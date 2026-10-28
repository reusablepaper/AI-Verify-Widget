import { app, BrowserWindow, Menu, Tray, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createWidgetWindow } from './windows/widgetWindow.ts'
import { startPinKeepAlive } from './windows/pinKeepAlive.ts'
import { ProductStore } from './data/productStore.ts'
import { createSettingsStore } from './data/settingsStore.ts'
import { GoogleAuthClient } from './google/authClient.ts'
import { ProductsService } from './productsService.ts'
import { registerIpcHandlers } from './ipc/handlers.ts'
import { IPC } from './ipc/channels.ts'
import { scheduleDailyRefresh } from './scheduler/dailyRefresh.ts'

function credentialsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'credentials.json')
    : join(app.getAppPath(), 'credentials.json')
}

let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null

process.on('uncaughtException', (err) => console.error('[uncaughtException]', err))
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err))
app.on('render-process-gone', (_e, _wc, details) => console.error('[render-process-gone]', details))
app.on('child-process-gone', (_e, details) => console.error('[child-process-gone]', details))

app.whenReady().then(async () => {
  try {
    await startApp()
  } catch (err) {
    console.error('[startApp failed]', err)
  }
})

async function startApp(): Promise<void> {
  electronApp.setAppUserModelId('com.ai-hwakinje.widget')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const settings = createSettingsStore()
  const store = new ProductStore(app.getPath('userData'))
  const auth = new GoogleAuthClient(credentialsPath(), join(app.getPath('userData'), 'token.json'))
  const products = new ProductsService(store, auth)
  await products.init()

  registerIpcHandlers(products, auth, settings, () => widgetWindow)

  function applyPinnedWindow(win: BrowserWindow): void {
    win.setAlwaysOnTop(settings.get('pinned'), 'floating')
    const keepAlive = startPinKeepAlive(win, () => settings.get('pinned'))
    win.on('closed', () => keepAlive.stop())
  }

  widgetWindow = createWidgetWindow(settings.get('windowBounds'))
  products.registerWindow(widgetWindow)
  ipcMain.handle(IPC.hideWindow, () => widgetWindow?.hide())
  applyPinnedWindow(widgetWindow)

  widgetWindow.on('close', () => {
    if (!widgetWindow) return
    settings.set('windowBounds', widgetWindow.getBounds())
  })

  tray = new Tray(icon)
  tray.setToolTip('AI 확인제 진행현황 위젯')
  const rebuildTrayMenu = (): void => {
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: widgetWindow?.isVisible() ? '숨기기' : '보이기',
          click: () => widgetWindow?.[widgetWindow.isVisible() ? 'hide' : 'show'](),
        },
        { label: '지금 새로고침', click: () => void products.refreshFromSheet() },
        {
          label: '항상 위에 고정',
          type: 'checkbox',
          checked: settings.get('pinned'),
          click: (item) => {
            settings.set('pinned', item.checked)
            widgetWindow?.setAlwaysOnTop(item.checked, 'floating')
          },
        },
        { type: 'separator' },
        { label: '종료', click: () => app.quit() },
      ])
    )
  }
  rebuildTrayMenu()
  tray.on('click', () => widgetWindow?.show())

  // 자동 갱신: 매일 12:30 Asia/Seoul. 놓친 갱신에 대한 캐치업 로직은 두지 않는다.
  scheduleDailyRefresh(() => {
    void products.refreshFromSheet()
  })

  // 토큰이 있으면 시작 시 1회 즉시 동기화.
  if (await auth.hasToken()) {
    void products.refreshFromSheet()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      widgetWindow = createWidgetWindow(settings.get('windowBounds'))
      products.registerWindow(widgetWindow)
      applyPinnedWindow(widgetWindow)
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
