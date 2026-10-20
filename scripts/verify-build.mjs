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
const mainIndex = readPattern(/^\/out\/main\/[^/]+\.js$/)
record(mainIndex.includes('lqsi://settings'), '主进程接管 lqsi://settings（设置入口）')
record(mainIndex.includes('lqsi:startup:'), '主进程注册启动舞台 IPC')
record(mainIndex.includes('启动动画设置'), '菜单含「启动动画设置」')

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
const view = entries.find((e) => e.includes('/out/main/enterprise-view'))
record(view ? read(view).includes('input[type=password]') : false, '自动登录只在看到登录框时执行一次')

// 5) 运行资源与品牌注册表
for (const f of ['splash.html', 'startup-gate.html', 'icon.png', 'app-update.yml', 'dsh-desktop.patch.yml']) {
  record(existsSync(join(resources, f)), `resources/${f}`)
}
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
