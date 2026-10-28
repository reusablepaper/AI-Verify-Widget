import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../main/ipc/channels.ts'
import type { ProductView, SyncSummary } from '../main/productsService.ts'
import type { AppSettings } from '../main/data/settingsStore.ts'
import type { HistoryEntryType, InterruptKind } from '../main/data/schema.ts'

const api = {
  getProducts: (): Promise<ProductView[]> => ipcRenderer.invoke(IPC.getProducts),

  onProductsUpdated: (cb: (products: ProductView[]) => void): (() => void) => {
    const listener = (_e: unknown, products: ProductView[]): void => cb(products)
    ipcRenderer.on(IPC.productsUpdated, listener)
    return () => ipcRenderer.removeListener(IPC.productsUpdated, listener)
  },

  refreshNow: (): Promise<SyncSummary> => ipcRenderer.invoke(IPC.refreshNow),

  appendHistoryEntry: (
    id: string,
    type: HistoryEntryType,
    opts?: { note?: string; taskKind?: InterruptKind; round?: number }
  ): Promise<void> => ipcRenderer.invoke(IPC.appendHistoryEntry, id, type, opts),

  editHistoryEntry: (id: string, entryId: string, patch: { at?: string; note?: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.editHistoryEntry, id, entryId, patch),

  deleteHistoryEntry: (id: string, entryId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.deleteHistoryEntry, id, entryId),

  undoLast: (id: string): Promise<void> => ipcRenderer.invoke(IPC.undoLast, id),

  confirmExclude: (id: string): Promise<void> => ipcRenderer.invoke(IPC.confirmExclude, id),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.getSettings),

  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> =>
    ipcRenderer.invoke(IPC.setSetting, key, value),

  getAuthStatus: (): Promise<{ connected: boolean }> => ipcRenderer.invoke(IPC.getAuthStatus),

  startGoogleAuth: (): Promise<{ connected: boolean }> => ipcRenderer.invoke(IPC.startGoogleAuth),

  hideWindow: (): Promise<void> => ipcRenderer.invoke(IPC.hideWindow),
}

export type WidgetApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
