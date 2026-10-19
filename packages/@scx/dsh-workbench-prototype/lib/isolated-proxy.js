import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createMesProxyHandler, ERP_PROXY_BRIDGE_PATH, erpProxyBridgeScript, getSiteProxyPath, publicBasePath } from './mes-proxy.js';
const BOOTSTRAP_PATH = '/__scx_mes_workbench/__bootstrap';
const BOOTSTRAP_TTL_MS = 30_000;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_BOOTSTRAPS = 32;
function cookieValue(header, name) {
    if (!header)
        return undefined;
    for (const segment of header.split(';')) {
        const equals = segment.indexOf('=');
        if (equals > 0 && segment.slice(0, equals).trim() === name)
            return segment.slice(equals + 1).trim();
    }
}
function sameOriginRequest(req) {
    const host = req.headers.host;
    if (!host)
        return false;
    const origin = req.headers.origin;
    if (origin) {
        try {
            return new URL(origin).host.toLowerCase() === host.toLowerCase();
        }
        catch {
            return false;
        }
    }
    return req.method === 'GET' || req.method === 'HEAD';
}
function send(res, status, message) {
    const body = JSON.stringify({ error: message });
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
    res.end(body);
}
/**
 * Serves ERP pages on a separate loopback port. The DSH page mints a one-use
 * bootstrap ticket after authenticating the browser; the ERP origin exchanges
 * it for a short-lived HttpOnly proxy cookie before loading any ERP content.
 */
