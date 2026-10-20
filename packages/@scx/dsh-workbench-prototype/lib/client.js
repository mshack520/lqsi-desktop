window.__ModuleLoader__.load({ id: "@scx/dsh-workbench-prototype", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
/**
 * LQ SI workbench UI with a configurable, employee-session read-only API bridge.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.parseEnterpriseProfileConfig = parseEnterpriseProfileConfig;
exports.appendApiOperationJson = appendApiOperationJson;
exports.getSiteProxyPath = getSiteProxyPath;
exports.shouldAttachEnterpriseWebsite = shouldAttachEnterpriseWebsite;
exports.isWorkbenchPanelActive = isWorkbenchPanelActive;
exports.apply = apply;
const react_1 = __importDefault(require("react"));
const R = react_1.default;
const h = R.createElement;
// inject 等待的是运行时服务名；对应的插件包由 package.json 的 dsh.client.inject 加载。
exports.inject = ['desktopWorkbenches', 'configForms', 'locale', 'sessions'];
const NS = 'scx.erpMesWorkbench';
const zh = {
    overviewTab: '业务总览', websiteTab: '企业网页', overviewEyebrow: '统一业务工作台', overviewTitle: '让企业数据与 AI 协作', overviewDescription: '从 ERP、MES 到库存、客户与协同系统，按企业授权连接数据，再用自然语言查询和整理结果。', overviewConnectionTitle: '当前连接', overviewConfigured: '系统地址已保存', overviewNotConfigured: '尚未配置企业系统', overviewUrlHelp: '可继续使用原有企业网页登录方式；官方只读 API 或数据库连接可在连接设置中配置。', overviewOpenWebsite: '打开企业网页', overviewConfigure: '连接设置', overviewMethodsTitle: '灵活接入方式', overviewMethodsHelp: '不同企业系统能力不同，按官方支持方式接入。网页连接会沿用原有登录与会话。', methodWebsite: '企业网页', methodWebsiteHelp: '嵌入原系统页面，沿用员工网页登录权限。', methodApi: '官方只读 API', methodApiHelp: '按官方接口文档配置查询操作，适合结构化数据。', methodDatabase: '只读数据库', methodDatabaseHelp: '使用专用只读账号查看获准的表结构与样例。', methodMcp: 'MCP / 系统连接器', methodMcpHelp: '预留扩展方式；此版本只保存 MCP 地址草稿，尚未建立连接。', overviewSystemsTitle: '常见企业系统类型', overviewSystemsHelp: '这里列出常见系统场景；能否读取数据取决于系统开放接口和企业授权。', overviewErp: '企业资源计划', overviewMes: '制造执行', overviewWms: '仓储管理', overviewCrm: '客户关系', overviewOa: '办公协同', overviewNoMetrics: '当前没有真实业务数据接入。本页先展示工作台布局；连接系统并验证接口后，再依据实际查询结果呈现指标。',
    panel: '业务工作台', settings: '连接设置', back: '返回网站', openChat: '打开 DSH 对话', badge: 'AI 业务工作台',
    chatStartHint: '点击下方快捷按钮即可开始与 AI 对话。', promptSending: '正在发送…', promptSent: '已发送到 AI 对话', promptSendFailed: '发送失败：请确认工作台会话和模型已就绪。',
    shipmentEntry: '登记发货', readCurrentPage: '读当前页',
    webStatus: '网页状态', webLoading: '正在加载', webReady: '网页已打开', webCovered: '应用弹窗暂时隐藏网页', webFailed: '网页加载失败', webIdle: '等待连接', reload: '刷新网页', inspectPage: '读取当前页', quickPrompts: 'AI 快捷提问', pageSummary: '页面摘要',
    assistantTitle: '智能操作', assistantHelp: '选择查询或录入动作，复制后交给左侧 AI 对话处理。', quickTab: '快捷查询', shipmentTab: '发货录入', pageTab: 'AI 读页面',
    todayReport: '今日报工', todayReportHelp: '按型号汇总今天的良品报工数量。', currentInventory: '当前库存', currentInventoryHelp: '查看各仓库和工序节点的库存。', todayShipments: '今日发货', todayShipmentsHelp: '列出今天发货记录，包含型号和数量。',
    pageReadHelp: '读取当前 MES 网页标题、地址和可见内容，再让 AI 按页面信息回答。', shipmentPrompt: '复制发货请求到 AI', shipmentModelPlaceholder: '型号，如 E93-01', shipmentQuantityPlaceholder: '数量',
    pageReadFailed: '读取失败：请先确认网页已加载且员工已登录。', pageActionFailed: '没有打开该页面；请确认已登录及当前账号有权访问。', promptCopied: '问题已复制，请粘贴到左侧 AI 对话发送。', promptCopyFailed: '无法自动复制，请在左侧对话输入这句话：',
    openWebsite: '打开企业系统', openWebsiteHelp: '企业系统直接嵌入此工作台。登录和网页操作权限由 ERP/MES 控制。', openWebsiteFailed: 'DSH 无法嵌入此网址，请检查连接设置。', embeddedUnavailable: '请在 LQ SI 桌面版中打开企业网页。',
    defaultName: 'AI 智能平台系统', browserError: 'DSH 配置不可写，且浏览器本地存储失败；网站地址未保存。',
    formUnavailable: 'DSH Config 表单当前不可用', profileReadOnly: 'DSH profile 配置当前不可写', saveRejected: 'DSH 未接受配置更改；请刷新后重试。',
    noUrl: '尚未配置企业系统地址', invalidUrl: 'URL 格式无效或含不支持的查询参数/片段，请检查连接设置。',
    systemCard: 'AI 智能平台系统',
    websiteUrl: '网站 URL', systemName: '系统名称', systemPlaceholder: '例如：企业 ERP/MES', saveSettings: '保存系统设置', saving: '正在保存…',
    invalidWebsite: '请输入有效的 http:// 或 https:// 网站地址（不含查询参数、片段或账号密码）。',
    savedProfile: 'ERP/MES 地址和系统名称已保存到当前 DSH profile。', saveFailed: '保存失败；DSH 配置可能已变化，请刷新表单后重试。',
    browserOnly: '已仅保存到当前浏览器，未写入 DSH profile。', sqlTitle: '只读 SQL 连接',
    mesAccountTitle: 'AI 业务连接账号', mesAccountHelp: 'AI 查询和发货通过 MES 固定接口执行，并按此账号的权限记录操作人。账号密码保存在 DSH 安全凭据中；会话过期后自动重新登录。',
    mesBaseUrl: 'MES 系统地址', mesUsername: 'MES 登录账号', mesPassword: 'MES 登录密码', mesPasswordHint: '保存后密码不会再次显示。修改或重新验证连接时需要重新输入。',
    mesPageLoginHint: '保存 MES 账号后，返回网站会自动登录；注销账号会清除网页登录状态并返回未登录页面。',
    mesNotConfigured: '尚未连接 AI 业务接口', mesConfigured: 'AI 业务接口已保存', mesSaving: '正在验证并保存…', mesSave: '验证并保存账号', mesSaved: 'MES 连接成功', mesLogout: '注销账号', mesLoggingOut: '正在注销…', mesLoggedOut: '账号已注销，网站已退出登录。', mesLogoutFailed: '注销失败，请重试。', mesLoadFailed: '无法读取 MES 连接设置。', mesSaveFailed: 'MES 登录或连接失败。', mesPasswordRequired: '请输入 MES 登录密码后再保存。', mesReadOnly: 'DSH 安全凭据当前不可写。',
    mesAutoLoginSaveFailed: 'MES 账号已保存，但自动登录凭据未能安全保存，请重试。',
    runtimeSyncFailed: '当前 DSH 服务未同步，网址暂时无法打开；请刷新后重试。',
    sqlHelp: '填写企业数据库连接信息后，DSH 会自动读取此 SQL 账号可见的表和字段。这里要填数据库服务器地址和 SQL 端口，不是 MES 网页地址或网页端口（例如 8063）。密码只保存在本次 DSH 运行的内存中，关闭并重开 DSH 后需要重新输入。请使用数据库管理员创建的只读账号。此连接按 SQL 账号权限读取，尚不会自动继承 ERP 网页员工角色。',
    sqlDialect: '数据库类型', sqlServer: 'SQL Server', mysql: 'MySQL', postgres: 'PostgreSQL', sqlHost: '数据库地址', sqlPort: '端口', sqlDatabase: '数据库名称', sqlUsername: '只读账号', sqlPassword: '密码（仅本次运行）', sqlSsl: '使用加密连接', sqlConnect: '测试并连接', sqlDisconnect: '断开连接', sqlConnecting: '正在连接…', sqlConnected: '连接成功；当前账号可见 {count} 张表。可在 DSH 对话里查看结构。', sqlNotConnected: '尚未连接', sqlStatusConnected: '已连接（密码仅在本次运行中有效）', sqlConfigSaved: '连接成功；非密码设置已保存，密码不会保存。', sqlConfigFailed: '连接失败，请检查数据库地址、端口、库名、账号密码和网络。', sqlReadonlyNotice: 'AI 只能查看表结构和最多 100 行样例，不能运行自定义 SQL 或写入数据。', apiTitle: '高级：官方只读 API（可选）',
    sqlDisabled: '配置企业官方只读 API。AI 只能调用下方列出的操作和参数；ERP 服务端仍须按当前登录员工检查每次请求权限。此接入要求 API 使用当前网页登录态；独立令牌、服务账号或 localStorage 登录需要单独适配。',
    apiOperations: 'API 操作 JSON', apiOperationsHelp: '每项包含 id、description、path 和 parameters。例如：[{"id":"orders","description":"查询订单","path":"/api/orders","parameters":[{"name":"from","type":"string","required":true}]}]。仅支持 GET，不要填写账号、密码或令牌。',
    quickAddOperation: '表单添加只读操作', quickAddHelp: '根据 ERP 官方 API 文档填写接口路径和参数。保存前会检查格式；接口是否只读、是否按员工权限过滤，仍需由企业确认。',
    operationId: '操作编号', operationIdPlaceholder: '例如 orders', operationDescription: '用途说明', operationDescriptionPlaceholder: '例如 查询当前员工可见订单', operationPath: '官方 GET 接口路径', operationPathPlaceholder: '例如 /api/orders',
    parametersTitle: '查询参数（可选）', parameterName: '参数名', parameterType: '类型', parameterRequired: '必填', addParameter: '添加参数', removeParameter: '删除', appendOperation: '加入配置 JSON', operationAdded: '操作已加入下方 JSON；检查无误后点击“保存 API 操作”。', parameterInvalid: '请填写有效且不重复的参数名；最多 20 个参数。',
    saveApiOperations: '保存 API 操作', apiOperationsSaved: 'API 操作已保存到本机并同步到当前工作台。', apiOperationsInvalid: '请输入有效的 JSON 数组；每项需填写操作编号、说明、以 / 开头的接口路径和参数列表。',
    configFileTitle: '企业配置文件', configFileHelp: '可导入企业配置或导出当前设置，便于部署到多台员工电脑。文件不包含员工账号、密码或令牌。', importConfig: '导入配置 JSON', exportConfig: '导出当前配置', configFileInvalid: '配置文件无效。请使用本插件导出的 JSON，并检查网址及只读接口定义。', configImported: '企业配置已保存到本机并同步到当前工作台。',
    mcpTitle: 'MCP 服务地址（草稿）', mcpHelp: '当前只保存地址，不会建立连接。完成企业身份校验和授权配置后再接入。',
    mcpUrl: 'MCP HTTP URL', saveMcp: '保存 MCP 地址草稿', mcpSaved: 'MCP 地址草稿已保存在此浏览器；此操作不会建立连接。',
    mcpInvalid: 'MCP 地址需为有效的 http:// 或 https:// URL。', mcpFailed: '无法保存 MCP 地址草稿。', summary: '企业系统网址与连接设置',
};
const en = {
    overviewTab: 'Overview', websiteTab: 'Enterprise website', overviewEyebrow: 'ENTERPRISE WORKSPACE', overviewTitle: 'Bring enterprise data and AI together', overviewDescription: 'Connect ERP, MES, inventory, customer, and collaboration systems through their supported, authorized interfaces, then ask questions in natural language.', overviewConnectionTitle: 'Current connection', overviewConfigured: 'System address saved', overviewNotConfigured: 'No enterprise system configured', overviewUrlHelp: 'Keep using the existing enterprise website sign-in. Configure official read-only APIs or a database in Connection settings.', overviewOpenWebsite: 'Open enterprise website', overviewConfigure: 'Connection settings', overviewMethodsTitle: 'Flexible connection methods', overviewMethodsHelp: 'Systems differ; use their supported integration method. Website connections keep the existing employee sign-in and session.', methodWebsite: 'Enterprise website', methodWebsiteHelp: 'Embed the existing system and use its employee access.', methodApi: 'Official read-only API', methodApiHelp: 'Configure documented query operations for structured data.', methodDatabase: 'Read-only database', methodDatabaseHelp: 'Use a dedicated read-only account for approved schema and samples.', methodMcp: 'MCP / system connector', methodMcpHelp: 'Reserved for future connectors; this version only saves an MCP URL draft and does not connect.', overviewSystemsTitle: 'Common enterprise system types', overviewSystemsHelp: 'These are common system categories. Data access depends on available interfaces and company authorization.', overviewErp: 'Enterprise resource planning', overviewMes: 'Manufacturing execution', overviewWms: 'Warehouse management', overviewCrm: 'Customer relationship', overviewOa: 'Office collaboration', overviewNoMetrics: 'No live business data is connected yet. This page previews the workspace layout; metrics can be shown after a system connection and its interface are verified.',
    panel: 'Business Workbench', settings: 'Connection settings', back: 'Back to system', openChat: 'Open DSH chat', badge: 'AI Workbench',
    chatStartHint: 'Choose a shortcut below to start chatting with AI.', promptSending: 'Sending…', promptSent: 'Sent to the AI conversation', promptSendFailed: 'Could not send. Check that the workbench session and model are ready.',
    shipmentEntry: 'Record shipment', readCurrentPage: 'Read current page',
    webStatus: 'Page status', webLoading: 'Loading', webReady: 'Page open', webCovered: 'Hidden behind an app popup', webFailed: 'Page load failed', webIdle: 'Waiting for connection', reload: 'Reload page', inspectPage: 'Read current page', quickPrompts: 'AI quick prompts', pageSummary: 'Page summary',
    assistantTitle: 'AI actions', assistantHelp: 'Choose a query or entry action, then send it to the DSH chat on the left.', quickTab: 'Quick queries', shipmentTab: 'Shipment entry', pageTab: 'Read page',
    todayReport: 'Today’s production', todayReportHelp: 'Summarize today’s accepted production by model.', currentInventory: 'Current inventory', currentInventoryHelp: 'Review stock by warehouse and process stage.', todayShipments: 'Today’s shipments', todayShipmentsHelp: 'List today’s shipments with model and quantity.',
    pageReadHelp: 'Read the current MES page title, address, and visible content for the AI to use.', shipmentPrompt: 'Copy shipment request to AI', shipmentModelPlaceholder: 'Model, e.g. E93-01', shipmentQuantityPlaceholder: 'Quantity',
    pageReadFailed: 'Could not read the page. Check that it loaded and an employee is signed in.', pageActionFailed: 'Could not open this page. Check sign-in and account permissions.', promptCopied: 'Prompt copied. Paste it into the AI chat on the left.', promptCopyFailed: 'Could not copy automatically. Enter this in the AI chat on the left:',
    openWebsite: 'Open enterprise system', openWebsiteHelp: 'The enterprise system is embedded in this workbench. ERP/MES controls sign-in and page permissions.', openWebsiteFailed: 'DSH could not embed this website. Check the connection settings.', embeddedUnavailable: 'Open the enterprise website in the DSH desktop app.',
    defaultName: 'AI Platform System', browserError: 'DSH settings are read-only and browser storage failed; the website URL was not saved.',
    formUnavailable: 'The DSH config form is unavailable', profileReadOnly: 'The DSH profile is read-only', saveRejected: 'DSH did not accept the settings change. Reload and try again.',
    noUrl: 'No enterprise system URL configured', invalidUrl: 'The URL is invalid or contains an unsupported query or fragment. Check connection settings.',
    systemCard: 'AI intelligent platform',
    websiteUrl: 'Website URL', systemName: 'System name', systemPlaceholder: 'For example: Company ERP/MES', saveSettings: 'Save system settings', saving: 'Saving…',
    invalidWebsite: 'Enter a valid http:// or https:// website URL without a query, fragment, or embedded credentials.',
    savedProfile: 'The ERP/MES URL and system name were saved to this DSH profile.', saveFailed: 'Save failed. DSH settings may have changed; reload the form and try again.',
    browserOnly: 'Saved in this browser only; it was not written to the DSH profile.', sqlTitle: 'Read-only SQL connection',
    mesAccountTitle: 'AI business account', mesAccountHelp: 'AI queries and shipment entries use fixed MES APIs and this account’s permissions. Credentials are stored in DSH secure credentials; expired sessions are renewed automatically.',
    mesBaseUrl: 'MES system address', mesUsername: 'MES account', mesPassword: 'MES password', mesPasswordHint: 'The password is not shown after saving. Enter it again to change or revalidate the connection.',
    mesPageLoginHint: 'After saving the MES account, returning to the website signs in automatically. Logging out clears the website session and returns to the signed-out page.',
    mesNotConfigured: 'AI business API is not connected', mesConfigured: 'AI business API credentials are saved', mesSaving: 'Validating and saving…', mesSave: 'Validate and save account', mesSaved: 'MES connected', mesLogout: 'Log out account', mesLoggingOut: 'Logging out…', mesLoggedOut: 'Account logged out and website session cleared.', mesLogoutFailed: 'Could not log out. Please retry.', mesLoadFailed: 'Could not load MES connection settings.', mesSaveFailed: 'MES login or connection failed.', mesPasswordRequired: 'Enter the MES password before saving.', mesReadOnly: 'DSH secure credentials are read-only.',
    mesAutoLoginSaveFailed: 'MES account was saved, but auto-login credentials could not be stored securely. Please retry.',
    runtimeSyncFailed: 'The current DSH service did not sync the address. Reload and try again.',
    sqlHelp: 'Enter the database connection details and DSH will read tables and columns visible to this SQL account. Enter the database server host and SQL port, not the MES website URL or its web port (for example, 8063). The password stays in memory for this DSH run; enter it again after restarting DSH. Use a read-only database account. This connection follows SQL account permissions and does not yet inherit the ERP web employee role.',
    sqlDialect: 'Database type', sqlServer: 'SQL Server', mysql: 'MySQL', postgres: 'PostgreSQL', sqlHost: 'Database host', sqlPort: 'Port', sqlDatabase: 'Database name', sqlUsername: 'Read-only account', sqlPassword: 'Password (this run only)', sqlSsl: 'Use encrypted connection', sqlConnect: 'Test and connect', sqlDisconnect: 'Disconnect', sqlConnecting: 'Connecting…', sqlConnected: 'Connected; {count} tables are visible. You can inspect their structure in DSH chat.', sqlNotConnected: 'Not connected', sqlStatusConnected: 'Connected (password held in memory for this run only)', sqlConfigSaved: 'Connected; non-secret settings were saved. The password was not saved.', sqlConfigFailed: 'Connection failed. Check the host, port, database, account, password, and network.', sqlReadonlyNotice: 'AI can inspect table structure and read up to 100 sample rows; it cannot run custom SQL or write data.', apiTitle: 'Advanced: official read-only API (optional)',
    sqlDisabled: 'Configure official read-only ERP APIs. AI can call only the operations and parameters listed below; the ERP server must still check the signed-in employee on every request. The API must use the current browser session; separate tokens, service accounts, or localStorage-based login need a dedicated adapter.',
    apiOperations: 'API operations JSON', apiOperationsHelp: 'Each item has id, description, path and parameters. Example: [{"id":"orders","description":"List orders","path":"/api/orders","parameters":[{"name":"from","type":"string","required":true}]}]. GET only. Do not enter passwords, accounts or tokens.',
    quickAddOperation: 'Add a read-only operation with a form', quickAddHelp: 'Use the official ERP API documentation to enter the path and parameters. Format is checked before saving; the company must still verify that the API is read-only and applies employee permissions.',
    operationId: 'Operation ID', operationIdPlaceholder: 'For example, orders', operationDescription: 'Description', operationDescriptionPlaceholder: 'For example, orders visible to the signed-in employee', operationPath: 'Official GET API path', operationPathPlaceholder: 'For example, /api/orders',
    parametersTitle: 'Query parameters (optional)', parameterName: 'Parameter name', parameterType: 'Type', parameterRequired: 'Required', addParameter: 'Add parameter', removeParameter: 'Remove', appendOperation: 'Add to configuration JSON', operationAdded: 'Operation added to the JSON below. Review it, then select “Save API operations”.', parameterInvalid: 'Enter valid, unique parameter names; up to 20 parameters are allowed.',
    saveApiOperations: 'Save API operations', apiOperationsSaved: 'API operations saved locally and synced to the current workbench.', apiOperationsInvalid: 'Enter a valid JSON array with operation id, description, a path starting with /, and parameters.',
    configFileTitle: 'Enterprise configuration file', configFileHelp: 'Import a company configuration or export current settings for deployment to employee computers. Files never include employee accounts, passwords, or tokens.', importConfig: 'Import configuration JSON', exportConfig: 'Export current configuration', configFileInvalid: 'The configuration file is invalid. Use JSON exported by this plugin and check the URL and read-only API definitions.', configImported: 'Enterprise configuration saved locally and synced to the current workbench.',
    mcpTitle: 'MCP service URL (draft)', mcpHelp: 'This only saves the URL; it does not connect. Configure enterprise identity and authorization before connecting.',
    mcpUrl: 'MCP HTTP URL', saveMcp: 'Save MCP URL draft', mcpSaved: 'MCP URL draft saved in this browser; no connection was made.',
    mcpInvalid: 'Enter a valid http:// or https:// MCP URL.', mcpFailed: 'Could not save the MCP URL draft.', summary: 'Enterprise system URL and connection settings',
};
const CONFIG_NAMESPACE_ID = 'scx-mes-workbench';
const MES_PROXY_PATH = '/__scx_mes_workbench';
const ERP_BRIDGE_PATH = '/__scx_erp_workbench_api';
const EMPLOYEE_PERMISSION_PATH = '/__scx_current_employee_permissions__';
const PAGE_INSPECT_PATH = '/__scx_erp_page_inspect__';
const PAGE_ACTION_PATH = '/__scx_erp_page_action__';
const SQL_BRIDGE_PATH = '/__scx_erp_workbench_sql';
const LEGACY_SITE_URL_KEY = 'scx.mesWorkbench.siteUrl';
const LEGACY_API_OPERATIONS_KEY = 'scx.mesWorkbench.apiOperations';
const LEGACY_SYSTEM_NAME_KEY = 'scx.mesWorkbench.systemName';
const MCP_URL_KEY = 'scx.mesWorkbench.mcpUrl';
const WEB_COLUMN_WIDTH_KEY = 'scx.mesWorkbench.webColumnWidth';
const CSS = `
.scxwb-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;container-type:inline-size;container-name:scxwb}
.scxwb-top{box-sizing:border-box;flex:none;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.scxwb-brand{display:flex;align-items:center;gap:11px;min-width:0}
.scxwb-mark{width:34px;height:34px;flex:none;border-radius:10px;display:grid;place-items:center;color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-brand-primary);font-size:16px;font-weight:800}
.scxwb-title{font-size:15px;font-weight:700;line-height:1.35}
.scxwb-subtitle{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px}
.scxwb-actions{display:flex;align-items:center;gap:8px;flex:none}
.scxwb-badge{padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;font-weight:700;white-space:nowrap}
.scxwb-root button.scxwb-chat,.scxwb-settings button.scxwb-button{appearance:none;border:1px solid transparent;border-radius:8px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);padding:8px 12px;font:inherit;font-size:12px;font-weight:650;white-space:nowrap;cursor:pointer}
.scxwb-root button.scxwb-button.secondary,.scxwb-settings button.scxwb-button.secondary{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.scxwb-root button.scxwb-chat:hover:not(:disabled),.scxwb-settings button.scxwb-button:not(.secondary):hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill))}
.scxwb-root button:focus-visible,.scxwb-settings button:focus-visible,.scxwb-field input:focus-visible,.scxwb-field textarea:focus-visible,.scxwb-field select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.scxwb-root button:disabled,.scxwb-settings button:disabled{cursor:wait;opacity:.65}
.scxwb-status.warning{color:var(--dsw-alias-state-business-primary)}
.scxwb-note{box-sizing:border-box;flex:none;padding:6px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;overflow-wrap:anywhere}
.scxwb-toolbar{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:42px;padding:5px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.scxwb-view-tabs{display:flex;align-items:center;gap:4px;min-width:0}
.scxwb-view-tab{min-height:34px;padding:7px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
.scxwb-view-tab[aria-selected="true"]{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.scxwb-view-tab:focus-visible,.scxwb-overview button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.scxwb-overview{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:clamp(14px,2.4vw,28px);background:var(--dsw-alias-bg-base)}
.scxwb-web-column>[role="tabpanel"]{display:flex;flex:1;min-height:0;flex-direction:column}
.scxwb-overview-inner{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.scxwb-overview-hero{position:relative;overflow:hidden;padding:clamp(20px,3vw,34px);border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-layer-1)}
.scxwb-overview-eyebrow{margin:0 0 9px;color:var(--dsw-alias-state-business-primary);font-size:11px;font-weight:750;letter-spacing:.12em}
.scxwb-overview-title{max-width:680px;margin:0;color:var(--dsw-alias-label-primary);font-size:clamp(22px,3vw,34px);line-height:1.2;letter-spacing:-.025em}
.scxwb-overview-description{max-width:720px;margin:12px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}
.scxwb-overview-section{display:flex;flex-direction:column;gap:11px}
.scxwb-overview-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.scxwb-overview-section-head h3{margin:0;font-size:14px}
.scxwb-overview-section-head p{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
.scxwb-overview-connection{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:13px;background:var(--dsw-alias-bg-layer-1)}
.scxwb-overview-connection-copy{min-width:0}
.scxwb-overview-connection-title{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;font-weight:700}
.scxwb-overview-connection-meta{margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.scxwb-overview-actions{display:flex;flex:none;flex-wrap:wrap;gap:7px}
.scxwb-overview button{min-height:34px;padding:7px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;font-weight:650;cursor:pointer}
.scxwb-overview button.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.scxwb-overview button.primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill))}
.scxwb-overview button:hover{background:var(--dsw-alias-bg-layer-2)}
.scxwb-overview-methods,.scxwb-overview-systems{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.scxwb-overview-method,.scxwb-overview-system{min-width:0;padding:13px;border:1px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}
.scxwb-overview-method h4,.scxwb-overview-system h4{margin:0;font-size:12px;font-weight:700}
.scxwb-overview-method p,.scxwb-overview-system p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.55}
.scxwb-overview-no-metrics{padding:14px;border:1px dashed var(--dsw-alias-border-l2);border-radius:11px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.55}
.scxwb-web-status{display:flex;align-items:center;gap:7px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
.scxwb-status-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#98a2b3}.scxwb-status-dot.ready{background:#21a675}.scxwb-status-dot.loading{background:#e5a22c;animation:scxwb-pulse 1s ease-in-out infinite alternate}.scxwb-status-dot.error{background:#d94b4b}
.scxwb-toolbar-actions{display:flex;align-items:center;gap:6px;flex:none}
.scxwb-toolbar button{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:6px 9px;font:inherit;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer}
.scxwb-toolbar button:hover{background:var(--dsw-alias-bg-layer-2)}
.scxwb-workspace{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,65%) 7px minmax(340px,1fr);gap:0;flex:1;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.scxwb-web-column{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}
.scxwb-frame-wrap{position:relative;box-sizing:border-box;flex:1;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base)}
.scxwb-assistant{box-sizing:border-box;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.scxwb-divider{position:relative;z-index:1;width:7px;min-height:0;cursor:col-resize;touch-action:none;background:var(--dsw-alias-bg-layer-2)}
.scxwb-divider::after{position:absolute;top:0;bottom:0;left:3px;width:1px;background:var(--dsw-alias-border-l2);content:""}
.scxwb-divider:hover,.scxwb-divider:focus-visible,.scxwb-divider[data-dragging="true"]{background:var(--dsw-alias-state-business-primary)}
.scxwb-divider:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
.scxwb-chat{position:relative;display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
.scxwb-chat-empty{display:grid;flex:1;place-items:center;padding:20px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}
.scxwb-shortcuts{display:flex;flex:none;flex-wrap:wrap;gap:7px;padding:10px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.scxwb-shortcut{min-height:34px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;font-weight:650;white-space:nowrap;cursor:pointer}
.scxwb-shortcut:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-2)}
.scxwb-shortcut:disabled{cursor:wait;opacity:.65}
.scxwb-ai-status{flex:none;margin:0 10px 8px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;overflow-wrap:anywhere}
.scxwb-ai-status.error{color:var(--dsw-alias-state-error-primary)}
@keyframes scxwb-pulse{to{opacity:.42}}
.scxwb-frame-empty{height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;color:var(--dsw-alias-label-secondary);text-align:center;font-size:13px}
.scxwb-settings-wrap{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:18px;background:var(--dsw-alias-bg-base)}
.scxwb-settings{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.scxwb-card{padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.scxwb-card h3{margin:0 0 6px;font-size:14px}
.scxwb-help{margin:0 0 12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
.scxwb-warning{padding:9px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-business-primary);font-size:12px;line-height:1.5}
.scxwb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.scxwb-field{display:flex;flex-direction:column;gap:5px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.scxwb-field input{box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.scxwb-field select{box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.scxwb-param-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(110px,.8fr) auto auto;align-items:end;gap:8px;margin:8px 0}
.scxwb-param-required{display:flex;align-items:center;gap:5px;min-height:38px;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px}
.scxwb-field textarea.scxwb-json{box-sizing:border-box;width:100%;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}
.scxwb-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:12px}
.scxwb-status{min-height:18px;margin-top:9px;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.45}
.scxwb-status.error{color:var(--dsw-alias-state-error-primary)}
.scxwb-status.success{color:var(--dsw-alias-label-primary)}
.scxwb-credential-status{margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:12px}
.scxwb-summary{padding:8px 0;color:var(--dsw-alias-label-secondary);font-size:14px}
@container scxwb (max-width:760px){.scxwb-workspace{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(220px,1fr) minmax(260px,44%)}.scxwb-divider{display:none}.scxwb-web-column{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2)}.scxwb-assistant{border-left:0;border-top:1px solid var(--dsw-alias-border-l2)}.scxwb-shortcuts{gap:6px;padding:7px}.scxwb-shortcut{min-height:31px;padding:5px 8px}}
@container scxwb (max-width:620px){.scxwb-overview-methods,.scxwb-overview-systems{grid-template-columns:1fr}.scxwb-overview-connection{align-items:flex-start;flex-direction:column}.scxwb-overview-section-head{align-items:flex-start;flex-direction:column}}
@media(max-width:600px){.scxwb-top{padding:8px 10px;gap:8px}.scxwb-subtitle,.scxwb-badge{display:none}.scxwb-button{padding:8px 9px}.scxwb-grid{grid-template-columns:1fr}.scxwb-param-row{grid-template-columns:1fr 1fr}.scxwb-settings-wrap{padding:10px}}
`;
function insertStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
}
function shouldAttachEnterpriseWebsite({ view, showSettings, hasFrame, panelActive, hasUrl }) {
    return view === 'website' && !showSettings && hasFrame && panelActive && hasUrl;
}
function isWorkbenchPanelActive({ explicitActive, entryId, activeId, marketOpen }) {
    if (marketOpen === true)
        return false;
    if (typeof explicitActive === 'boolean')
        return explicitActive;
    return !!entryId && activeId === entryId;
}
function readLegacySiteUrl() {
    try {
        const stored = localStorage.getItem(LEGACY_SITE_URL_KEY);
        return stored ? normalizeHttpUrl(stored) || '' : '';
    }
    catch {
        return '';
    }
}
function readLegacySystemName() {
    try {
        const stored = localStorage.getItem(LEGACY_SYSTEM_NAME_KEY);
        const name = normalizeSystemName(stored || '');
        return !name || name === 'ERP/MES 工作台' || name === 'LQ SI MES' ? 'AI 智能平台系统' : name;
    }
    catch {
        return 'AI 智能平台系统';
    }
}
function readLegacyApiOperations() {
    try {
        const stored = localStorage.getItem(LEGACY_API_OPERATIONS_KEY);
        return stored && validApiOperations(stored) ? JSON.stringify(JSON.parse(stored)) : undefined;
    }
    catch {
        return undefined;
    }
}
function readConfiguredSiteUrl(snapshot) {
    const stored = snapshot?.value?.siteUrl;
    return typeof stored === 'string' ? normalizeHttpUrl(stored) || '' : '';
}
function readConfiguredSystemName(snapshot) {
    const stored = snapshot?.value?.systemName;
    if (typeof stored !== 'string')
        return '';
    const name = normalizeSystemName(stored);
    return !name || name === 'ERP/MES 工作台' || name === 'LQ SI MES' ? 'AI 智能平台系统' : name;
}
function readWebColumnWidth() {
    try {
        const value = Number(localStorage.getItem(WEB_COLUMN_WIDTH_KEY));
        if (Number.isFinite(value) && value >= 40 && value <= 76)
            return value;
    }
    catch { /* Keep the default ratio when local storage is unavailable. */ }
    return 65;
}
function getConfigForms(value) {
    if (typeof value !== 'object' || value === null || !('get' in value) || typeof value.get !== 'function')
        return undefined;
    return value;
}
function getConfigForm(value, entryId) {
    const forms = getConfigForms(value);
    if (!forms)
        return undefined;
    try {
        return forms.get(entryId);
    }
    catch {
        return undefined;
    }
}
function readFormSnapshot(props) {
    if (props.form)
        return props.form.state;
    try {
        return props.configStore?.getSnapshot();
    }
    catch {
        return undefined;
    }
}
function validApiOperations(value) {
    if (value.length > 64 * 1024)
        return false;
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return false;
    }
    if (!Array.isArray(parsed) || parsed.length > 30)
        return false;
    const valid = parsed.every((item) => {
        if (!item || typeof item !== 'object')
            return false;
        const operation = item;
        if (Object.keys(operation).some((key) => !['id', 'description', 'path', 'parameters'].includes(key)))
            return false;
        if (typeof operation.id !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(operation.id))
            return false;
        if (typeof operation.description !== 'string' || operation.description.length > 160 || /[\x00-\x1f\x7f]/.test(operation.description))
            return false;
        if (typeof operation.path !== 'string' || operation.path.length > 300 || !operation.path.startsWith('/') || operation.path.startsWith('//') || /[\x00-\x20\x7f?#\\]/.test(operation.path) || /%(?:2e|2f|5c)/i.test(operation.path))
            return false;
        if (operation.path.split('/').some((part) => { try {
            return ['.', '..'].includes(decodeURIComponent(part));
        }
        catch {
            return true;
        } }))
            return false;
        if (!Array.isArray(operation.parameters) || operation.parameters.length > 20)
            return false;
        return operation.parameters.every((parameter) => {
            if (!parameter || typeof parameter !== 'object')
                return false;
            const item = parameter;
            if (Object.keys(item).some((key) => !['name', 'type', 'required'].includes(key)))
                return false;
            return typeof item.name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(item.name)
                && ['string', 'number', 'boolean'].includes(String(item.type))
                && (item.required === undefined || typeof item.required === 'boolean');
        }) && new Set(operation.parameters.map((parameter) => parameter.name)).size === operation.parameters.length;
    });
    return valid && new Set(parsed.map((item) => item.id)).size === parsed.length;
}
function parseEnterpriseProfileConfig(raw) {
    if (new TextEncoder().encode(raw).byteLength > 128 * 1024)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return undefined;
    const value = parsed;
    if (Object.keys(value).some((key) => !['systemName', 'siteUrl', 'apiOperations'].includes(key)))
        return undefined;
    const systemName = value.systemName === undefined ? 'AI 智能平台系统' : typeof value.systemName === 'string' ? normalizeSystemName(value.systemName) : undefined;
    const siteUrl = value.siteUrl === undefined ? '' : value.siteUrl === '' ? '' : typeof value.siteUrl === 'string' ? normalizeSiteUrl(value.siteUrl) : undefined;
    if (!systemName || siteUrl === undefined || (value.apiOperations !== undefined && !Array.isArray(value.apiOperations)))
        return undefined;
    const apiOperations = JSON.stringify(value.apiOperations ?? []);
    if (!validApiOperations(apiOperations))
        return undefined;
    return { systemName, siteUrl, apiOperations };
}
function readStoredMcpUrl() {
    try {
        return localStorage.getItem(MCP_URL_KEY) || '';
    }
    catch {
        return '';
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
function normalizeSiteUrl(value) {
    const normalized = normalizeHttpUrl(value);
    if (!normalized)
        return undefined;
    try {
        const target = new URL(normalized);
        return target.search || target.hash ? undefined : normalized;
    }
    catch {
        return undefined;
    }
}
function normalizeSystemName(value) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 50 || /[\x00-\x1f\x7f]/.test(normalized))
        return undefined;
    return normalized;
}
function appendApiOperationJson(current, operation) {
    const source = current.trim() || '[]';
    if (!validApiOperations(source) || !validApiOperations(JSON.stringify([operation])))
        return undefined;
    const next = [...JSON.parse(source), operation];
    return validApiOperations(JSON.stringify(next)) ? JSON.stringify(next, null, 2) : undefined;
}
function getSiteProxyPath(value) {
    try {
        const target = new URL(value);
        const basePath = target.pathname.replace(/\/+$/, '');
        const identity = `${target.origin}${basePath}`;
        let hash = 0xcbf29ce484222325n;
        for (let index = 0; index < identity.length; index++) {
            hash ^= BigInt(identity.charCodeAt(index));
            hash = BigInt.asUintN(64, hash * 0x100000001b3n);
        }
        return `${MES_PROXY_PATH}/${hash.toString(16).padStart(16, '0')}`;
    }
    catch {
        return undefined;
    }
}
async function syncWorkbenchSiteUrl(siteUrl, apiOperations) {
    try {
        const response = await fetch(`${window.location.origin}${ERP_BRIDGE_PATH}/configure`, {
            method: 'POST', credentials: 'include', cache: 'no-store',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ siteUrl, ...(apiOperations === undefined ? {} : { apiOperations }) }),
        });
        const result = await response.json();
        return response.ok && result.ok === true;
    }
    catch {
        return false;
    }
}
function MesApiAccountCard(props) {
    const t = props.t;
    const [settings, setSettings] = R.useState(null);
    const [baseUrl, setBaseUrl] = R.useState('http://121.40.84.3:4175/scx');
    const [username, setUsername] = R.useState('');
    const [password, setPassword] = R.useState('');
    const [status, setStatus] = R.useState('');
    const [statusKind, setStatusKind] = R.useState('');
    const [loading, setLoading] = R.useState(true);
    const [saving, setSaving] = R.useState(false);
    const [loggingOut, setLoggingOut] = R.useState(false);
    R.useEffect(() => {
        let active = true;
        void fetch(`${window.location.origin}/api/scx-mes-query.settings`, { credentials: 'same-origin', cache: 'no-store' })
            .then(async (response) => {
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || t('mesLoadFailed'));
            if (!active)
                return;
            setSettings(result);
            setBaseUrl(result.baseUrl || 'http://121.40.84.3:4175/scx');
            setUsername(result.username || '');
            setStatus(!result.writable ? t('mesReadOnly') : result.configured ? t('mesConfigured') : t('mesNotConfigured'));
        })
            .catch((error) => {
            if (active) {
                setStatus(error instanceof Error ? error.message : t('mesLoadFailed'));
                setStatusKind('error');
            }
        })
            .finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [t]);
    const save = async () => {
        if (saving || !settings)
            return;
        if (!password) {
            setStatus(t('mesPasswordRequired'));
            setStatusKind('error');
            return;
        }
        setSaving(true);
        setStatus(t('mesSaving'));
        setStatusKind('');
        try {
            const response = await fetch(`${window.location.origin}/api/scx-mes-query.save`, {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ revision: settings.revision, baseUrl, username, password }),
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || t('mesSaveFailed'));
            const websiteCredentials = await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.saveEnterpriseWebsiteLoginCredentials?.(props.websiteUrl || baseUrl, username, password);
            if (!websiteCredentials?.ok)
                throw new Error(t('mesAutoLoginSaveFailed'));
            setSettings(result);
            setBaseUrl(result.baseUrl);
            setUsername(result.username);
            setPassword('');
            setStatus(`${t('mesSaved')} · ${result.connectedAs || result.username}`);
            setStatusKind('success');
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : t('mesSaveFailed'));
            setStatusKind('error');
        }
        finally {
            setSaving(false);
        }
    };
    const logout = async () => {
        if (saving || loggingOut || !settings?.configured)
            return;
        setLoggingOut(true);
        setStatus(t('mesLoggingOut'));
        setStatusKind('');
        try {
            const website = await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.clearEnterpriseWebsiteLogin?.(props.websiteUrl || baseUrl);
            if (!website?.ok)
                throw new Error(t('mesLogoutFailed'));
            const response = await fetch(`${window.location.origin}/api/scx-mes-query.logout`, {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'content-type': 'application/json' }, body: '{}',
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || t('mesLogoutFailed'));
            setSettings(result);
            setUsername('');
            setPassword('');
            setStatus(t('mesLoggedOut'));
            setStatusKind('success');
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : t('mesLogoutFailed'));
            setStatusKind('error');
        }
        finally {
            setLoggingOut(false);
        }
    };
    return h('section', { className: 'scxwb-card' }, h('h3', null, t('mesAccountTitle')), h('p', { className: 'scxwb-help' }, t('mesAccountHelp')), h('div', { className: 'scxwb-grid', style: { marginTop: '10px' } }, h('label', { className: 'scxwb-field' }, t('mesBaseUrl'), h('input', { type: 'url', required: true, value: baseUrl, maxLength: 500, autoComplete: 'url', disabled: saving || loggingOut || loading, onChange: (event) => setBaseUrl(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('mesUsername'), h('input', { type: 'text', required: true, value: username, maxLength: 100, autoComplete: 'username', disabled: saving || loggingOut || loading, onChange: (event) => setUsername(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('mesPassword'), h('input', { type: 'password', required: true, value: password, maxLength: 512, autoComplete: 'current-password', disabled: saving || loggingOut || loading, onChange: (event) => setPassword(event.currentTarget.value) }))), h('p', { className: 'scxwb-help', style: { marginTop: '8px' } }, t('mesPasswordHint')), h('p', { className: 'scxwb-help' }, t('mesPageLoginHint')), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', disabled: saving || loggingOut || loading || !settings?.writable, onClick: () => { void save(); } }, saving ? t('mesSaving') : t('mesSave')), settings?.configured ? h('button', { className: 'scxwb-button secondary', type: 'button', disabled: saving || loggingOut || loading || !settings?.writable, onClick: () => { void logout(); } }, loggingOut ? t('mesLoggingOut') : t('mesLogout')) : null), status ? h('div', { className: `scxwb-status ${statusKind}`, role: statusKind === 'error' ? 'alert' : 'status', 'aria-live': 'polite' }, status) : null);
}
function SettingsForm(props) {
    const t = props.t;
    const [siteUrl, setSiteUrl] = R.useState(() => readConfiguredSiteUrl(readFormSnapshot(props)) || readLegacySiteUrl());
    const [systemName, setSystemName] = R.useState(() => readConfiguredSystemName(readFormSnapshot(props)) || readLegacySystemName() || t('defaultName'));
    const [mcpUrl, setMcpUrl] = R.useState(readStoredMcpUrl);
    const [apiOperations, setApiOperations] = R.useState(() => {
        const local = readLegacyApiOperations();
        if (local !== undefined)
            return local;
        const value = readFormSnapshot(props)?.value?.apiOperations;
        return typeof value === 'string' ? value : '[]';
    });
    const [sqlDialect, setSqlDialect] = R.useState(() => String(readFormSnapshot(props)?.value?.sqlDialect || 'sqlserver'));
    const [sqlHost, setSqlHost] = R.useState(() => String(readFormSnapshot(props)?.value?.sqlHost || ''));
    const [sqlPort, setSqlPort] = R.useState(() => String(readFormSnapshot(props)?.value?.sqlPort || '1433'));
    const [sqlDatabase, setSqlDatabase] = R.useState(() => String(readFormSnapshot(props)?.value?.sqlDatabase || ''));
    const [sqlUsername, setSqlUsername] = R.useState(() => String(readFormSnapshot(props)?.value?.sqlUsername || ''));
    const [sqlSsl, setSqlSsl] = R.useState(() => readFormSnapshot(props)?.value?.sqlSsl !== 'false');
    const [sqlPassword, setSqlPassword] = R.useState('');
    const [sqlConnected, setSqlConnected] = R.useState(false);
    const [operationId, setOperationId] = R.useState('');
    const [operationDescription, setOperationDescription] = R.useState('');
    const [operationPath, setOperationPath] = R.useState('');
    const [apiParameters, setApiParameters] = R.useState([]);
    const [message, setMessage] = R.useState('');
    const [messageKind, setMessageKind] = R.useState('');
    const [saving, setSaving] = R.useState(false);
    R.useEffect(() => {
        if (!props.configStore)
            return;
        const sync = () => {
            try {
                const snapshot = props.configStore?.getSnapshot();
                setSiteUrl(readConfiguredSiteUrl(snapshot) || readLegacySiteUrl());
                setSystemName(readConfiguredSystemName(snapshot) || readLegacySystemName());
                setApiOperations(readLegacyApiOperations() ?? (typeof snapshot?.value?.apiOperations === 'string' ? snapshot.value.apiOperations : '[]'));
                setSqlDialect(String(snapshot?.value?.sqlDialect || 'sqlserver'));
                setSqlHost(String(snapshot?.value?.sqlHost || ''));
                setSqlPort(String(snapshot?.value?.sqlPort || '1433'));
                setSqlDatabase(String(snapshot?.value?.sqlDatabase || ''));
                setSqlUsername(String(snapshot?.value?.sqlUsername || ''));
                setSqlSsl(snapshot?.value?.sqlSsl !== 'false');
            }
            catch {
                setSiteUrl(readLegacySiteUrl());
                setSystemName(readLegacySystemName());
                setApiOperations('[]');
            }
        };
        sync();
        return props.configStore.subscribe(sync);
    }, [props.configStore]);
    R.useEffect(() => {
        if (props.form) {
            setSiteUrl(readConfiguredSiteUrl(props.form.state) || readLegacySiteUrl());
            setSystemName(readConfiguredSystemName(props.form.state) || readLegacySystemName());
            setApiOperations(readLegacyApiOperations() ?? (typeof props.form.state.value?.apiOperations === 'string' ? props.form.state.value.apiOperations : '[]'));
            setSqlDialect(String(props.form.state.value?.sqlDialect || 'sqlserver'));
            setSqlHost(String(props.form.state.value?.sqlHost || ''));
            setSqlPort(String(props.form.state.value?.sqlPort || '1433'));
            setSqlDatabase(String(props.form.state.value?.sqlDatabase || ''));
            setSqlUsername(String(props.form.state.value?.sqlUsername || ''));
            setSqlSsl(props.form.state.value?.sqlSsl !== 'false');
        }
    }, [props.form?.state.revision]);
    R.useEffect(() => {
        let active = true;
        void fetch(`${window.location.origin}${SQL_BRIDGE_PATH}/status`, { credentials: 'include', cache: 'no-store' })
            .then((response) => response.json())
            .then((value) => {
            const result = value && typeof value === 'object' ? value : {};
            if (active)
                setSqlConnected(result.connected === true);
        })
            .catch(() => { if (active)
            setSqlConnected(false); });
        return () => { active = false; };
    }, []);
    const setStatus = (text, kind) => {
        setMessage(text);
        setMessageKind(kind);
    };
    const saveSiteUrl = () => {
        if (saving)
            return;
        const normalized = normalizeSiteUrl(siteUrl);
        if (!normalized)
            return setStatus(t('invalidWebsite'), 'error');
        const normalizedName = normalizeSystemName(systemName) || t('defaultName');
        const saveBrowserDraft = (reason) => {
            try {
                localStorage.setItem(LEGACY_SITE_URL_KEY, normalized);
                localStorage.setItem(LEGACY_SYSTEM_NAME_KEY, normalizedName);
                setSiteUrl(normalized);
                setSystemName(normalizedName);
                props.onSiteUrlSaved?.(normalized);
                void syncWorkbenchSiteUrl(normalized).then((synced) => {
                    setStatus(synced ? `${reason}；${t('browserOnly')}` : `${reason}；${t('browserOnly')}；${t('runtimeSyncFailed')}`, synced ? 'warning' : 'error');
                });
            }
            catch {
                setStatus(t('browserError'), 'error');
            }
        };
        const snapshot = readFormSnapshot(props);
        const mutate = props.form?.mutate ?? (props.configStore ? props.configStore.mutate.bind(props.configStore) : undefined);
        if (!snapshot || !mutate)
            return saveBrowserDraft(t('formUnavailable'));
        if (!snapshot.writable || !Number.isSafeInteger(snapshot.revision))
            return saveBrowserDraft(t('profileReadOnly'));
        setSaving(true);
        void mutate([
            { op: 'set', path: ['siteUrl'], value: normalized },
            { op: 'set', path: ['systemName'], value: normalizedName },
        ], snapshot.revision).then((result) => {
            if (result === false)
                return saveBrowserDraft(t('saveRejected'));
            try {
                localStorage.setItem(LEGACY_SITE_URL_KEY, normalized);
            }
            catch { /* profile save remains successful; local fallback is best-effort */ }
            try {
                localStorage.setItem(LEGACY_SYSTEM_NAME_KEY, normalizedName);
            }
            catch { /* profile save remains successful; local fallback is best-effort */ }
            setSiteUrl(normalized);
            setSystemName(normalizedName);
            props.onSiteUrlSaved?.(normalized);
            setStatus(t('savedProfile'), 'success');
        }).catch(() => setStatus(t('saveFailed'), 'error')).finally(() => setSaving(false));
    };
    const saveMcpUrl = () => {
        const raw = mcpUrl.trim();
        if (raw && !normalizeHttpUrl(raw))
            return setStatus(t('mcpInvalid'), 'error');
        try {
            localStorage.setItem(MCP_URL_KEY, raw ? normalizeHttpUrl(raw) : '');
            setStatus(t('mcpSaved'), 'success');
        }
        catch {
            setStatus(t('mcpFailed'), 'error');
        }
    };
    const saveApiOperations = () => {
        if (saving)
            return;
        if (!validApiOperations(apiOperations))
            return setStatus(t('apiOperationsInvalid'), 'error');
        const normalized = JSON.stringify(JSON.parse(apiOperations));
        const snapshot = readFormSnapshot(props);
        const mutate = props.form?.mutate ?? (props.configStore ? props.configStore.mutate.bind(props.configStore) : undefined);
        const siteUrl = readLegacySiteUrl() || readConfiguredSiteUrl(snapshot);
        if (!siteUrl)
            return setStatus(t('invalidWebsite'), 'error');
        setSaving(true);
        void (async () => {
            try {
                localStorage.setItem(LEGACY_API_OPERATIONS_KEY, normalized);
            }
            catch {
                setStatus(t('browserError'), 'error');
                return;
            }
            if (snapshot && mutate && snapshot.writable && Number.isSafeInteger(snapshot.revision)) {
                try {
                    await mutate([{ op: 'set', path: ['apiOperations'], value: normalized }], snapshot.revision);
                }
                catch { /* this desktop profile may be memory-only; local storage remains the fallback */ }
            }
            const synced = await syncWorkbenchSiteUrl(siteUrl, normalized);
            setApiOperations(normalized);
            setStatus(synced ? t('apiOperationsSaved') : `${t('apiOperationsSaved')}；${t('runtimeSyncFailed')}`, synced ? 'success' : 'warning');
        })().finally(() => setSaving(false));
    };
    const connectSql = () => {
        if (saving)
            return;
        const port = Number(sqlPort);
        if (!sqlHost.trim() || !sqlDatabase.trim() || !sqlUsername.trim() || !sqlPassword || !Number.isInteger(port) || port < 1 || port > 65535) {
            return setStatus(t('sqlConfigFailed'), 'error');
        }
        setSaving(true);
        void fetch(`${window.location.origin}${SQL_BRIDGE_PATH}/connect`, {
            method: 'POST', credentials: 'include', cache: 'no-store',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ dialect: sqlDialect, host: sqlHost.trim(), port, database: sqlDatabase.trim(), username: sqlUsername.trim(), password: sqlPassword, ssl: sqlSsl }),
        }).then(async (response) => {
            const result = await response.json();
            if (!response.ok || result.ok !== true)
                throw new Error(typeof result.error === 'string' ? result.error : t('sqlConnectionFailed'));
            const tableCount = Number.isInteger(result.tableCount) ? Number(result.tableCount) : 0;
            setSqlConnected(true);
            setSqlPassword('');
            const snapshot = readFormSnapshot(props);
            const mutate = props.form?.mutate ?? (props.configStore ? props.configStore.mutate.bind(props.configStore) : undefined);
            if (snapshot && mutate && snapshot.writable) {
                const saveResult = await mutate([
                    { op: 'set', path: ['sqlDialect'], value: sqlDialect },
                    { op: 'set', path: ['sqlHost'], value: sqlHost.trim() },
                    { op: 'set', path: ['sqlPort'], value: String(port) },
                    { op: 'set', path: ['sqlDatabase'], value: sqlDatabase.trim() },
                    { op: 'set', path: ['sqlUsername'], value: sqlUsername.trim() },
                    { op: 'set', path: ['sqlSsl'], value: String(sqlSsl) },
                ], snapshot.revision);
                if (saveResult === false)
                    return setStatus(t('sqlConfigSaved'), 'warning');
            }
            setStatus(t('sqlConnected').replace('{count}', String(tableCount)), 'success');
        }).catch((error) => {
            setSqlConnected(false);
            setStatus(error instanceof Error && error.message !== t('sqlConnectionFailed') ? error.message : t('sqlConfigFailed'), 'error');
        }).finally(() => setSaving(false));
    };
    const disconnectSql = () => {
        setSaving(true);
        void fetch(`${window.location.origin}${SQL_BRIDGE_PATH}/disconnect`, {
            method: 'POST', credentials: 'include', cache: 'no-store',
            headers: { 'content-type': 'application/json', accept: 'application/json' }, body: '{}',
        }).then(() => { setSqlConnected(false); setStatus(t('sqlNotConnected'), 'success'); })
            .catch(() => setStatus(t('sqlConnectionFailed'), 'error')).finally(() => setSaving(false));
    };
    const importCompanyConfig = async (file) => {
        if (!file)
            return;
        if (file.size > 128 * 1024)
            return setStatus(t('configFileInvalid'), 'error');
        let imported;
        try {
            imported = parseEnterpriseProfileConfig(await file.text());
        }
        catch {
            imported = undefined;
        }
        if (!imported)
            return setStatus(t('configFileInvalid'), 'error');
        const snapshot = readFormSnapshot(props);
        const mutate = props.form?.mutate ?? (props.configStore ? props.configStore.mutate.bind(props.configStore) : undefined);
        if (saving)
            return;
        setSaving(true);
        void (async () => {
            try {
                localStorage.setItem(LEGACY_SITE_URL_KEY, imported.siteUrl);
                localStorage.setItem(LEGACY_SYSTEM_NAME_KEY, imported.systemName);
                localStorage.setItem(LEGACY_API_OPERATIONS_KEY, imported.apiOperations);
            }
            catch {
                setStatus(t('browserError'), 'error');
                return;
            }
            if (snapshot && mutate && snapshot.writable && Number.isSafeInteger(snapshot.revision)) {
                try {
                    await mutate([
                        { op: 'set', path: ['systemName'], value: imported.systemName },
                        { op: 'set', path: ['siteUrl'], value: imported.siteUrl },
                        { op: 'set', path: ['apiOperations'], value: imported.apiOperations },
                    ], snapshot.revision);
                }
                catch { /* local settings remain available in this installation */ }
            }
            const synced = imported.siteUrl ? await syncWorkbenchSiteUrl(imported.siteUrl, imported.apiOperations) : false;
            setSystemName(imported.systemName);
            setSiteUrl(imported.siteUrl);
            setApiOperations(imported.apiOperations);
            props.onSiteUrlSaved?.(imported.siteUrl);
            setStatus(synced ? t('configImported') : `${t('configImported')}；${t('runtimeSyncFailed')}`, synced ? 'success' : 'warning');
        })().finally(() => setSaving(false));
    };
    const exportCompanyConfig = () => {
        if (!validApiOperations(apiOperations))
            return setStatus(t('apiOperationsInvalid'), 'error');
        const content = JSON.stringify({ systemName: normalizeSystemName(systemName) || t('defaultName'), siteUrl: normalizeSiteUrl(siteUrl) || '', apiOperations: JSON.parse(apiOperations) }, null, 2);
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'erp-mes-config.json';
        link.click();
        URL.revokeObjectURL(url);
    };
    const addApiParameter = () => {
        if (apiParameters.length >= 20)
            return setStatus(t('parameterInvalid'), 'error');
        setApiParameters([...apiParameters, { name: '', type: 'string', required: false }]);
    };
    const appendApiOperation = () => {
        const operation = {
            id: operationId.trim(),
            description: operationDescription.trim(),
            path: operationPath.trim(),
            parameters: apiParameters.map((parameter) => ({ ...parameter, name: parameter.name.trim() })),
        };
        if (apiParameters.some((parameter) => !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(parameter.name.trim()))
            || new Set(apiParameters.map((parameter) => parameter.name.trim()).filter(Boolean)).size !== apiParameters.length) {
            return setStatus(t('parameterInvalid'), 'error');
        }
        const next = appendApiOperationJson(apiOperations, operation);
        if (next === undefined)
            return setStatus(t('apiOperationsInvalid'), 'error');
        setApiOperations(next);
        setOperationId('');
        setOperationDescription('');
        setOperationPath('');
        setApiParameters([]);
        setStatus(t('operationAdded'), 'success');
    };
    if (props.view === 'summary')
        return h('div', { className: 'scxwb-summary' }, t('summary'));
    return h('div', { className: 'scxwb-settings' }, h('section', { className: 'scxwb-card' }, h('h3', null, t('systemCard')), h('label', { className: 'scxwb-field' }, t('websiteUrl'), h('input', { type: 'url', value: siteUrl, placeholder: 'https://mes.example.com/', onChange: (event) => setSiteUrl(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('systemName'), h('input', { type: 'text', value: systemName, maxLength: 50, placeholder: t('systemPlaceholder'), onChange: (event) => setSystemName(event.currentTarget.value) })), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', disabled: saving, onClick: saveSiteUrl }, saving ? t('saving') : t('saveSettings'))), h('h4', null, t('configFileTitle')), h('p', { className: 'scxwb-help' }, t('configFileHelp')), h('div', { className: 'scxwb-row' }, h('label', { className: 'scxwb-field' }, t('importConfig'), h('input', { type: 'file', accept: '.json,application/json', disabled: saving, onChange: (event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importCompanyConfig(file); } })), h('button', { className: 'scxwb-button secondary', type: 'button', disabled: saving, onClick: exportCompanyConfig }, t('exportConfig')))), h(MesApiAccountCard, { t, websiteUrl: siteUrl }), h('section', { className: 'scxwb-card' }, h('h3', null, t('sqlTitle')), h('p', { className: 'scxwb-help' }, t('sqlHelp')), h('p', { className: 'scxwb-help', role: 'status' }, sqlConnected ? t('sqlStatusConnected') : t('sqlNotConnected')), h('div', { className: 'scxwb-grid' }, h('label', { className: 'scxwb-field' }, t('sqlDialect'), h('select', { value: sqlDialect, onChange: (event) => {
            const next = event.currentTarget.value;
            setSqlDialect(next);
            if (sqlPort === '1433' || sqlPort === '3306' || sqlPort === '5432')
                setSqlPort(next === 'mysql' ? '3306' : next === 'postgres' ? '5432' : '1433');
        } }, h('option', { value: 'sqlserver' }, t('sqlServer')), h('option', { value: 'mysql' }, t('mysql')), h('option', { value: 'postgres' }, t('postgres')))), h('label', { className: 'scxwb-field' }, t('sqlHost'), h('input', { type: 'text', value: sqlHost, maxLength: 253, autoComplete: 'off', onChange: (event) => setSqlHost(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('sqlPort'), h('input', { type: 'number', value: sqlPort, min: 1, max: 65535, onChange: (event) => setSqlPort(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('sqlDatabase'), h('input', { type: 'text', value: sqlDatabase, maxLength: 128, autoComplete: 'off', onChange: (event) => setSqlDatabase(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('sqlUsername'), h('input', { type: 'text', value: sqlUsername, maxLength: 128, autoComplete: 'username', onChange: (event) => setSqlUsername(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('sqlPassword'), h('input', { type: 'password', value: sqlPassword, maxLength: 1024, autoComplete: 'new-password', onChange: (event) => setSqlPassword(event.currentTarget.value) }))), h('label', { className: 'scxwb-param-required' }, h('input', { type: 'checkbox', checked: sqlSsl, onChange: (event) => setSqlSsl(event.currentTarget.checked) }), t('sqlSsl')), h('p', { className: 'scxwb-help' }, t('sqlReadonlyNotice')), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', disabled: saving, onClick: connectSql }, saving ? t('sqlConnecting') : t('sqlConnect')), sqlConnected ? h('button', { className: 'scxwb-button secondary', type: 'button', disabled: saving, onClick: disconnectSql }, t('sqlDisconnect')) : null), h('h4', null, t('apiTitle')), h('h4', null, t('quickAddOperation')), h('p', { className: 'scxwb-help' }, t('quickAddHelp')), h('div', { className: 'scxwb-grid' }, h('label', { className: 'scxwb-field' }, t('operationId'), h('input', { type: 'text', value: operationId, maxLength: 40, placeholder: t('operationIdPlaceholder'), onChange: (event) => setOperationId(event.currentTarget.value) })), h('label', { className: 'scxwb-field' }, t('operationDescription'), h('input', { type: 'text', value: operationDescription, maxLength: 160, placeholder: t('operationDescriptionPlaceholder'), onChange: (event) => setOperationDescription(event.currentTarget.value) }))), h('label', { className: 'scxwb-field' }, t('operationPath'), h('input', { type: 'text', value: operationPath, maxLength: 300, placeholder: t('operationPathPlaceholder'), onChange: (event) => setOperationPath(event.currentTarget.value) })), h('div', null, h('p', { className: 'scxwb-help' }, t('parametersTitle')), ...apiParameters.map((parameter, index) => h('div', { className: 'scxwb-param-row', key: index }, h('label', { className: 'scxwb-field' }, t('parameterName'), h('input', { type: 'text', value: parameter.name, maxLength: 40, onChange: (event) => setApiParameters(apiParameters.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.currentTarget.value } : item)) })), h('label', { className: 'scxwb-field' }, t('parameterType'), h('select', { value: parameter.type, onChange: (event) => setApiParameters(apiParameters.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.currentTarget.value } : item)) }, h('option', { value: 'string' }, 'string'), h('option', { value: 'number' }, 'number'), h('option', { value: 'boolean' }, 'boolean'))), h('label', { className: 'scxwb-param-required' }, h('input', { type: 'checkbox', checked: parameter.required, onChange: (event) => setApiParameters(apiParameters.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.currentTarget.checked } : item)) }), t('parameterRequired')), h('button', { className: 'scxwb-button secondary', type: 'button', onClick: () => setApiParameters(apiParameters.filter((_, itemIndex) => itemIndex !== index)) }, t('removeParameter')))), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button secondary', type: 'button', disabled: apiParameters.length >= 20, onClick: addApiParameter }, t('addParameter')))), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', onClick: appendApiOperation }, t('appendOperation'))), h('label', { className: 'scxwb-field' }, t('apiOperations'), h('textarea', { className: 'scxwb-json', value: apiOperations, maxLength: 65536, rows: 8, spellCheck: false, onChange: (event) => setApiOperations(event.currentTarget.value) })), h('p', { className: 'scxwb-help' }, t('apiOperationsHelp')), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button', type: 'button', disabled: saving, onClick: saveApiOperations }, saving ? t('saving') : t('saveApiOperations')))), h('section', { className: 'scxwb-card' }, h('h3', null, t('mcpTitle')), h('p', { className: 'scxwb-help' }, t('mcpHelp')), h('label', { className: 'scxwb-field' }, t('mcpUrl'), h('input', { type: 'url', value: mcpUrl, placeholder: 'https://mcp.example.com/mcp', onChange: (event) => setMcpUrl(event.currentTarget.value) })), h('div', { className: 'scxwb-row' }, h('button', { className: 'scxwb-button secondary', type: 'button', onClick: saveMcpUrl }, t('saveMcp')))), message ? h('div', { className: `scxwb-status ${messageKind}`, role: messageKind === 'error' ? 'alert' : 'status', 'aria-live': messageKind === 'error' ? 'assertive' : 'polite', 'aria-atomic': 'true' }, message) : null);
}
function DashboardPanel(props) {
    const t = props.t;
    const siteForm = props.siteForm;
    const [siteUrl, setSiteUrl] = R.useState(() => readConfiguredSiteUrl(siteForm?.getSnapshot()) || readLegacySiteUrl());
    const [systemName, setSystemName] = R.useState(() => readConfiguredSystemName(siteForm?.getSnapshot()) || readLegacySystemName());
    const [showSettings, setShowSettings] = R.useState(false);
    const [activeView, setActiveView] = R.useState('overview');
    const [openStatus, setOpenStatus] = R.useState('');
    const [frameElement, setFrameElement] = R.useState(null);
    // Keep the callback ref stable: a fresh inline callback clears the old ref
    // on every React render. Since the effect below owns the native WebContentsView,
    // that would close and reopen the MES page repeatedly, leaving a white pane.
    const [frameRef] = R.useState(() => (node) => setFrameElement((current) => current === node ? current : node));
    const [websiteStatus, setWebsiteStatus] = R.useState({ ok: false, loading: false, url: '', title: '', error: '' });
    const [aiActionStatus, setAiActionStatus] = R.useState('');
    const [sendingPrompt, setSendingPrompt] = R.useState(false);
    const [webColumnWidth, setWebColumnWidth] = R.useState(readWebColumnWidth);
    const [dividerDrag, setDividerDrag] = R.useState(null);
    const workbenchService = props.service;
    const workbenchEntry = props.entry;
    // The host passes `active` from the exact panel selection it rendered.
    // Prefer it over the service snapshot, which can lag during navigation and
    // otherwise leaves the native website view detached while this panel is visible.
    const panelActive = isWorkbenchPanelActive({ explicitActive: props.active, entryId: workbenchEntry?.id, activeId: workbenchService?.state?.active, marketOpen: workbenchService?.marketOpen });
    const sessions = props.sessions;
    R.useEffect(() => {
        const layout = workbenchService?.ctx?.layout;
        if (!panelActive || !layout)
            return;
        const sidebar = document.querySelector('[data-dsh-sidebar-root]');
        const wasWide = sidebar?.getAttribute('data-dsh-sidebar-wide') === 'true';
        if (wasWide)
            layout.toggleSidebar();
        return () => {
            const currentSidebar = document.querySelector('[data-dsh-sidebar-root]');
            if (wasWide && currentSidebar?.getAttribute('data-dsh-sidebar-wide') === 'false')
                layout.toggleSidebar();
        };
    }, [panelActive, workbenchService]);
    R.useEffect(() => {
        if (!siteForm)
            return;
        const sync = () => {
            try {
                const snapshot = siteForm.getSnapshot();
                setSiteUrl(readConfiguredSiteUrl(snapshot) || readLegacySiteUrl());
                setSystemName(readConfiguredSystemName(snapshot) || readLegacySystemName());
            }
            catch {
                setSiteUrl(readLegacySiteUrl());
                setSystemName(readLegacySystemName());
            }
        };
        sync();
        return siteForm.subscribe(sync);
    }, [siteForm]);
    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    const refreshWebsiteStatus = async () => {
        try {
            const status = await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.getEnterpriseWebsiteStatus?.();
            if (status)
                setWebsiteStatus(status);
        }
        catch { /* The next status refresh will retry. */ }
    };
    const reloadWebsite = async () => {
        setWebsiteStatus((previous) => ({ ...previous, loading: true, error: '' }));
        try {
            const result = await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.reloadEnterpriseWebsite?.();
            if (!result?.ok)
                throw new Error('reload unavailable');
            setOpenStatus('');
            setAiActionStatus('');
        }
        catch {
            setWebsiteStatus((previous) => ({ ...previous, loading: false, error: t('openWebsiteFailed') }));
        }
    };
    const sendAiPrompt = async (prompt) => {
        if (sendingPrompt || !workbenchEntry?.id || !workbenchService)
            return;
        setSendingPrompt(true);
        setAiActionStatus(t('promptSending'));
        try {
            const binding = workbenchService.state?.sessionBindings ?? {};
            let sessionId = workbenchService.currentSession?.();
            if (!sessionId || binding[sessionId] !== workbenchEntry.id) {
                sessionId = await workbenchService.newSession?.();
            }
            if (!sessionId)
                throw new Error('没有创建工作台会话；请重新点击并完成工作区选择。');
            let conversation;
            for (let attempt = 0; attempt < 40; attempt++) {
                // Cordis scopes only expose services through property access when the
                // caller fiber injects them. Use Context.get here, matching the
                // conversation plugin's own scopedConversation() helper.
                conversation = sessions?.scope(sessionId)?.get('conversation');
                if (conversation && typeof conversation.send === 'function')
                    break;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            if (!conversation || typeof conversation.send !== 'function')
                throw new Error('工作台对话尚未就绪，请稍后重试。');
            await conversation.send(prompt);
            setAiActionStatus(t('promptSent'));
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : '';
            setAiActionStatus(`${t('promptSendFailed')}${detail ? ` ${detail}` : ''}`);
        }
        finally {
            setSendingPrompt(false);
        }
    };
    const saveWebColumnWidth = (value) => {
        const width = Math.max(40, Math.min(76, value));
        setWebColumnWidth(width);
        try {
            localStorage.setItem(WEB_COLUMN_WIDTH_KEY, String(width));
        }
        catch { /* The split still works for this run. */ }
    };
    const startDividerDrag = (event) => {
        if (event.button !== undefined && event.button !== 0)
            return;
        const workspace = event.currentTarget.parentElement;
        const containerWidth = workspace?.getBoundingClientRect().width ?? 0;
        if (!containerWidth)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDividerDrag({ pointerId: event.pointerId, startX: event.clientX, startWidth: webColumnWidth, containerWidth });
    };
    const moveDivider = (event) => {
        if (!dividerDrag || dividerDrag.pointerId !== event.pointerId)
            return;
        saveWebColumnWidth(dividerDrag.startWidth + ((event.clientX - dividerDrag.startX) / dividerDrag.containerWidth) * 100);
    };
    const finishDividerDrag = (event) => {
        if (!dividerDrag || dividerDrag.pointerId !== event.pointerId)
            return;
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch { /* Capture may already have been released. */ }
        setDividerDrag(null);
    };
    const adjustDivider = (event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            saveWebColumnWidth(webColumnWidth - 2);
        }
        else if (event.key === 'ArrowRight') {
            event.preventDefault();
            saveWebColumnWidth(webColumnWidth + 2);
        }
        else if (event.key === 'Home') {
            event.preventDefault();
            saveWebColumnWidth(40);
        }
        else if (event.key === 'End') {
            event.preventDefault();
            saveWebColumnWidth(76);
        }
    };
    R.useEffect(() => {
        const desktop = (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})();
        if (!desktop?.attachEnterpriseWebsite || !desktop.updateEnterpriseWebsiteBounds || !desktop.setEnterpriseWebsiteCovered || !desktop.closeEnterpriseWebsite || !normalizedSiteUrl) {
            if (desktop?.closeEnterpriseWebsite)
                void desktop.closeEnterpriseWebsite();
            setWebsiteStatus({ ok: false, loading: false, url: '', title: '', error: '' });
            return;
        }
        if (!shouldAttachEnterpriseWebsite({ view: activeView, showSettings, hasFrame: !!frameElement, panelActive, hasUrl: !!normalizedSiteUrl })) {
            // WebContentsView is a native child view and always paints above the
            // renderer. Remove it when this panel is not the active surface so it
            // cannot sit over Harness settings, the plugin market, or another panel.
            // Its persistent Electron partition keeps the employee's website login.
            void desktop.closeEnterpriseWebsite();
            setWebsiteStatus({ ok: false, loading: false, url: '', title: '', error: '' });
            return;
        }
        let active = true;
        let applicationInteractionUntil = 0;
        let restoreWebsiteTimer;
        let statusTimer;
        const getBounds = () => {
            const rect = frameElement.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        const updateBounds = () => {
            if (active)
                void desktop.updateEnterpriseWebsiteBounds?.(getBounds());
        };
        const updateCoverage = () => {
            if (!active)
                return;
            const interactionRemaining = applicationInteractionUntil - Date.now();
            if (interactionRemaining > 0) {
                void desktop.setEnterpriseWebsiteCovered?.(true);
                if (restoreWebsiteTimer !== undefined)
                    window.clearTimeout(restoreWebsiteTimer);
                restoreWebsiteTimer = window.setTimeout(updateCoverage, interactionRemaining);
                return;
            }
            // Avoid generic data-state="open" and class-name matches here: they also
            // select ordinary active panels/menus and can leave the native page
            // hidden forever. Recognized dialogs are safe; framework portals and
            // custom overlays must also be positioned above the application.
            const selectors = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [popover]:popover-open, [data-radix-popper-content-wrapper], [data-radix-portal] > *, [data-floating-ui-portal] > *, [data-headlessui-portal] > *, [role="menu"], [role="listbox"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"], [class*="popover"], [class*="Popover"], [class*="dropdown"], [class*="Dropdown"], [class*="context-menu"], [class*="ContextMenu"]';
            const panelRoot = frameElement.closest('[data-scxwb-root]');
            const frameRect = frameElement.getBoundingClientRect();
            const covered = Array.from(document.querySelectorAll(selectors)).some((element) => {
                if (panelRoot?.contains(element) || element.closest('[hidden], [aria-hidden="true"]'))
                    return false;
                let ancestor = element;
                while (ancestor) {
                    const style = window.getComputedStyle(ancestor);
                    const opacity = Number.parseFloat(style.opacity);
                    if (style.display === 'none' || style.visibility === 'hidden' || (Number.isFinite(opacity) && opacity <= 0.01)
                        || ancestor.getClientRects().length === 0)
                        return false;
                    ancestor = ancestor.parentElement;
                }
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const overlapsWorkbenchPage = rect.right > frameRect.left && rect.left < frameRect.right
                    && rect.bottom > frameRect.top && rect.top < frameRect.bottom;
                if (!overlapsWorkbenchPage)
                    return false;
                const semanticOverlay = element.matches('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [popover]:popover-open');
                const elevatedOverlay = ['fixed', 'absolute'].includes(style.position) && Number.parseInt(style.zIndex, 10) >= 10;
                return semanticOverlay || elevatedOverlay;
            });
            void desktop.setEnterpriseWebsiteCovered?.(covered);
        };
        const coverBeforeApplicationAction = (event) => {
            const target = event.target;
            if (!target || typeof target.closest !== 'function')
                return;
            if (frameElement.closest('[data-scxwb-root]')?.contains(target))
                return;
            // WebContentsView is painted above the renderer. Hide it before DSH's
            // Settings, About, market, menus, and other application controls open;
            // the observer below restores it only after the popup has gone away.
            if (!target.closest('button, [role="button"], [role="menuitem"], [aria-haspopup], [data-state="open"]'))
                return;
            applicationInteractionUntil = Date.now() + 1200;
            void desktop.setEnterpriseWebsiteCovered?.(true);
            if (restoreWebsiteTimer !== undefined)
                window.clearTimeout(restoreWebsiteTimer);
            restoreWebsiteTimer = window.setTimeout(updateCoverage, 1200);
        };
        const observer = new ResizeObserver(updateBounds);
        observer.observe(frameElement);
        const overlayObserver = new MutationObserver(updateCoverage);
        overlayObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['aria-hidden', 'aria-modal', 'class', 'data-state', 'hidden', 'open', 'role', 'style'],
        });
        document.addEventListener('pointerdown', coverBeforeApplicationAction, true);
        document.addEventListener('keydown', coverBeforeApplicationAction, true);
        document.addEventListener('focusin', coverBeforeApplicationAction, true);
        updateCoverage();
        window.addEventListener('resize', updateBounds);
        window.addEventListener('scroll', updateBounds, true);
        setOpenStatus('');
        setWebsiteStatus({ ok: true, loading: true, url: normalizedSiteUrl, title: '', error: '' });
        const pollWebsiteStatus = () => {
            if (!active)
                return;
            // App dialogs may fade out without a final DOM mutation. Recheck the
            // occlusion state with the status poll so the native page cannot remain
            // hidden after a dismissed popup.
            updateCoverage();
            void refreshWebsiteStatus();
            statusTimer = window.setTimeout(pollWebsiteStatus, 1400);
        };
        void desktop.attachEnterpriseWebsite(normalizedSiteUrl, systemName, getBounds()).then((result) => {
            if (!active)
                return;
            if (!result?.ok) {
                setWebsiteStatus((previous) => ({ ...previous, ok: false, loading: false, error: t('openWebsiteFailed') }));
                setOpenStatus(t('openWebsiteFailed'));
                return;
            }
            setOpenStatus('');
            void refreshWebsiteStatus();
            updateCoverage();
            pollWebsiteStatus();
        }).catch(() => {
            if (active) {
                setWebsiteStatus((previous) => ({ ...previous, ok: false, loading: false, error: t('openWebsiteFailed') }));
                setOpenStatus(t('openWebsiteFailed'));
            }
        });
        return () => {
            active = false;
            observer.disconnect();
            overlayObserver.disconnect();
            if (restoreWebsiteTimer !== undefined)
                window.clearTimeout(restoreWebsiteTimer);
            if (statusTimer !== undefined)
                window.clearTimeout(statusTimer);
            document.removeEventListener('pointerdown', coverBeforeApplicationAction, true);
            document.removeEventListener('keydown', coverBeforeApplicationAction, true);
            document.removeEventListener('focusin', coverBeforeApplicationAction, true);
            window.removeEventListener('resize', updateBounds);
            window.removeEventListener('scroll', updateBounds, true);
            void desktop.closeEnterpriseWebsite?.();
        };
    }, [normalizedSiteUrl, systemName, showSettings, activeView, frameElement, panelActive]);
    const shortcuts = [
        { label: t('todayReport'), prompt: '查询今天的报工汇总，并按型号列出良品数量。' },
        { label: t('currentInventory'), prompt: '查询当前库存，按仓库和工序节点列出数量。' },
        { label: t('todayShipments'), prompt: '查询今天的发货记录，按型号和数量逐笔列出。' },
        { label: t('shipmentEntry'), prompt: '我要登记发货。请先询问发货日期、型号、数量和必要信息；信息完整后先汇总让我核对，得到确认后再提交。' },
        { label: t('readCurrentPage'), prompt: '读取当前打开的 ERP/MES 页面，提取可见标题、主要数据和筛选条件；若要执行会修改数据的操作，请先说明并等待我确认。' },
    ];
    const sessionId = workbenchService?.currentSession?.();
    const conversationBound = !!sessionId && workbenchService?.state?.sessionBindings?.[sessionId] === workbenchEntry?.id;
    const conversationNode = props.conversation;
    const websiteStateClass = websiteStatus.error ? 'error' : websiteStatus.loading ? 'loading' : websiteStatus.ok ? 'ready' : '';
    const websiteStateLabel = websiteStatus.error ? `${t('webFailed')}：${websiteStatus.error}` : websiteStatus.loading ? t('webLoading') : websiteStatus.covered ? t('webCovered') : websiteStatus.ok ? t('webReady') : t('webIdle');
    const handleViewTabKeyDown = (event) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(event.key))
            return;
        const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
        const current = tabs.indexOf(event.target);
        if (current < 0 || tabs.length === 0)
            return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next]?.focus();
        tabs[next]?.click();
    };
    return h('section', { className: 'scxwb-root', 'data-scxwb-root': 'true', 'aria-label': `${systemName} ${t('panel')}` },
        h('header', { className: 'scxwb-top' }, h('div', { className: 'scxwb-brand' }, h('div', { className: 'scxwb-mark', 'aria-hidden': 'true' }, 'LQ'), h('div', null, h('div', { className: 'scxwb-title' }, systemName))), h('div', { className: 'scxwb-actions' }, h('span', { className: 'scxwb-badge' }, t('badge')), h('button', { className: 'scxwb-button secondary', type: 'button', onClick: () => setShowSettings(!showSettings) }, showSettings ? t('back') : t('settings')))),
        showSettings
            ? h('div', { className: 'scxwb-settings-wrap' }, h(SettingsForm, { t, configStore: siteForm, onSiteUrlSaved: setSiteUrl }))
            : h('div', { className: 'scxwb-workspace', style: { gridTemplateColumns: `minmax(0, ${webColumnWidth}%) 7px minmax(340px, 1fr)` } },
                h('div', { className: 'scxwb-web-column' },
                    h('div', { className: 'scxwb-toolbar' },
                        h('div', { className: 'scxwb-view-tabs', role: 'tablist', 'aria-label': t('panel'), onKeyDown: handleViewTabKeyDown },
                            h('button', { id: 'scxwb-overview-tab', className: 'scxwb-view-tab', type: 'button', role: 'tab', 'aria-selected': activeView === 'overview', 'aria-controls': 'scxwb-overview-panel', tabIndex: activeView === 'overview' ? 0 : -1, onClick: () => setActiveView('overview') }, t('overviewTab')),
                            h('button', { id: 'scxwb-website-tab', className: 'scxwb-view-tab', type: 'button', role: 'tab', 'aria-selected': activeView === 'website', 'aria-controls': 'scxwb-website-panel', tabIndex: activeView === 'website' ? 0 : -1, onClick: () => setActiveView('website') }, t('websiteTab'))),
                        activeView === 'website' ? h(R.Fragment, null, h('div', { className: 'scxwb-web-status', role: 'status', 'aria-live': 'polite' }, h('span', { className: `scxwb-status-dot ${websiteStateClass}`, 'aria-hidden': 'true' }), h('span', null, `${t('webStatus')}：${websiteStateLabel}`)), h('div', { className: 'scxwb-toolbar-actions' }, h('button', { type: 'button', onClick: reloadWebsite, disabled: !normalizedSiteUrl }, t('reload')))) : null),
                    activeView === 'overview'
                        ? h('div', { id: 'scxwb-overview-panel', role: 'tabpanel', 'aria-labelledby': 'scxwb-overview-tab' }, h(OverviewPanel, { t, systemName, normalizedSiteUrl, onOpenWebsite: () => setActiveView('website'), onOpenSettings: () => setShowSettings(true) }))
                        : h('div', { id: 'scxwb-website-panel', className: 'scxwb-frame-wrap', role: 'tabpanel', 'aria-labelledby': 'scxwb-website-tab', ref: frameRef }, !normalizedSiteUrl
                            ? h('div', { className: 'scxwb-frame-empty' }, t(siteUrl ? 'invalidUrl' : 'noUrl'))
                            : !(function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.attachEnterpriseWebsite
                                ? h('div', { className: 'scxwb-frame-empty' }, t('embeddedUnavailable'))
                                : websiteStatus.error
                                    ? h('div', { className: 'scxwb-frame-empty', role: 'alert', 'aria-live': 'assertive' }, `${t('webFailed')}：${websiteStatus.error}`)
                                    : websiteStatus.loading
                                        ? h('div', { className: 'scxwb-frame-empty', role: 'status', 'aria-live': 'polite' }, `${systemName} ${t('webLoading')}…`)
                                        : openStatus
                                            ? h('div', { className: 'scxwb-frame-empty', role: 'alert', 'aria-live': 'assertive' }, openStatus)
                                            : null),
                    ),
                h('div', {
                    className: 'scxwb-divider', role: 'separator', tabIndex: 0, 'aria-orientation': 'vertical',
                    'aria-label': '调整网页和对话区域宽度', 'aria-valuemin': 40, 'aria-valuemax': 76, 'aria-valuenow': Math.round(webColumnWidth),
                    'data-dragging': dividerDrag ? 'true' : 'false',
                    onPointerDown: startDividerDrag, onPointerMove: moveDivider, onPointerUp: finishDividerDrag, onPointerCancel: finishDividerDrag,
                    onKeyDown: adjustDivider,
                }),
                h('aside', { className: 'scxwb-assistant', 'aria-label': 'AI 对话与快捷按钮' }, h('div', { className: 'scxwb-chat' }, conversationBound && conversationNode
                    ? conversationNode
                    : h('div', { className: 'scxwb-chat-empty' }, t('chatStartHint'))), aiActionStatus ? h('div', { className: `scxwb-ai-status${aiActionStatus.startsWith(t('promptSendFailed')) ? ' error' : ''}`, role: 'status', 'aria-live': 'polite' }, aiActionStatus) : null, h('div', { className: 'scxwb-shortcuts', 'aria-label': '快捷操作' }, ...shortcuts.map((item) => h('button', { key: item.label, className: 'scxwb-shortcut', type: 'button', disabled: sendingPrompt, onClick: () => void sendAiPrompt(item.prompt) }, item.label))))));
}
function activeSessionId(sessions) {
    try {
        const byId = sessions.list.getSnapshot().byId;
        return Object.keys(byId).find((id) => (byId[id]?.retainedBy?.mainView ?? 0) > 0);
    }
    catch {
        return undefined;
    }
}
function OverviewPanel({ t, systemName, normalizedSiteUrl, onOpenWebsite, onOpenSettings }) {
    const methods = [
        ['01', t('methodWebsite'), t('methodWebsiteHelp')],
        ['02', t('methodApi'), t('methodApiHelp')],
        ['03', t('methodDatabase'), t('methodDatabaseHelp')],
        ['04', t('methodMcp'), t('methodMcpHelp')],
    ];
    const systems = [
        ['ERP', t('overviewErp')], ['MES', t('overviewMes')], ['WMS', t('overviewWms')],
        ['CRM', t('overviewCrm')], ['OA', t('overviewOa')],
    ];
    return h('div', { className: 'scxwb-overview', 'aria-label': t('overviewTab') }, h('div', { className: 'scxwb-overview-inner' },
        h('section', { className: 'scxwb-overview-hero' }, h('p', { className: 'scxwb-overview-eyebrow' }, t('overviewEyebrow')), h('h2', { className: 'scxwb-overview-title' }, t('overviewTitle')), h('p', { className: 'scxwb-overview-description' }, t('overviewDescription'))),
        h('section', { className: 'scxwb-overview-section', 'aria-labelledby': 'scxwb-connection-heading' }, h('div', { className: 'scxwb-overview-section-head' }, h('h3', { id: 'scxwb-connection-heading' }, t('overviewConnectionTitle'))), h('div', { className: 'scxwb-overview-connection' }, h('div', { className: 'scxwb-overview-connection-copy' }, h('p', { className: 'scxwb-overview-connection-title' }, systemName), h('p', { className: 'scxwb-overview-connection-meta', role: 'status', 'aria-live': 'polite' }, normalizedSiteUrl ? `${t('overviewConfigured')} · ${normalizedSiteUrl}` : t('overviewNotConfigured')), h('p', { className: 'scxwb-overview-connection-meta' }, t('overviewUrlHelp'))), h('div', { className: 'scxwb-overview-actions' }, h('button', { className: 'primary', type: 'button', onClick: onOpenWebsite }, t('overviewOpenWebsite')), h('button', { type: 'button', onClick: onOpenSettings }, t('overviewConfigure'))))),
        h('section', { className: 'scxwb-overview-section', 'aria-labelledby': 'scxwb-methods-heading' }, h('div', { className: 'scxwb-overview-section-head' }, h('h3', { id: 'scxwb-methods-heading' }, t('overviewMethodsTitle')), h('p', null, t('overviewMethodsHelp'))), h('div', { className: 'scxwb-overview-methods' }, ...methods.map(([number, title, description]) => h('article', { className: 'scxwb-overview-method', key: number }, h('h4', null, `${number} · ${title}`), h('p', null, description))))),
        h('section', { className: 'scxwb-overview-section', 'aria-labelledby': 'scxwb-systems-heading' }, h('div', { className: 'scxwb-overview-section-head' }, h('h3', { id: 'scxwb-systems-heading' }, t('overviewSystemsTitle')), h('p', null, t('overviewSystemsHelp'))), h('div', { className: 'scxwb-overview-systems' }, ...systems.map(([code, description]) => h('article', { className: 'scxwb-overview-system', key: code }, h('h4', null, code), h('p', null, description)))), h('div', { className: 'scxwb-overview-no-metrics', role: 'note' }, t('overviewNoMetrics')))));
}
function startApiBridge(ctx) {
    const sessions = ctx.get('sessions');
    if (!sessions?.list?.getSnapshot)
        return () => undefined;
    const controller = new AbortController();
    let syncedConfiguration = '';
    const callBridge = async (endpoint, payload) => {
        const response = await fetch(`${window.location.origin}${ERP_BRIDGE_PATH}/${endpoint}`, {
            method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal,
            headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload),
        });
        return await response.json();
    };
    const complete = async (sessionId, requestId, data, failed) => {
        await callBridge('complete', { sessionId, requestId, data, error: failed });
    };
    const run = async () => {
        while (!controller.signal.aborted) {
            const browserSiteUrl = readLegacySiteUrl();
            const browserApiOperations = readLegacyApiOperations() ?? '[]';
            const configuration = JSON.stringify({ siteUrl: browserSiteUrl, apiOperations: browserApiOperations });
            if (browserSiteUrl && configuration !== syncedConfiguration) {
                try {
                    const configured = await callBridge('configure', { siteUrl: browserSiteUrl, apiOperations: browserApiOperations });
                    if (configured.ok)
                        syncedConfiguration = configuration;
                }
                catch { /* retry after the DSH connection is ready */ }
            }
            const sessionId = activeSessionId(sessions);
            if (!sessionId) {
                await new Promise((resolve) => setTimeout(resolve, 900));
                continue;
            }
            try {
                const polled = await callBridge('poll', { sessionId });
                if (!polled.ok) {
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                    continue;
                }
                if (!polled.value || typeof polled.value !== 'object')
                    continue;
                const job = polled.value;
                if (typeof job.requestId !== 'string' || typeof job.path !== 'string' || !job.path.startsWith('/') || job.path.startsWith('//'))
                    continue;
                try {
                    const parameters = job.parameters && typeof job.parameters === 'object' ? job.parameters : {};
                    const data = job.path === EMPLOYEE_PERMISSION_PATH
                        ? await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.readEnterpriseEmployeePermissions?.()
                        : job.path === PAGE_INSPECT_PATH
                            ? await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.inspectEnterpriseWebsitePage?.()
                            : job.path === PAGE_ACTION_PATH
                                ? await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.controlEnterpriseWebsitePage?.({ action: typeof parameters.action === 'string' ? parameters.action : '', ...(typeof parameters.target === 'string' ? { target: parameters.target } : {}), ...(typeof parameters.value === 'string' ? { value: parameters.value } : {}) })
                                : await (function(){try{return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return (function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()}})()}})()?.readEnterpriseWebsiteApi?.(job.path, parameters);
                    if (data === undefined)
                        throw new Error('桌面 ERP 安全连接未就绪，请重开工作台后重试');
                    await complete(sessionId, job.requestId, data, false);
                }
                catch {
                    await complete(sessionId, job.requestId, null, true).catch(() => undefined);
                }
            }
            catch {
                if (!controller.signal.aborted)
                    await new Promise((resolve) => setTimeout(resolve, 1200));
            }
        }
    };
    void run();
    return () => controller.abort();
}
function apply(ctx) {
    const t = ctx.locale.bind(NS);
    ctx.effect(() => {
        const stopApiBridge = startApiBridge(ctx);
        const disposeLocale = ctx.locale.register(NS, { zh, en });
        const removeStyles = insertStyles(CSS);
        const siteForm = getConfigForm(ctx.configForms, CONFIG_NAMESPACE_ID);
        const sessions = ctx.get('sessions');
        const WorkbenchPanel = (props) => h(DashboardPanel, { ...props, t, siteForm, sessions });
        const stopWorkbench = ctx.desktopWorkbenches.register({
            title: 'AI 智能 工作台',
            repository: 'https://github.com/dataelement/dsh-desktop',
            description: '',
            panelTitle: 'AI 智能平台系统',
            layout: { businessSide: 'right', businessWidth: 0.7 },
            initialization: 'new-session',
            customFrame: true,
            defaultEnabled: true,
            desktopManaged: true,
        }, WorkbenchPanel);
        return () => {
            stopWorkbench();
            stopApiBridge();
            removeStyles();
            disposeLocale();
        };
    }, 'AI smart workbench');
}

return module.exports; } });
