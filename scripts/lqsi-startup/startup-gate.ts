/**
 * LQ SI 启动舞台的 preload。负责把动画脚本需要的 Host 侧注入量挂到页面上：
 *   __DSH_STARTUP__              动画配置（身份、品牌、颜色、节奏）
 *   __DSH_NATIVE_STARTUP_GATE__  标记由原生窗口承载，动画收尾广播事件而不是自己移除
 *   __DSH_STARTUP_SCRIPT_URL__   动画脚本位置（相对 resources 目录）
 * 动画结束时页面派发 dsh-startup:done，这里转成 IPC 通知主进程关窗放行。
 *
 * 该窗口只加载本地资源（resources/startup-gate.html），因此关闭上下文隔离，
 * 让这些全局量对页面可见；不开放 nodeIntegration。
 */
import { ipcRenderer } from 'electron'

const params = new URLSearchParams(location.search)

let config: Record<string, unknown> = {}
try {
  const parsed = JSON.parse(params.get('config') ?? '{}') as unknown
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    config = parsed as Record<string, unknown>
  }
} catch {
  /* 配置坏了就用动画脚本自带的默认值 */
}

const preview = params.get('preview') === 'true'
const page = window as unknown as Record<string, unknown>

page.__DSH_STARTUP__ = config
page.__DSH_NATIVE_STARTUP_GATE__ = true
page.__DSH_STARTUP_PREVIEW__ = preview
page.__DSH_STARTUP_SKIP__ = false
page.__DSH_STARTUP_ICON_URL__ = 'icon.png'
page.__DSH_STARTUP_SCRIPT_URL__ = 'startup/splash.js'

let finished = false
function done(): void {
  if (finished) return
  finished = true
  ipcRenderer.send('lqsi:startup:done')
}

window.addEventListener('dsh-startup:done', () => done())

// 动画脚本没加载起来（素材缺失、脚本报错）时不能把用户永远锁在黑屏里。
const failsafe = setTimeout(() => {
  if (page.__DSH_STARTUP_LOADED__ !== true) done()
}, 6000)
window.addEventListener('dsh-startup:done', () => clearTimeout(failsafe))

// 页面内置的备用操作区需要这几个能力；只读，不写配置。
page.dshDesktop = {
  verifyStartupPassword: (passcode: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('lqsi:startup:verify', passcode) as Promise<{ ok: boolean }>,
  authorizeStartupSettings: (passcode: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('lqsi:startup:authorize', passcode) as Promise<{ ok: boolean }>,
  getStartupAnimationSettings: (): Promise<unknown> => ipcRenderer.invoke('lqsi:startup:getSettings')
}
