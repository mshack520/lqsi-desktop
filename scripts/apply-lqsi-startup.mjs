#!/usr/bin/env node
/**
 * 把 LQ SI 的原生启动舞台接进官方源码（幂等，可重复执行）。
 *
 * 做的事：
 *   1. 复制 scripts/lqsi-startup/startup-stage.ts -> src/main/startup-stage.ts
 *      （启动动画窗口 + 启动口令 + 设置页需要的 11 个 IPC）
 *   2. 复制 scripts/lqsi-startup/startup-gate.ts  -> src/preload/startup-gate.ts
 *      （给动画页注入 __DSH_STARTUP__ 等全局量）
 *   3. electron.vite.config.ts 增加 preload 入口 startup-gate
 *   4. src/preload/index.ts 往 dshDesktop 桥里补 11 个方法
 *   5. src/main/index.ts 的 showSplash() 改为先播原生启动舞台，失败才退回静态图
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const source = join(here, 'lqsi-startup')

const log = (message) => console.log(`[lqsi-startup] ${message}`)
const fail = (message) => {
  console.error(`[lqsi-startup] ERROR: ${message}`)
  process.exit(1)
}

const read = (rel) => {
  const path = join(repo, rel)
  if (!existsSync(path)) fail(`${rel} 不存在`)
  return readFileSync(path, 'utf8')
}
const write = (rel, text) => writeFileSync(join(repo, rel), text, 'utf8')

/* ── 1/2 源文件 ─────────────────────────────────────────────────────────── */
const COPIES = [
  ['startup-stage.ts', 'src/main/startup-stage.ts'],
  ['startup-gate.ts', 'src/preload/startup-gate.ts']
]
for (const [file, target] of COPIES) {
  const from = join(source, file)
  if (!existsSync(from)) fail(`scripts/lqsi-startup/${file} 不存在`)
  mkdirSync(dirname(join(repo, target)), { recursive: true })
  copyFileSync(from, join(repo, target))
  log(`复制 ${file} -> ${target}`)
}

/* ── 3 preload 入口 ─────────────────────────────────────────────────────── */
{
  const rel = 'electron.vite.config.ts'
  const text = read(rel)
  if (text.includes("'startup-gate':")) {
    log(`${rel} 已包含 startup-gate 入口`)
  } else {
    const anchor = "index: resolve('src/preload/index.ts')"
    if (!text.includes(anchor)) fail(`${rel} 找不到 preload input 锚点`)
    write(
      rel,
      text.replace(
        anchor,
        `${anchor},\n          'startup-gate': resolve('src/preload/startup-gate.ts')`
      )
    )
    log(`${rel} 已加入 startup-gate 入口`)
  }
}

/* ── 4 dshDesktop 桥 ────────────────────────────────────────────────────── */
const BRIDGE_METHODS = `    getStartupAnimationSettings: (): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:getSettings'),
    updateStartupAnimationSettings: (config: any): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:updateSettings', config),
    resetStartupAnimationSettings: (): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:resetSettings'),
    previewStartupAnimation: (): Promise<any> => ipcRenderer.invoke('lqsi:startup:preview'),
    authorizeStartupSettings: (passcode: string): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:authorize', passcode),
    changeStartupPassword: (current: string, next: string): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:changePassword', current, next),
    getStartupAuthSettings: (): Promise<any> => ipcRenderer.invoke('lqsi:startup:authSettings'),
    setStartupAutoLogin: (enabled: boolean): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:setAutoLogin', enabled),
    getAutoLaunchSettings: (): Promise<any> => ipcRenderer.invoke('lqsi:startup:autoLaunch'),
    setAutoLaunchEnabled: (enabled: boolean): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:setAutoLaunch', enabled),
    verifyStartupPassword: (passcode: string): Promise<any> =>
      ipcRenderer.invoke('lqsi:startup:verify', passcode),
`
{
  const rel = 'src/preload/index.ts'
  const text = read(rel)
  if (text.includes('getStartupAnimationSettings:')) {
    log(`${rel} 已包含启动舞台桥方法`)
  } else {
    const anchor = "    restartHarness: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('harness:restart'),"
    if (!text.includes(anchor)) fail(`${rel} 找不到 dshDesktop 锚点`)
    write(rel, text.replace(anchor, `${BRIDGE_METHODS}${anchor}`))
    log(`${rel} 已补 11 个启动舞台方法`)
  }
}

/* ── 5 showSplash 改为原生舞台 ──────────────────────────────────────────── */
const NEW_SHOW_SPLASH = `async function showSplash(): Promise<void> {
  const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : createWindow()
  try {
    const stage = await import('./startup-stage')
    await stage.showStartupStage(window)
    return
  } catch (error) {
    runtime.note(\`[desktop] LQ SI startup stage unavailable: \${
      error instanceof Error ? error.message : String(error)
    }\`)
  }
  clearProfileBootConfirmation()
  const navigationVersion = ++mainWindowNavigationVersion
  window.webContents.stop()
  await loadDesktopResource(window, desktopResourcePath('splash.html'), {
    query: { theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }
  })
  if (window.isDestroyed() || navigationVersion !== mainWindowNavigationVersion) return
  raiseWindowWithoutStealingFocus(window, process.platform, () => app.isActive())
}`

{
  const rel = 'src/main/index.ts'
  const text = read(rel)
  if (text.includes('showStartupStage(window)')) {
    log(`${rel} showSplash 已接线`)
  } else {
    const signature = 'async function showSplash(): Promise<void> {'
    const start = text.indexOf(signature)
    if (start < 0) fail(`${rel} 找不到 showSplash`)
    let depth = 0
    let end = -1
    for (let index = text.indexOf('{', start); index < text.length; index += 1) {
      const char = text[index]
      if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          end = index + 1
          break
        }
      }
    }
    if (end < 0) fail(`${rel} showSplash 花括号不闭合`)
    write(rel, `${text.slice(0, start)}${NEW_SHOW_SPLASH}${text.slice(end)}`)
    log(`${rel} showSplash 已改为原生启动舞台`)
  }
}

/* ── 6 启动时注册 IPC ───────────────────────────────────────────────────── */
{
  const rel = 'src/main/index.ts'
  const text = read(rel)
  const marker = 'module.registerStartupStageIpc()'
  if (text.includes(marker)) {
    log(`${rel} 已注册启动舞台 IPC`)
  } else {
    write(
      rel,
      `${text.trimEnd()}

// LQ SI：启动舞台相关 IPC（启动动画窗口、启动口令、设置页）在模块加载时注册。
void import('./startup-stage')
  .then((module) => module.registerStartupStageIpc())
  .catch(() => undefined)
`
    )
    log(`${rel} 已注册启动舞台 IPC`)
  }
}

log('完成')
