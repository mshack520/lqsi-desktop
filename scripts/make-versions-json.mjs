#!/usr/bin/env node
/** 生成 dist/versions.json（版本目录），供“选择版本/历史版本”使用。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const dist = join(process.cwd(), 'dist')
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
const repo = process.env.LQSI_REPO || 'OWNER/lqsi'
const v = pkg.version
const entry = {
  version: v,
  feedUrl: `https://github.com/${repo}/releases/download/v${v}/`,
  releasedAt: new Date().toISOString()
}
let list = []
const p = join(dist, 'versions.json')
if (existsSyncSafe(p)) { try { list = JSON.parse(readFileSync(p, 'utf8')).versions || [] } catch {} }
list = [entry, ...list.filter(x => x.version !== v)]
writeFileSync(p, JSON.stringify({ updatedAt: new Date().toISOString(), versions: list }, null, 2))
console.log('[LQ SI] versions.json 已生成，版本：', v)
function existsSyncSafe(p) { try { readFileSync(p); return true } catch { return false } }
