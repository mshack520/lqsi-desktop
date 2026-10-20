#!/usr/bin/env node
/**
 * LQ SI 文案统一（构建后、打包前执行）。
 *
 * 把界面里残留的 DSH Desktop / dataelem / dshdesktop.com 换成 LQ SI 的说法。
 * 只改构建产物与 @deepseek-ai 的运行时代码，不碰二进制、不改数据目录名。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const log = (m) => console.log(`[lqsi-copy] ${m}`)

const REPO_URL = 'https://github.com/mshack520/lqsi-desktop'
const REPLACEMENTS = [
  ['DSH Desktop', 'LQ SI'],
  ['DSH desktop', 'LQ SI'],
  ['by dataelem', 'by LQ SI'],
  ['DataElem', 'LQ SI'],
  ['dataelem.com', 'github.com/mshack520/lqsi-desktop'],
  ['https://dshdesktop.com/zh/', REPO_URL],
  ['https://www.dshdesktop.com/', REPO_URL],
  ['https://dshdesktop.com', REPO_URL],
  ['dshdesktop.com', 'github.com/mshack520/lqsi-desktop'],
  ['dataelement/dsh-desktop', 'mshack520/lqsi-desktop']
]

const SKIP = /\.(png|jpg|jpeg|gif|ico|icns|woff2?|ttf|otf|exe|dll|node|map|asar|zip|gz|br|wasm|pdf|mp3|wav|mp4|bin)$/iu

const roots = ['out', 'node_modules/@deepseek-ai']

let changed = 0
let scanned = 0

function walk(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' && !dir.endsWith('@deepseek-ai')) continue
      walk(full)
      continue
    }
    if (!entry.isFile() || SKIP.test(entry.name)) continue
    if (extname(entry.name) !== '.js' && extname(entry.name) !== '.cjs' && extname(entry.name) !== '.mjs' && extname(entry.name) !== '.html' && extname(entry.name) !== '.css' && extname(entry.name) !== '.json') continue
    let size = 0
    try {
      size = statSync(full).size
    } catch {
      continue
    }
    if (size > 12 * 1024 * 1024) continue
    scanned += 1
    let text
    try {
      text = readFileSync(full, 'utf8')
    } catch {
      continue
    }
    if (!/DSH Desktop|dataelem|dshdesktop\.com|DataElem/u.test(text)) continue
    let next = text
    for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to)
    if (next === text) continue
    writeFileSync(full, next, 'utf8')
    changed += 1
    log(`改写 ${full.slice(repo.length + 1)}`)
  }
}

for (const root of roots) walk(join(repo, root))
log(`扫描 ${scanned} 个文件，改写 ${changed} 个`)
