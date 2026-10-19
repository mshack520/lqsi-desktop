import { URL } from "node:url";

const DEFAULT_BASE_URL = "http://121.40.84.3:4175/scx";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 500;
const DSH_SOURCE = "DSH 助手";
const CONFIRM_WORD = "确认执行";

const QUERY_PAGES = new Set([
  "summary", "overview", "process", "inventory", "local_stock", "shipments", "reports", "production", "aggregation",
  "delivery", "trace", "payroll", "equipment", "materials", "quality",
  "mappings", "plans", "production-plan", "alerts", "orders", "technical_documents", "backups", "connection", "product_routes", "routes"
]);

const DESTRUCTIVE_OPERATIONS = new Set([
  "dispatch_revoke", "plan_delete", "order_delete", "material_delete", "material_dictionary_remove",
  "quality_defect_revoke", "quality_ticket_delete", "quality_dictionary_remove", "backup_restore"
]);

const PRE_BACKUP_OPERATIONS = new Set([
  "thresholds_save",
  "material_add", "material_update", "material_delete", "material_record", "material_dictionary_add", "material_dictionary_remove",
  "quality_defect_add", "quality_defect_revoke", "quality_ticket_add", "quality_ticket_stage", "quality_ticket_delete",
  "quality_dictionary_add", "quality_dictionary_rename", "quality_dictionary_remove"
]);

const DAY_MS = 86_400_000;

function beijingDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

function dateRange(input, { defaultDays = 30 } = {}) {
  const endDate = input.endDate || beijingDate();
  const startDate = input.startDate || new Date(Date.parse(`${endDate}T00:00:00Z`) - (defaultDays - 1) * DAY_MS).toISOString().slice(0, 10);
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error("日期必须使用有效的 YYYY-MM-DD 格式");
  if (startDate > endDate) throw new Error("开始日期不能晚于结束日期");
  return { startDate, endDate, defaulted: !input.startDate && !input.endDate, inferredStart: !input.startDate, inferredEnd: !input.endDate };
}

function reportRange(input, now) {
  const day = safeText(input.day, 16);
  if (day) {
    if (input.startDate || input.endDate) throw new Error("使用 day 时不要同时传开始日期或结束日期");
    if (day !== "today" && day !== "yesterday") throw new Error("day 只支持 today 或 yesterday");
    const today = beijingDate(now);
    const selected = day === "today"
      ? today
      : new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
    return { startDate: selected, endDate: selected, defaulted: false, inferredStart: false, inferredEnd: false };
  }
  const today = beijingDate(now);
  const startDate = input.startDate || today;
  const endDate = input.endDate || today;
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error("日期必须使用有效的 YYYY-MM-DD 格式");
  if (startDate > endDate) throw new Error("开始日期不能晚于结束日期");
  return { startDate, endDate, defaulted: !input.startDate && !input.endDate, inferredStart: false, inferredEnd: false };
}

function payrollRange(input, now) {
  if (input.month) {
    if (input.startDate || input.endDate) throw new Error("使用 month 时不要同时传开始日期或结束日期");
    const month = safeText(input.month, 7);
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) throw new Error("月份格式应为 YYYY-MM");
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}`, defaulted: false, inferredStart: false, inferredEnd: false };
  }
  const endDate = input.endDate || beijingDate(now);
  const startDate = input.startDate || `${endDate.slice(0, 7)}-01`;
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error("日期必须使用有效的 YYYY-MM-DD 格式");
  if (startDate > endDate) throw new Error("开始日期不能晚于结束日期");
  return { startDate, endDate, defaulted: !input.startDate && !input.endDate, inferredStart: !input.startDate, inferredEnd: !input.endDate };
}

function enforceMaxRange(range, maxDays = 366) {
  const days = (Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / DAY_MS + 1;
  if (days > maxDays) throw new Error(`日期范围最多 ${maxDays} 天，请缩小查询区间`);
  return range;
}

function describeRange(range, defaultDescription) {
  if (range.defaulted) return defaultDescription;
  if (range.inferredStart) return "未指定开始日期，按默认近 30 天窗口补齐（北京时间）";
  if (range.inferredEnd) return "未指定结束日期，已取北京时间今天";
  return "";
}

export function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value || DEFAULT_BASE_URL);
  } catch {
    throw new Error("SCX MES 地址无效");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("MES 地址只能是 HTTP(S) 基础地址，不能包含账号、密码、查询参数或片段");
  }
  let decodedPath = url.pathname;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { throw new Error("MES 基础路径编码无效"); }
  if (decodedPath.split("/").some((part) => part === "..")) throw new Error("MES 基础路径不能包含上级目录");
  return url;
}

function buildUrl(base, apiPath, params = {}) {
  const prefix = base.pathname.replace(/\/$/, "");
  const url = new URL(`${prefix}${apiPath}`, base.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function safeText(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function stringQuery(input, key, max = 100) {
  return safeText(input[key], max);
}

function assertRecord(value, label = "payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 必须是对象`);
  return value;
}

function pick(source, fields) {
  const result = {};
  for (const field of fields) {
    if (Object.hasOwn(source, field)) result[field] = source[field];
  }
  return result;
}

