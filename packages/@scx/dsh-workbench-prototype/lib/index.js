import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { createMesProxyHandler, isSameOriginRequest, MES_PROXY_PATH, readConfigString, resolveUpstreamTarget } from './mes-proxy.js';
import { createIsolatedMesProxy, isolatedBootstrapPath } from './isolated-proxy.js';
import { SqlReader } from './sql-reader.js';
export const Config = z.object({
    siteUrl: z.string().default('http://121.40.84.3:4175/scx').volatile(),
    systemName: z.string().default('AI 智能平台系统').volatile(),
    apiOperations: z.string().default('[]').volatile(),
    sqlDialect: z.string().default('sqlserver').volatile(),
    sqlHost: z.string().default('').volatile(),
    sqlPort: z.string().default('1433').volatile(),
    sqlDatabase: z.string().default('').volatile(),
    sqlUsername: z.string().default('').volatile(),
    sqlSsl: z.string().default('true').volatile(),
});
export const name = '@scx/dsh-workbench-prototype';
export const inject = ['webServer', 'tools', 'connection'];
const API_BRIDGE_PATH = '/__scx_erp_workbench_api';
const SQL_BRIDGE_PATH = '/__scx_erp_workbench_sql';
const EMPLOYEE_PERMISSION_PATH = '/__scx_current_employee_permissions__';
const PAGE_INSPECT_PATH = '/__scx_erp_page_inspect__';
const PAGE_ACTION_PATH = '/__scx_erp_page_action__';
const MAX_RESULT_BYTES = 1024 * 1024;
function readOperations(value) {
    const raw = readConfigString(value) || '[]';
    if (Buffer.byteLength(raw) > 64 * 1024)
        return [];
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed) || parsed.length > 30)
        return [];
    const valid = parsed.filter((item) => {
        if (!item || typeof item !== 'object')
            return false;
        if (Object.keys(item).some((key) => !['id', 'description', 'path', 'parameters'].includes(key)))
            return false;
        const operation = item;
        return typeof operation.id === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(operation.id)
            && typeof operation.description === 'string' && operation.description.length <= 160 && !/[\x00-\x1f\x7f]/.test(operation.description)
            && typeof operation.path === 'string' && operation.path.length <= 300 && operation.path.startsWith('/') && !operation.path.startsWith('//')
            && !/[\x00-\x20\x7f?#\\]/.test(operation.path) && !/%(?:2e|2f|5c)/i.test(operation.path)
            && !operation.path.split('/').some((part) => { try {
                return ['.', '..'].includes(decodeURIComponent(part));
            }
            catch {
                return true;
            } })
            && Array.isArray(operation.parameters) && operation.parameters.length <= 20
            && operation.parameters.every((parameter) => parameter && typeof parameter === 'object'
                && Object.keys(parameter).every((key) => ['name', 'type', 'required'].includes(key))
                && /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(parameter.name) && ['string', 'number', 'boolean'].includes(parameter.type)
                && parameter.name.toLowerCase() !== 'tk'
                && (parameter.required === undefined || typeof parameter.required === 'boolean'));
    });
    return valid.length === parsed.length && new Set(valid.map((item) => item.id)).size === valid.length
        && valid.every((operation) => new Set(operation.parameters.map((item) => item.name)).size === operation.parameters.length) ? valid : [];
}
function isValidOperationsJson(value) {
    if (typeof value !== 'string' || Buffer.byteLength(value) > 64 * 1024)
        return false;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length <= 30 && readOperations(value).length === parsed.length;
    }
    catch {
        return false;
    }
}
function removeSensitiveFields(value, depth = 0) {
    if (depth > 40)
        throw new Error('ERP 返回数据嵌套过深，已拒绝传给 AI');
    if (Array.isArray(value)) {
        if (value.length > 10_000)
            throw new Error('ERP 返回数组过大，已拒绝传给 AI');
        return value.map((item) => removeSensitiveFields(item, depth + 1));
    }
    if (!value || typeof value !== 'object')
        return value;
    const entries = Object.entries(value);
    if (entries.length > 10_000)
        throw new Error('ERP 返回字段过多，已拒绝传给 AI');
    return Object.fromEntries(entries
        .filter(([key]) => !/(?:password|passwd|pwd|token|secret|authorization|cookie|^tk$)/i.test(key))
        .map(([key, item]) => [key, removeSensitiveFields(item, depth + 1)]));
}
function safeJson(value) {
    const encoded = JSON.stringify(removeSensitiveFields(value));
    if (!encoded || Buffer.byteLength(encoded) > MAX_RESULT_BYTES)
        throw new Error('ERP 返回内容超过 1 MB，已拒绝传给 AI');
    return JSON.parse(encoded);
}
function normalizeWorkbenchSiteUrl(value) {
    if (typeof value !== 'string')
        return undefined;
    try {
        const url = new URL(value.trim());
        if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash)
            return undefined;
        return url.toString();
    }
    catch {
        return undefined;
    }
}
function isAllowedReadProxyRequest(siteUrl, rawUrl, method, rawOperations) {
    if (method !== 'GET')
        return false;
    const target = resolveUpstreamTarget(siteUrl, rawUrl);
    if (!target)
        return false;
    let base;
    let request;
    try {
        base = new URL(siteUrl);
        request = new URL(rawUrl, 'http://dsh.local');
    }
    catch {
        return false;
    }
    const mountPath = base.pathname.replace(/\/+$/, '');
    const operation = readOperations(rawOperations).find((item) => target.pathname === `${mountPath}${item.path}`);
    if (!operation)
        return false;
    const allowed = new Map(operation.parameters.map((parameter) => [parameter.name, parameter]));
    const seen = new Set();
    for (const [key, value] of request.searchParams) {
        const parameter = allowed.get(key);
        if (!parameter || seen.has(key))
            return false;
        seen.add(key);
        if (parameter.type === 'string' && value.length > 200)
            return false;
        if (parameter.type === 'number' && (!value.trim() || !Number.isFinite(Number(value))))
            return false;
        if (parameter.type === 'boolean' && value !== 'true' && value !== 'false')
            return false;
    }
    return operation.parameters.every((parameter) => !parameter.required || seen.has(parameter.name));
}
export function apply(ctx, config) {
    ctx.inject(['webServer', 'tools', 'connection'], (hostCtx) => applyInjected(hostCtx, config));
}
function applyInjected(ctx, config) {
    let runtimeSiteUrl = readConfigString(config.siteUrl);
    let runtimeApiOperations = readConfigString(config.apiOperations) || '[]';
    const sqlReader = new SqlReader();
    const jobs = new Map();
    const queues = new Map();
    const pollWaiters = new Map();
    const finishJob = (job, result, failed = false) => {
        clearTimeout(job.timer);
        jobs.delete(job.id);
        const queue = queues.get(job.sessionId);
        if (queue) {
            const index = queue.indexOf(job.id);
            if (index >= 0)
                queue.splice(index, 1);
            if (!queue.length)
                queues.delete(job.sessionId);
        }
        if (failed)
            job.reject(new Error(String(result)));
        else
            job.resolve(result);
    };
    const enqueueJob = (sessionId, operation, parameters, signal) => new Promise((resolve, reject) => {
        const queue = queues.get(sessionId) ?? [];
        if (queue.length >= 16)
            throw new Error('当前会话 API 请求过多，请稍后重试');
        const id = randomUUID();
        const job = { id, sessionId, operation, parameters, resolve, reject, timer: setTimeout(() => finishJob(job, '等待 ERP 登录页面超时，请确认工作台已打开并登录', true), 40_000) };
        jobs.set(id, job);
        queue.push(id);
        queues.set(sessionId, queue);
        for (const wake of [...(pollWaiters.get(sessionId) ?? [])])
            wake();
        pollWaiters.delete(sessionId);
        signal.addEventListener('abort', () => finishJob(job, '请求已取消', true), { once: true });
    });
    const dispatchApiRequest = async (endpoint, payload, signal) => {
        if (!payload || typeof payload !== 'object')
            return { ok: false, error: { code: 'invalid_request', message: '请求格式无效' } };
        const request = payload;
        if (endpoint === 'configure') {
            if (Object.keys(request).some((key) => !['siteUrl', 'apiOperations'].includes(key)))
                return { ok: false, error: { code: 'invalid_request', message: '设置格式无效' } };
            const siteUrl = normalizeWorkbenchSiteUrl(request.siteUrl);
            if (!siteUrl)
                return { ok: false, error: { code: 'invalid_request', message: '网站地址无效' } };
            if (request.apiOperations !== undefined && !isValidOperationsJson(request.apiOperations))
                return { ok: false, error: { code: 'invalid_request', message: '只读 API 配置无效' } };
            runtimeSiteUrl = siteUrl;
            if (typeof request.apiOperations === 'string')
                runtimeApiOperations = request.apiOperations;
            return { ok: true, value: true };
        }
        if (endpoint === 'poll') {
            if (typeof request.sessionId !== 'string' || request.sessionId.length > 200)
                return { ok: false, error: { code: 'invalid_request', message: '会话无效' } };
            const sessionId = request.sessionId;
            const take = () => {
                const queue = queues.get(sessionId);
                const id = queue?.shift();
                if (queue && !queue.length)
                    queues.delete(sessionId);
                return id ? jobs.get(id) : undefined;
            };
            let job = take();
            if (!job && !signal.aborted)
                await new Promise((resolve) => {
                    const waiters = pollWaiters.get(sessionId) ?? [];
                    const wake = () => {
                        clearTimeout(timeout);
                        signal.removeEventListener('abort', wake);
                        const current = pollWaiters.get(sessionId);
                        if (current) {
                            const index = current.indexOf(wake);
                            if (index >= 0)
                                current.splice(index, 1);
                            if (!current.length)
                                pollWaiters.delete(sessionId);
                        }
                        resolve();
                    };
                    const timeout = setTimeout(wake, 1500);
                    signal.addEventListener('abort', wake, { once: true });
                    waiters.push(wake);
                    pollWaiters.set(sessionId, waiters);
                });
            if (!job)
                job = take();
            return { ok: true, value: job ? { requestId: job.id, path: job.operation.path, parameters: job.parameters } : null };
        }
        if (endpoint === 'complete') {
            const job = typeof request.requestId === 'string' ? jobs.get(request.requestId) : undefined;
            if (!job || request.sessionId !== job.sessionId) {
                return { ok: false, error: { code: 'not_found', message: '请求已过期或会话不匹配' } };
            }
            try {
                if (request.error)
                    finishJob(job, 'ERP 请求失败或未登录', true);
                else
                    finishJob(job, safeJson(request.data));
                return { ok: true, value: true };
            }
            catch (error) {
                finishJob(job, error instanceof Error ? error.message : 'ERP 返回数据无效', true);
                return { ok: false, error: { code: 'invalid_result', message: 'ERP 返回数据无效或过大' } };
            }
        }
        return { ok: false, error: { code: 'not_found', message: '接口不存在' } };
    };
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: API_BRIDGE_PATH,
        handler: async (req, res) => {
            const admission = ctx.connection.admit({ headers: req.headers });
            if ('rejection' in admission) {
                const body = JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'DSH 请求未通过认证' } });
                res.writeHead(admission.rejection, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(body);
                return;
            }
            if (req.method !== 'POST') {
                res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                res.end(JSON.stringify({ ok: false, error: { code: 'method_not_allowed', message: '仅支持 POST' } }));
                return;
            }
            const endpoint = req.url?.slice(API_BRIDGE_PATH.length).replace(/^\//, '').split(/[?#]/, 1)[0] || '';
            if (endpoint !== 'poll' && endpoint !== 'complete' && endpoint !== 'configure') {
                res.writeHead(404, { 'cache-control': 'no-store' });
                res.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: '接口不存在' } }));
                return;
            }
            const chunks = [];
            let size = 0;
            try {
                for await (const chunk of req) {
                    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    size += bytes.length;
                    if (size > MAX_RESULT_BYTES + 64 * 1024)
                        throw new Error('request too large');
                    chunks.push(bytes);
                }
                const payload = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
                const controller = new AbortController();
                res.once('close', () => { if (!res.writableEnded)
                    controller.abort(); });
                const result = await dispatchApiRequest(endpoint, payload, controller.signal);
                const body = JSON.stringify(result);
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                res.end(body);
            }
            catch {
                if (res.headersSent || res.destroyed)
                    return;
                const body = JSON.stringify({ ok: false, error: { code: 'invalid_request', message: '请求格式无效或内容过大' } });
                res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                res.end(body);
            }
        },
    }), `${name}: authenticated employee-session API bridge`);
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: SQL_BRIDGE_PATH,
        handler: async (req, res) => {
            const admission = ctx.connection.admit({ headers: req.headers });
            const origin = req.headers.origin;
            if ('rejection' in admission || !origin || !req.headers.host || !isSameOriginRequest(origin, req.headers.host)) {
                res.writeHead('rejection' in admission ? admission.rejection : 403, { 'cache-control': 'no-store', 'content-length': '0' });
                res.end();
                return;
            }
            const endpoint = new URL(req.url || '/', 'http://dsh.local').pathname.slice(SQL_BRIDGE_PATH.length).replace(/^\//, '');
            if (endpoint === 'status' && req.method === 'GET') {
                const connected = sqlReader.isConnected();
                const body = JSON.stringify({ ok: true, connected });
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                res.end(body);
                return;
            }
            if (req.method !== 'POST' || !['connect', 'disconnect'].includes(endpoint)) {
                res.writeHead(405, { allow: 'GET, POST', 'cache-control': 'no-store', 'content-length': '0' });
                res.end();
                return;
            }
            try {
                const chunks = [];
                let size = 0;
                for await (const chunk of req) {
                    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    size += part.length;
                    if (size > 16 * 1024)
                        throw new Error('request too large');
                    chunks.push(part);
                }
                if (endpoint === 'disconnect')
                    await sqlReader.disconnect();
                else {
                    const input = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
                    const result = await sqlReader.connect({
                        dialect: input.dialect,
                        host: input.host,
                        port: Number(input.port),
                        database: input.database,
                        username: input.username,
                        password: input.password,
                        ssl: input.ssl,
                    });
                    const body = JSON.stringify({ ok: true, ...result });
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                    res.end(body);
                    return;
                }
                const body = JSON.stringify({ ok: true });
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                res.end(body);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'SQL 连接失败';
                const body = JSON.stringify({ ok: false, error: message });
                res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
                res.end(body);
            }
        },
    }), `${name}: authenticated SQL read-only connection bridge`);
    ctx.effect(() => () => { void sqlReader.disconnect(); }, `${name}: SQL connection cleanup`);
    ctx.effect(() => {
        const disposeSchema = ctx.tools.register(defineTool({
            name: 'erp_sql_schema',
            description: '读取已连接 ERP/MES 数据库中当前 SQL 账号可见的表和字段结构。仅查看结构，不会修改数据。',
            parameters: {},
            output: { schema: { type: 'object', additionalProperties: false, properties: { data: { type: 'string', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            timeoutMs: 30_000,
            async execute() { return { data: JSON.stringify(await sqlReader.listTables()) }; },
        }));
        const disposeRead = ctx.tools.register(defineTool({
            name: 'erp_sql_read_table',
            description: '从已连接的 ERP/MES 数据库读取指定表的少量样例数据。只能读取当前 SQL 账号有权读取的表，每次最多 100 行；不能执行 SQL 语句或写入数据。',
            parameters: {
                table: { type: 'string', required: true, description: 'erp_sql_schema 返回的完整表名' },
                limit: { type: 'number', description: '最多读取行数，默认 20，上限 100' },
            },
            output: { schema: { type: 'object', additionalProperties: false, properties: { data: { type: 'string', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            timeoutMs: 30_000,
            async execute(args) {
                const input = args && typeof args === 'object' ? args : {};
                return { data: JSON.stringify(await sqlReader.readTable(input.table, input.limit)) };
            },
        }));
        return () => { disposeRead(); disposeSchema(); };
    }, `${name}: read-only SQL tools`);
    ctx.effect(() => {
        const dispose = ctx.tools.register(defineTool({
            name: 'erp_read',
            description: '读取企业 ERP/MES 中当前员工有权限查看的只读数据。只能使用已配置的操作和参数；需要在当前 DSH 会话的 ERP 工作台完成员工登录。',
            parameters: { operation: { type: 'string', required: true, description: '已配置的 API 操作编号' }, parameters: { type: 'object', additionalProperties: true, description: '该操作允许的查询参数' } },
            output: { schema: { type: 'object', additionalProperties: false, properties: { data: { type: 'string', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            timeoutMs: 45_000,
            async execute(args, exec) {
                const sessionId = exec.agent?.id;
                if (!sessionId)
                    throw new Error('无法确认当前 DSH 会话，请从工作台会话中重试');
                const input = args;
                const operations = readOperations(runtimeApiOperations);
                const operation = operations.find((item) => item.id === input.operation);
                if (!operation) {
                    const available = operations.map((item) => `${item.id}（${item.description}）`).join('、');
                    throw new Error(available ? `该 API 操作未配置。可用操作：${available}` : '未配置有效的 ERP/MES 只读 API 操作，请联系涛哥设置');
                }
                const given = input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters) ? input.parameters : {};
                const parameters = {};
                for (const key of Object.keys(given))
                    if (!operation.parameters.some((item) => item.name === key))
                        throw new Error(`不允许的查询参数：${key}`);
                for (const spec of operation.parameters) {
                    const value = given[spec.name];
                    if (value === undefined && spec.required)
                        throw new Error(`缺少必填参数：${spec.name}`);
                    if (value !== undefined) {
                        if (typeof value !== spec.type || (typeof value === 'string' && value.length > 200))
                            throw new Error(`参数格式错误：${spec.name}`);
                        parameters[spec.name] = value;
                    }
                }
                const data = await enqueueJob(sessionId, operation, parameters, exec.signal);
                const serialized = JSON.stringify(data);
                if (Buffer.byteLength(serialized) > MAX_RESULT_BYTES)
                    throw new Error('ERP 返回内容超过 1 MB，已拒绝传给 AI');
                return { data: serialized };
            },
        }));
        const disposePermissions = ctx.tools.register(defineTool({
            name: 'erp_current_user_permissions',
            description: '读取当前嵌入 ERP 员工账号可见的菜单模块，用于确认当前账号的模块范围。菜单可见性不代表每个数据接口都授权，查询仍由 ERP 服务端再次校验。',
            parameters: {},
            output: { schema: { type: 'object', additionalProperties: false, properties: { menus: { type: 'array', items: { type: 'string' }, required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            timeoutMs: 45_000,
            async execute(_args, exec) {
                const sessionId = exec.agent?.id;
                if (!sessionId)
                    throw new Error('无法确认当前 DSH 会话，请从工作台会话中重试');
                const operation = { id: 'current_permissions', description: '当前员工菜单权限', path: EMPLOYEE_PERMISSION_PATH, parameters: [] };
                const data = await enqueueJob(sessionId, operation, {}, exec.signal);
                if (!data || typeof data !== 'object' || !Array.isArray(data.menus))
                    throw new Error('ERP 当前员工权限返回格式无效');
                return { menus: data.menus };
            },
        }));
        const disposeWebpage = ctx.tools.register(defineTool({
            name: 'erp_webpage',
            description: '通用 ERP/MES 网页工具，直接使用当前嵌入工作台的员工登录状态。先用 action=inspect 查看当前页面；再用 click 点击可见菜单/按钮，fill 填写查询框，select 选择下拉项。同名菜单可用“父菜单 > 子菜单”限定，例如“生产管理 > 明细记录”。无需为每个菜单配置 API；ERP 服务端仍按当前员工权限拦截。只有用户明确要求时才执行保存、提交、删除等会改数据的操作。',
            parameters: {
                action: { type: 'string', required: true, description: 'inspect、click、fill 或 select' },
                target: { type: 'string', description: '网页上显示的控件名称；同名菜单用“父菜单 > 子菜单”限定，如“生产管理 > 明细记录”' },
                value: { type: 'string', description: 'fill 的文字或 select 的下拉项显示文字' },
            },
            output: { schema: { type: 'object', additionalProperties: false, properties: { data: { type: 'string', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            timeoutMs: 60_000,
            async execute(args, exec) {
                const sessionId = exec.agent?.id;
                if (!sessionId)
                    throw new Error('无法确认当前 DSH 会话，请从工作台会话中重试');
                const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
                const allowedKeys = input.action === 'inspect' ? ['action'] : input.action === 'click' ? ['action', 'target'] : ['action', 'target', 'value'];
                if (Object.keys(input).some((key) => !allowedKeys.includes(key)))
                    throw new Error('网页操作参数无效；不接受额外指令');
                let action;
                if (input.action === 'inspect' && input.target === undefined && input.value === undefined)
                    action = { action: 'inspect' };
                else if (input.action === 'click' && typeof input.target === 'string' && input.target.trim() && input.target.trim().length <= 120 && !/[\x00-\x1f\x7f]/.test(input.target) && input.value === undefined)
                    action = { action: 'click', target: input.target.trim() };
                else if ((input.action === 'fill' || input.action === 'select') && typeof input.target === 'string' && input.target.trim() && input.target.trim().length <= 120 && !/[\x00-\x1f\x7f]/.test(input.target) && typeof input.value === 'string' && input.value.length <= 2000 && !/\x00/.test(input.value))
                    action = { action: input.action, target: input.target.trim(), value: input.value };
                else
                    throw new Error('网页操作参数无效；请提供 inspect，或带控件名称的 click/fill/select');
                const operation = { id: 'erp_webpage', description: '当前员工登录态网页操作', path: action.action === 'inspect' ? PAGE_INSPECT_PATH : PAGE_ACTION_PATH, parameters: [] };
                const parameters = action.action === 'inspect' ? {} : action.action === 'click' ? { action: action.action, target: action.target } : { action: action.action, target: action.target, value: action.value };
                const data = await enqueueJob(sessionId, operation, parameters, exec.signal);
                const serialized = JSON.stringify(data);
                if (Buffer.byteLength(serialized) > MAX_RESULT_BYTES)
                    throw new Error('ERP 页面内容超过 1 MB，已拒绝传给 AI');
                return { data: serialized };
            },
        }));
        return () => { dispose(); disposePermissions(); disposeWebpage(); };
    }, `${name}: employee-session ERP read tools`);
    const readSiteUrl = () => runtimeSiteUrl;
    const isolated = createIsolatedMesProxy(readSiteUrl);
    const apiProxy = createMesProxyHandler(readSiteUrl);
    ctx.effect(() => {
        return () => { void isolated.close(); };
    }, `${name}: isolated ERP/MES website origin`);
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: MES_PROXY_PATH,
        handler: async (req, res) => {
            const requestPath = new URL(req.url || '/', 'http://dsh.local').pathname;
            const admission = ctx.connection.admit(req);
            if ('rejection' in admission) {
                res.writeHead(admission.rejection, { 'cache-control': 'no-store', 'content-length': '0' });
                res.end();
                return;
            }
            if (requestPath !== isolatedBootstrapPath) {
                if (!isAllowedReadProxyRequest(readSiteUrl(), req.url || '/', req.method || '', runtimeApiOperations)) {
                    res.writeHead(403, { 'cache-control': 'no-store', 'content-length': '0' });
                    res.end();
                    return;
                }
                return apiProxy(req, res);
            }
            if (req.method !== 'GET') {
                res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                res.end();
                return;
            }
            const host = req.headers.host;
            if (!host) {
                res.writeHead(400, { 'cache-control': 'no-store' });
                res.end();
                return;
            }
            const encrypted = Boolean(req.socket.encrypted);
            const parentOrigin = `${encrypted ? 'https' : 'http'}://${host}`;
            let bootstrapUrl;
            try {
                bootstrapUrl = await isolated.createBootstrapUrl(readSiteUrl(), parentOrigin);
            }
            catch { /* the loopback listener is unavailable */ }
            if (!bootstrapUrl) {
                res.writeHead(503, { 'cache-control': 'no-store', 'content-length': '0' });
                res.end();
                return;
            }
            res.writeHead(303, { location: bootstrapUrl, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-length': '0' });
            res.end();
        },
    }), `${name}: authenticated ERP/MES proxy entry`);
}
//# sourceMappingURL=index.js.map