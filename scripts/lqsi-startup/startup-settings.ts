import { app, BrowserWindow, Menu, MenuItem, ipcMain } from 'electron'
import { join } from 'node:path'

let settingsWindow: BrowserWindow | null = null

function settingsPage(): string {
  return join(process.resourcesPath, 'startup-settings.html')
}

/** 打开「启动动画设置」原生窗口。 */
export function openStartupSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  const win = new BrowserWindow({
    width: 780,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: 'LQ SI 启动动画设置',
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/startup-settings.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  })
  settingsWindow = win
  win.on('closed', () => {
    if (settingsWindow === win) settingsWindow = null
  })
  void win.loadFile(settingsPage())
}

/** 在主菜单里加一项入口；应用启动时调用一次。 */
export function installStartupSettingsMenu(): void {
  try {
    const menu = Menu.getApplicationMenu()
    const item = new MenuItem({ label: '启动动画设置…', click: () => openStartupSettings() })
    if (menu) {
      menu.append(item)
      Menu.setApplicationMenu(menu)
      return
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { label: 'LQ SI', submenu: [{ label: '启动动画设置…', click: () => openStartupSettings() }, { role: 'quit', label: '退出' }] },
        { label: '编辑', submenu: [{ role: 'copy' }, { role: 'paste' }] },
      ]),
    )
  } catch {
    /* 菜单不可用时忽略：命令行仍可通过 IPC 打开 */
  }
}

export function registerStartupSettingsIpc(): void {
  ipcMain.removeHandler('lqsi:settings:close')
  ipcMain.handle('lqsi:settings:close', () => {
    settingsWindow?.close()
    return { ok: true }
  })
}

void app.whenReady().then(() => {
  // 菜单要等应用 ready 之后才可靠。
  setTimeout(() => installStartupSettingsMenu(), 3000)
})