function exactPositiveQuantity(value, label = "发货数量") {
  const max = 100_000_000n;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0 || value > Number(max)) throw new Error(`${label}必须是 1 到 100,000,000 之间的整数`);
    return value;
  }
  const expression = String(value ?? "").replace(/[\s,，]/g, "").replace(/[x×]/gi, "*");
  if (expression.length > 200) throw new Error(`${label}表达式过长`);
  if (!/^\d+(?:\*\d+)*(?:\+\d+(?:\*\d+)*)*$/.test(expression)) {
    throw new Error(`${label}只支持正整数、整数乘法和加法，例如 400*4+272；小数或其他运算不允许`);
  }
  let total = 0n;
  for (const term of expression.split("+")) {
    let product = 1n;
    for (const factor of term.split("*")) {
      product *= BigInt(factor);
      if (product > max || total + product > max) throw new Error(`${label}不能超过 100,000,000`);
    }
    total += product;
  }
  if (total <= 0n) throw new Error(`${label}必须大于 0`);
  return Number(total);
}

function validateRowLimit(value) {
  const number = value === undefined ? DEFAULT_ROW_LIMIT : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > MAX_ROW_LIMIT) {
    throw new Error(`limit 必须是 1 到 ${MAX_ROW_LIMIT} 之间的整数`);
  }
  return number;
}

function capArrays(value, limit, path = "$", truncatedPaths = []) {
  if (Array.isArray(value)) {
    if (value.length > limit) {
      truncatedPaths.push({ path, total: value.length, returned: limit });
      return value.slice(0, limit).map((item, index) => capArrays(item, limit, `${path}[${index}]`, truncatedPaths));
    }
    return value.map((item, index) => capArrays(item, limit, `${path}[${index}]`, truncatedPaths));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, capArrays(item, limit, `${path}.${key}`, truncatedPaths)]));
}

function filterRows(rows, query, fields) {
  if (!Array.isArray(rows) || !query) return rows || [];
  const needle = query.toLocaleLowerCase("zh-CN");
  return rows.filter((row) => fields.some((field) => String(row?.[field] ?? "").toLocaleLowerCase("zh-CN").includes(needle)));
}

function filterByProduct(rows, product) {
  if (!Array.isArray(rows) || !product) return rows || [];
  const needle = product.toLocaleLowerCase("zh-CN");
  return rows.filter((row) => [row?.specification, row?.product, row?.productName, row?.name]
    .some((value) => String(value ?? "").toLocaleLowerCase("zh-CN").includes(needle)));
}

function sanitizedConnection(payload) {
  return {
    meta: payload?.meta || null,
    queryPlan: Array.isArray(payload?.queryPlan) ? payload.queryPlan : [],
    connectionError: payload?.connectionError || null
  };
}

