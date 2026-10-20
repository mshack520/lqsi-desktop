/**
 * LQ SI 企业网页嵌入视图（AI 智能平台工作台用）。
 *
 * @scx/dsh-workbench-prototype 不自己画网页：它把一块区域交给宿主，
 * 由宿主用原生视图在指定坐标上绘制 MES/ERP 网页，并把状态回报给插件。
 * 官方开源仓库没有这层，这里补回宿主侧实现。
 */
import { app, BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Bounds = { x: number; y: number; width: number; height: number }

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

const loginFile = (): string => join(app.getPath('userData'), 'harness', 'mes-login.json')

function readLogin(): Record<string, { username: string; password: string }> {
  try {
    if (!existsSync(loginFile())) return {}
    return JSON.parse(readFileSync(loginFile(), 'utf8')) as Record<string, { username: string; password: string }>
  } catch {
    return {}
  }
}

function writeLogin(next: Record<string, { username: string; password: string }>): void {
  try {
    mkdirSync(dirname(loginFile()), { recursive: true })
    writeFileSync(loginFile(), JSON.stringify(next, null, 2), 'utf8')
  } catch { /* 保存失败不影响网页使用 */ }
}

/** 每个站点只尝试一次自动登录，且只在真的看到登录框时才填。 */
const autoLoginTried = new Set<string>()

async function attemptAutoLogin(target: WebContentsView, siteUrl: string): Promise<void> {
  if (autoLoginTried.has(siteUrl)) return
  const record = readLogin()[siteUrl]
  if (!record?.username || !record?.password) {
    autoLoginTried.add(siteUrl)
    return
  }
  // 只有在页面上真的显示着登录框时才登录，避免已登录页面被反复刷新。
  let needsLogin = false
  try {
    needsLogin = await target.webContents.executeJavaScript(
      `(() => {
        const field = document.querySelector('input[type=password]')
        if (!field) return false
        const box = field.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })()`,
      true,
    )
  } catch {
    return
  }
  if (needsLogin !== true) {
    autoLoginTried.add(siteUrl)
    return
  }
  autoLoginTried.add(siteUrl)
  try {
    const base = new URL(siteUrl)
    const prefix = base.pathname.replace(/\/$/u, '')
    const endpoint = `${base.origin}${prefix}/api/auth/login`
    const ok = await target.webContents.executeJavaScript(
      `fetch(${JSON.stringify(endpoint)}, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: ${JSON.stringify(record.username)}, password: ${JSON.stringify(record.password)} })
      }).then((r) => r.ok).catch(() => false)`,
      true,
    )
    if (ok === true) target.webContents.reload()
  } catch { /* 自动登录失败时保留页面，让用户手动登录 */ }
}

function setState(patch: Partial<ViewState>): void {
  state = { ...state, ...patch }
  try { owner?.webContents.send('lqsi:enterprise:status', state) } catch { /* 窗口已关闭 */ }
}

function ensureView(target: BrowserWindow, siteUrl: string): WebContentsView {
  if (view && !view.webContents.isDestroyed()) return view
  owner = target
  const created = new WebContentsView({
    webPreferences: {
      // 独立分区：MES 的登录 cookie 与主界面隔离，重启后仍保留。
      partition: 'persist:lqsi-enterprise',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  target.contentView.addChildView(created)
  created.webContents.on('did-start-loading', () => setState({ loading: true, error: '' }))
  created.webContents.on('did-finish-load', () => {
    setState({ ok: true, loading: false, error: '', url: created.webContents.getURL(), title: created.webContents.getTitle() })
    if (currentSite) void attemptAutoLogin(created, currentSite)
  })
  created.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 = 主动取消
    setState({ ok: false, loading: false, error: `${description || `HTTP ${code}`}`, url })
  })
  created.webContents.on('page-title-updated', (_event, title) => setState({ title }))
  view = created
  return created
}

const bridge = {
  async attachEnterpriseWebsite(siteUrl: string, _systemName: string, bounds: Bounds) {
    try {
      if (!owner) owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
      if (!owner) throw new Error('no owner window')
      const target = ensureView(owner, siteUrl)
      target.setBounds(bounds)
      target.setVisible(true)
      currentSite = siteUrl
      autoLoginTried.delete(siteUrl)
      setState({ url: siteUrl, covered: false })
      if (target.webContents.getURL() !== siteUrl) await target.webContents.loadURL(siteUrl)
      return { ok: true }
    } catch (error) {
      setState({ ok: false, error: String((error as Error)?.message ?? error) })
      return { ok: false }
    }
  },
  async updateEnterpriseWebsiteBounds(bounds: Bounds) {
    try {
      if (!view || view.webContents.isDestroyed()) return { ok: false }
      view.setBounds(bounds)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async getEnterpriseWebsiteStatus(): Promise<ViewState> {
    if (view && !view.webContents.isDestroyed() && !state.url) {
      setState({ ok: true, url: view.webContents.getURL(), title: view.webContents.getTitle() })
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
      setState({ ok: false, loading: false, url: '', title: '', error: '' })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
  async saveEnterpriseWebsiteLoginCredentials(siteUrl: string, username: string, password: string) {
    const all = readLogin()
    all[siteUrl] = { username, password }
    writeLogin(all)
    // 顺手在页面里填一次，省得用户再输一遍。
    try {
      if (view && !view.webContents.isDestroyed()) {
        await view.webContents.executeJavaScript(`(() => {
          const pick = (selector) => document.querySelector(selector)
          const user = pick('input[type=text],input[name*=user],input[id*=user],input[name*=account]')
          const pass = pick('input[type=password]')
          if (user && !user.value) { user.value = ${JSON.stringify(username)}; user.dispatchEvent(new Event('input', { bubbles: true })) }
          if (pass && !pass.value) { pass.value = ${JSON.stringify(password)}; pass.dispatchEvent(new Event('input', { bubbles: true })) }
          return true
        })()`, true).catch(() => false)
      }
    } catch { /* 页面未就绪时忽略 */ }
    return { ok: true }
  },
  async clearEnterpriseWebsiteLogin(siteUrl: string) {
    const all = readLogin()
    delete all[siteUrl]
    writeLogin(all)
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
