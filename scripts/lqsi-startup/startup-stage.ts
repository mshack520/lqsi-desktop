import { app, BrowserWindow, ipcMain, nativeTheme, session } from 'electron'
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
const STAGE_TIMEOUT_MS = 120000

let registered = false
let stageWindow: BrowserWindow | null = null
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
  writeRaw(raw)
}

function stagePreloadPath(): string {
  // 主进程按 ESM 打包（package.json type=module），因此用 import.meta.dirname。
  return join(import.meta.dirname, '../preload/startup-gate.cjs')
}

function createStageWindow(preview: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: preview ? 1024 : 1280,
    height: preview ? 640 : 800,
    show: false,
    frame: false,
    fullscreen: !preview,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    skipTaskbar: preview,
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

/** 播放启动舞台；resolve 之后才继续显示主界面。 */
export function showStartupStage(owner: BrowserWindow | null): Promise<void> {
  const raw = readRaw()
  const cfg = configOf(raw)
  if (cfg.enabled === false) return Promise.resolve()
  if (playedThisSession) return Promise.resolve()
  if (cfg.mode === 'once' && raw.lastShownVersion === app.getVersion()) return Promise.resolve()
  playedThisSession = true

  return new Promise<void>((resolve) => {
    const win = createStageWindow(false)
    stageWindow = win
    let settled = false
    let destroyed = false
    let timer: NodeJS.Timeout | undefined
    let autoTimer: NodeJS.Timeout | undefined
    let handoffTimer: NodeJS.Timeout | undefined
    const autoLogin = raw.autoLogin === true

    /** 播完之后不立刻黑屏：换成厂商同款的加载页（resources/splash.html），
     *  等主界面真的起来了再退场，视觉和 LQ SI 原版一致。 */
    const showWaitingLayer = (): void => {
      if (destroyed) return
      try {
        const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        void win
          .loadFile(join(process.resourcesPath, 'splash.html'), { query: { theme } })
          .catch(() => undefined)
      } catch {
        /* best effort */
      }
    }

    const destroyStage = (): void => {
      if (destroyed) return
      destroyed = true
      if (handoffTimer) clearTimeout(handoffTimer)
      try {
        if (!win.isDestroyed()) win.destroy()
      } catch {
        /* window already gone */
      }
    }

    const finish = (): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (autoTimer) clearTimeout(autoTimer)
      ipcMain.removeListener(DONE_CHANNEL, onDone)
      stageWindow = null
      try {
        const next = readRaw()
        next.lastShownVersion = app.getVersion()
        next.lastShownAt = new Date().toISOString()
        writeRaw(next)
      } catch {
        /* persistence is best effort */
      }
      try {
        if (owner && !owner.isDestroyed()) owner.focus()
      } catch {
        /* focus is best effort */
      }

      // 主界面就绪交接：先盖等待层，主窗口能显示后再退场（最多等 12 秒）。
      const ownerUsable = (): boolean => Boolean(owner && !owner.isDestroyed())
      if (!ownerUsable() || owner!.isVisible()) {
        destroyStage()
        resolve()
        return
      }
      showWaitingLayer()
      const handoff = (): void => {
        destroyStage()
        resolve()
      }
      const tryHandoff = (): boolean => {
        if (!ownerUsable()) {
          handoff()
          return true
        }
        if (owner!.isVisible() && !owner!.webContents.isLoading()) {
          handoff()
          return true
        }
        return false
      }
      owner!.webContents.once('did-finish-load', () => {
        setTimeout(tryHandoff, 260)
      })
      owner!.once('show', () => {
        setTimeout(tryHandoff, 260)
      })
      const poll = setInterval(() => {
        if (tryHandoff()) clearInterval(poll)
      }, 200)
      handoffTimer = setTimeout(() => {
        clearInterval(poll)
        handoff()
      }, 12000)
    }

    const onDone = (event: Electron.IpcMainEvent): void => {
      if (event.sender === win.webContents) finish()
    }

    ipcMain.on(DONE_CHANNEL, onDone)
    timer = setTimeout(finish, STAGE_TIMEOUT_MS)
    win.on('closed', finish)
    win.once('ready-to-show', () => {
      if (!settled) win.show()
    })
    void loadStage(win, false, autoLogin ? { ...cfg, requireInteraction: false, allowSkip: true } : undefined)
      .then(() => {
        // 开了免登录：动画播完自动进入，不需要再点确认。
        if (autoLogin && !settled) autoTimer = setTimeout(finish, 3200)
      })
      .catch(finish)
  })
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
  registered = true

  // 工作台内嵌第三方系统（MES 等）时，对方常带 X-Frame-Options / CSP frame-ancestors，
  // 会把 iframe 打死并显示「DSH 无法嵌入此网址」。对所有会话统一摘掉这两个头。
  installFrameHeaderStrip()

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
        if (key === 'passcode' || key === 'lastShownVersion' || key === 'lastShownAt') continue
        raw[key] = value
      }
    }
    writeRaw(raw)
    return { ok: true, config: configOf(raw) }
  })

  ipcMain.handle('lqsi:startup:resetSettings', () => {
    const raw = readRaw()
    writeRaw({ passcode: raw.passcode, autoLogin: raw.autoLogin })
    return { ok: true, config: configOf({}) }
  })

  ipcMain.handle('lqsi:startup:preview', async () => {
    await showPreviewStage()
    return { ok: true }
  })

  ipcMain.handle('lqsi:startup:authorize', (_event, passcode: unknown) =>
    verifyPasscode(String(passcode ?? ''))
      ? { ok: true }
      : { ok: false, error: '启动口令不正确' }
  )

  ipcMain.handle('lqsi:startup:changePassword', (_event, current: unknown, next: unknown) => {
    if (!verifyPasscode(String(current ?? ''))) return { ok: false, error: '启动口令不正确' }
    const text = String(next ?? '')
    if (text.length === 0 || text.length > 64) return { ok: false, error: '新口令长度不合法' }
    setPasscode(text)
    return { ok: true, autoLogin: readRaw().autoLogin === true }
  })

  ipcMain.handle('lqsi:startup:authSettings', () => ({
    ok: true,
    autoLogin: readRaw().autoLogin === true
  }))

  ipcMain.handle('lqsi:startup:setAutoLogin', (_event, enabled: unknown) => {
    const raw = readRaw()
    raw.autoLogin = enabled === true
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
