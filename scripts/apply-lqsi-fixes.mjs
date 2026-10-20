#!/usr/bin/env node
/**
 * LQ SI 品牌修复（构建前执行，幂等）。
 *
 *   1. 安装器：用户直接选盘符根目录（F:\）时自动改成 F:\LQ SI，并能创建目录
 *   2. 首启欢迎弹窗：把 DSH Desktop / dataelem 的说明换成 LQ SI 的
 *   3. 模型列表：去掉我们之前加的重复 DeepSeek 条目（内置那一条已经可用）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')

const log = (m) => console.log(`[lqsi-fixes] ${m}`)
const fail = (m) => {
  console.error(`[lqsi-fixes] ERROR: ${m}`)
  process.exit(1)
}
const read = (rel) => {
  const p = join(repo, rel)
  if (!existsSync(p)) fail(`${rel} 不存在`)
  return readFileSync(p, 'utf8')
}
const write = (rel, text) => writeFileSync(join(repo, rel), text, 'utf8')

/* ── 1 安装器：盘符根目录自动补目录名 ─────────────────────────────────── */
{
  const rel = 'build/installer.nsh'
  let text = read(rel)
  if (text.includes('LQSI_ROOT_FIX')) {
    log(`${rel} 已包含盘符修复`)
  } else {
    const anchor = 'Function DshEnsureInstDirExists'
    const start = text.indexOf(anchor)
    if (start < 0) fail(`${rel} 找不到 DshEnsureInstDirExists`)
    const end = text.indexOf('FunctionEnd', start)
    if (end < 0) fail(`${rel} DshEnsureInstDirExists 缺少 FunctionEnd`)
    const BS = String.fromCharCode(92)
    // NSIS 点击“下一步/安装”时会调用 .onVerifyInstDir 做路径校验；
    // 在这里先把根目录补名并建目录，才不会在校验阶段被判“目录不存在”。
    const verify = 'Function .onVerifyInstDir'
    const vi = text.indexOf(verify)
    if (vi >= 0) {
      const ve = text.indexOf('FunctionEnd', vi)
      if (ve > 0) {
        text = `${text.slice(0, vi)}Function .onVerifyInstDir${String.fromCharCode(10)}  Call DshEnsureInstDirExists${String.fromCharCode(10)}${text.slice(ve)}`
      }
    }
    const body = [
      '; LQSI_ROOT_FIX: 选盘符根目录（F: 或 F:/ ）时自动补成 F:/LQ SI，并创建目录。',
      'Function DshEnsureInstDirExists',
      '  StrCpy $0 $INSTDIR',
      '  StrLen $1 $0',
      '  ${If} $1 == 2',
      '    StrCpy $2 $0 1 1',
      '    ${If} $2 == ":"',
      '      StrCpy $INSTDIR "$0' + BS + 'LQ SI"',
      '    ${EndIf}',
      '  ${ElseIf} $1 == 3',
      '    StrCpy $2 $0 1 1',
      '    StrCpy $3 $0 1 2',
      '    ${If} $2 == ":"',
      '    ${AndIf} $3 == "' + BS + '"',
      '      StrCpy $INSTDIR "$0LQ SI"',
      '    ${EndIf}',
      '  ${EndIf}',
      '  CreateDirectory "$INSTDIR"',
      'FunctionEnd'
    ].join('\n')
    write(rel, `${text.slice(0, start)}${body}${text.slice(end + 'FunctionEnd'.length)}`)
    log(`${rel} 已加入盘符根目录自动补名`)
  }
}

