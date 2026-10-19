#!/usr/bin/env node
/**
 * 把 LQ SI 品牌应用到一个 dsh-desktop 仓库副本上（幂等，可重复运行）。
 * 用法：在仓库根目录执行  node scripts/apply-lqsi-brand.mjs
 *
 * 兼容两种目录布局：
 *  - 仓库布局：脚本在 <repo>/scripts/，素材在 <repo>/assets、插件在 <repo>/packages
 *  - 套件布局：脚本在 <kit>/scripts/，素材在 <kit>/assets、插件在 <kit>/packages
 */
import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.cwd()
const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OWNER_REPO = (process.env.LQSI_REPO || 'mshack520/lqsi-desktop').trim()
const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
if (!REPO_PATTERN.test(OWNER_REPO) || /^OWNER\//i.test(OWNER_REPO)) {
  throw new Error(`LQSI_REPO 不合法：「${OWNER_REPO}」—— 必须是 owner/name，例如 mshack520/lqsi-desktop`)
}

const PLUGINS = ['dsh-lingqi-brand', 'dsh-lingqi-brand-icon', 'dsh-startup-screen', 'dsh-mes-query']
// 带 @scope 的私有包：MES 工作台原型（工作台里的「AI 智能系统」入口）
const SCX_PLUGINS = ['@scx/dsh-workbench-prototype']
const ASSETS = ['splash.html', 'startup-gate.html', 'dsh-loader.gif', 'dsh-loader-dark.gif', 'icon.png', 'icon.ico']
// 启动动画窗口要加载 splash.html + startup/splash.js(.css)，缺一个就只闪一下。
const EXTRA_RESOURCES = [
  { from: 'build/splash.html', to: 'splash.html' },
  { from: 'build/startup-gate.html', to: 'startup-gate.html' },
  { from: 'build/startup', to: 'startup' }
]

const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
const norm = (p) => resolve(p).replace(/[\\/]+$/, '').toLowerCase()
const samePath = (a, b) => norm(a) === norm(b)

// ---------- 1) package.json：产品名 / 安装包名 / 更新源 ----------
const pkgPath = join(root, 'package.json')
const pkg = loadJson(pkgPath)
const b = (pkg.build ??= {})

b.productName = 'LQ SI'
b.appId = process.env.LQSI_APPID || b.appId || 'io.dsh.desktop' // 保持旧 appId 才能原地升级
b.artifactName = 'lq-si-${os}-${arch}.${ext}'
b.nsis = { ...(b.nsis || {}), artifactName: 'lq-si-windows-${arch}-setup.${ext}' }
b.publish = [{ provider: 'generic', url: `https://github.com/${OWNER_REPO}/releases/latest/download/` }]
b.win = { ...(b.win || {}), verifyUpdateCodeSignature: false }
if (b.win && 'signtoolOptions' in b.win) delete b.win.signtoolOptions

// 启动动画 / 身份屏所需的资源目录必须真的打进安装包
b.extraResources = Array.isArray(b.extraResources) ? b.extraResources : []
for (const entry of EXTRA_RESOURCES) {
  if (!b.extraResources.some((item) => item && item.to === entry.to)) b.extraResources.push(entry)
}

pkg.version = process.env.LQSI_VERSION || pkg.version

// ---------- 2) 品牌素材 → build/ ----------
const assetsSrc = join(kit, 'assets')
const buildDir = join(root, 'build')
mkdirSync(buildDir, { recursive: true })

let copiedAssets = 0
for (const f of ASSETS) {
  const src = join(assetsSrc, f)
  if (!existsSync(src)) continue
  const dst = join(buildDir, f === 'icon.png' ? 'app-icon.png' : f)
  if (samePath(src, dst)) continue
  cpSync(src, dst)
  copiedAssets++
}

// 启动动画脚本目录（若素材里带 startup/）
const startupSrc = join(assetsSrc, 'startup')
const startupDst = join(buildDir, 'startup')
if (existsSync(startupSrc) && !samePath(startupSrc, startupDst)) {
  cpSync(startupSrc, startupDst, { recursive: true })
  copiedAssets++
}

// ---------- 3) 品牌插件 → packages/ ----------
const pkgsDir = join(root, 'packages')
mkdirSync(pkgsDir, { recursive: true })

let copiedPlugins = 0
for (const name of [...PLUGINS, ...SCX_PLUGINS]) {
  const src = join(kit, 'packages', name)
  if (!existsSync(src)) continue
  const dst = join(pkgsDir, name)
  if (!samePath(src, dst)) {
    mkdirSync(dirname(dst), { recursive: true })
    cpSync(src, dst, { recursive: true })
    copiedPlugins++
  }
}

// ---------- 4) 以 file: 依赖把插件接进主工程 ----------
pkg.dependencies = pkg.dependencies || {}
const wired = []
for (const name of [...PLUGINS, ...SCX_PLUGINS]) {
  if (existsSync(join(pkgsDir, name))) {
    pkg.dependencies[name] = `file:packages/${name}`
    wired.push(name)
  }
}
saveJson(pkgPath, pkg)

console.log('[LQ SI] 品牌已应用成功：')
console.log('  productName =', b.productName, '  appId =', b.appId, '  version =', pkg.version)
console.log('  更新源 =', b.publish[0].url)
console.log('  素材 → build/（本次处理', copiedAssets, '项）')
console.log('  插件 → packages/（本次复制', copiedPlugins, '个）')
console.log('  已接入依赖：', wired.join(', '))
console.log('  下一步：npm install && npm run build && npx electron-builder --win --x64 --publish never')
