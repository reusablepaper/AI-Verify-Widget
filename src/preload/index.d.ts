import { ElectronAPI } from '@electron-toolkit/preload'
import type { WidgetApi } from './index.ts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: WidgetApi
  }
}
