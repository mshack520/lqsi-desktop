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
  ['startup-gate.ts', 'src/preload/startup-gate.ts'],
  ['enterprise-view.ts', 'src/main/enterprise-view.ts'],
  ['startup-settings.ts', 'src/main/startup-settings.ts'],
  ['startup-settings.preload.ts', 'src/preload/startup-settings.ts']
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
  const withGate = read(rel)
  if (withGate.includes("'startup-settings':")) {
    log(`${rel} 已包含 startup-settings 入口`)
  } else {
    const anchor = "'startup-gate': resolve('src/preload/startup-gate.ts')"
    if (!withGate.includes(anchor)) fail(`${rel} 找不到 startup-gate 入口锚点`)
    write(rel, withGate.replace(anchor, `${anchor},
          'startup-settings': resolve('src/preload/startup-settings.ts')`))
    log(`${rel} 已加入 startup-settings 入口`)
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
const SHOW_SPLASH_MARKER = 'LQSI_SHOW_SPLASH_V2'
const NEW_SHOW_SPLASH = [
  'async function showSplash(): Promise<void> {',
  '  // ' + SHOW_SPLASH_MARKER + ' — LQ SI: 先播启动舞台，再走官方原有加载页流程。',
  '  clearProfileBootConfirmation()',
  '  const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : createWindow()',
  '  if (!window || window.isDestroyed()) return',
  '  try {',
  "    const stage = await import('./startup-stage')",
  '    await stage.showStartupStage(window)',
  '  } catch (error) {',
  '    runtime.note(`[desktop] LQ SI startup stage unavailable: ${',
  '      error instanceof Error ? error.message : String(error)',
  '    }`)',
  '  }',
  '  const navigationVersion = ++mainWindowNavigationVersion',
  '  window.webContents.stop()',
  "  await loadDesktopResource(window, desktopResourcePath('splash.html'), {",
  "    query: { theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }",
  '  })',
  '  if (window.isDestroyed() || navigationVersion !== mainWindowNavigationVersion) return',
  '  raiseWindowWithoutStealingFocus(window, process.platform, () => app.isActive())',
  '}'
].join('\n')

function replaceShowSplash(rel) {
  const text = read(rel)
  if (text.includes(SHOW_SPLASH_MARKER)) {
    log(`${rel} showSplash 已接线`)
    return
  }
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

replaceShowSplash('src/main/index.ts')

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


/* ── 企业网页嵌入视图：preload 桥 + 主进程 IPC 注册 ───────────────── */
{
  const rel = 'src/preload/index.ts'
  const bridge = `
    // LQ SI：AI 智能平台工作台的嵌入网页（由主进程原生视图绘制）
    attachEnterpriseWebsite: (siteUrl: string, systemName: string, bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('lqsi:enterprise:attachEnterpriseWebsite', siteUrl, systemName, bounds),
    updateEnterpriseWebsiteBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('lqsi:enterprise:updateEnterpriseWebsiteBounds', bounds),
    getEnterpriseWebsiteStatus: () => ipcRenderer.invoke('lqsi:enterprise:getEnterpriseWebsiteStatus'),
    reloadEnterpriseWebsite: () => ipcRenderer.invoke('lqsi:enterprise:reloadEnterpriseWebsite'),
    setEnterpriseWebsiteCovered: (covered: boolean) =>
      ipcRenderer.invoke('lqsi:enterprise:setEnterpriseWebsiteCovered', covered),
    closeEnterpriseWebsite: () => ipcRenderer.invoke('lqsi:enterprise:closeEnterpriseWebsite'),
    saveEnterpriseWebsiteLoginCredentials: (siteUrl: string, username: string, password: string) =>
      ipcRenderer.invoke('lqsi:enterprise:saveEnterpriseWebsiteLoginCredentials', siteUrl, username, password),
    clearEnterpriseWebsiteLogin: (siteUrl: string) => ipcRenderer.invoke('lqsi:enterprise:clearEnterpriseWebsiteLogin', siteUrl),
    readEnterpriseWebsiteApi: (path: string, parameters: Record<string, string | number | boolean>) =>
      ipcRenderer.invoke('lqsi:enterprise:readEnterpriseWebsiteApi', path, parameters),
    inspectEnterpriseWebsitePage: () => ipcRenderer.invoke('lqsi:enterprise:inspectEnterpriseWebsitePage'),
    readEnterpriseEmployeePermissions: () => ipcRenderer.invoke('lqsi:enterprise:readEnterpriseEmployeePermissions'),
    controlEnterpriseWebsitePage: (action: { action: string; target?: string; value?: string }) =>
      ipcRenderer.invoke('lqsi:enterprise:controlEnterpriseWebsitePage', action),
`
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不存在，跳过企业网页桥`)
  } else if (read(rel).includes('attachEnterpriseWebsite')) {
    log(`${rel} 已含企业网页桥`)
  } else {
    const anchor2 = "    restartHarness: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('harness:restart'),"
    const text2 = read(rel)
    if (!text2.includes(anchor2)) fail(`${rel} 找不到企业网页锚点`)
    write(rel, text2.replace(anchor2, `${bridge}${anchor2}`))
    log(`${rel} 已加入 12 个企业网页方法`)
  }

  const mainRel = 'src/main/index.ts'
  if (existsSync(join(repo, mainRel)) && !read(mainRel).includes('registerEnterpriseViewIpc')) {
    const text = read(mainRel)
    write(
      mainRel,
      `${text}
// LQ SI：企业网页嵌入视图（AI 智能平台工作台）。
void import('./enterprise-view')
  .then((module) => module.registerEnterpriseViewIpc())
  .catch(() => undefined)
`
    )
    log(`${mainRel} 已注册企业网页 IPC`)
  }
}

/* ── 7 启动动画设置窗口（菜单入口 + 页面素材） ─────────────────────── */
{
  const page = join(repo, 'assets', 'startup-settings.html')
  const buildDir = join(repo, 'build')
  if (!existsSync(page)) {
    log('assets/startup-settings.html 不存在，跳过设置窗口')
  } else {
    mkdirSync(buildDir, { recursive: true })
    copyFileSync(page, join(buildDir, 'startup-settings.html'))
    const pkgRel = 'package.json'
    const pkg = JSON.parse(read(pkgRel))
    pkg.build ??= {}
    pkg.build.extraResources ??= []
    const extra = pkg.build.extraResources
    if (!extra.some((entry) => entry && entry.to === 'startup-settings.html')) {
      extra.push({ from: 'build/startup-settings.html', to: 'startup-settings.html' })
      write(pkgRel, JSON.stringify(pkg, null, 2))
    }
    log('启动动画设置页面已打包')
  }

  const mainRel = 'src/main/index.ts'
  if (existsSync(join(repo, mainRel)) && !read(mainRel).includes('registerStartupSettingsIpc')) {
    const text = read(mainRel)
    write(
      mainRel,
      `${text}
// LQ SI：启动动画设置窗口（菜单入口）。
void import('./startup-settings')
  .then((module) => module.registerStartupSettingsIpc())
  .catch(() => undefined)
`
    )
    log(`${mainRel} 已注册启动动画设置窗口`)
  }
}

log('完成')
