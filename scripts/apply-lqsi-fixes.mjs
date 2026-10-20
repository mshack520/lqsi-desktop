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
  if (text.includes('DshNormalizeDriveRootFinal')) {
    log(`${rel} 已包含盘符修复`)
  } else {
    const fnStart = text.indexOf('Function DshNormalizeDriveRoot')
    if (fnStart < 0) fail(`${rel} 找不到 DshNormalizeDriveRoot`)
    const fnEnd = text.indexOf('FunctionEnd', fnStart)
    if (fnEnd < 0) fail(`${rel} DshNormalizeDriveRoot 缺少 FunctionEnd`)
    const insertAt = text.indexOf(String.fromCharCode(10), fnEnd + 'FunctionEnd'.length) + 1
    const extra = `
    ; LQSI_ROOT_FIX: 点“安装”时再兜一次（编辑框 OnChange 不一定触发），
    ; 把 "F:" / "F:\\" 规范成 "F:\LQ SI" 并确保目录存在。
    !ifndef MUI_PAGE_CUSTOMFUNCTION_LEAVE
      !define MUI_PAGE_CUSTOMFUNCTION_LEAVE DshEnsureInstDirExists
    !endif

    Function DshEnsureInstDirExists
      Call DshNormalizeDriveRootFinal
      CreateDirectory "$INSTDIR"
    FunctionEnd

    Function DshNormalizeDriveRootFinal
      StrCpy $0 $INSTDIR
      StrLen $1 $0
      \${If} $1 == 2
        StrCpy $2 $0 1 1
        \${If} $2 == ":"
          StrCpy $INSTDIR "$0\LQ SI"
        \${EndIf}
      \${ElseIf} $1 == 3
        StrCpy $2 $0 1 1
        StrCpy $3 $0 1 2
        \${If} $2 == ":"
        \${AndIf} $3 == "\\"
          StrCpy $INSTDIR "$0LQ SI"
        \${EndIf}
      \${EndIf}
    FunctionEnd
`
    text = `${text.slice(0, insertAt)}${extra}${text.slice(insertAt)}`
    write(rel, text)
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
  if (!text.includes('LQ SI: DeepSeek 官方标准端点')) {
    log(`${rel} 已无重复 provider 段`)
  } else {
    const start = text.indexOf('# LQ SI: DeepSeek 官方标准端点')
    if (start < 0) fail(`${rel} 段定位失败`)
    // 段尾：下一个顶层 "- id:" 或文件末尾
    const rest = text.slice(start)
    const nextRow = rest.search(/\n- id: /u)
    const end = nextRow < 0 ? text.length : start + nextRow + 1
    text = `${text.slice(0, start)}${text.slice(end)}`
    write(rel, text)
    log(`${rel} 已移除重复 DeepSeek 条目`)
  }
  }
}

log('完成')