/* ── 2 首启欢迎弹窗文案 ──────────────────────────────────────────────── */
{
  const rel = 'packages/dsh-desktop-onboarding/client.js'
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不在仓库里，跳过首启文案`)
  } else {
  let text = read(rel)
  if (text.includes('LQ SI 桌面版')) {
    log(`${rel} 已是 LQ SI 文案`)
  } else {
    const pairs = [
      ["brandName: 'DSH Desktop'", "brandName: 'LQ SI'"],
      ["brandBy: 'by dataelem'", "brandBy: 'by LQ SI'"],
      ["step0Title: '内测声明'", "step0Title: 'LQ SI 使用说明'"],
      ["desktopIntroTitle: '关于 DSH Desktop'", "desktopIntroTitle: '关于 LQ SI'"],
      [
        "officialSiteUrl: 'https://dshdesktop.com/zh/'",
        "officialSiteUrl: 'https://github.com/mshack520/lqsi-desktop'"
      ],
      [
        "officialSiteUrl: 'https://www.dshdesktop.com/'",
        "officialSiteUrl: 'https://github.com/mshack520/lqsi-desktop'"
      ],
      ["officialSite: '官网'", "officialSite: '更新与下载'"],
      ["officialSite: 'Official site'", "officialSite: 'Updates & downloads'"]
    ]
    let hits = 0
    for (const [from, to] of pairs) {
      if (text.includes(from)) {
        text = text.split(from).join(to)
        hits += 1
      }
    }
    // 正文：整体替换成 LQ SI 版本（两个语言各一段）
    const zhBody =
      'LQ SI 是由灵启智能维护的智能工作台，基于 DeepSeek Harness 构建，内置企业 MES、文档与表格、插件市场等能力。当前版本仍在持续打磨，欢迎随时反馈问题与建议。\\n\\n我们会在开源、开放、可复用的基础设施之上持续迭代，把 LQ SI 做成真正能落地干活的桌面工作台。'
    const enBody =
      'LQ SI is an intelligent workspace maintained by Lingqi Intelligence, built on DeepSeek Harness with built-in MES, Office documents, and a plugin market. The current release is still being refined, and feedback is always welcome.\\n\\nWe keep iterating on open, reusable infrastructure to make LQ SI a desktop workspace that does real work.'
    text = text.replace(
      /declarationBody:\s*"[^"]{40,}"/u,
      `declarationBody: "${zhBody}"`
    )
    text = text.replace(
      /declarationBody:\s*"[^"]{40,}"/u,
      `declarationBody: "${enBody}"`
    )
    text = text.replace(
      /desktopIntroBody:\s*'[^']{10,}'/u,
      "desktopIntroBody: 'LQ SI 桌面版由灵启智能维护，本地优先、跨平台，内置企业系统与办公文档工作流。'"
    )
    write(rel, text)
    log(`${rel} 文案已改为 LQ SI（命中 ${hits} 处）`)
  }
  }
}

/* ── 3 去掉重复的 DeepSeek 自定义 provider ───────────────────────────── */
{
  const rel = 'build/dsh-desktop.patch.yml'
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不存在，跳过 provider 清理`)
  } else {
    let text = read(rel)
    let removed = 0
    for (let guard = 0; guard < 6; guard += 1) {
      const marker = removed === 0 ? '- id: llm-pi-ai' : '- id: agent-default-model'
      const row = text.indexOf(marker)
      if (row < 0) break
      // 往前吃掉紧邻的注释行
      let begin = text.lastIndexOf(String.fromCharCode(10), row - 1) + 1
      for (let step = 0; step < 6; step += 1) {
        const prevStart = text.lastIndexOf(String.fromCharCode(10), begin - 2) + 1
        const line = text.slice(prevStart, begin).trim()
        if (line.startsWith('#')) begin = prevStart
        else break
      }
      const NL = String.fromCharCode(10)
      const next = text.indexOf(`${NL}- id: `, row + marker.length)
      const stop = next < 0 ? text.length : next + 1
      text = `${text.slice(0, begin)}${text.slice(stop)}`
      removed += 1
    }
    if (removed > 0) {
      write(rel, text)
      log(`${rel} 已移除 ${removed} 段重复 DeepSeek 条目`)
    } else {
      log(`${rel} 已无重复 provider 段`)
    }
  }
}

/* ── 4 启动设置页：工作台内嵌页面拿不到 window.dshDesktop 时向上找 ────── */
{
  const rel = 'packages/dsh-startup-screen/lib/client.js'
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不存在，跳过设置页桥接`)
  } else {
    const text = read(rel)
    if (text.includes('{LQSI_BRIDGE_FALLBACK}')) {
      log(`${rel} 已含桥接兜底`)
    } else {
      const fallback =
        '(function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()'
      const next = text.split('window.dshDesktop').join(fallback)
      write(rel, next)
      log(`${rel} 已改为多窗口查找 dshDesktop`)
    }
  }
}

/* ── 5 工作台客户端：拿不到 window.dshDesktop 时向上找（内嵌页面用） ── */
{
  const rel = 'packages/@scx/dsh-workbench-prototype/lib/client.js'
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不存在，跳过工作台桥接`)
  } else {
    const text = read(rel)
    if (text.includes('{LQSI_BRIDGE_FALLBACK}')) {
      log(`${rel} 已含桥接兜底`)
    } else {
      const fallback =
        '(function(){try{return window.dshDesktop||(window.parent&&window.parent.dshDesktop)||(window.top&&window.top.dshDesktop)}catch(e){return window.dshDesktop}})()'
      const next = text.split('window.dshDesktop').join(fallback)
      write(rel, next)
      log(`${rel} 已改为多窗口查找 dshDesktop`)
    }
  }
}

