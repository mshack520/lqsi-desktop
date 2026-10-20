/**
 * LQ SI 企业网页嵌入视图（AI 智能平台工作台用）。
 *
 * @scx/dsh-workbench-prototype 不自己画网页：它把一块区域交给宿主，
 * 由宿主用原生视图在指定坐标上绘制 MES/ERP 网页，并把状态回报给插件。
 * 官方开源仓库没有这层，这里补回宿主侧实现。
 */
import { app, BrowserWindow, ipcMain, safeStorage, session, WebContentsView } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Bounds = { x: number; y: number; width: number; height: number }
const WEBSITE_PARTITION = 'persist:lqsi-enterprise'

type ViewState = {
  ok: boolean
  loading: boolean
  url: string
  title: string
  error: string
  covered?: boolean
}

let view: WebContentsView | null = null
let owner: BrowserWindow | null = null
let state: ViewState = { ok: false, loading: false, url: '', title: '', error: '' }
let currentSite = ''
let resettingWebsite = false

function isWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function comparableWebsiteUrl(value: string): string {
  try {
    const url = new URL(value)
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/'
    return url.toString()
  } catch {
    return value
  }
}

/** Avoid waiting forever for JavaScript execution before a page has a document. */
async function safeExecuteJavaScript(target: WebContentsView['webContents'], code: string, timeoutMs = 800): Promise<void> {
  if (target.isDestroyed() || !isWebsiteUrl(target.getURL())) return
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      target.executeJavaScript(code, true).then(() => undefined, () => undefined),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, timeoutMs) }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function loadWebsiteUrl(target: WebContentsView, url: string, timeoutMs = 30_000): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  try {
    await Promise.race([
      target.webContents.loadURL(url),
      new Promise<void>((_resolve, reject) => {
        timeout = setTimeout(() => {
          timedOut = true
          reject(new Error('网页连接超时，请检查企业系统地址和网络后重试。'))
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (timedOut && !target.webContents.isDestroyed()) target.webContents.stop()
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function clearWebsitePartition(): Promise<void> {
  const websiteSession = session.fromPartition(WEBSITE_PARTITION)
  await Promise.all([
    websiteSession.clearStorageData(),
    websiteSession.clearAuthCache(),
    websiteSession.clearCache(),
  ])
}

const loginFile = (): string => join(app.getPath('userData'), 'harness', 'mes-login.json')
type LoginCredentials = { username: string; password: string }
type StoredLoginCredentials = { username?: string; password?: string; passwordEncrypted?: string }

function loginSiteKey(siteUrl: string): string | undefined {
  try {
    const url = new URL(siteUrl)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return undefined
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/'
    return url.toString().replace(/\/$/u, url.pathname === '/' ? '/' : '')
  } catch {
    return undefined
  }
}

function siteOrigin(siteUrl: string): string | undefined {
  try {
    const url = new URL(siteUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.origin
  } catch {
    return undefined
  }
}

function readLogin(): Record<string, LoginCredentials> {
  try {
    if (!existsSync(loginFile())) return {}
    const stored = JSON.parse(readFileSync(loginFile(), 'utf8')) as Record<string, StoredLoginCredentials>
    const result: Record<string, LoginCredentials> = {}
    for (const [siteUrl, value] of Object.entries(stored)) {
      if (typeof value?.username !== 'string') continue
      let password = typeof value.password === 'string' ? value.password : ''
      if (!password && typeof value.passwordEncrypted === 'string' && safeStorage.isEncryptionAvailable()) {
        try { password = safeStorage.decryptString(Buffer.from(value.passwordEncrypted, 'base64')) } catch { /* stale key */ }
      }
      if (password) result[siteUrl] = { username: value.username, password }
    }
    return result
  } catch {
    return {}
  }
}

function writeLogin(next: Record<string, { username: string; password: string }>): boolean {
  try {
    if (Object.keys(next).length > 0 && !safeStorage.isEncryptionAvailable()) return false
    mkdirSync(dirname(loginFile()), { recursive: true })
    const stored = Object.fromEntries(Object.entries(next).map(([siteUrl, value]) => [siteUrl, {
      username: value.username,
      passwordEncrypted: safeStorage.encryptString(value.password).toString('base64')
    }]))
    writeFileSync(loginFile(), JSON.stringify(stored, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

/** 每个站点只尝试一次自动登录，且只在真的看到登录框时才填。 */
const autoLoginTried = new Set<string>()
const autoLoginRunning = new Set<string>()
const autoLoginBlocked = new Set<string>()
const autoLoginTokens = new Map<string, string>()

function autoLoginKey(siteUrl: string): string {
  return siteOrigin(siteUrl) ?? siteUrl
}

async function cancelAutoLogin(siteUrl: string): Promise<void> {
  const key = autoLoginKey(siteUrl)
  autoLoginTokens.delete(key)
  autoLoginTried.delete(key)
  try {
    if (view && !view.webContents.isDestroyed() && view.webContents.getURL()) {
      await safeExecuteJavaScript(view.webContents, 'window.__lqsiMesAutoLoginToken = null')
    }
  } catch { /* 页面正在导航 */ }
  // The injected login form poll wakes at most 500 ms later. Wait for it to
  // stop before clearing cookies so a late form submit cannot restore a session.
  const deadline = Date.now() + 1_500
  while (autoLoginRunning.has(key) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function loginForSite(siteUrl: string): { username: string; password: string } | undefined {
  const all = readLogin()
  const key = loginSiteKey(siteUrl)
  const exact = key ? all[key] : undefined
  if (exact?.username && exact.password) return exact
  // Settings may save the API base URL while the embedded page uses a deeper
  // route on the same MES host. Match only the origin so credentials never
  // cross to a different website.
  const origin = siteOrigin(siteUrl)
  if (!origin) return undefined
  for (const [savedUrl, credentials] of Object.entries(all)) {
    if (siteOrigin(savedUrl) === origin && credentials?.username && credentials.password) return credentials
  }
  return undefined
}

async function attemptAutoLogin(target: WebContentsView, siteUrl: string): Promise<void> {
  const key = autoLoginKey(siteUrl)
  if (autoLoginBlocked.has(key) || autoLoginTried.has(key) || autoLoginRunning.has(key)) return
  const record = loginForSite(siteUrl)
  if (!record) return
  autoLoginRunning.add(key)
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  autoLoginTokens.set(key, token)
  try {
    // MES 页面可能在 document load 后才渲染登录表单。等待真实表单，
    // 填写受控输入框并提交表单；不要假设每个系统都有同一个登录 API。
    const submitted = await target.webContents.executeJavaScript(`(async () => {
      const token = ${JSON.stringify(token)}
      window.__lqsiMesAutoLoginToken = token
      const active = () => window.__lqsiMesAutoLoginToken === token
      const visible = (input) => {
        if (!input || !input.isConnected) return false
        const box = input.getBoundingClientRect()
        const style = getComputedStyle(input)
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const deadline = Date.now() + 20000
      while (Date.now() < deadline && active()) {
        const password = Array.from(document.querySelectorAll('input[type="password"]')).find(visible)
        if (!password) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        const form = password.closest('form')
        const scope = form || document
        const candidates = Array.from(scope.querySelectorAll('input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"])')).filter(visible)
        const username = candidates.find((input) => /user|account|login|email|phone|mobile|用户|账号/i.test([input.name, input.id, input.autocomplete, input.placeholder, input.getAttribute('aria-label')].join(' ')))
          || candidates.find((input) => ['text', 'email', 'tel'].includes((input.type || '').toLowerCase()))
        if (!username) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        const setValue = (input, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          if (setter) setter.call(input, value)
          else input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
        setValue(username, ${JSON.stringify(record.username)})
        setValue(password, ${JSON.stringify(record.password)})
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (!active()) return false
        if (form && typeof form.requestSubmit === 'function') {
          form.requestSubmit()
          return true
        }
        const submit = Array.from(scope.querySelectorAll('button, input[type="submit"]')).find((button) => {
          if (!visible(button)) return false
          return /log\s*in|sign\s*in|submit|登录/i.test([button.innerText, button.value, button.getAttribute('aria-label')].join(' '))
        })
        if (submit) {
          submit.click()
          return true
        }
        return false
      }
      return false
    })()`, true)
    if (submitted === true && autoLoginTokens.get(key) === token && !autoLoginBlocked.has(key)) autoLoginTried.add(key)
  } catch {
    // Keep credentials eligible for a later retry after redirects or SPA navigation.
  } finally {
    autoLoginRunning.delete(key)
    if (autoLoginTokens.get(key) === token) autoLoginTokens.delete(key)
  }
}

/**
 * The enterprise view has its own persistent partition. Resetting that whole
 * partition also removes cookies set by a login redirect/SSO host, not only
 * data belonging to the configured MES URL.
 */
async function clearWebsiteSession(target: WebContentsView, reloadUrl?: string): Promise<void> {
  resettingWebsite = true
  target.setVisible(false)
  setState({ ok: false, loading: true, error: '', url: reloadUrl ?? '', title: '' })
  try {
    // Clear page storage while the authenticated origin is still available.
    // Doing this after navigating to about:blank only clears the blank origin.
    try {
      await safeExecuteJavaScript(target.webContents, `(() => {
        try { sessionStorage.clear() } catch {}
        try { localStorage.clear() } catch {}
        return true
      })()`)
    } catch { /* page may already be navigating */ }
    // Unload the authenticated document so its timers cannot recreate cookies.
    target.webContents.stop()
    try { await loadWebsiteUrl(target, 'about:blank', 5_000) } catch { /* page may already be navigating */ }
    await clearWebsitePartition()
    if (!reloadUrl || target.webContents.isDestroyed()) {
      setState({ ok: false, loading: false, url: '', title: '', error: '' })
      return
    }
    setState({ ok: false, loading: true, error: '', url: reloadUrl, title: '' })
    await loadWebsiteUrl(target, reloadUrl)
    const loadedUrl = target.webContents.getURL()
    if (!isWebsiteUrl(loadedUrl)) throw new Error('网页没有成功载入，请点击刷新网页重试。')
    setState({ ok: true, loading: false, error: '', url: loadedUrl, title: target.webContents.getTitle() })
    target.setVisible(!state.covered)
  } catch (error) {
    const message = String((error as Error)?.message ?? error)
    setState({ ok: false, loading: false, error: message, url: '', title: '' })
    throw error
  } finally {
    resettingWebsite = false
  }
}

function setState(patch: Partial<ViewState>): void {
  state = { ...state, ...patch }
  try { owner?.webContents.send('lqsi:enterprise:status', state) } catch { /* 窗口已关闭 */ }
}

function toNativeBounds(bounds: Bounds, target: BrowserWindow): Bounds {
  const zoom = target.webContents.getZoomFactor()
  const [contentWidth = 0, contentHeight = 0] = target.getContentSize()
  const x = Math.max(0, Math.round(bounds.x * zoom))
  const y = Math.max(0, Math.round(bounds.y * zoom))
  const width = Math.max(0, Math.min(Math.round(bounds.width * zoom), contentWidth - x))
  const height = Math.max(0, Math.min(Math.round(bounds.height * zoom), contentHeight - y))
  return { x, y, width, height }
}

function ensureView(target: BrowserWindow, siteUrl: string): WebContentsView {
  if (view && !view.webContents.isDestroyed()) return view
  owner = target
  const created = new WebContentsView({
    webPreferences: {
      // 独立分区：MES 的登录 cookie 与主界面隔离，重启后仍保留。
      partition: WEBSITE_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  target.contentView.addChildView(created)
  created.webContents.on('did-start-loading', () => {
    if (view !== created || resettingWebsite) return
    setState({ ok: false, loading: true, error: '' })
  })
  created.webContents.on('did-finish-load', () => {
    if (view !== created || resettingWebsite) return
    const url = created.webContents.getURL()
    const validUrl = isWebsiteUrl(url)
    setState({ ok: validUrl, loading: false, error: validUrl ? '' : '网页没有成功载入，请点击刷新网页重试。', url: validUrl ? url : '', title: validUrl ? created.webContents.getTitle() : '' })
    created.setVisible(validUrl)
    if (currentSite) void attemptAutoLogin(created, currentSite)
  })
  // Some MES single-page apps finish their network navigation without a
  // did-finish-load event for the final redirected page. Always reconcile the
  // toolbar state with Electron's final stop-loading event.
  created.webContents.on('did-stop-loading', () => {
    if (view !== created || resettingWebsite) return
    const url = created.webContents.getURL()
    const validUrl = isWebsiteUrl(url)
    setState({
      ok: validUrl && !state.error,
      loading: false,
      url: validUrl ? url : '',
      title: validUrl ? created.webContents.getTitle() : '',
      error: validUrl ? state.error : '网页没有成功载入，请点击刷新网页重试。',
    })
    created.setVisible(validUrl)
  })
  created.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (view !== created || resettingWebsite || !isMainFrame) return
    if (code === -3) {
      // Redirects may abort an intermediate URL. Reconcile after navigation settles
      // so an aborted event cannot leave the toolbar in a permanent loading state.
      setTimeout(() => {
        if (view !== created || created.webContents.isDestroyed() || resettingWebsite || created.webContents.isLoadingMainFrame() || (state.error && !state.loading)) return
        const finalUrl = created.webContents.getURL()
        const validUrl = isWebsiteUrl(finalUrl)
        setState({
          ok: validUrl,
          loading: false,
          error: validUrl ? '' : (description || '网页加载已中断，请点击刷新网页重试。'),
          url: validUrl ? finalUrl : url,
          title: validUrl ? created.webContents.getTitle() : '',
        })
        created.setVisible(validUrl)
      }, 300)
      return
    }
    created.setVisible(false)
    setState({ ok: false, loading: false, error: `${description || `HTTP ${code}`}`, url })
  })
  created.webContents.on('render-process-gone', (_event, details) => {
    if (view !== created || resettingWebsite) return
    created.setVisible(false)
    setState({ ok: false, loading: false, error: `网页进程已退出：${details.reason}`, url: '', title: '' })
  })
  created.webContents.on('page-title-updated', (_event, title) => {
    if (view === created && isWebsiteUrl(created.webContents.getURL())) setState({ title })
  })
  view = created
  return created
}

const bridge = {
  async attachEnterpriseWebsite(siteUrl: string, _systemName: string, bounds: Bounds) {
    try {
      if (!owner) owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
      if (!owner) throw new Error('no owner window')
      const target = ensureView(owner, siteUrl)
      target.setBounds(toNativeBounds(bounds, owner))
      currentSite = siteUrl
      const hasSavedLogin = Boolean(loginForSite(siteUrl))
      if (hasSavedLogin) autoLoginBlocked.delete(autoLoginKey(siteUrl))
      else autoLoginBlocked.add(autoLoginKey(siteUrl))
      await cancelAutoLogin(siteUrl)
      setState({ url: siteUrl, covered: false })
      if (hasSavedLogin) {
        if (comparableWebsiteUrl(target.webContents.getURL()) !== comparableWebsiteUrl(siteUrl)) {
          target.setVisible(false)
          setState({ ok: false, loading: true, error: '', url: siteUrl })
          await loadWebsiteUrl(target, siteUrl)
        } else {
          target.setVisible(isWebsiteUrl(target.webContents.getURL()))
        }
        void attemptAutoLogin(target, siteUrl)
      } else {
        // No saved MES account means the embedded website must not inherit a
        // previous login, including a session from an older app version.
        await clearWebsiteSession(target, siteUrl)
      }
      return { ok: true }
    } catch (error) {
      setState({ ok: false, loading: false, url: '', title: '', error: String((error as Error)?.message ?? error) })
      return { ok: false }
    }
  },
  async updateEnterpriseWebsiteBounds(bounds: Bounds) {
    try {
      if (!view || view.webContents.isDestroyed() || !owner || owner.isDestroyed()) return { ok: false }
      view.setBounds(toNativeBounds(bounds, owner))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async getEnterpriseWebsiteStatus(): Promise<ViewState> {
    if (view && view.webContents.isDestroyed()) {
      view = null
      setState({ ok: false, loading: false, error: '网页视图已关闭，请重新打开企业网页。', url: '', title: '' })
      return state
    }
    if (view && !view.webContents.isDestroyed()) {
      const loading = view.webContents.isLoadingMainFrame()
      const url = view.webContents.getURL()
      const validUrl = isWebsiteUrl(url)
      if (state.loading !== loading || state.url !== (validUrl ? url : '') || state.ok !== (validUrl && !loading && !state.error)) {
        setState({
          ok: validUrl && !loading && !state.error,
          loading,
          url: validUrl ? url : '',
          title: validUrl ? view.webContents.getTitle() : '',
          error: validUrl || loading ? state.error : state.error || '网页没有成功载入，请点击刷新网页重试。',
        })
        if (!validUrl) view.setVisible(false)
      }
    }
    return state
  },
  async reloadEnterpriseWebsite() {
    try {
      if (!view || view.webContents.isDestroyed()) return { ok: false }
      view.webContents.reload()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async setEnterpriseWebsiteCovered(covered: boolean) {
    try {
      view?.setVisible(!covered)
      setState({ covered })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async closeEnterpriseWebsite() {
    try {
      if (view && !view.webContents.isDestroyed()) {
        owner?.contentView.removeChildView(view)
        view.webContents.close()
      }
      view = null
      currentSite = ''
      setState({ ok: false, loading: false, url: '', title: '', error: '' })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async saveEnterpriseWebsiteLoginCredentials(siteUrl: string, username: string, password: string) {
    const key = loginSiteKey(siteUrl)
    if (!key || !username.trim() || !password) return { ok: false }
    const all = readLogin()
    all[key] = { username: username.trim(), password }
    if (!writeLogin(all)) return { ok: false }
    const originKey = autoLoginKey(siteUrl)
    autoLoginBlocked.delete(originKey)
    autoLoginTried.delete(originKey)
    if (view && !view.webContents.isDestroyed() && currentSite) {
      const target = view
      const targetSite = currentSite
      await cancelAutoLogin(targetSite)
      // Let an in-flight form poll observe cancellation before retrying with
      // the newly saved account.
      setTimeout(() => {
        if (view === target && !target.webContents.isDestroyed()) void attemptAutoLogin(target, targetSite)
      }, 600)
    }
    return { ok: true }
  },
  async clearEnterpriseWebsiteLogin(siteUrl: string) {
    const all = readLogin()
    const key = loginSiteKey(siteUrl)
    const origin = siteOrigin(siteUrl)
    if (key) delete all[key]
    if (origin) {
      for (const savedUrl of Object.keys(all)) if (siteOrigin(savedUrl) === origin) delete all[savedUrl]
    }
    if (!writeLogin(all)) return { ok: false }
    if (origin) autoLoginBlocked.add(origin)
    await cancelAutoLogin(siteUrl)
    if (view && !view.webContents.isDestroyed()) {
      try {
        await clearWebsiteSession(view, currentSite || siteUrl)
      } catch {
        return { ok: false }
      }
    } else {
      try {
        await clearWebsitePartition()
        view = null
        setState({ ok: false, loading: false, error: '', url: '', title: '' })
      } catch {
        return { ok: false }
      }
    }
    return { ok: true }
  },
  async readEnterpriseWebsiteApi(path: string, parameters: Record<string, string | number | boolean>) {
    if (!view || view.webContents.isDestroyed()) return null
    const query = new URLSearchParams(Object.entries(parameters ?? {}).map(([k, v]) => [k, String(v)])).toString()
    const target = `${path}${path.includes('?') ? '&' : '?'}${query}`
    try {
      return await view.webContents.executeJavaScript(
        `fetch(${JSON.stringify(target)}, { credentials: 'include' }).then((r) => r.json()).catch(() => null)`,
        true,
      )
    } catch {
      return null
    }
  },
  async inspectEnterpriseWebsitePage() {
    if (!view || view.webContents.isDestroyed()) return null
    try {
      return await view.webContents.executeJavaScript(
        `({ url: location.href, title: document.title, text: (document.body?.innerText || '').slice(0, 4000) })`,
        true,
      )
    } catch {
      return null
    }
  },
  async readEnterpriseEmployeePermissions() {
    return { menus: [] as string[] }
  },
  async controlEnterpriseWebsitePage(action: { action: string; target?: string; value?: string }) {
    if (!view || view.webContents.isDestroyed()) return { ok: false }
    const script = `(() => {
      const sel = ${JSON.stringify(action?.target ?? '')}
      const el = sel ? document.querySelector(sel) : null
      const kind = ${JSON.stringify(action?.action ?? '')}
      const value = ${JSON.stringify(action?.value ?? '')}
      if (kind === 'click') { if (!el) return false; el.click(); return true }
      if (kind === 'input' || kind === 'type') {
        if (!el) return false
        el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      return false
    })()`
    try {
      const ok = await view.webContents.executeJavaScript(script, true)
      return { ok: Boolean(ok) }
    } catch {
      return { ok: false }
    }
  },
}

/** 把上面的桥注册成 preload 可用的 IPC 方法。 */
export function registerEnterpriseViewIpc(): void {
  const channels: Array<[string, (...args: any[]) => unknown]> = [
    ['attachEnterpriseWebsite', bridge.attachEnterpriseWebsite],
    ['updateEnterpriseWebsiteBounds', bridge.updateEnterpriseWebsiteBounds],
    ['getEnterpriseWebsiteStatus', bridge.getEnterpriseWebsiteStatus],
    ['reloadEnterpriseWebsite', bridge.reloadEnterpriseWebsite],
    ['setEnterpriseWebsiteCovered', bridge.setEnterpriseWebsiteCovered],
    ['closeEnterpriseWebsite', bridge.closeEnterpriseWebsite],
    ['saveEnterpriseWebsiteLoginCredentials', bridge.saveEnterpriseWebsiteLoginCredentials],
    ['clearEnterpriseWebsiteLogin', bridge.clearEnterpriseWebsiteLogin],
    ['readEnterpriseWebsiteApi', bridge.readEnterpriseWebsiteApi],
    ['inspectEnterpriseWebsitePage', bridge.inspectEnterpriseWebsitePage],
    ['readEnterpriseEmployeePermissions', bridge.readEnterpriseEmployeePermissions],
    ['controlEnterpriseWebsitePage', bridge.controlEnterpriseWebsitePage],
  ]
  for (const [name, handler] of channels) {
    ipcMain.removeHandler(`lqsi:enterprise:${name}`)
    ipcMain.handle(`lqsi:enterprise:${name}`, (_event, ...args) => handler(...args))
  }
}

/** 记录主窗口，供视图挂载。 */
export function setEnterpriseViewOwner(window: BrowserWindow): void {
  owner = window
}
