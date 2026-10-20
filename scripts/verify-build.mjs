/* LQ SI 打包自检：把「安装包真的包含我们改的东西」变成可核对的证据。
   任何一条不通过 → 进程退出码 1，Release 步骤不会执行，坏包发布不出去。 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const asar = require('@electron/asar')

const unpacked = 'dist/win-unpacked'
const asarPath = join(unpacked, 'resources/app.asar')
const resources = join(unpacked, 'resources')
const lines = []
let failed = 0

function record(ok, name, detail = '') {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!ok) failed += 1
  console.log(lines.at(-1))
}

if (!existsSync(asarPath)) {
  record(false, 'app.asar 存在', asarPath)
  finish()
}

let rawEntries = []
try {
  rawEntries = asar.listPackage(asarPath)
} catch (error) {
  record(false, 'asar 可读取', String(error && error.message ? error.message : error))
}
record(rawEntries.length > 0, 'asar 条目数', String(rawEntries.length))
console.log(lines.at(-1))

const BS = String.fromCharCode(92)
const trimSep = (p) => (p.charAt(0) === BS || p.charAt(0) === '/' ? p.slice(1) : p)
const posix = (p) => '/' + trimSep(p).split(BS).join('/')
const entries = rawEntries.map(posix)
const has = (p) => entries.some((e) => e === p || e.endsWith(p))
const read = (p) => {
  const idx = rawEntries.findIndex((raw, i) => entries[i] === p || entries[i].endsWith(p))
  if (idx < 0) return ''
  try {
    return asar.extractFile(asarPath, trimSep(rawEntries[idx])).toString('utf8')
  } catch {
    return ''
  }
}
const readPattern = (re) => entries.map((e, i) => (re.test(e) ? i : -1)).filter((i) => i >= 0).map((i) => {
  try {
    return asar.extractFile(asarPath, trimSep(rawEntries[i])).toString('utf8')
  } catch {
    return ''
  }
}).join(String.fromCharCode(10))


// 1) 启动舞台与设置窗口的编译产物
record(has('/out/preload/startup-gate.cjs'), '含启动舞台 preload')
record(has('/out/preload/startup-settings.cjs'), '含设置窗口 preload')
record(entries.some((e) => e.includes('/out/main/startup-settings')), '含设置窗口主进程代码')
record(entries.some((e) => e.includes('/out/main/enterprise-view')), '含企业网页视图代码')

// 2) 主进程关键接线
const mainBundles = readPattern(/^\/out\/main\/[^/]+\.js$/)
const mainIndex = read('/out/main/index.js')
record(mainBundles.includes('lqsi://settings'), '主进程接管 lqsi://settings（设置入口）')
record(mainIndex.includes('tray.setToolTip') && mainIndex.includes('LQ SI Desktop') && mainIndex.includes('显示 LQ SI Desktop'), '系统托盘名称显示为 LQ SI Desktop')
record(mainIndex.includes('registerStartupStageIpc'), '主进程在启动流程中调用启动舞台注册')
record(mainIndex.includes('finishStartupOverlay'), '工作区 UI 就绪后关闭启动覆盖层')
const startupStagePath = entries.find((entry) => /\/out\/main\/startup-stage[^/]*\.js$/.test(entry))
const startupStage = startupStagePath ? read(startupStagePath) : ''
record(startupStage.includes('getBounds') && startupStage.includes('workArea') && startupStage.includes('skipTaskbar: true'), '启动窗口与主窗口对齐且不产生第二个任务栏图标')
for (const channel of ['lqsi:startup:verify', 'lqsi:startup:authorize', 'lqsi:startup:getSettings']) {
  record(Boolean(startupStagePath) && startupStage.includes(channel), `启动舞台已注册处理器 ${channel}`)
}
record(Boolean(startupStagePath) && startupStage.includes('autoLoginPasscodeEncrypted'), '自动登录口令使用系统加密存储')
const startupGatePreload = read('/out/preload/startup-gate.cjs')
record(startupGatePreload.includes('verifyStartupAutoLogin'), '启动舞台 preload 含自动口令验证桥')
record(mainBundles.includes('启动动画设置'), '菜单含「启动动画设置」')

// 3) 渲染进程桥接（面板/工作台调用得到的方法）
const preload = readPattern(/\/out\/preload\/index[^/]*\.cjs$/)
for (const name of ['authorizeStartupSettings', 'changeStartupPassword', 'verifyStartupPassword', 'getAutoLaunchSettings', 'getEnterpriseWebsiteStatus', 'reloadEnterpriseWebsite']) {
  record(preload.includes(name), `桥接方法 ${name}`)
}

// 4) 品牌插件 + 面板跳转 + 自动登录只尝试一次
record(has('/node_modules/dsh-lingqi-brand/package.json'), '含品牌插件 dsh-lingqi-brand')
record(has('/node_modules/dsh-lingqi-brand-icon/package.json'), '含品牌图标插件')
record(has('/node_modules/dsh-startup-screen/package.json'), '含启动动画插件')
record(has('/node_modules/@scx/dsh-workbench-prototype/package.json'), '含 AI 智能平台工作台插件')
const panel = read('/node_modules/dsh-startup-screen/lib/client.js')
record(panel.includes('lqsi://settings/open'), '面板无桥时唤起独立设置窗口')
const onboarding = read('/node_modules/dsh-desktop-onboarding/client.js')
record(onboarding.includes('LQ SI 灵启智能体') && !onboarding.includes('介绍 LQ SI 灵启智能体') && onboarding.includes('更多能力等待您亲自解锁') && onboarding.includes('深秋的蝎子'), '首次启动标题去掉“介绍”并保留 LQ SI 品牌文案')
record(!onboarding.includes('DeepSeek Harness 目前的 0.1 版本') && !onboarding.includes('DataElem 团队维护'), '首次启动介绍不再显示上游说明')
const view = entries.find((e) => e.includes('/out/main/enterprise-view'))
const enterpriseView = view ? read(view) : ''
record(/input\[type=["']?password["']?\]/.test(enterpriseView) && enterpriseView.includes('requestSubmit'), 'MES 网页等待登录表单并自动提交')
record(enterpriseView.includes('passwordEncrypted') && enterpriseView.includes('safeStorage.encryptString'), 'MES 网页账号使用系统加密保存')
record(enterpriseView.includes('did-stop-loading') && enterpriseView.includes('isLoadingMainFrame'), 'MES 网页状态与实际加载状态同步')
record(enterpriseView.includes('isWebsiteUrl') && enterpriseView.includes('网页没有成功载入') && enterpriseView.includes('await loadWebsiteUrl(target, reloadUrl)'), 'about:blank 不会被误报为网页已打开，目标网页加载失败会显示错误')
record(enterpriseView.includes("target.setVisible(false)") && enterpriseView.includes('target.setVisible(!state.covered)'), '清理登录态期间隐藏空白页面，目标网页载入后再显示')
record(enterpriseView.includes('toNativeBounds') && enterpriseView.includes('getZoomFactor') && enterpriseView.includes('getContentSize'), '企业网页视图按应用缩放正确换算显示区域')
record(enterpriseView.includes('clearStorageData') && enterpriseView.includes('clearAuthCache') && enterpriseView.includes('clearCache'), '注销时清理 MES 网页分区、认证缓存和缓存文件')
record(enterpriseView.includes('safeExecuteJavaScript') && enterpriseView.includes('timeoutMs = 800') && enterpriseView.includes('getURL()'), '新建网页未导航时跳过脚本执行，避免工作台加载卡死')
record(enterpriseView.includes('session.fromPartition') && enterpriseView.includes('clearEnterpriseWebsiteLogin'), '关闭设置面板后注销仍会清理企业网页登录会话')
record(enterpriseView.includes('loadWebsiteUrl') && enterpriseView.includes('网页连接超时'), '企业网页连接超时会结束加载并给出错误状态')
record(enterpriseView.includes('render-process-gone') && enterpriseView.includes('网页进程已退出'), '企业网页进程退出时能结束加载并显示错误')
record(enterpriseView.includes('comparableWebsiteUrl'), '网站重定向补尾斜杠后不会触发重复加载')
record(enterpriseView.includes('autoLoginBlocked') && enterpriseView.includes('__lqsiMesAutoLoginToken') && enterpriseView.includes('loginForSite'), '没有保存账号时清除旧网页登录并阻止自动登录')

// 5) 运行资源与品牌注册表
for (const f of ['splash.html', 'startup-gate.html', 'icon.png', 'app-update.yml', 'dsh-desktop.patch.yml']) {
  record(existsSync(join(resources, f)), `resources/${f}`)
}
const reconnectSplash = existsSync(join(resources, 'splash.html')) ? readFileSync(join(resources, 'splash.html'), 'utf8') : ''
record(reconnectSplash.includes('正在连接工作区') && !reconnectSplash.includes('LQ SI DESKTOP'), '重启等待画面与连接提示统一')
for (const f of ['startup/splash.js', 'startup/splash.css']) {
  record(existsSync(join(resources, f)), `resources/${f}`)
}
const patch = existsSync(join(resources, 'dsh-desktop.patch.yml')) ? readFileSync(join(resources, 'dsh-desktop.patch.yml'), 'utf8') : ''
for (const token of ['dsh-lingqi-brand', 'dsh-startup-screen', 'dsh-mes-query', '@scx/dsh-workbench-prototype']) {
  record(patch.includes(token), `品牌注册表含 ${token}`)
}

finish()

function finish() {
  lines.unshift(`LQ SI 打包自检 ${new Date().toISOString()}`)
  lines.push('', failed === 0 ? `结果：全部通过（${lines.length - 2} 项）` : `结果：${failed} 项未通过`)
  mkdirSync('dist', { recursive: true })
  writeFileSync('dist/verify.txt', lines.join('\n') + '\n')
  process.exit(failed === 0 ? 0 : 1)
}
