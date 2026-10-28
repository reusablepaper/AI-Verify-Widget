import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'

export function createWidgetWindow(initialBounds?: {
  x: number
  y: number
  width: number
  height: number
}): BrowserWindow {
  const win = new BrowserWindow({
    width: initialBounds?.width ?? 360,
    height: initialBounds?.height ?? 640,
    x: initialBounds?.x,
    y: initialBounds?.y,
    minWidth: 300,
    minHeight: 360,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    // Windows에서 frame:false + hasShadow:false 조합이어도 DWM의 네이티브 사각형
    // 그림자가 완전히 사라지지 않는 경우가 있어 thickFrame도 꺼서 최대한 억제한다.
    thickFrame: false,
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox:true로 두면 preload가 @electron-toolkit/preload(외부 require)를 로드하지
      // 못해 전체 preload 스크립트가 조용히 실패하고 window.api가 통째로 undefined가 된다.
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
