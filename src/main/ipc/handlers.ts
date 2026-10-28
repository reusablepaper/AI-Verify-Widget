import { app, ipcMain, type BrowserWindow } from 'electron'
import type Store from 'electron-store'
import { IPC } from './channels.ts'
import type { ProductsService } from '../productsService.ts'
import type { GoogleAuthClient } from '../google/authClient.ts'
import type { AppSettings } from '../data/settingsStore.ts'
import type { HistoryEntryType, InterruptKind } from '../data/schema.ts'

export function registerIpcHandlers(
  products: ProductsService,
  auth: GoogleAuthClient,
  settings: Store<AppSettings>,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC.getProducts, () => products.getViews())

  ipcMain.handle(IPC.refreshNow, () => products.refreshFromSheet())

  ipcMain.handle(
    IPC.appendHistoryEntry,
    (_e, id: string, type: HistoryEntryType, opts?: { note?: string; taskKind?: InterruptKind; round?: number }) =>
      products.appendHistoryEntry(id, type, opts)
  )

  ipcMain.handle(IPC.editHistoryEntry, (_e, id: string, entryId: string, patch: { at?: string; note?: string }) =>
    products.editHistoryEntry(id, entryId, patch)
  )

  ipcMain.handle(IPC.deleteHistoryEntry, (_e, id: string, entryId: string) =>
    products.deleteHistoryEntry(id, entryId)
  )

  ipcMain.handle(IPC.undoLast, (_e, id: string) => products.undoLast(id))

  ipcMain.handle(IPC.confirmExclude, (_e, id: string) => products.confirmExclude(id))

  ipcMain.handle(IPC.getSettings, () => settings.store)

  ipcMain.handle(IPC.setSetting, (_e, key: keyof AppSettings, value: unknown) => {
    // @ts-expect-error - 키별 값 타입은 호출부(설정 패널)에서 보장
    settings.set(key, value)
    // 자동실행은 패키징된 앱에서만 의미 있다 (dev 모드는 electron.exe + dev 인자를 가리킴).
    if (key === 'autoLaunch' && app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: Boolean(value), path: process.execPath })
    }
    // 설정값 저장만으로는 창에 반영되지 않으므로 직접 적용한다.
    if (key === 'pinned') {
      getWindow()?.setAlwaysOnTop(Boolean(value), 'floating')
    }
  })

  ipcMain.handle(IPC.getAuthStatus, async () => ({ connected: await auth.hasToken() }))

  ipcMain.handle(IPC.startGoogleAuth, async () => {
    await auth.runFirstTimeConsent()
    return { connected: true }
  })
}
