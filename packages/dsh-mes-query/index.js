import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'
import { createScxMesAssistant, scxMesConstants } from './core.mjs'
import { createMesSettings } from './mes-settings.mjs'
import { toolDefinitions } from './tools.mjs'

export const name = 'dsh-mes-query'
export const SKILL_NAME = 'scx-mes-query'
export const SKILL_DESCRIPTION = '连接云端鑫程智造 MES，查询生产、报工、库存、薪酬、设备和台账；按用户明确要求执行权限内的业务登记。'
export const inject = ['credentials', 'connection', 'tools', 'skills']
export const Config = z.object({ resources: z.string().required(false) })

const PACKAGE_DIRECTORY = fileURLToPath(new URL('.', import.meta.url))
const PACKAGE_SKILL_DIRECTORY = PACKAGE_DIRECTORY
const SKILL_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u

function isGenerationPackage(directory) {
  return directory.replaceAll('\\', '/').includes('/profiles/.generations/live/')
}

export function renderSkillInstructions(markdown) {
  return markdown.replace(SKILL_FRONTMATTER, '').trim()
}

async function isReadableFile(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJsonRequest(request, maxBytes = 16_384) {
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new Error('MES 连接设置请求过大。')
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('格式无效')
    return value
  } catch {
    throw new Error('MES 连接设置不是有效的 JSON。')
  }
}

function registerSettingsApi(ctx, settings) {
  const register = (path, methods, run) => {
    const route = {
      path,
      methods,
      requestBody: 'buffered',
      fetch: async request => {
        try {
          const value = await run(request)
          return Response.json(value, { headers: { 'Cache-Control': 'no-store' } })
        } catch (error) {
          const status = Number.isInteger(error?.status) ? error.status : 400
          return Response.json({ error: String(error?.message || 'MES 连接设置失败。').slice(0, 300) }, {
            status, headers: { 'Cache-Control': 'no-store' },
          })
        }
      },
    }
    return ctx.connection.fetch.register(route)
  }
  register('/api/scx-mes-query.settings', ['GET'], () => settings.describe())
  register('/api/scx-mes-query.save', ['POST'], async request => settings.save(await readJsonRequest(request), request.signal))
  register('/api/scx-mes-query.logout', ['POST'], () => settings.logout())
}

/** Register the cloud MES tools and an installation-owned skill provider. */
export async function apply(ctx, config = {}) {
  const settings = createMesSettings(ctx)
  const assistant = createScxMesAssistant({
    getConnection: () => settings.active(),
    refreshConnection: () => settings.refreshSession(),
  })
  const disposers = toolDefinitions(assistant).map(definition => ctx.tools.register(definition))
  registerSettingsApi(ctx, settings)

  const bundledDirectory = config.resources ? join(config.resources, 'scx-mes-query') : undefined
  const bundledSkillFile = bundledDirectory ? join(bundledDirectory, 'SKILL.md') : undefined
  const skillDirectory = isGenerationPackage(PACKAGE_DIRECTORY)
    ? PACKAGE_SKILL_DIRECTORY
    : bundledSkillFile && await isReadableFile(bundledSkillFile)
      ? bundledDirectory
      : PACKAGE_SKILL_DIRECTORY
  const skillFile = join(skillDirectory, 'SKILL.md')
  const candidate = {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: name,
    source: 'bundled',
    rank: BUNDLED_SKILL_RANK,
    locator: { path: skillFile, directory: skillDirectory },
    resourceBase: { kind: 'directory', path: skillDirectory },
  }
  ctx.skills.registerProvider(() => ({
    name,
    list: async () => [candidate],
    get: async selected => selected.name === SKILL_NAME
      ? { ...candidate, content: renderSkillInstructions(await readFile(skillFile, 'utf8')) }
      : undefined,
  }))

  return () => {
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
  }
}

export { scxMesConstants }