/* ── 6 检查更新：直读 GitHub 发布清单，并自动挑选可用的下载通道 ───── */
{
  const rel = 'src/main/desktop-service/service.ts'
  const marker = 'LQSI_CHECK_UPDATE_V4'
  if (!existsSync(join(repo, rel))) {
    log(`${rel} 不存在，跳过检查更新改写`)
  } else {
    const text = read(rel)
    if (text.includes(marker)) {
      log(`${rel} 检查更新已带镜像选路`)
    } else {
      const signature = '  async checkUpdate(_manual = false): Promise<UpdateDecision> {'
      const start = text.indexOf(signature)
      if (start < 0) fail(`${rel} 找不到 checkUpdate`)
      let depth = 0
      let end = -1
      for (let index = text.indexOf('{', start); index < text.length; index += 1) {
        const char = text[index]
        if (char === '{') depth += 1
        else if (char === '}') { depth -= 1; if (depth === 0) { end = index + 1; break } }
      }
      if (end < 0) fail(`${rel} 无法确定 checkUpdate 范围`)
      const replacement = [
        '  // ' + marker + ' — LQ SI: 直读 latest.yml，并在多个下载通道里挑一个通得过的。',
        '  async checkUpdate(_manual = false): Promise<UpdateDecision> {',
        "    const REPO = 'mshack520/lqsi-desktop'",
        "    const DIRECT = `https://github.com/${REPO}/releases/download/v`",
        '    const PROXIES = [',
        "      'https://ghproxy.net/https://github.com/',",
        "      'https://gh-proxy.com/https://github.com/',",
        "      'https://ghfast.top/https://github.com/'",
        '    ]',
        '    const tryGet = async (url: string): Promise<string | null> => {',
        '      try {',
        '        const response = await this.options.request(url, { signal: AbortSignal.timeout(8000) })',
        '        if (!response.ok) return null',
        '        return await response.text()',
        '      } catch {',
        '        return null',
        '      }',
        '    }',
        "    const latestUrl = `https://github.com/${REPO}/releases/latest/download/latest.yml`",
        '    const manifestUrls = [latestUrl]',
        '    for (const proxy of PROXIES) manifestUrls.push(`${proxy}github.com/${REPO}/releases/latest/download/latest.yml`)',
        "    let text: string | null = null",
        '    for (const url of manifestUrls) {',
        '      text = await tryGet(url)',
        '      if (text) break',
        '    }',
        '    if (!text) return { updateAvailable: false }',
        '    const matched = /^\s*version:\s*([0-9A-Za-z.+_-]+)/m.exec(text)',
        '    if (!matched) return { updateAvailable: false }',
        '    const remote = matched[1]!.trim()',
        '    if (!isVersion(remote)) return { updateAvailable: false }',
        '    const current = this.options.version',
        "    if (compareVersions(remote.split('+')[0]!, current.split('+')[0]!) <= 0) return { updateAvailable: false }",
        '    if (!isPrereleaseVersion(current) && isPrereleaseVersion(remote)) return { updateAvailable: false }',
        '    const bases = PROXIES.map((proxy) => `${proxy}github.com/${REPO}/releases/download/v${remote}/`)',
        '    bases.push(`${DIRECT}${remote}/`)',
        '    let chosen = bases[0]!',
        '    for (const base of bases) {',
        '      if (await tryGet(`${base}latest.yml`)) { chosen = base; break }',
        '    }',
        '    return { updateAvailable: true, version: remote, feedUrl: chosen }',
        '  }'
      ].join('\n')
      write(rel, text.slice(0, start) + replacement + text.slice(end))
      log(`${rel} 检查更新改为直读 latest.yml + 镜像选路`)
    }
  }
}

log('完成')
