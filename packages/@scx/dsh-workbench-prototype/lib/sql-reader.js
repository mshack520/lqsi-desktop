import sql from 'mssql';
import mysql from 'mysql2/promise';
import { Pool } from 'pg';
const MAX_TABLES = 500;
const MAX_COLUMNS_PER_TABLE = 200;
const MAX_RESULT_BYTES = 1024 * 1024;
function driverErrorCode(error) {
    let current = error;
    let fallback = 'UNKNOWN';
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
        const value = current;
        if (typeof value.code === 'string' && /^[A-Z0-9_:-]{1,40}$/i.test(value.code)) {
            const code = value.code.toUpperCase();
            if (code !== 'EREQUEST' && code !== 'UNKNOWN')
                return code;
            fallback = code;
        }
        if (typeof value.number === 'number' && Number.isInteger(value.number))
            return `SQL_${value.number}`;
        current = value.originalError ?? value.cause ?? value.info;
    }
    return fallback;
}
function safeDriverDetail(error, settings) {
    let current = error;
    const messages = [];
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
        const value = current;
        if (typeof value.message === 'string')
            messages.push(value.message);
        current = value.originalError ?? value.cause ?? value.info;
    }
    const detail = messages.at(-1) || messages[0];
    if (!detail)
        return undefined;
    const safe = detail
        .replaceAll(settings.password, '[密码已隐藏]')
        .replaceAll(settings.username, '[账号已隐藏]')
        .replace(/(password|pwd|access[_ -]?token)\s*[:=]\s*[^;\s,]+/gi, '$1=[已隐藏]')
        .replace(/[\r\n\t\x00-\x1f\x7f]+/g, ' ')
        .trim()
        .slice(0, 180);
    return safe || undefined;
}
function connectionErrorMessage(dialect, stage, error, settings) {
    const code = driverErrorCode(error);
    const number = code.startsWith('SQL_') ? Number(code.slice(4)) : undefined;
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ETIMEOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
        return `${stage}失败 [${code}]：数据库主机或端口无法连通。确认填写的是 SQL 数据库地址和端口，并检查防火墙、VPN 和服务器远程访问设置。`;
    }
    if (code === 'ESOCKET') {
        const detail = safeDriverDetail(error, settings);
        const reason = dialect === 'sqlserver'
            ? 'TCP 连接存在，但 SQL Server 握手失败。确认该端口提供原生 SQL Server 服务，并检查加密/证书设置。'
            : 'TCP 连接存在，但数据库协议握手失败。确认数据库类型、端口和服务器 TLS 设置匹配。';
        return `${stage}失败 [${code}]：${reason}${detail ? `驱动信息：${detail}` : ''}`;
    }
    if (['ELOGIN', 'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', '28P01', '28000'].includes(code) || number === 18456 || number === 1045) {
        return `${stage}失败 [${code}]：数据库拒绝登录。检查账号密码、账号允许的来源地址，以及 SQL Server 是否启用对应登录方式。`;
    }
    if (['ER_BAD_DB_ERROR', '3D000'].includes(code) || number === 4060) {
        return `${stage}失败 [${code}]：数据库名称不存在或该账号无权访问。`;
    }
    if (['42501', 'ER_TABLEACCESS_DENIED_ERROR'].includes(code) || number === 229 || number === 916) {
        return `${stage}失败 [${code}]：账号已连接，但缺少读取数据库表结构或数据的权限。`;
    }
    if (/CERT|TLS|SSL|EPROTO|SELF_SIGNED/i.test(code)) {
        return `${stage}失败 [${code}]：数据库加密证书校验失败。确认服务器证书；仅在企业网络策略允许时再调整“加密连接”选项。`;
    }
    return `${stage}失败 [${code}]（${dialect}）：检查数据库地址、端口、库名、只读账号权限和加密设置。`;
}
function validateSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('连接设置格式无效');
    const input = value;
    if (!['sqlserver', 'mysql', 'postgres'].includes(String(input.dialect)))
        throw new Error('请选择 SQL Server、MySQL 或 PostgreSQL');
    if (typeof input.host !== 'string' || !/^[a-zA-Z0-9.:[\]-]{1,253}$/.test(input.host.trim()))
        throw new Error('数据库地址格式无效');
    if (!Number.isInteger(input.port) || Number(input.port) < 1 || Number(input.port) > 65535)
        throw new Error('数据库端口无效');
    if (typeof input.database !== 'string' || !input.database.trim() || input.database.length > 128)
        throw new Error('数据库名称无效');
    if (typeof input.username !== 'string' || !input.username.trim() || input.username.length > 128)
        throw new Error('SQL 用户名无效');
    if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 1024)
        throw new Error('SQL 密码无效');
    if (typeof input.ssl !== 'boolean')
        throw new Error('加密连接设置无效');
    return {
        dialect: input.dialect,
        host: input.host.trim(),
        port: Number(input.port),
        database: input.database.trim(),
        username: input.username.trim(),
        ssl: input.ssl,
        password: input.password,
    };
}
function rowsFromSqlServer(result) {
    return result.recordset;
}
export class SqlReader {
    active;
    isConnected() { return Boolean(this.active); }
    async disconnect() {
        const active = this.active;
        this.active = undefined;
        if (!active)
            return;
        try {
            if (active.dialect === 'sqlserver')
                await active.pool.close();
            else
                await active.pool.end();
        }
        catch { /* disconnect is best-effort cleanup */ }
    }
    async connect(value) {
        const settings = validateSettings(value);
        await this.disconnect();
        let stage = '连接数据库';
        try {
            if (settings.dialect === 'sqlserver') {
                const pool = await new sql.ConnectionPool({
                    server: settings.host,
                    port: settings.port,
                    database: settings.database,
                    user: settings.username,
                    password: settings.password,
                    connectionTimeout: 8000,
                    requestTimeout: 10000,
                    pool: { min: 0, max: 2, idleTimeoutMillis: 10000 },
                    options: { encrypt: settings.ssl, trustServerCertificate: false, appName: 'DSH ERP Read Only' },
                }).connect();
                this.active = { dialect: 'sqlserver', pool };
            }
            else if (settings.dialect === 'mysql') {
                const pool = mysql.createPool({
                    host: settings.host,
                    port: settings.port,
                    database: settings.database,
                    user: settings.username,
                    password: settings.password,
                    ssl: settings.ssl ? {} : undefined,
                    waitForConnections: true,
                    connectionLimit: 2,
                    connectTimeout: 8000,
                    enableKeepAlive: true,
                });
                await pool.query('SELECT 1');
                this.active = { dialect: 'mysql', pool };
            }
            else {
                const pool = new Pool({
                    host: settings.host,
                    port: settings.port,
                    database: settings.database,
                    user: settings.username,
                    password: settings.password,
                    ssl: settings.ssl ? { rejectUnauthorized: true } : undefined,
                    max: 2,
                    connectionTimeoutMillis: 8000,
                    statement_timeout: 10000,
                    query_timeout: 10000,
                    application_name: 'DSH ERP Read Only',
                });
                await pool.query('SELECT 1');
                this.active = { dialect: 'postgres', pool };
            }
            stage = '读取数据库表结构';
            const tables = await this.listTables();
            return { tableCount: tables.length };
        }
        catch (error) {
            await this.disconnect();
            throw new Error(connectionErrorMessage(settings.dialect, stage, error, settings));
        }
    }
    async listTables() {
        const active = this.requireConnection();
        let rows;
        if (active.dialect === 'sqlserver') {
            const result = await active.pool.request().query('SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION');
            rows = rowsFromSqlServer(result);
        }
        else if (active.dialect === 'mysql') {
            const [result] = await active.pool.query(`SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
        FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION LIMIT 100000`);
            rows = result;
        }
        else {
            const result = await active.pool.query(`SELECT table_schema, table_name, column_name, data_type
        FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name, ordinal_position LIMIT 100000`);
            rows = result.rows;
        }
        const grouped = new Map();
        for (const row of rows) {
            const schema = String(row.table_schema || '');
            const table = String(row.table_name || '');
            const name = active.dialect === 'mysql' ? table : `${schema}.${table}`;
            if (!schema || !table || !/^[\p{L}\p{N}_.$ -]{1,256}$/u.test(name))
                continue;
            if (!grouped.has(name) && grouped.size >= MAX_TABLES)
                continue;
            const columns = grouped.get(name) ?? [];
            if (columns.length < MAX_COLUMNS_PER_TABLE)
                columns.push({ name: String(row.column_name), type: String(row.data_type) });
            grouped.set(name, columns);
        }
        const tables = [...grouped.entries()].map(([name, columns]) => ({ name, columns }));
        if (Buffer.byteLength(JSON.stringify(tables)) > MAX_RESULT_BYTES)
            throw new Error('表结构太多，请联系管理员缩小数据库账号可见范围');
        return tables;
    }
    async readTable(tableName, requestedLimit) {
        const active = this.requireConnection();
        if (typeof tableName !== 'string' || tableName.length > 256)
            throw new Error('表名称无效');
        const limit = requestedLimit === undefined ? 20 : requestedLimit;
        if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 100)
            throw new Error('每次最多读取 100 行');
        const tables = await this.listTables();
        const table = tables.find((item) => item.name === tableName);
        if (!table)
            throw new Error('未找到该表；请先调用 erp_sql_schema 查看可读取的表');
        if (!table.columns.length)
            throw new Error('该表没有可读取的字段');
        const quoted = quoteTable(active.dialect, table.name);
        const statement = active.dialect === 'sqlserver'
            ? `SELECT TOP (${Number(limit)}) * FROM ${quoted}`
            : `SELECT * FROM ${quoted} LIMIT ${Number(limit)}`;
        let rows;
        if (active.dialect === 'sqlserver')
            rows = rowsFromSqlServer(await active.pool.request().query(statement));
        else if (active.dialect === 'mysql') {
            const [result] = await active.pool.query(statement);
            rows = result;
        }
        else
            rows = (await active.pool.query(statement)).rows;
        const encoded = JSON.stringify(rows);
        if (Buffer.byteLength(encoded) > MAX_RESULT_BYTES)
            throw new Error('查询结果超过 1 MB，请减少读取行数或缩小字段');
        return { table: table.name, rows: JSON.parse(encoded) };
    }
    requireConnection() {
        if (!this.active)
            throw new Error('尚未连接数据库。请先在工作台连接设置中填写 SQL 连接信息并测试连接。');
        return this.active;
    }
}
function quoteIdentifier(dialect, name) {
    if (!name || name.includes('\0'))
        throw new Error('数据库对象名称无效');
    if (dialect === 'mysql')
        return `\`${name.replace(/`/g, '``')}\``;
    if (dialect === 'postgres')
        return `"${name.replace(/"/g, '""')}"`;
    return `[${name.replace(/]/g, ']]')}]`;
}
function quoteTable(dialect, name) {
    const parts = dialect === 'mysql' ? [name] : name.split('.');
    if (parts.some((part) => !part))
        throw new Error('数据库对象名称无效');
    return parts.map((part) => quoteIdentifier(dialect, part)).join('.');
}
//# sourceMappingURL=sql-reader.js.map