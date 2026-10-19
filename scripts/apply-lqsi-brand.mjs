#!/usr/bin/env node
/**
 * 把 LQ SI 品牌应用到一个 dsh-desktop 仓库副本上（幂等，可重复运行）。
 * 用法：在仓库根目录执行  node scripts/apply-lqsi-brand.mjs
 */
import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const OWNER_REPO = process.env.LQSI_REPO || 'OWNER/lqsi'
const kit = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function loadJson(p) { return JSON.parse(readFileSync(p, 'utf8')) }
function saveJson(p, v) { writeFileSync(p, JSON.stringify(v, null, 2) + '\n') }

const pkgPath = join(root, 'package.json')
const pkg = loadJson(pkgPath)
const b = (pkg.build ??= {})

b.productName = 'LQ SI'
b.appId = process.env.LQSI_APPID || 'io.dsh.desktop'   // 保持与旧版一致，才能原地升级
b.artifactName = 'lq-si-${os}-${arch}.${ext}'
b.nsis = { ...(b.nsis || {}), artifactName: 'lq-si-windows-${arch}-setup.${ext}' }
b.publish = [{ provider: 'generic', url: `https://github.com/${OWNER_REPO}/releases/latest/download/` }]
b.win = { ...(b.win || {}), verifyUpdateCodeSignature: false }
delete b.win.signtoolOptions

// 1) 品牌素材
const assets = join(kit, 'assets')
const buildDir = join(root, 'build')
mkdirSync(buildDir, { recursive: true })
for (const f of ['splash.html', 'dsh-loader.gif', 'dsh-loader-dark.gif']) {
  cpSync(join(assets, f), join(buildDir, f))
}
cpSync(join(assets, 'icon.png'), join(buildDir, 'app-icon.png'))
if (existsSync(join(assets, 'icon.ico'))) cpSync(join(assets, 'icon.ico'), join(buildDir, 'icon.ico'))

// 2) 品牌插件（file: 依赖）
const pkgsDir = join(root, 'packages')
cpSync(join(kit, 'packages'), pkgsDir, { recursive: true })
pkg.dependencies = pkg.dependencies || {}
for (const p of ['dsh-lingqi-brand', 'dsh-lingqi-brand-icon', 'dsh-startup-screen', 'dsh-mes-query']) {
  pkg.dependencies[p] = `file:packages/${p}`
}
saveJson(pkgPath, pkg)

console.log('[LQ SI] 品牌已应用：')
console.log('  productName = LQ SI   appId =', b.appId)
console.log('  更新源 = https://github.com/' + OWNER_REPO + '/releases/latest/download/')
console.log('  素材 → build/    插件 → packages/（4 个）')
console.log('  下一步：npm install && npm run build && npx electron-builder --win --x64 --publish never')
