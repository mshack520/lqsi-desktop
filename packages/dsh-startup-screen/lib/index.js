/**
 * dsh-startup-screen — 仅保留 DSH 设置页 bundle。
 * 启动动画由 LQ SI Electron 原生启动窗口播放，插件不注册路由、不注入页面。
 */
const name = 'dsh-startup-screen'
const inject = []

function apply(ctx) {
  try {
    ctx.logger?.debug?.('[dsh-startup-screen] playback is owned by the LQ SI desktop shell')
  } catch {
    // Logging is optional; the settings-only plugin remains active.
  }
}

export { name, inject, apply }
