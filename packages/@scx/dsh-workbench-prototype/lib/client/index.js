/**
 * DSH workbench UI. The MES web page is an iframe; database reads are exposed
 * by the Host half through DSH tools and use provider-managed credentials.
 */
import React from 'react';
const R = React;
const h = R.createElement;
export const inject = ['slots', '@deepseek-ai/dsh-api-remotes'];
const PANEL_ID = '@scx/dsh-workbench-prototype';
const CHAT_PANEL_ID = 'conversation';
const DEFAULT_SITE_URL = 'http://192.168.3.188:4173/';
const SITE_URL_KEY = 'scx.mesWorkbench.siteUrl';
const MCP_URL_KEY = 'scx.mesWorkbench.mcpUrl';
const DB_FORM_KEY = 'scx.mesWorkbench.sqlConfig';
const SQL_REFS = [
    'SCX_MES_SQL_SERVER',
    'SCX_MES_SQL_PORT',
    'SCX_MES_SQL_DATABASE',
    'SCX_MES_SQL_USER',
    'SCX_MES_SQL_PASSWORD',
];
const CSS = `
.scxwb-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#f5f7fb);color:var(--dsw-alias-label-primary,#172033);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
.scxwb-top{box-sizing:border-box;flex:none;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#e6eaf0);background:var(--dsw-alias-bg-layer-1,#fff)}
.scxwb-brand{display:flex;align-items:center;gap:11px;min-width:0}
.scxwb-mark{width:34px;height:34px;flex:none;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#3978f6,#54b5e7);font-size:16px;font-weight:800}
.scxwb-title{font-size:14px;font-weight:700;line-height:1.35}
.scxwb-subtitle{margin-top:2px;color:var(--dsw-alias-label-secondary,#7b8497);font-size:10px}
.scxwb-actions{display:flex;align-items:center;gap:8px;flex:none}
.scxwb-badge{padding:5px 8px;border:1px solid #f4e3c4;border-radius:999px;background:#fff7e9;color:#9a620b;font-size:10px;font-weight:700;white-space:nowrap}
.scxwb-chat,.scxwb-button{border:0;border-radius:8px;background:var(--dsw-alias-brand-primary,#3978f6);color:#fff;padding:8px 12px;font:inherit;font-size:11px;font-weight:650;white-space:nowrap;cursor:pointer}
.scxwb-button.secondary{border:1px solid #d9dfeb;background:#fff;color:#344054}
.scxwb-chat:hover,.scxwb-button:hover{filter:brightness(.96)}
.scxwb-note{box-sizing:border-box;flex:none;padding:6px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e6eaf0);background:var(--dsw-alias-bg-layer-2,#f7f8fb);color:var(--dsw-alias-label-secondary,#7b8497);font-size:10px;line-height:1.5;overflow-wrap:anywhere}
.scxwb-frame-wrap{position:relative;flex:1;min-height:0;background:var(--dsw-alias-bg-base,#f5f7fb)}
.scxwb-frame{display:block;width:100%;height:100%;border:0;background:#fff}
.scxwb-settings-wrap{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:18px;background:var(--dsw-alias-bg-base,#f5f7fb)}
.scxwb-settings{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.scxwb-card{padding:16px;border:1px solid var(--dsw-alias-border-l1,#e6eaf0);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 1px 3px rgba(16,24,40,.04)}
.scxwb-card h3{margin:0 0 6px;font-size:13px}
.scxwb-help{margin:0 0 12px;color:var(--dsw-alias-label-secondary,#667085);font-size:11px;line-height:1.55}
.scxwb-warning{padding:9px 11px;border:1px solid #f1d7a9;border-radius:8px;background:#fff8e8;color:#805b16;font-size:11px;line-height:1.5}
.scxwb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.scxwb-field{display:flex;flex-direction:column;gap:5px;min-width:0;color:#475467;font-size:11px}
.scxwb-field input{box-sizing:border-box;width:100%;min-height:34px;padding:7px 9px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#172033;font:inherit;font-size:12px;outline:none}
.scxwb-field input:focus{border-color:#3978f6;box-shadow:0 0 0 2px rgba(57,120,246,.12)}
.scxwb-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:12px}
.scxwb-status{min-height:16px;margin-top:9px;color:#475467;font-size:11px;line-height:1.45}
.scxwb-status.error{color:#b42318}
.scxwb-status.success{color:#067647}
.scxwb-credential-status{margin-top:8px;color:#667085;font-size:10px}
.scxwb-summary{padding:8px 0;color:#475467;font-size:12px}
@media(max-width:600px){.scxwb-top{padding:8px 10px;gap:8px}.scxwb-subtitle,.scxwb-badge{display:none}.scxwb-chat,.scxwb-button{padding:8px 9px}.scxwb-grid{grid-template-columns:1fr}.scxwb-settings-wrap{padding:10px}}
`;
function insertStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
}
function isLayoutService(value) {
    return typeof value === 'object' && value !== null && 'selectPanel' in value && typeof value.selectPanel === 'function';
}
function getCredentialRemote(value) {
    if (typeof value !== 'object' || value === null || !('credentials' in value))
        return undefined;
    const credentials = value.credentials;
    if (!credentials || typeof credentials.describe !== 'function' || typeof credentials.set !== 'function' || typeof credentials.unset !== 'function')
        return undefined;
    return credentials;
}
function readStoredSiteUrl() {
    try {
        const stored = localStorage.getItem(SITE_URL_KEY);
        return stored ? normalizeHttpUrl(stored) || DEFAULT_SITE_URL : DEFAULT_SITE_URL;
    }
    catch {
        return DEFAULT_SITE_URL;
    }
}
function readStoredMcpUrl() {
    try {
        return localStorage.getItem(MCP_URL_KEY) || '';
    }
    catch {
        return '';
    }
}
function readSqlForm() {
    const empty = { server: '', port: '1433', database: '', user: '' };
    try {
        const raw = localStorage.getItem(DB_FORM_KEY);
        if (!raw)
            return empty;
        const parsed = JSON.parse(raw);
        return {
            server: typeof parsed.server === 'string' ? parsed.server : '',
            port: typeof parsed.port === 'string' ? parsed.port : '1433',
            database: typeof parsed.database === 'string' ? parsed.database : '',
            user: typeof parsed.user === 'string' ? parsed.user : '',
        };
    }
    catch {
        return empty;
    }
}
function normalizeHttpUrl(value) {
    try {
        const parsed = new URL(value.trim());
        if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username || parsed.password)
            return undefined;
        return parsed.toString();
    }
    catch {
        return undefined;
    }
}
function SettingsForm(props) {
    const [siteUrl, setSiteUrl] = R.useState(readStoredSiteUrl);
    const [mcpUrl, setMcpUrl] = R.useState(readStoredMcpUrl);
    const [sql, setSql] = R.useState(readSqlForm);
    const [password, setPassword] = R.useState('');
    const [message, setMessage] = R.useState('');
    const [messageKind, setMessageKind] = R.useState('');
    const [credentialStatus, setCredentialStatus] = R.useState('正在检查凭据状态…');
    const refreshCredentialStatus = () => {
        if (!props.credentials) {
            setCredentialStatus('DSH Credentials Remote 不可用；SQL 凭据尚未配置。');
            return;
        }
        void props.credentials.describe(SQL_REFS).then((info) => {
            const configured = SQL_REFS.filter((ref) => info[ref]?.configured).length;
            const readOnly = SQL_REFS.some((ref) => info[ref]?.configured && !info[ref]?.writable);
            setCredentialStatus(`SQL 凭据 ${configured}/${SQL_REFS.length} 项已配置${readOnly ? '；至少一项由只读来源提供' : ''}。值不会回传到页面。`);
        }).catch(() => setCredentialStatus('无法读取凭据状态；请检查 DSH Credentials provider。'));
    };
    R.useEffect(() => { refreshCredentialStatus(); }, [props.credentials]);
    const setStatus = (text, kind) => {
        setMessage(text);
        setMessageKind(kind);
    };
    const saveSiteUrl = () => {
        const normalized = normalizeHttpUrl(siteUrl);
        if (!normalized)
            return setStatus('请输入有效的 http:// 或 https:// 网站地址。', 'error');
        try {
            localStorage.setItem(SITE_URL_KEY, normalized);
            setSiteUrl(normalized);
            props.onSiteUrlSaved?.(normalized);
            setStatus('MES 网站地址已保存在此浏览器。', 'success');
        }
        catch {
            setStatus('无法保存网站地址，请检查浏览器本地存储权限。', 'error');
        }
    };
    const saveMcpUrl = () => {
        const raw = mcpUrl.trim();
        if (raw && !normalizeHttpUrl(raw))
            return setStatus('MCP 地址需为有效的 http:// 或 https:// URL。', 'error');
        try {
            localStorage.setItem(MCP_URL_KEY, raw ? normalizeHttpUrl(raw) : '');
            setStatus('MCP 地址草稿已保存在此浏览器；此操作不会建立连接。', 'success');
        }
        catch {
            setStatus('无法保存 MCP 地址草稿。', 'error');
        }
    };
    const saveSql = () => {
        if (!props.credentials)
            return setStatus('当前 DSH 会话没有 Credentials Remote，未保存 SQL 凭据。', 'error');
        const portNumber = Number(sql.port);
        if (!sql.server.trim() || !sql.database.trim() || !sql.user.trim() || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
            return setStatus('请填写服务器、数据库、用户名和 1–65535 范围内的端口。', 'error');
        }
        try {
            localStorage.setItem(DB_FORM_KEY, JSON.stringify({ ...sql, server: sql.server.trim(), database: sql.database.trim(), user: sql.user.trim(), port: String(portNumber) }));
        }
        catch {
            return setStatus('无法保存非敏感连接信息到此浏览器。', 'error');
        }
        const values = [
            [SQL_REFS[0], sql.server.trim()],
            [SQL_REFS[1], String(portNumber)],
            [SQL_REFS[2], sql.database.trim()],
            [SQL_REFS[3], sql.user.trim()],
        ];
        if (password)
            values.push([SQL_REFS[4], password]);
        void Promise.all(values.map(([ref, value]) => props.credentials?.set(ref, value))).then(() => {
            setPassword('');
            setStatus(password ? 'SQL 连接信息与密码已交给 DSH Credentials provider。' : 'SQL 连接信息已保存；未输入密码，因此现有密码（如有）未更改。', 'success');
            refreshCredentialStatus();
        }).catch(() => setStatus('保存失败；请检查 Credentials provider 是否已挂载且可写。', 'error'));
    };
    const clearSql = () => {
        if (!props.credentials)
            return setStatus('当前 DSH 会话没有 Credentials Remote。', 'error');
        if (!window.confirm('将从 DSH Credentials provider 移除这组 MES SQL 凭据。此操作不会修改数据库。继续吗？'))
            return;
        void Promise.all(SQL_REFS.map((ref) => props.credentials?.unset(ref))).then(() => {
            setSql({ server: '', port: '1433', database: '', user: '' });
            setPassword('');
            try {
                localStorage.removeItem(DB_FORM_KEY);
            }
            catch { /* no-op */ }
            setStatus('已移除本机保存的 SQL 凭据；数据库未被修改。', 'success');
            refreshCredentialStatus();
        }).catch(() => setStatus('清除失败；请检查 Credentials provider。', 'error'));
    };
    if (props.view === 'summary')
        return h('div', { className: 'scxwb-summary' }, 'MES 网站、只读 SQL 与 MCP 地址设置');
    return h('div', { className: 'scxwb-settings' }, h('section', { className: 'scxwb-card' }, h('h3', null, 'MES 网站'), h('p', { className: 'scxwb-help' }, '网页地址仅保存于当前浏览器；页面通过 iframe 打开，登录、SSO、Cookie 与站点嵌入策略仍由 MES 网站决定。'), h('label', { className: 'scxwb-field' }, '网站 URL', h('input', { type: 'url', value: siteUrl, placeholder: 'https://mes.example.com/', onChange: (event) => setSiteUrl(event.currentTarget.value) })), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', onClick: saveSiteUrl }, '保存网站地址'))), h('section', { className: 'scxwb-card' }, h('h3', null, 'SQL Server（只读账号）'), h('p', { className: 'scxwb-help' }, '每位员工应使用各自的 SQL 登录，并由 SQL Server 仅授予必要的只读权限。插件每次查询重新解析凭据，不缓存密码；页面不能读回已保存的值。'), h('div', { className: 'scxwb-warning' }, '安全提示：凭据由当前 DSH Credentials provider 管理，但其本机静态加密状态尚未核实。请只用测试只读账号，确认存储保护后再配置生产凭据。'), h('div', { className: 'scxwb-grid', style: { marginTop: '12px' } }, h('label', { className: 'scxwb-field' }, 'SQL Server 主机名', h('input', { value: sql.server, placeholder: 'sql.example.com', onChange: (event) => setSql({ ...sql, server: event.currentTarget.value }) })), h('label', { className: 'scxwb-field' }, '端口', h('input', { inputMode: 'numeric', value: sql.port, onChange: (event) => setSql({ ...sql, port: event.currentTarget.value }) })), h('label', { className: 'scxwb-field' }, '数据库', h('input', { value: sql.database, onChange: (event) => setSql({ ...sql, database: event.currentTarget.value }) })), h('label', { className: 'scxwb-field' }, '只读 SQL 用户名', h('input', { autoComplete: 'username', value: sql.user, onChange: (event) => setSql({ ...sql, user: event.currentTarget.value }) })), h('label', { className: 'scxwb-field' }, 'SQL 密码（留空则不更改）', h('input', { type: 'password', autoComplete: 'new-password', value: password, onChange: (event) => setPassword(event.currentTarget.value) }))), h('div', { className: 'scxwb-credential-status' }, credentialStatus), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', onClick: saveSql }, '保存 SQL 凭据'), h('button', { className: 'scxwb-button secondary', type: 'button', onClick: clearSql }, '清除本机凭据'))), h('section', { className: 'scxwb-card' }, h('h3', null, 'MCP 服务地址（草稿）'), h('p', { className: 'scxwb-help' }, '此处只保存地址，不会自动建立 MCP 连接。待企业 MCP endpoint、OIDC/JWT 校验与管理 provisioning contract 明确后，再通过 DSH 内置 MCP Client 完成连接配置。'), h('label', { className: 'scxwb-field' }, 'MCP HTTP URL', h('input', { type: 'url', value: mcpUrl, placeholder: 'https://mcp.example.com/mcp', onChange: (event) => setMcpUrl(event.currentTarget.value) })), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button secondary', type: 'button', onClick: saveMcpUrl }, '保存 MCP 地址草稿'))), message ? h('div', { className: `scxwb-status ${messageKind}` }, message) : null);
}
function DashboardPanel(props) {
    const openChat = typeof props.onOpenChat === 'function' ? props.onOpenChat : () => undefined;
    const credentials = props.credentials;
    const [siteUrl, setSiteUrl] = R.useState(readStoredSiteUrl);
    const [showSettings, setShowSettings] = R.useState(false);
    R.useEffect(() => { setSiteUrl(readStoredSiteUrl()); }, []);
    return h('section', { className: 'scxwb-root', 'aria-label': '企业业务工作台' }, h('header', { className: 'scxwb-top' }, h('div', { className: 'scxwb-brand' }, h('div', { className: 'scxwb-mark', 'aria-hidden': 'true' }, 'W'), h('div', null, h('div', { className: 'scxwb-title' }, '企业业务系统'), h('div', { className: 'scxwb-subtitle' }, '通过 DSH 工作台访问内网业务网站'))), h('div', { className: 'scxwb-actions' }, h('span', { className: 'scxwb-badge' }, '只读连接'), h('button', { className: 'scxwb-button secondary', type: 'button', onClick: () => setShowSettings(!showSettings) }, showSettings ? '返回网站' : '连接设置'), h('button', { className: 'scxwb-chat', type: 'button', onClick: openChat }, '打开 DSH 对话'))), showSettings
        ? h('div', { className: 'scxwb-settings-wrap' }, h(SettingsForm, { credentials, onSiteUrlSaved: setSiteUrl }))
        : h(R.Fragment, null, h('div', { className: 'scxwb-note' }, '当前网站：', siteUrl, ' · 若页面拒绝嵌入，请检查 X-Frame-Options / CSP frame-ancestors；若登录过期，请验证 iframe 内 SSO/Cookie。'), h('div', { className: 'scxwb-frame-wrap' }, h('iframe', {
            className: 'scxwb-frame', src: siteUrl, title: '企业内网业务系统', loading: 'eager',
            referrerPolicy: 'strict-origin-when-cross-origin',
        }))));
}
function PluginConfigPage(props) {
    return h(SettingsForm, { credentials: props.credentials, view: props.view });
}
function PanelIcon(props) {
    const size = typeof props.size === 'number' ? props.size : 18;
    return h('svg', {
        'data-dsh-panel-entry': PANEL_ID,
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
    }, h('rect', { x: 3.5, y: 4, width: 17, height: 16, rx: 3 }), h('path', { d: 'M3.5 9h17M9 9v11M13 13h4M13 16h4' }));
}
export function apply(ctx) {
    const credentials = getCredentialRemote(ctx.get('remote'));
    ctx.effect(() => {
        const removeStyles = insertStyles(CSS);
        const stopMain = ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
            inject: () => ({
                credentials,
                onOpenChat: () => {
                    const layout = ctx.get('layout');
                    if (isLayoutService(layout))
                        layout.selectPanel(CHAT_PANEL_ID);
                },
            }),
        }, DashboardPanel));
        const stopConfig = ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: PANEL_ID }, PluginConfigPage));
        const stopIcon = ctx.slots.inject('sidebar.panellist', () => {
            const dispose = ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 12, label: () => '业务工作台' }, PanelIcon);
            const layout = ctx.get('layout');
            if (isLayoutService(layout))
                layout.selectPanel(PANEL_ID);
            return dispose;
        });
        return () => {
            stopIcon();
            stopConfig();
            stopMain();
            removeStyles();
        };
    }, `${PANEL_ID}: panel and settings`);
}
//# sourceMappingURL=index.js.map