function parseResponseBody(response) {
  return response.json().catch(() => {
    throw new Error("看板返回的不是 JSON。请检查 MES 地址和 API 服务状态。");
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function actionRequest(input) {
  const operation = safeText(input.operation, 50);
  const payload = assertRecord(input.payload || {}, "payload");
  const source = DSH_SOURCE;

  if (DESTRUCTIVE_OPERATIONS.has(operation) && input.confirmDestructive !== CONFIRM_WORD) {
    throw new Error(`此操作可能删除、撤回或覆盖本机业务数据。请先向用户展示目标与影响并取得明确确认；确认后才可将 confirmDestructive 设为「${CONFIRM_WORD}」。未确认时没有执行任何写入。`);
  }

  switch (operation) {
    case "dispatch": {
      if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) {
        throw new Error("发货 items 必须包含 1 到 50 个型号及数量");
      }
      const items = payload.items.map((item, index) => {
        assertRecord(item, `items[${index}]`);
        if (item.quantity !== undefined && item.quantityExpression !== undefined) {
          throw new Error(`items[${index}] 只能提供 quantity 或 quantityExpression 其中一个`);
        }
        return {
          specification: safeText(item.specification, 100),
          quantity: exactPositiveQuantity(item.quantityExpression ?? item.quantity, `第 ${index + 1} 项发货数量`),
          ...(item.note ? { note: safeText(item.note, 200) } : {})
        };
      });
      return { method: "POST", path: "/api/hermes/dispatch", body: { ...pick(payload, ["date", "note"]), items, source: "DSH" } };
    }
    case "stocktake":
      // 云端登录接口按库位校验权限；盘仓只更新指定库位台账，不写 MES。
      return { method: "POST", path: "/api/local-inventory/stocktake", body: { ...pick(payload, ["specification", "date", "note", "storeCode"]), quantity: Number(payload.quantity) } };
    case "dispatch_revoke":
      return { method: "POST", path: `/api/local-inventory/dispatch/${encodeURIComponent(safeText(payload.id, 64))}/revoke`, body: {} };
    case "plan_add":
      return { method: "POST", path: "/api/production-plans", body: pick(payload, ["planName", "specification", "customer", "plannedQuantity", "dailyRequiredQuantity", "startDate", "dueDate"]) };
    case "plan_update":
      return { method: "PUT", path: `/api/production-plans/${encodeURIComponent(safeText(payload.id, 64))}`, body: pick(payload, ["planName", "specification", "customer", "plannedQuantity", "dailyRequiredQuantity", "startDate", "dueDate"]) };
    case "plan_delete":
      return { method: "DELETE", path: `/api/production-plans/${encodeURIComponent(safeText(payload.id, 64))}` };
    case "order_add":
      return { method: "POST", path: "/api/production-orders", body: pick(payload, ["date", "specification", "customer", "quantity", "dueDate", "assigneeId"]) };
    case "order_update":
      return { method: "PUT", path: `/api/production-orders/${encodeURIComponent(safeText(payload.id, 64))}`, body: pick(payload, ["date", "specification", "customer", "quantity", "dueDate", "assigneeId"]) };
    case "order_delete":
      return { method: "DELETE", path: `/api/production-orders/${encodeURIComponent(safeText(payload.id, 64))}` };
    case "thresholds_save":
      return { method: "POST", path: "/api/thresholds", body: { finishedSafe: payload.finishedSafe } };
    case "material_add":
      return { method: "POST", path: "/api/materials/items", body: pick(payload, ["category", "name", "spec", "unit", "safeStock", "initialStock", "equipment", "note"]) };
    case "material_update":
      return { method: "PUT", path: `/api/materials/items/${encodeURIComponent(safeText(payload.id, 64))}`, body: pick(payload, ["category", "name", "spec", "unit", "safeStock", "equipment", "note"]) };
    case "material_delete":
      return { method: "DELETE", path: `/api/materials/items/${encodeURIComponent(safeText(payload.id, 64))}` };
    case "material_record":
      return { method: "POST", path: "/api/materials/records", body: pick(payload, ["itemId", "type", "quantity", "date", "operator", "purpose", "note"]) };
    case "material_dictionary_add":
      return { method: "POST", path: "/api/materials/dictionaries", body: { kind: safeText(payload.kind, 30), action: "add", value: safeText(payload.value, 100) } };
    case "material_dictionary_remove":
      return { method: "POST", path: "/api/materials/dictionaries", body: { kind: safeText(payload.kind, 30), action: "remove", value: safeText(payload.value, 100) } };
    case "quality_defect_add":
      return { method: "POST", path: "/api/quality-manager/defects", body: { ...pick(payload, ["date", "step", "specification", "reason", "quantity", "disposal", "operator", "note"]), createdBy: source } };
    case "quality_defect_revoke":
      return { method: "POST", path: "/api/quality-manager/defects/revoke", body: { id: safeText(payload.id, 64) } };
    case "quality_ticket_add":
      return { method: "POST", path: "/api/quality-manager/tickets", body: { ...pick(payload, ["kind", "date", "symptom", "customer", "vendor", "product", "batchQuantity", "outsourceContent", "quantity", "result", "incidentType", "device", "operator", "handler", "handling", "lossNote"]), createdBy: source } };
    case "quality_ticket_stage":
      return { method: "POST", path: "/api/quality-manager/tickets/stage", body: pick(payload, ["kind", "id", "stage", "text", "owner", "due", "by"]) };
    case "quality_ticket_delete":
      return { method: "POST", path: "/api/quality-manager/tickets/delete", body: pick(payload, ["kind", "id"]) };
    case "quality_dictionary_add":
      return { method: "POST", path: "/api/quality-manager/dict", body: { ...pick(payload, ["list", "name"]), action: "add" } };
    case "quality_dictionary_rename":
      return { method: "POST", path: "/api/quality-manager/dict", body: { ...pick(payload, ["list", "id", "name"]), action: "rename" } };
    case "quality_dictionary_remove":
      return { method: "POST", path: "/api/quality-manager/dict", body: { ...pick(payload, ["list", "id"]), action: "remove" } };
    case "backup_create":
      return { method: "POST", path: "/api/local-data/backups", body: { reason: "manual" } };
    case "backup_restore": {
      const filename = safeText(payload.filename, 160);
      if (!/^scx-(local|daily)-data-\d{14}-[a-f0-9-]+\.json$/i.test(filename)) throw new Error("备份文件名格式无效，请从备份列表中选择完整文件名");
      return { method: "POST", path: `/api/local-data/backups/${encodeURIComponent(filename)}/restore`, body: {} };
    }
    default:
      throw new Error("不支持此本机操作；可使用自然语言说明业务意图，或通过看板页面完成未开放的文件操作。");
  }
}

export function createScxMesAssistant({
  baseUrl = process.env.SCX_MES_BASE_URL || DEFAULT_BASE_URL,
  timeoutMs = Number(process.env.SCX_MES_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  getConnection,
  refreshConnection,
  fetchImpl = globalThis.fetch,
  now = () => new Date()
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("当前 Node 运行时未提供 fetch");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) throw new Error("SCX_MES_TIMEOUT_MS 必须在 1000 到 60000 毫秒之间");

  async function request(apiPath, { method = "GET", params, body } = {}) {
    if (typeof getConnection !== "function") throw new Error("DSH 尚未配置 MES 云端账号，请先打开「业务工作台 → 连接设置 → AI 业务连接账号」");
    let connection = await getConnection();
    if (!connection?.sessionCookie) throw new Error("MES 登录凭据已失效，请在 DSH 设置中重新保存连接");
    let response;
    let payload;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const base = normalizeBaseUrl(connection.baseUrl || baseUrl);
      const url = buildUrl(base, apiPath, params);
      const headers = { Accept: "application/json", Cookie: connection.sessionCookie };
      const options = { method, headers, redirect: "error" };
      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
        headers.Origin = base.origin;
        options.body = JSON.stringify(body || {});
      }
      if (typeof AbortSignal?.timeout === "function") options.signal = AbortSignal.timeout(timeoutMs);
      try {
        response = await fetchImpl(url, options);
      } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new Error("MES 云端请求超时，请稍后重试");
        throw new Error("无法连接 MES 云端；请检查地址和网络");
      }
      if (response.status === 401 && attempt === 0 && typeof refreshConnection === "function") {
        connection = await refreshConnection();
        continue;
      }
      payload = await parseResponseBody(response);
      break;
    }
    if (!response?.ok) {
      const message = safeText(payload?.error || payload?.detail, 300) || `HTTP ${response?.status || "未知"}`;
      throw new Error(`MES 云端拒绝请求：${message}`);
    }
    return payload;
  }

  async function productionPlanData(browse, { product, plan, customer, limit }) {
    const planPayload = await browse("/api/production-plans");
    let plans = Array.isArray(planPayload?.plans) ? planPayload.plans : [];
    const includes = (value, needle) => !needle || String(value || "").toLocaleLowerCase("zh-CN").includes(needle.toLocaleLowerCase("zh-CN"));
    plans = plans.filter((row) => includes(row.specification, product)
      && includes(row.planName, plan)
      && includes(row.customer, customer));
    plans.sort((left, right) => String(left.dueDate || "").localeCompare(String(right.dueDate || ""))
      || String(left.planName || "").localeCompare(String(right.planName || ""), "zh-CN"));

    if (!plans.length) {
      return {
        planCount: 0,
        plans: [],
        note: "云端生产计划列表中没有匹配记录；请先在看板生产计划中添加计划。",
        filters: { plan: plan || "全部", product: product || "全部" }
      };
    }

    const today = beijingDate(now());
    const todayStamp = Date.parse(`${today}T00:00:00Z`);
    const supportedStart = new Date(todayStamp - 365 * DAY_MS).toISOString().slice(0, 10);
    const requestedStart = plans.reduce((earliest, row) => {
      const value = isValidDate(String(row.startDate || "")) ? String(row.startDate) : today;
      return value < earliest ? value : earliest;
    }, today);
    const startDate = requestedStart < supportedStart ? supportedStart : requestedStart;
    const endDate = today;
    const period = { startDate, endDate };
    const [aggregation, finishedFlow, inventoryPayload] = await Promise.all([
      browse("/api/production-aggregation", { params: period }),
      browse("/api/finished-flow", { params: period }),
      browse("/api/inventory")
    ]);
    const aggregationMeta = aggregation?.meta || {};
    if (aggregationMeta.mode !== "live") {
      return {
        planCount: plans.length,
        mesStatus: aggregationMeta.notice || aggregationMeta.connectionError || "未连接真实 MES",
        plans: plans.slice(0, limit).map((row) => ({
          id: row.id, planName: row.planName, specification: row.specification, customer: row.customer || "",
          plannedQuantity: Number(row.plannedQuantity) || 0,
          dailyRequiredQuantity: Number(row.dailyRequiredQuantity) || 0,
          startDate: row.startDate, dueDate: row.dueDate
        })),
        note: "已读取云端计划；MES 未连接，暂时无法计算工序报工和成品入库进度。",
        filters: { plan: plan || "全部", product: product || "全部" }
      };
    }
    const finishedMeta = finishedFlow?.meta || {};
    const inventoryMeta = inventoryPayload?.meta || {};
    if (finishedMeta.mode !== "live") throw new Error(finishedMeta.notice || finishedMeta.connectionError || "MES 成品入库数据不可用");
    if (inventoryMeta.mode !== "live") throw new Error(inventoryMeta.notice || inventoryMeta.connectionError || "MES 库存数据不可用");

    const reportRows = Array.isArray(aggregation?.rows) ? aggregation.rows : [];
    const finishRows = Array.isArray(finishedFlow?.rows) ? finishedFlow.rows : [];
    const inventoryRows = Array.isArray(inventoryPayload?.inventory) ? inventoryPayload.inventory : [];
    const routeCache = new Map();
    const stepNames = new Map([["CC001", "粗车"], ["BJC001", "半精车"], ["MB001", "磨边"], ["JC0001", "精车"], ["ZK001", "钻孔"]]);
    const quantity = (value) => {
      const result = Number(value) || 0;
      return Number.isInteger(result) ? result : Math.round(result * 10000) / 10000;
    };
    const percent = (value, target) => target > 0 ? Math.round(value / target * 1000) / 10 : null;
    const sum = (rows, key = "qty") => rows.reduce((total, row) => total + (Number(row?.[key]) || 0), 0);
    const outputPlans = [];

    for (const row of plans.slice(0, limit)) {
      const specification = String(row.specification || "");
      const planStart = isValidDate(String(row.startDate || "")) ? String(row.startDate) : startDate;
      const modelReports = reportRows.filter((item) => item.specification === specification
        && planStart <= String(item.date || "") && String(item.date || "") <= endDate);
      const exactPlanReports = modelReports.filter((item) => item.planName === row.planName);
      const planNameMatched = exactPlanReports.length > 0;
      const matchedReports = planNameMatched ? exactPlanReports : modelReports;
      const target = Number(row.plannedQuantity) || 0;

      if (!routeCache.has(specification)) {
        routeCache.set(specification, await browse("/api/product-routes", { params: { product: specification } }));
      }
      const routePayload = routeCache.get(specification);
      const routeEntry = (routePayload?.routes || []).find((item) => item.specification === specification);
      const selectedRoute = routeEntry?.selected || {};
      const modelInventory = inventoryRows.filter((item) => item.specification === specification);
      const routeSteps = [];
      for (const step of selectedRoute.steps || []) {
        const code = String(step.code || "");
        if (!stepNames.has(code)) continue;
        const stepReports = matchedReports.filter((item) => item.stepCode === code);
        const stepInventory = modelInventory.filter((item) => item.storeCode === code);
        const updateTime = stepInventory.map((item) => String(item.updateTime || "")).sort().at(-1) || null;
        const reported = sum(stepReports);
        routeSteps.push({
          step: step.name || stepNames.get(code),
          stepCode: code,
          cumulativeGoodReports: quantity(reported),
          completionPercent: percent(reported, target),
          currentWorkInProcess: quantity(sum(stepInventory, "num")),
          unit: "只",
          inventoryUpdatedAt: updateTime,
          sequence: step.sequence
        });
      }

      const finished = finishRows.filter((item) => item.specification === specification
        && planStart <= String(item.date || "") && String(item.date || "") <= endDate);
      const completed = sum(finished);
      const remaining = Math.max(0, target - completed);
      let estimatedCompletionDate = null;
      if (remaining > 0) {
        const recentStartDate = new Date(todayStamp - 6 * DAY_MS).toISOString().slice(0, 10);
        const rateStart = recentStartDate > planStart ? recentStartDate : planStart;
        const recentRows = finishRows.filter((item) => item.specification === specification
          && rateStart <= String(item.date || "") && String(item.date || "") <= endDate);
        const activeDays = Math.max(1, (todayStamp - Date.parse(`${rateStart}T00:00:00Z`)) / DAY_MS + 1);
        const dailyRate = sum(recentRows) / activeDays;
        if (dailyRate > 0) {
          const daysNeeded = Math.ceil(remaining / dailyRate);
          estimatedCompletionDate = new Date(todayStamp + daysNeeded * DAY_MS).toISOString().slice(0, 10);
        }
      }

      const dueDate = String(row.dueDate || "");
      let completionStatus = "暂无完工预测";
      if (completed >= target) completionStatus = "已完成";
      else if (dueDate && dueDate < endDate) completionStatus = "已逾期";
      else if (estimatedCompletionDate && dueDate && estimatedCompletionDate > dueDate) completionStatus = "预计延期";
      else if (estimatedCompletionDate && dueDate && estimatedCompletionDate === dueDate) completionStatus = "刚好按期";
      else if (estimatedCompletionDate && dueDate && estimatedCompletionDate < dueDate) completionStatus = "预计提前";

      let routeProgress = [];
      if (routeSteps.length) {
        routeProgress = [
          { node: "毛坯仓库", currentInventory: quantity(sum(modelInventory.filter((item) => item.storeCode === "MP01"), "num")), unit: "只" },
          ...routeSteps.map((item) => ({ node: item.step, ...item })),
          { node: "成品仓库", currentInventory: quantity(sum(modelInventory.filter((item) => item.storeCode === "CP01"), "num")), unit: "只" }
        ];
      }
      outputPlans.push({
        id: row.id,
        planName: row.planName,
        specification,
        customer: row.customer || "",
        plannedQuantity: quantity(target),
        dailyRequiredQuantity: Number(row.dailyRequiredQuantity) || 0,
        startDate: planStart,
        dueDate,
        route: routeSteps.length ? ["毛坯仓库", ...routeSteps.map((item) => item.step), "成品仓库"].join(" → ") : "MES 正式路线中未找到该型号",
        mesRouteName: selectedRoute.routeName || null,
        routeAmbiguous: Boolean(routeEntry?.ambiguous),
        routeProgress,
        reportPlanMatch: planNameMatched ? "精确匹配" : "未匹配，按规格型号汇总",
        completedQuantity: quantity(completed),
        completionPercent: percent(completed, target),
        remainingQuantity: quantity(remaining),
        estimatedCompletionDate: estimatedCompletionDate || "暂无估算",
        completionStatus,
        reportDateRange: { startDate: planStart > startDate ? planStart : startDate, endDate }
      });
    }

    return {
      planCount: plans.length,
      mesStatus: "真实 MES 只读数据",
      beijingTime: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium", hour12: false }).format(now()),
      plans: outputPlans,
      note: "计划来自云端看板计划表；工序数量来自 MES 良品报工；实际完成只按进入成品仓库的入库流水累计。未匹配 MES 计划名称时，工序数量按型号汇总，可能包含同型号其他计划。",
      rangeLimited: requestedStart < supportedStart,
      filters: { plan: plan || "全部", product: product || "全部" }
    };
  }

  function productionAlerts(planData, today) {
    const notices = [];
    for (const row of planData.plans || []) {
      if (row.completionStatus === "已逾期" || row.completionStatus === "预计延期") {
        notices.push({
          type: "延期", specification: row.specification, planName: row.planName,
          status: row.completionStatus, estimatedCompletionDate: row.estimatedCompletionDate, dueDate: row.dueDate
        });
      }
      for (const step of (row.routeProgress || []).slice(1, -1)) {
        const stamp = String(step.inventoryUpdatedAt || "");
        const updatedDate = stamp.slice(0, 10);
        if (!isValidDate(updatedDate) || Number(step.currentWorkInProcess) <= 0) continue;
        const staleDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${updatedDate}T00:00:00Z`)) / DAY_MS);
        if (staleDays >= 7) {
          notices.push({
            type: "在制积压核查", specification: row.specification, planName: row.planName,
            step: step.step || step.node, currentWorkInProcess: step.currentWorkInProcess,
            inventoryUpdatedAt: stamp, staleDays
          });
        }
      }
    }
    return {
      count: notices.length,
      alerts: notices,
      note: "积压提醒条件为 MES 工序库存非零且库存更新时间至少 7 天前；这只是核查信号，不单独断定实际停滞。",
      planNote: planData.note
    };
  }

  async function query(input = {}) {
    const page = safeText(input.page, 40);
    if (!QUERY_PAGES.has(page)) throw new Error(`未知页面。可用页面：${[...QUERY_PAGES].join("、")}`);
    if (page === "payroll" && input.sensitiveRequestConfirmed !== true) throw new Error("薪酬数据敏感；只有用户在本轮明确询问薪酬时才能将 sensitiveRequestConfirmed 设为 true");
    const limit = validateRowLimit(input.limit);
    const queryText = stringQuery(input, "query");
    const product = stringQuery(input, "product");
    const plan = stringQuery(input, "plan");
    const step = stringQuery(input, "step", 30);
    const employee = stringQuery(input, "employee", 80);
    const category = stringQuery(input, "category", 40);
    const customer = stringQuery(input, "customer", 100);
    const date = input.date || beijingDate(now());
    const view = stringQuery(input, "view", 16) || "monthly";
    if (input.date && !isValidDate(input.date)) throw new Error("date 必须是有效的 YYYY-MM-DD");

    const verificationChecks = [];
    const browse = async (path, options = {}) => {
      const first = await request(path, options);
      const second = await request(path, options);
      const matched = canonicalJson(first) === canonicalJson(second);
      verificationChecks.push({ endpoint: path, matched });
      if (!matched) {
        throw new Error(`查询数据二次验证未通过：${path} 两次读取结果不一致。为避免回复可能错误的数据，本次结果已拦截，请稍后重新查询。`);
      }
      return second;
    };

    let data;
    let rangeNote = "";
    switch (page) {
      case "summary": {
        const today = beijingDate(now());
        const [overviewPayload, qualityPayload, reportsPayload] = await Promise.all([
          browse("/api/overview"),
          browse("/api/quality"),
          browse("/api/reports", { params: { startDate: today, endDate: today } })
        ]);
        const meta = overviewPayload?.meta || {};
        if (meta.mode !== "live") throw new Error(meta.notice || meta.connectionError || "看板尚未连接真实 MES，无法提供实时生产数据");
        const qualityRows = Array.isArray(qualityPayload?.quality) ? qualityPayload.quality : [];
        const reportRows = Array.isArray(reportsPayload?.rows) ? reportsPayload.rows : [];
        data = {
          status: "真实 MES 只读连接正常",
          beijingTime: meta.lastSync,
          statisticsDate: String(meta.lastSync || "").slice(0, 10),
          todayGoodReports: Number(overviewPayload?.overview?.todayReports) || 0,
          unit: "只",
          todayReportCount: Number(reportsPayload?.total) || reportRows.length,
          steps: qualityRows.map((row) => ({ step: row.step, goodQuantity: Number(row.reportQty) || 0, unit: "只", reportCount: Number(row.reportCount) || 0 }))
        };
        break;
      }
      case "overview": data = await browse("/api/overview"); break;
      case "process": data = await browse("/api/process"); break;
      case "inventory": data = await browse("/api/inventory", { params: { q: queryText || product } }); break;
      case "local_stock": {
        const params = { includeShipmentBalances: input.includeShipmentBalances ? "1" : undefined };
        if (input.startDate || input.endDate) {
          const range = dateRange(input);
          params.shipmentStartDate = range.startDate;
          params.shipmentEndDate = range.endDate;
          rangeNote = describeRange(range, "未指定日期，按看板近 30 天默认口径");
        }
        if (product) params.shipmentSpecification = product;
        data = await browse("/api/local-inventory", { params });
        if (product) data.events = filterByProduct(data.events, product);
        if (input.startDate || input.endDate) {
          const range = dateRange(input);
          data.events = (data.events || []).filter((event) => !event.date || (event.date >= range.startDate && event.date <= range.endDate));
        }
        break;
      }
      case "shipments": {
        const range = dateRange(input, { defaultDays: 1 });
        const params = { includeShipmentBalances: input.includeShipmentBalances ? "1" : undefined };
        params.shipmentStartDate = range.startDate;
        params.shipmentEndDate = range.endDate;
        rangeNote = range.defaulted
          ? "未指定日期，按北京时间今天查询"
          : range.inferredStart
            ? "未指定开始日期，按结束日期当天查询"
            : range.inferredEnd
              ? "未指定结束日期，按北京时间今天作为结束日期"
              : "";
        if (product) params.shipmentSpecification = product;
        const localInventory = await browse("/api/local-inventory", { params });
        const events = (Array.isArray(localInventory?.events) ? localInventory.events : [])
          .filter((event) => event?.type === "dispatch" && (event.storeCode || "CP01") === "CP01")
          .filter((event) => {
            const eventDate = String(event.date || event.createdAt || "").slice(0, 10);
            return eventDate >= range.startDate && eventDate <= range.endDate;
          });
        const filteredEvents = product ? filterByProduct(events, product) : events;
        const records = filteredEvents.map((event) => {
          const createdAt = safeText(event.createdAt || event.date, 40);
          const quantity = event.quantity === undefined || event.quantity === null || event.quantity === ""
            ? null
            : Number.isSafeInteger(Number(event.quantity)) ? Number(event.quantity) : null;
          return {
            id: safeText(event.id, 80) || null,
            date: String(event.date || createdAt).slice(0, 10),
            time: createdAt.length >= 19 ? createdAt.slice(11, 19) : "",
            specification: safeText(event.specification, 100) || null,
            quantity,
            unit: "只",
            balanceBefore: event.previousQuantity ?? null,
            balanceAfter: event.balanceAfter ?? null,
            source: safeText(event.source, 100) || null,
            note: safeText(event.note, 300) || ""
          };
        });
        data = {
          dateRange: { startDate: range.startDate, endDate: range.endDate },
          filters: { product: product || "全部" },
          recordCount: records.length,
          totalQuantity: records.reduce((sum, record) => sum + (record.quantity || 0), 0),
          unit: "只",
          records,
          ...(input.includeShipmentBalances ? {
            shipmentBalances: localInventory.shipmentBalances ?? null,
            shipmentBalanceError: localInventory.shipmentBalanceError || ""
          } : {})
        };
        break;
      }
      case "reports":
      case "production":
      case "aggregation":
      case "delivery": {
        const range = page === "reports"
          ? enforceMaxRange(reportRange(input, now()), 366)
          : enforceMaxRange(dateRange(input), 366);
        rangeNote = page === "reports"
          ? (input.day ? `按${input.day === "today" ? "今天" : "昨天"}查询（北京时间）` : describeRange(range, "未指定日期，按今天查询（北京时间）"))
          : describeRange(range, "未指定日期，按近 30 天查询（北京时间）");
        const params = { startDate: range.startDate, endDate: range.endDate, q: queryText || undefined, step: step || undefined, product: product || undefined, plan: plan || undefined };
        if (page === "reports") data = await browse("/api/reports", { params });
        else if (page === "production" || page === "aggregation") data = await browse("/api/production-aggregation", { params });
        else {
          const [plans, analytics] = await Promise.all([
            browse("/api/production-plans"),
            browse("/api/production-aggregation", { params })
          ]);
          data = { plans: (plans.plans || []).filter((row) => (!customer || String(row.customer || "").includes(customer)) && (!product || String(row.specification || "").includes(product))), analytics };
        }
        if (input.summaryOnly === true && Array.isArray(data?.rows)) {
          const rows = data.rows;
          data = { ...data, returnedRowCount: rows.length, rows: [] };
        }
        break;
      }
      case "trace": {
        if (!product) throw new Error("批次/生产追溯页按规格型号查询，请提供 product（规格型号）");
        const range = enforceMaxRange(dateRange(input), 366);
        rangeNote = describeRange(range, "未指定日期，追溯报工按近 30 天查询（北京时间）");
        const [reports, inventory, mesQuality, local, qualityManager, route] = await Promise.all([
          browse("/api/reports", { params: { product, startDate: range.startDate, endDate: range.endDate } }),
          browse("/api/inventory", { params: { q: product } }),
          browse("/api/quality"),
          browse("/api/local-inventory", { params: { shipmentSpecification: product } }),
          browse("/api/quality-manager"),
          browse("/api/product-routes", { params: { product } })
        ]);
        data = {
          specification: product,
          route,
          reports,
          inventory,
          mesQuality,
          localStockEvents: filterByProduct(local.events, product),
          localQuality: {
            defects: filterByProduct(qualityManager.defects, product),
            complaints: filterByProduct(qualityManager.complaints, product),
            outsourcing: filterByProduct(qualityManager.outsourcing, product),
            incidents: filterByProduct(qualityManager.incidents, product)
          }
        };
        break;
      }
      case "payroll": {
        if (view !== "monthly" && view !== "daily") throw new Error("薪酬 view 只支持 monthly 或 daily");
        const range = payrollRange(input, now());
        rangeNote = describeRange(range, "未指定日期，薪酬按本月 1 日至今天（北京时间）");
        const payroll = await browse("/api/payroll", { params: { startDate: range.startDate, endDate: range.endDate, category: category || "all", view, specification: product || undefined, employee: employee || undefined } });
        const summaryRows = Array.isArray(payroll[view === "monthly" ? "monthlySummary" : "dailySummary"])
          ? payroll[view === "monthly" ? "monthlySummary" : "dailySummary"] : [];
        if (input.payrollDetails === true) {
          data = {
            period: { startDate: range.startDate, endDate: range.endDate },
            view,
            viewLabel: view === "monthly" ? "月度人员汇总" : "员工每日明细",
            filters: { employee: employee || "全部", product: product || "全部", category: category || "all" },
            returnedRowCount: summaryRows.length,
            truncated: Boolean(payroll.truncated),
            records: summaryRows
          };
        } else {
          const amountFields = ["pieceworkAmount", "rewardAmount", "qualityDeduction", "socialAmount", "taxAmount", "mealAllowance", "hourlyAmount", "attendanceBonus", "totalAmount"];
          const totals = Object.fromEntries(amountFields.map((field) => [field, summaryRows.reduce((sum, row) => {
            const amount = Number(row?.[field]);
            return sum + (Number.isFinite(amount) ? amount : 0);
          }, 0)]));
          if (view === "daily") totals.socialAmount = 0;
          data = {
            period: { startDate: range.startDate, endDate: range.endDate },
            view,
            detailIncluded: false,
            recordCount: summaryRows.length,
            employeeCount: new Set(summaryRows.map((row) => row?.employee).filter(Boolean)).size,
            totals
          };
        }
        break;
      }
      case "equipment": {
        data = await browse("/api/equipment", { params: { date } });
        if (queryText && Array.isArray(data?.devices)) {
          const needle = queryText.toLocaleLowerCase("zh-CN");
          data.devices = data.devices.filter((row) => {
            const scalarFields = ["code", "name", "model", "connectionStatus", "runningStatus", "machineCount", "runningStatusParameter", "machineCountParameter"];
            const arrayFields = ["specifications", "products", "steps", "operators"];
            return scalarFields.some((field) => String(row?.[field] ?? "").toLocaleLowerCase("zh-CN").includes(needle))
              || arrayFields.some((field) => (row?.[field] || []).some((value) => String(value).toLocaleLowerCase("zh-CN").includes(needle)));
          });
        }
        break;
      }
      case "materials": {
        data = await browse("/api/materials");
        if (queryText) {
          data.items = filterRows(data.items, queryText, ["category", "name", "spec", "unit", "equipment", "note"]);
          data.records = filterRows(data.records, queryText, ["name", "spec", "operator", "purpose", "note"]);
        }
        if (category) data.items = (data.items || []).filter((item) => item.category === category);
        break;
      }
      case "quality": {
        const [mesQuality, local, partners] = await Promise.all([
          browse("/api/quality"), browse("/api/quality-manager"), browse("/api/quality-partners")
        ]);
        data = { mesQuality, localQuality: local, partners };
        break;
      }
      case "mappings": {
        const [mappings, thresholds, materials, qualityManager, qualityPartners] = await Promise.all([
          browse("/api/mappings"), browse("/api/thresholds"), browse("/api/materials"),
          browse("/api/quality-manager"), browse("/api/quality-partners")
        ]);
        data = {
          mappings,
          thresholds,
          materialDictionaries: materials.dictionaries,
          qualityDictionaries: {
            codes: qualityManager.codes || [],
            customers: qualityManager.customers || [],
            vendors: qualityManager.vendors || [],
            incidentTypes: qualityManager.incidentTypes || []
          },
          qualityPartners
        };
        break;
      }
      case "plans": {
        data = await browse("/api/production-plans");
        data.plans = (data.plans || []).filter((row) => (!product || String(row.specification || "").includes(product)) && (!plan || String(row.planName || "").includes(plan)) && (!customer || String(row.customer || "").includes(customer)));
        break;
      }
      case "production-plan":
        data = await productionPlanData(browse, { product, plan, customer, limit });
        break;
      case "alerts": {
        const planData = await productionPlanData(browse, { product, plan, customer, limit });
        data = productionAlerts(planData, beijingDate(now()));
        break;
      }
      case "orders": {
        data = await browse("/api/production-orders");
        data.orders = (data.orders || []).filter((row) => (!product || String(row.specification || "").includes(product)) && (!customer || String(row.customer || "").includes(customer)) && (!queryText || [row.specification, row.customer].some((value) => String(value || "").includes(queryText))));
        break;
      }
      case "technical_documents": {
        data = await browse("/api/technical-documents");
        if (queryText) data.documents = filterRows(data.documents, queryText, ["title", "fileName", "filename", "name", "specification", "category"]);
        break;
      }
      case "backups": data = await browse("/api/local-data/backups"); break;
      case "connection": data = sanitizedConnection(await browse("/api/connection")); break;
      case "product_routes":
      case "routes":
        if (!product) throw new Error("查询型号工艺路线需要提供 product（规格型号）");
        data = await browse("/api/product-routes", { params: { product } });
        break;
      default: throw new Error("页面暂不支持查询");
    }

    const truncatedPaths = [];
    const bounded = capArrays(data, limit, "$", truncatedPaths);
    return {
      ok: true,
      page,
      source: "鑫程智造云端看板 API",
      mesWriteBoundary: "MES 只读；查询没有执行任何写入",
      timeZone: "Asia/Shanghai",
      verification: {
        status: "passed",
        method: "每个查询接口独立读取两次并逐字段比对",
        verifiedEndpointCount: verificationChecks.length,
        readCount: verificationChecks.length * 2,
        checks: verificationChecks
      },
      ...(rangeNote ? { dateNote: rangeNote } : {}),
      limit,
      truncated: truncatedPaths.length > 0,
      truncatedPaths,
      data: bounded
    };
  }

  async function write(input = {}) {
    const browse = (path, options = {}) => request(path, options);
    const requestSpec = actionRequest(input);
    // 生产订单必须先有接收人：允许用中文姓名指定，这里解析成账号 id；修改订单时不指定则保留原接收人。
    if (input.operation === "order_add" || input.operation === "order_update") {
      const wanted = safeText(input.payload?.assigneeName, 50);
      if (!requestSpec.body.assigneeId && (wanted || input.operation === "order_add")) {
        const options = await browse("/api/account-options");
        const accounts = Array.isArray(options?.accounts) ? options.accounts : [];
        const match = wanted
          ? accounts.find((item) => item.displayName === wanted || item.username === wanted || item.id === wanted)
          : null;
        if (wanted && !match) {
          const names = accounts.map((item) => item.displayName || item.username).join("、");
          throw new Error(`接收人「${wanted}」不存在或已停用。可选：${names || "（暂无可用账号，请先到基础映射的人员管理添加）"}`);
        }
        if (!match) {
          const names = accounts.map((item) => item.displayName || item.username).join("、");
          throw new Error(`新增生产订单必须指定接收人：请在 payload 里传 assigneeName（例如「鲁伟」）。当前可选：${names || "（暂无可用账号，请先到基础映射的人员管理添加）"}`);
        }
        requestSpec.body.assigneeId = match.id;
      }
    }
    let safetyBackup = null;
    if (PRE_BACKUP_OPERATIONS.has(input.operation)) {
      safetyBackup = await browse("/api/local-data/backups", { method: "POST", body: { reason: "manual" } });
    }
    const response = await browse(requestSpec.path, requestSpec);
    return {
      ok: true,
      operation: input.operation,
      ...(safetyBackup ? { safetyBackup } : {}),
      result: response,
      boundary: "写入云端看板台账；没有向现有 MES SQL Server 写回。"
    };
  }

  return { query, write, request, baseUrl: normalizeBaseUrl(baseUrl).href };
}

export const scxMesConstants = Object.freeze({
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultRowLimit: DEFAULT_ROW_LIMIT,
  maxRowLimit: MAX_ROW_LIMIT,
  confirmWord: CONFIRM_WORD,
  queryPages: [...QUERY_PAGES],
  destructiveOperations: [...DESTRUCTIVE_OPERATIONS]
});
