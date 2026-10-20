import { app, BrowserWindow, ipcMain, nativeTheme, safeStorage, screen, session } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * LQ SI 启动舞台（原生侧）。
 *
 * 厂商版把「启动动画 + 身份确认 + 启动口令」做在私有 Electron 外壳里；
 * 官方开源代码只有一张静态 splash.html。这里把这一层补回来：
 *   1. 启动时用独立无边框窗口加载 resources/startup-gate.html 播放动画；
 *   2. 给设置页补齐 window.dshDesktop 里那 10 个接口；
 *   3. 口令默认 mshack，改过之后存到 harness/dsh-startup.json（加盐哈希）。
 */

type AnyRecord = Record<string, unknown>

const DEFAULTS: AnyRecord = {
  enabled: true,
  mode: 'always',
  theme: 'light',
  speed: 1,
  requireInteraction: true,
  allowSkip: false,
  sound: false,
  autoLogin: false,
  voice: false,
  voiceCue: false,
  identity: 'LQ SI 用户',
  identityId: 'LQSI-001',
  accessLevel: '1',
  brand1: 'LQ SI',
  brand2: 'SMART INTELLIGENCE',
  brand3a: 'DSH',
  brand3b: 'DESKTOP',
  welcomeBox: 'LQ SI DESKTOP',
  footer: 'POWERED BY LQ SI',
  accent: '#d92d39',
  glitchA: '#d92d39',
  glitchB: '#3677d5'
}

const EXTRA_KEYS = ['orgZh', 'orgEn', 'orgSub', 'voiceSource', 'sfx']
const DEFAULT_PASSCODE = 'mshack'
const DONE_CHANNEL = 'lqsi:startup:done'
const AUTHORIZATION_TTL_MS = 5 * 60 * 1000

let registered = false
let stageWindow: BrowserWindow | null = null
let startupGateWindow: BrowserWindow | null = null
let startupGateWaitingForWorkspace = false
let authorizedPasscode: { value: string; expiresAt: number } | undefined
/** 一次运行只播一次：Harness 重启、故障恢复等路径也会走 showSplash()。 */
let playedThisSession = false

function startupFile(): string {
  return join(app.getPath('userData'), 'harness', 'dsh-startup.json')
}

function readRaw(): AnyRecord {
  try {
    const parsed = JSON.parse(readFileSync(startupFile(), 'utf8')) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnyRecord) : {}
  } catch {
    return {}
  }
}

function writeRaw(next: AnyRecord): void {
  const file = startupFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

function configOf(raw: AnyRecord = readRaw()): AnyRecord {
  const out: AnyRecord = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS)) if (raw[key] !== undefined) out[key] = raw[key]
  for (const key of EXTRA_KEYS) if (raw[key] !== undefined) out[key] = raw[key]
  return out
}