export function createIsolatedMesProxy(readSiteUrl) {
    const bootstraps = new Map();
    const sessions = new Map();
    const secret = randomBytes(32);
    const server = createServer();
    let port = 0;
    let ready;
    const sessionCookieName = (sitePath) => `dsh_erp_proxy_${sitePath.split('/').at(-1)}_auth`;
    const sessionSignature = (token, session) => createHmac('sha256', secret)
        .update(`${token}\n${session.sitePath}\n${session.parentOrigin}\n${session.isolatedOrigin}\n${session.expiresAt}`)
        .digest('base64url');
    const proxyHandler = createMesProxyHandler(readSiteUrl, { injectProxyBridge: true, frameAncestor: (req) => {
            const sitePath = getSiteProxyPath(readSiteUrl());
            if (!sitePath)
                return undefined;
            const cookie = cookieValue(req.headers.cookie, sessionCookieName(sitePath));
            if (!cookie)
                return undefined;
            const [token, signature] = cookie.split('.');
            const session = token ? sessions.get(token) : undefined;
            if (!session || session.sitePath !== sitePath || session.expiresAt <= Date.now() || !signature)
                return undefined;
            const expected = sessionSignature(token, session);
            const actualBytes = Buffer.from(signature);
            const expectedBytes = Buffer.from(expected);
            if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes))
                return undefined;
            return session.parentOrigin;
        } });
    server.on('request', (req, res) => {
        void (async () => {
            if (!sameOriginRequest(req))
                return send(res, 403, '拒绝跨站请求');
            const requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
            const sitePath = getSiteProxyPath(readSiteUrl());
            if (!sitePath)
                return send(res, 503, '请先保存有效的 ERP/MES 网站地址');
            if (requestUrl.pathname === BOOTSTRAP_PATH) {
                if (req.method !== 'GET')
                    return send(res, 405, '仅支持 GET');
                const ticket = requestUrl.searchParams.get('ticket') || '';
                const bootstrap = bootstraps.get(ticket);
                bootstraps.delete(ticket);
                if (!bootstrap || bootstrap.expiresAt <= Date.now() || bootstrap.sitePath !== sitePath || `http://${req.headers.host}` !== bootstrap.isolatedOrigin)
                    return send(res, 403, '工作台认证已失效，请刷新后重试');
                const token = randomBytes(32).toString('base64url');
                const session = { ...bootstrap, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 };
                sessions.set(token, session);
                const signature = sessionSignature(token, session);
                // ERP pages often navigate with window.location.href = '/Home/Main'.
                // The session cookie must reach that first root request so we can send
                // it back through the site-scoped proxy path before forwarding anything.
                const cookie = `${sessionCookieName(sitePath)}=${token}.${signature}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Strict`;
                const destination = `${session.isolatedOrigin}${publicBasePath(readSiteUrl())}/`;
                res.writeHead(303, {
                    location: destination,
                    'set-cookie': cookie,
                    'referrer-policy': 'no-referrer',
                    'cache-control': 'no-store',
                });
                res.end();
                return;
            }
            const cookieName = sessionCookieName(sitePath);
            const cookie = cookieValue(req.headers.cookie, cookieName);
            const token = cookie?.split('.')[0];
            const session = token ? sessions.get(token) : undefined;
            if (!session || session.sitePath !== sitePath || session.expiresAt <= Date.now() || `http://${req.headers.host}` !== session.isolatedOrigin)
                return send(res, 401, '工作台页面未认证，请刷新后重试');
            const signature = cookie.slice(token.length + 1);
            const expected = sessionSignature(token, session);
            const actualBytes = Buffer.from(signature);
            const expectedBytes = Buffer.from(expected);
            if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes))
                return send(res, 401, '工作台页面未认证，请刷新后重试');
            // A root-relative ERP navigation leaves the proxy mount path. Redirect
            // only authenticated safe navigations back under this site's isolated route.
            if (requestUrl.pathname !== sitePath && !requestUrl.pathname.startsWith(`${sitePath}/`)) {
                if (req.method !== 'GET' && req.method !== 'HEAD')
                    return send(res, 403, '拒绝代理路径外的写入请求');
                res.writeHead(303, {
                    location: `${session.isolatedOrigin}${publicBasePath(readSiteUrl())}${requestUrl.pathname}${requestUrl.search}`,
                    'referrer-policy': 'no-referrer',
                    'cache-control': 'no-store',
                });
                res.end();
                return;
            }
            const bridgePath = `${publicBasePath(readSiteUrl())}/${ERP_PROXY_BRIDGE_PATH}`;
            if (requestUrl.pathname === bridgePath) {
                if (req.method !== 'GET')
                    return send(res, 405, '仅支持 GET');
                res.writeHead(200, {
                    'content-type': 'application/javascript; charset=utf-8',
                    'cache-control': 'no-store',
                    'x-content-type-options': 'nosniff',
                    'content-length': Buffer.byteLength(erpProxyBridgeScript),
                });
                res.end(erpProxyBridgeScript);
                return;
            }
            await proxyHandler(req, res);
        })().catch(() => send(res, 500, 'ERP/MES 代理请求失败'));
    });
    const start = () => {
        if (ready)
            return ready;
        ready = new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                const address = server.address();
                if (!address || typeof address === 'string')
                    return reject(new Error('无法读取本地代理端口'));
                port = address.port;
                resolve(`http://127.0.0.1:${port}`);
            });
        });
        return ready;
    };
    const createBootstrapUrl = async (siteUrl, parentOrigin) => {
        const sitePath = getSiteProxyPath(siteUrl);
        if (!sitePath)
            return undefined;
        let parent;
        try {
            parent = new URL(parentOrigin);
        }
        catch {
            return undefined;
        }
        if (parent.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parent.hostname))
            return undefined;
        await start();
        const isolatedOrigin = `${parent.protocol}//${parent.hostname}:${port}`;
        const now = Date.now();
        for (const [ticket, value] of bootstraps)
            if (value.expiresAt <= now)
                bootstraps.delete(ticket);
        for (const [token, value] of sessions)
            if (value.expiresAt <= now)
                sessions.delete(token);
        if (bootstraps.size >= MAX_BOOTSTRAPS)
            return undefined;
        const ticket = randomBytes(32).toString('base64url');
        bootstraps.set(ticket, { sitePath, parentOrigin: parent.origin, isolatedOrigin, expiresAt: now + BOOTSTRAP_TTL_MS });
        return `${isolatedOrigin}${BOOTSTRAP_PATH}?ticket=${ticket}`;
    };
    const close = async () => {
        bootstraps.clear();
        sessions.clear();
        secret.fill(0);
        if (ready)
            await ready.catch(() => undefined);
        if (!server.listening)
            return;
        await new Promise((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
        });
    };
    return { start, createBootstrapUrl, close };
}
export const isolatedBootstrapPath = BOOTSTRAP_PATH;
//# sourceMappingURL=isolated-proxy.js.map