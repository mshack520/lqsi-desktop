#!/usr/bin/env node
/**
 * 把更新源从 dshdesktop.com 改到自己的 GitHub Releases（改源码 + 已构建产物）。
 * 用法：node scripts/patch-update-source.mjs --repo OWNER/NAME [--tag-prefix v]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const repo = get('repo') || process.env.LQSI_REPO || 'OWNER/lqsi'
const prefix = get('tag-prefix', 'v')
const base = `https://github.com/${repo}`

const rules = [
  [/https:\/\/dshdesktop\.com\/updates\/latest\//g, `${base}/releases/latest/download/`],
  [/https:\/\/dshdesktop\.com\/updates\/versions\.json/g, `${base}/releases/latest/download/versions.json`],
  [/https:\/\/dshdesktop\.com\/updates\/archive\/\$\{([^}]+)\}\//g, `${base}/releases/download/${prefix}\${$1}/`],
  [/https:\/\/dshdesktop\.com\/crash/g, `${base}/issues`]
]

const targets = [
  'src/main/update/version-catalog.ts',
  'src/main/update/update-manager.ts',
  'src/main/desktop-service/service.ts',
  'src/main/desktop-service/index.ts',
  'src/main/index.ts'
]
let total = 0
for (const rel of targets) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) continue
  let src = readFileSync(p, 'utf8')
  const before = src
  for (const [re, to] of rules) src = src.replace(re, to)
  if (src !== before) { writeFileSync(p, src); total++; console.log('  改写', rel) }
}
for (const rel of ['out/main/index.js']) {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) continue
  let src = readFileSync(p, 'utf8')
  const before = src
  for (const [re, to] of rules) src = src.replace(re, to)
  if (src !== before) { writeFileSync(p, src); total++; console.log('  改写', rel) }
}
console.log(total ? `[LQ SI] 更新源已指向 ${base}` : '[LQ SI] 未发现需要改写的更新源（可能已处理）')