function hashPasscode(passcode: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${passcode}`, 'utf8').digest('hex')
}

function verifyPasscode(passcode: string): boolean {
  const stored = readRaw().passcode as { salt?: string; hash?: string } | undefined
  if (!stored || typeof stored.salt !== 'string' || typeof stored.hash !== 'string') {
    return passcode === DEFAULT_PASSCODE
  }
  return hashPasscode(passcode, stored.salt) === stored.hash
}

function setPasscode(passcode: string): void {
  const raw = readRaw()
  const salt = randomBytes(12).toString('hex')
  raw.passcode = { salt, hash: hashPasscode(passcode, salt), updatedAt: new Date().toISOString() }
  if (raw.autoLogin === true) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        raw.autoLoginPasscodeEncrypted = safeStorage.encryptString(passcode).toString('base64')
      } else {
        raw.autoLogin = false
        delete raw.autoLoginPasscodeEncrypted
      }
    } catch {
      raw.autoLogin = false
      delete raw.autoLoginPasscodeEncrypted
    }
  }
  writeRaw(raw)
}

function autoLoginPasscode(raw: AnyRecord = readRaw()): string | undefined {
  if (raw.autoLogin !== true || typeof raw.autoLoginPasscodeEncrypted !== 'string') return undefined
  if (!safeStorage.isEncryptionAvailable()) return undefined
  try {
    const encrypted = Buffer.from(raw.autoLoginPasscodeEncrypted, 'base64')
    if (encrypted.length === 0) return undefined
    const passcode = safeStorage.decryptString(encrypted)
    return verifyPasscode(passcode) ? passcode : undefined
  } catch {
    return undefined
  }
}

function autoLoginIsEnabled(): boolean {
  const raw = readRaw()
  if (autoLoginPasscode(raw)) return true
  if (raw.autoLogin === true || raw.autoLoginPasscodeEncrypted !== undefined) {
    raw.autoLogin = false
    delete raw.autoLoginPasscodeEncrypted
    writeRaw(raw)
  }
  return false
}

function rememberAuthorizedPasscode(passcode: string): void {
  authorizedPasscode = { value: passcode, expiresAt: Date.now() + AUTHORIZATION_TTL_MS }
}

function stagePreloadPath(): string {
  // 主进程按 ESM 打包（package.json type=module），因此用 import.meta.dirname。
  return join(import.meta.dirname, '../preload/startup-gate.cjs')
}

function createStageWindow(preview: boolean, ownerWindow?: BrowserWindow): BrowserWindow {
  // The startup stage must cover the actual DSH window. A separate fullscreen
  // window can land on another monitor (or use a different DPI size), exposing
  // the main window beside it and making the startup message look off-center.
  const ownerBounds = !preview && ownerWindow && !ownerWindow.isDestroyed()
    ? ownerWindow.getBounds()
    : undefined
  const displayBounds = ownerBounds && ownerWindow?.isMaximized()
    ? screen.getDisplayMatching(ownerBounds).workArea
    : undefined
  const bounds = displayBounds ?? ownerBounds
  const win = new BrowserWindow({
    ...(bounds
      ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      : { width: preview ? 1024 : 1280, height: preview ? 640 : 800 }),
    show: false,
    frame: false,
    fullscreen: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    // Keep the gate visually attached to the DSH window without creating a
    // second LQ SI item in the Windows taskbar.
    skipTaskbar: true,
    resizable: preview,
    movable: preview,
    webPreferences: {
      preload: stagePreloadPath(),
      // 动画脚本读取 window.__DSH_STARTUP__ 等注入量，和主界面不同：
      // 这个窗口只加载本地 resources/startup-gate.html，因此关闭上下文隔离。
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.setMenuBarVisibility(false)
  return win
}

function loadStage(win: BrowserWindow, preview: boolean, config?: AnyRecord): Promise<void> {
  const cfg = config ?? configOf()
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return win
    .loadFile(join(process.resourcesPath, 'startup-gate.html'), {
      query: {
        theme,
        preview: preview ? 'true' : 'false',
        config: JSON.stringify({ ...cfg, theme })
      }
    })
    .then(() => undefined)
}

/** 播放启动舞台；动画结束后保留连接提示，等工作区真正打开再退场。 */
export function showStartupStage(ownerWindow?: BrowserWindow): Promise<void> {
  const raw = readRaw()
  const cfg = configOf(raw)
  if (cfg.enabled === false) return Promise.resolve()
  if (playedThisSession) return Promise.resolve()
  if (cfg.mode === 'once' && raw.lastShownVersion === app.getVersion()) return Promise.resolve()
  playedThisSession = true

  return new Promise<void>((resolve, reject) => {
    const win = createStageWindow(false, ownerWindow)
    stageWindow = win
    startupGateWindow = win
    startupGateWaitingForWorkspace = false
    win.setAlwaysOnTop(true, 'screen-saver')
    let settled = false
    let destroyed = false
    const autoLogin = autoLoginIsEnabled()

    const destroyStage = (): void => {
      if (destroyed) return
      destroyed = true
      try {
        if (!win.isDestroyed()) win.destroy()
      } catch {
        /* window already gone */
      }
    }

    const finishAnimation = (): void => {
      if (settled) return
      settled = true
      ipcMain.removeListener(DONE_CHANNEL, onDone)
      try {
        const next = readRaw()
        next.lastShownVersion = app.getVersion()
        next.lastShownAt = new Date().toISOString()
        writeRaw(next)
      } catch {
        /* persistence is best effort */
      }
      startupGateWaitingForWorkspace = true
      resolve()
    }

    const onDone = (event: Electron.IpcMainEvent): void => {
      if (event.sender === win.webContents) finishAnimation()
    }

    const allowCloseForQuit = (): void => {
      destroyStage()
    }

    ipcMain.on(DONE_CHANNEL, onDone)
    win.on('close', (event) => {
      if (!settled) event.preventDefault()
    })
    app.once('before-quit', allowCloseForQuit)
    win.on('closed', () => {
      app.removeListener('before-quit', allowCloseForQuit)
      if (stageWindow === win) stageWindow = null
      if (startupGateWindow === win) startupGateWindow = null
      startupGateWaitingForWorkspace = false
      finishAnimation()
    })
    win.once('ready-to-show', () => {
      if (!settled) win.show()
    })
    const stageConfig = autoLogin
      ? { ...cfg, autoLogin: true, autoLoginVerified: true, requireInteraction: false }
      : { ...cfg, autoLogin: false, autoLoginVerified: false }
    void loadStage(win, false, stageConfig).catch((error: unknown) => {
      settled = true
      ipcMain.removeListener(DONE_CHANNEL, onDone)
      startupGateWaitingForWorkspace = false
      if (stageWindow === win) stageWindow = null
      if (startupGateWindow === win) startupGateWindow = null
      destroyStage()
      reject(error)
    })
  })
}

/** 工作区已完成导航后关闭覆盖层，避免两个启动 Logo 交替出现。 */
export function finishStartupStage(): void {
  if (!startupGateWaitingForWorkspace) return
  const win = startupGateWindow
  startupGateWindow = null
  startupGateWaitingForWorkspace = false
  if (stageWindow === win) stageWindow = null
  if (!win || win.isDestroyed()) return
  try {
    win.destroy()
  } catch {
    /* window already closed */
  }
}

/** 设置页里的「立即预览」。 */
async function showPreviewStage(): Promise<void> {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.focus()
    return
  }
  const win = createStageWindow(true)
  stageWindow = win
  const close = (): void => {
    ipcMain.removeListener(DONE_CHANNEL, onDone)
    try {
      if (!win.isDestroyed()) win.destroy()
    } catch {
      /* ignore */
    }
    if (stageWindow === win) stageWindow = null
  }
  const onDone = (event: Electron.IpcMainEvent): void => {
    if (event.sender === win.webContents) close()
  }
  ipcMain.on(DONE_CHANNEL, onDone)
  win.on('closed', () => {
    ipcMain.removeListener(DONE_CHANNEL, onDone)
    if (stageWindow === win) stageWindow = null
  })
  win.once('ready-to-show', () => win.show())
  await loadStage(win, true)
}


/** 允许把第三方系统嵌进工作台：摘掉 X-Frame-Options / CSP frame-ancestors。 */
const strippedSessions = new WeakSet<Electron.Session>()

function installFrameHeaderStrip(target?: Electron.Session): void {
  const apply = (s: Electron.Session): void => {
    if (strippedSessions.has(s)) return
    strippedSessions.add(s)
    try {
      s.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        const headers = { ...(details.responseHeaders ?? {}) }
        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'x-frame-options') delete headers[key]
          else if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
            const list = Array.isArray(headers[key]) ? headers[key] : [String(headers[key] ?? '')]
            headers[key] = list
              .map((item) =>
                item
                  .split(';')
                  .map((part) => part.trim())
                  .filter((part) => part && !part.toLowerCase().startsWith('frame-ancestors'))
                  .join('; ')
              )
              .filter((item) => item.length > 0)
          }
        }
        callback({ responseHeaders: headers })
      })
    } catch {
      /* 注册失败不影响主流程 */
    }
  }
  if (target) {
    apply(target)
    return
  }
  apply(session.defaultSession)
  // 工作台里的 webview 可能用独立会话，这里对所有新建 webContents 的会话补一次。
  app.on('web-contents-created', (_event, contents) => {
    try {
      apply(contents.session)
    } catch {
      /* ignore */
    }
  })
}

export function registerStartupStageIpc(): void {
  if (registered) return
  if (!app.isReady()) {
    throw new Error('启动舞台 IPC 必须在 Electron app ready 后注册')
  }

  // 工作台内嵌第三方系统（MES 等）时，对方常带 X-Frame-Options / CSP frame-ancestors，
  // 会把 iframe 打死并显示「DSH 无法嵌入此网址」。对所有会话统一摘掉这两个头。
  installFrameHeaderStrip()
  registered = true

  ipcMain.handle('lqsi:startup:verify', (_event, passcode: unknown) => ({
    ok: verifyPasscode(String(passcode ?? ''))
  }))

  ipcMain.handle('lqsi:startup:getSettings', () => {
    const raw = readRaw()
    return { ok: true, config: configOf(raw), defaults: { ...DEFAULTS }, file: startupFile() }
  })

  ipcMain.handle('lqsi:startup:updateSettings', (_event, patch: unknown) => {
    const raw = readRaw()
    if (patch && typeof patch === 'object') {
      for (const [key, value] of Object.entries(patch as AnyRecord)) {
        if (
          key === 'passcode' ||
          key === 'autoLogin' ||
          key === 'autoLoginPasscodeEncrypted' ||
          key === 'lastShownVersion' ||
          key === 'lastShownAt'
        ) continue
        raw[key] = value
      }
    }
    writeRaw(raw)
    return { ok: true, config: configOf(raw) }
  })

  ipcMain.handle('lqsi:startup:resetSettings', () => {
    const raw = readRaw()
    const preserveAutoLogin = autoLoginIsEnabled()
    writeRaw({
      passcode: raw.passcode,
      autoLogin: preserveAutoLogin,
      ...(preserveAutoLogin ? { autoLoginPasscodeEncrypted: raw.autoLoginPasscodeEncrypted } : {})
    })
    return { ok: true, config: configOf({}) }
  })

  ipcMain.handle('lqsi:startup:preview', async () => {
    await showPreviewStage()
    return { ok: true }
  })

  ipcMain.handle('lqsi:startup:authorize', (_event, passcode: unknown) => {
    const value = String(passcode ?? '')
    if (!verifyPasscode(value)) return { ok: false, error: '启动口令不正确' }
    rememberAuthorizedPasscode(value)
    return { ok: true }
  })

  ipcMain.handle('lqsi:startup:changePassword', (_event, current: unknown, next: unknown) => {
    if (!verifyPasscode(String(current ?? ''))) return { ok: false, error: '启动口令不正确' }
    const text = String(next ?? '')
    if (text.length === 0 || text.length > 64) return { ok: false, error: '新口令长度不合法' }
    setPasscode(text)
    rememberAuthorizedPasscode(text)
    return { ok: true, autoLogin: readRaw().autoLogin === true }
  })

  ipcMain.handle('lqsi:startup:authSettings', () => ({
    ok: true,
    autoLogin: autoLoginIsEnabled()
  }))

  ipcMain.handle('lqsi:startup:setAutoLogin', (_event, enabled: unknown) => {
    const raw = readRaw()
    if (enabled === true) {
      const authorized = authorizedPasscode
      if (!authorized || authorized.expiresAt < Date.now() || !verifyPasscode(authorized.value)) {
        authorizedPasscode = undefined
        return { ok: false, error: '设置授权已过期，请重新输入启动口令。' }
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return { ok: false, error: '系统加密存储不可用，无法安全保存启动口令。' }
      }
      try {
        raw.autoLoginPasscodeEncrypted = safeStorage.encryptString(authorized.value).toString('base64')
      } catch {
        return { ok: false, error: '系统加密存储失败，启动口令未保存。' }
      }
      raw.autoLogin = true
    } else {
      raw.autoLogin = false
      delete raw.autoLoginPasscodeEncrypted
    }
    writeRaw(raw)
    return { ok: true, autoLogin: raw.autoLogin }
  })

  ipcMain.handle('lqsi:startup:autoLaunch', () => ({
    ok: true,
    enabled: app.getLoginItemSettings().openAtLogin
  }))

  ipcMain.handle('lqsi:startup:setAutoLaunch', (_event, enabled: unknown) => {
    app.setLoginItemSettings({ openAtLogin: enabled === true })
    return { ok: true, enabled: app.getLoginItemSettings().openAtLogin }
  })
}
