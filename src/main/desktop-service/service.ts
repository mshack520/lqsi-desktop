import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersions } from '../update/version-catalog'

export const SERVICE_URL = 'https://github.com/mshack520/lqsi-desktop/issues'
export type DesktopPlatform = 'mac' | 'mac-intel' | 'windows'
export type FailureKind = 'startup-failure' | 'harness-crash' | 'renderer-crash' | 'gpu-crash' | 'main-crash' | 'unclean-exit'
export type UpdateDecision = { updateAvailable: false } | { updateAvailable: true; version: string; feedUrl: string }
type Request = (url: string, init?: RequestInit) => Promise<Response>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/
export function isVersion(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80 || !semver.test(value)) return false
  return !(semver.exec(value)?.[4]?.split('.').some(part => /^0\d+$/.test(part)))
}
export function isPrereleaseVersion(value: string): boolean {
  return Boolean(semver.exec(value)?.[4])
}
export function desktopPlatform(platform: string, arch: string): DesktopPlatform {
  if (platform === 'darwin' && arch === 'arm64') return 'mac'
  if (platform === 'darwin' && arch === 'x64') return 'mac-intel'
  if (platform === 'win32' && arch === 'x64') return 'windows'
  throw new Error(`Unsupported desktop platform: ${platform}/${arch}`)
}
export function redact(value: string): string {
  return value.replace(/(Bearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret|token)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi, '$1[REDACTED]')
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/(?:\/Users\/|\/home\/)[^/\s]+/g, '/home/[USER]')
    .replace(/C:\\Users\\[^\\\s]+/gi, 'C:\\Users\\[USER]')
}
function atomic(path: string, value: unknown): void {
  const temp = `${path}.${randomUUID()}.tmp`
  try { writeFileSync(temp, JSON.stringify(value), { mode: 0o600 }); renameSync(temp, path) }
  finally { if (existsSync(temp)) unlinkSync(temp) }
}
export function tailLog(path: string): { lines: string[]; logStatus: 'ok' | 'missing' | 'truncated' | 'unreadable' } {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    const size = fstatSync(fd).size, start = Math.max(0, size - 1024 * 1024)
    const buffer = Buffer.alloc(size - start)
    const read = readSync(fd, buffer, 0, buffer.length, start)
    let text = buffer.subarray(0, read).toString('utf8')
    if (start > 0) { const newline = text.indexOf('\n'); text = newline < 0 ? '' : text.slice(newline + 1) }
    const lines = text.split(/\r?\n/)
    if (lines.at(-1) === '') lines.pop()
    const last = lines.slice(-100)
    const truncated = (start > 0 && last.length < 100) || last.some(line => line.length > 2000)
    return { lines: last.map(line => redact(line).slice(0, 2000)), logStatus: truncated ? 'truncated' : 'ok' }
  } catch (error) { return { lines: [], logStatus: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable' } }
  finally { if (fd !== undefined) closeSync(fd) }
}
export function isHealthySessionLog(lines: string[]): boolean {
  if (lines.length === 0) return false
  const tail = lines.slice(-30)
  const hasError = tail.some(line =>
    /render-process-gone:\s*reason=crashed/i.test(line) ||
    /GPU process gone:\s*reason=crashed/i.test(line) ||
    /Harness entry failed/i.test(line) ||
    /DSH entry failed/i.test(line) ||
    /uncaught exception/i.test(line) ||
    /unhandled rejection/i.test(line) ||
    /\bfatal\b/i.test(line) ||
    /STATUS_ACCESS_VIOLATION/i.test(line) ||
    /\(exit code [^0]\)/i.test(line)
  )
  if (hasError) return false
  return lines.some(line =>
    line.includes('Harness is ready') ||
    line.includes('cleared 1 stale Harness authentication cookie') ||
    line.includes('dsh web:')
  )
}

export class DesktopService {
  readonly installationId: string
  readonly platform: DesktopPlatform
  private sessionId?: string
  private flushing?: Promise<void>
  private readonly outbox: string
  private readonly marker: string
  constructor(private readonly options: { stateDir: string; logPath: string; version: string; platform: string; arch: string; request: Request; confirmUpload: (report: string) => Promise<boolean> }) {
    this.platform = desktopPlatform(options.platform, options.arch)
    if (!isVersion(options.version)) throw new Error('Invalid application version')
    this.outbox = join(options.stateDir, 'outbox')
    this.marker = join(options.stateDir, 'session.json')
    mkdirSync(this.outbox, { recursive: true, mode: 0o700 })
    const path = join(options.stateDir, 'installation.json')
    if (!existsSync(path)) atomic(path, { id: randomUUID() })
    this.installationId = (JSON.parse(readFileSync(path, 'utf8')) as { id: string }).id
    if (!uuid.test(this.installationId)) throw new Error('Invalid installation ID')
  }
  beginSession(): void {
    this.sessionId = randomUUID()
    atomic(this.marker, { eventId: this.sessionId, version: this.options.version })
  }
  markCleanExit(): void {
    try { unlinkSync(this.marker) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  discard(eventId: string): boolean {
    if (!uuid.test(eventId)) return false
    const path = join(this.outbox, `${eventId}.json`)
    if (existsSync(path)) {
      try {
        unlinkSync(path)
        return true
      } catch {
        return false
      }
    }
    return false
  }
  capture(kind: FailureKind, message: string, eventId: string = randomUUID(), version = this.options.version): string {
    if (!uuid.test(eventId)) throw new Error('Invalid event ID')
    const path = join(this.outbox, `${eventId}.json`)
    if (existsSync(path)) return eventId
    const files = this.pending()
    while (files.length >= 50) unlinkSync(join(this.outbox, files.shift()!))
    atomic(path, { eventId, installationId: this.installationId, version, platform: this.platform, kind, occurredAt: new Date().toISOString(), message: redact(message).slice(0, 4000), ...tailLog(this.options.logPath) })
    return eventId
  }
  captureFatal(error: Error): void { this.capture('main-crash', error.stack ?? error.message, this.sessionId) }
  pending(): string[] {
    return readdirSync(this.outbox).filter(name => name.endsWith('.json') && uuid.test(name.slice(0, -5)))
      .sort((a, b) => statSync(join(this.outbox, a)).mtimeMs - statSync(join(this.outbox, b)).mtimeMs)
  }
  flush(): Promise<void> {
    this.flushing ??= this.flushPending().finally(() => { this.flushing = undefined })
    return this.flushing
  }
  private async flushPending(): Promise<void> {
    // Consume before sending: even an interrupted request must not be retried.
    for (let name = this.pending()[0]; name; name = this.pending()[0]) {
      const path = join(this.outbox, name)
      const body = readFileSync(path, 'utf8')
      unlinkSync(path)
      try {
        let kind: string | undefined
        try { kind = (JSON.parse(body) as { kind?: string }).kind } catch { /* A malformed report still goes through consent. */ }
        if (kind === 'unclean-exit') continue
        if (await this.options.confirmUpload(body) !== true) continue
        await this.options.request(SERVICE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(5000), redirect: 'error' })
      } catch { /* Best effort: failed reports are discarded. */ }
    }
  }

  // Keep the caller's manual flag for compatibility; presentation is local.
  // The rollout API accepts only installationId, currentVersion and platform.
  // LQSI_CHECK_UPDATE_V4 — LQ SI: 直读 latest.yml，并在多个下载通道里挑一个通得过的。
  async checkUpdate(_manual = false): Promise<UpdateDecision> {
    const REPO = 'mshack520/lqsi-desktop'
    const DIRECT = `https://github.com/${REPO}/releases/download/v`
    const PROXIES = [
      'https://ghproxy.net/https://github.com/',
      'https://gh-proxy.com/https://github.com/',
      'https://ghfast.top/https://github.com/'
    ]
    const tryGet = async (url: string): Promise<string | null> => {
      try {
        const response = await this.options.request(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) return null
        return await response.text()
      } catch {
        return null
      }
    }
    const latestUrl = `https://github.com/${REPO}/releases/latest/download/latest.yml`
    const manifestUrls = [latestUrl]
    for (const proxy of PROXIES) manifestUrls.push(`${proxy}github.com/${REPO}/releases/latest/download/latest.yml`)
    let text: string | null = null
    for (const url of manifestUrls) {
      text = await tryGet(url)
      if (text) break
    }
    if (!text) return { updateAvailable: false }
    const matched = /^s*version:s*([0-9A-Za-z.+_-]+)/m.exec(text)
    if (!matched) return { updateAvailable: false }
    const remote = matched[1]!.trim()
    if (!isVersion(remote)) return { updateAvailable: false }
    const current = this.options.version
    if (compareVersions(remote.split('+')[0]!, current.split('+')[0]!) <= 0) return { updateAvailable: false }
    if (!isPrereleaseVersion(current) && isPrereleaseVersion(remote)) return { updateAvailable: false }
    const bases = PROXIES.map((proxy) => `${proxy}github.com/${REPO}/releases/download/v${remote}/`)
    bases.push(`${DIRECT}${remote}/`)
    let chosen = bases[0]!
    for (const base of bases) {
      if (await tryGet(`${base}latest.yml`)) { chosen = base; break }
    }
    return { updateAvailable: true, version: remote, feedUrl: chosen }
  }
}
