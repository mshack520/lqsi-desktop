#!/usr/bin/env node
/**
 * 把更新源从 dshdesktop.com 改到自己的 GitHub Releases（改源码 + 已构建产物）。
 *
 * 关键点：厂商的「检查更新」不是直接读 latest.yml，而是先请求在线 rollout 接口
 * （${SERVICE_URL}/v1/updates/check）拿一份 policy，再拿 policy.feedUrl 交给 electron-updater。
 * 我们自建发布没有服务器，所以把这一步改成读仓库里的静态策略文件 updates/policy.json。
 *
 * 用法：node scripts/patch-update-source.mjs --repo OWNER/NAME [--tag-prefix v]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const repo = (get('repo') || process.env.LQSI_REPO || 'mshack520/lqsi-desktop').trim()
const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
if (!REPO_PATTERN.test(repo) || /^OWNER\//i.test(repo) || /^NAME\//i.test(repo)) {
  throw new Error(`更新源仓库名不合法：「${repo}」—— 必须是 owner/name，例如 mshack520/lqsi-desktop`)
}
const prefix = get('tag-prefix', 'v')
const base = `https://github.com/${repo}`
const POLICY_URL = `https://raw.githubusercontent.com/${repo}/main/updates/policy.json`

const rules = [
  // 1) 在线 rollout 接口 → 仓库内静态 policy.json（raw 不跳转，符合 redirect:'error'）
  [
    /\$\{SERVICE_URL\}\/v1\/updates\/check\?\$\{query\}/g,
    () => `${POLICY_URL}?$\{query\}`
  ],
  // 2) 静态 policy 不知道客户端版本，所以「版本不比自己新」要当作“无更新”，不能抛错
  [
    /if \(policy\?\.updateAvailable === false\) return \{ updateAvailable: false \};?/g,
    () =>
      "if (policy?.updateAvailable !== true) return { updateAvailable: false }; " +
      "if (!isVersion(policy.version) || compareVersions(String(policy.version).split('+')[0], String(this.options.version).split('+')[0]) <= 0) return { updateAvailable: false };"
  ],
  // 3) 常规地址替换
  [/https:\/\/dshdesktop\.com\/updates\/latest\//g, `${base}/releases/latest/download/`],
  [/https:\/\/dshdesktop\.com\/updates\/versions\.json/g, `${base}/releases/latest/download/versions.json`],
  [/https:\/\/dshdesktop\.com\/updates\/archive\/\$\{([^}]+)\}\//g, `${base}/releases/download/${prefix}\${$1}/`],
  // 4) 崩溃上报接口 → 本仓库 issues（无服务器，别让它拖慢启动）
  [/https:\/\/dshdesktop\.com\/crash/g, `${base}/issues`]
]

const targets = [
  'src/main/update/version-catalog.ts',
  'src/main/update/update-manager.ts',
  'src/main/desktop-service/service.ts',
  'src/main/desktop-service/index.ts',
  'src/main/index.ts',
  'out/main/index.js'
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
if (total === 0) throw new Error('[LQ SI] 没有发现可改写的更新源，说明上游代码结构变了，请先核对再发布')
console.log(`[LQ SI] 更新源已指向 ${base}；策略文件 ${POLICY_URL}`)
