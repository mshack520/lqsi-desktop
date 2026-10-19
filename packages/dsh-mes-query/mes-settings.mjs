import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { normalizeBaseUrl } from './core.mjs'

export const DEFAULT_MES_BASE_URL = 'http://121.40.84.3:4175/scx'
const KEY = credentialKey('dsh-mes-query', 'cloud-connection')
const EMPTY = () => ({ revision: 0, baseUrl: DEFAULT_MES_BASE_URL, username: '', password: '', sessionCookie: '' })

function cookieFrom(response) {
  const value = response.headers.get('set-cookie') || ''
  const match = /(?:^|[,; ]+)scx_session=([^;,]+)/u.exec(value)
  if (!match) throw new Error('登录成功但服务器没有返回 MES 登录凭据。')
  return `scx_session=${match[1]}`
}

export async function authenticateMes({ baseUrl, username, password, fetchImpl = globalThis.fetch, signal }) {
  const base = normalizeBaseUrl(baseUrl)
  if (!username || !password) throw new Error('请输入 MES 系统账号和密码。')
  const prefix = base.pathname.replace(/\/$/u, '')
  let response
  try {
    response = await fetchImpl(new URL(`${prefix}/api/auth/login`, base.origin), {
      method: 'POST', redirect: 'error', signal: signal || AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: base.origin },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('无法连接 MES。请检查地址和网络。')
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('MES 系统账号或密码不正确。')
    if (response.status === 429) throw new Error('MES 登录尝试次数过多，请稍后再试。')
    if (response.status === 503) throw new Error('MES 尚未配置可登录的系统账号。')
    throw new Error(`MES 登录失败（HTTP ${response.status}）。`)
  }
  let payload
  try { payload = await response.json() } catch { throw new Error('MES 登录响应格式无效。') }
  if (payload?.authenticated !== true) throw new Error('MES 未确认登录成功。')
  return { sessionCookie: cookieFrom(response), displayName: String(payload.displayName || payload.username || username) }
}

export function createMesSettings(ctx, { fetchImpl = globalThis.fetch } = {}) {
  async function read() {
    const record = await ctx.credentials.readRecord(KEY)
    if (!record) return EMPTY()
    if (record.kind !== 'grant' || !Number.isSafeInteger(record.payload?.revision)
      || typeof record.payload?.baseUrl !== 'string' || typeof record.payload?.username !== 'string'
      || typeof record.payload?.password !== 'string' || typeof record.payload?.sessionCookie !== 'string') {
      throw new Error('保存的 MES 连接配置无效，请在设置里重新保存。')
    }
    return record.payload
  }

  async function describe() {
    const value = await read()
    let writable = true
    try { writable = (await ctx.credentials.describeRecord(KEY)).writable } catch {}
    return {
      revision: value.revision,
      baseUrl: value.baseUrl,
      username: value.username,
      configured: Boolean(value.username && value.password && value.sessionCookie),
      writable,
    }
  }

  async function active() {
    const value = await read()
    if (!value.username || !value.password || !value.sessionCookie) {
      throw new Error('请先在 DSH「业务工作台 → 连接设置 → AI 业务连接账号」中完成连接。')
    }
    return value
  }

  async function save(input, signal) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('连接设置格式无效。')
    const before = await read()
    if (!Number.isSafeInteger(input.revision) || input.revision !== before.revision) {
      const error = new Error('设置已在其他窗口更新，请重新打开此设置页。')
      error.status = 409
      throw error
    }
    const baseUrl = normalizeBaseUrl(String(input.baseUrl || '').trim()).href.replace(/\/$/u, '')
    const username = String(input.username || '').trim()
    const password = String(input.password || '')
    if (!username || username.length > 100 || /[\x00-\x1f\x7f]/u.test(username)) throw new Error('MES 系统账号不能为空，且不能包含控制字符。')
    if (!password || password.length > 512) throw new Error('MES 系统密码不能为空或过长。')
    const auth = await authenticateMes({ baseUrl, username, password, fetchImpl, signal })
    if (!(await describe()).writable) throw new Error('DSH 安全凭据存储当前为只读，无法保存 MES 连接。')
    const next = { revision: before.revision + 1, baseUrl, username, password, sessionCookie: auth.sessionCookie }
    await ctx.credentials.modifyRecord(KEY, async record => {
      const latest = record?.kind === 'grant' ? record.payload : EMPTY()
      if (latest.revision !== before.revision) {
        const error = new Error('设置已在其他窗口更新，请重新打开此设置页。')
        error.status = 409
        throw error
      }
      return { kind: 'grant', payload: next }
    })
    ctx.logger.info('dsh-mes-query: cloud MES connection saved; account=%s', username)
    return { ...(await describe()), connectedAs: auth.displayName }
  }

  async function logout() {
    const before = await describe()
    if (!before.writable) throw new Error('DSH 安全凭据存储当前为只读，无法注销 MES 账号。')
    await ctx.credentials.deleteRecord(KEY)
    ctx.logger.info('dsh-mes-query: cloud MES connection removed')
    return await describe()
  }

  async function refreshSession() {
    const current = await active()
    const auth = await authenticateMes({ ...current, fetchImpl })
    const next = { ...current, revision: current.revision + 1, sessionCookie: auth.sessionCookie }
    await ctx.credentials.modifyRecord(KEY, async record => {
      const latest = record?.kind === 'grant' ? record.payload : EMPTY()
      if (latest.revision !== current.revision) return record
      return { kind: 'grant', payload: next }
    })
    return next
  }

  return { active, describe, logout, refreshSession, save }
}
