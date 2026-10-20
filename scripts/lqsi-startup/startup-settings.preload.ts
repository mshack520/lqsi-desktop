import { contextBridge, ipcRenderer } from 'electron'

/**
 * LQ SI 启动动画设置窗口的桥。所有方法直接复用主进程已注册的
 * lqsi:startup:* 通道（与启动舞台共用同一份 dsh-startup.json）。
 */
const api = {
  read: () => ipcRenderer.invoke('lqsi:startup:getSettings'),
  save: (patch: Record<string, unknown>) => ipcRenderer.invoke('lqsi:startup:updateSettings', patch),
  reset: () => ipcRenderer.invoke('lqsi:startup:resetSettings'),
  preview: () => ipcRenderer.invoke('lqsi:startup:preview'),
  authorize: (passcode: string) => ipcRenderer.invoke('lqsi:startup:authorize', passcode),
  changePasscode: (current: string, next: string) =>
    ipcRenderer.invoke('lqsi:startup:changePassword', current, next),
  authSettings: () => ipcRenderer.invoke('lqsi:startup:authSettings'),
  setAutoLogin: (enabled: boolean) => ipcRenderer.invoke('lqsi:startup:setAutoLogin', enabled),
  close: () => ipcRenderer.invoke('lqsi:settings:close'),
}

contextBridge.exposeInMainWorld('lqsiStartup', api)
