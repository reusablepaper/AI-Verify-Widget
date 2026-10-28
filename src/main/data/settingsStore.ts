import Store from 'electron-store'

export type PaletteId = 'default' | 'ocean' | 'mint' | 'sky' | 'dusk' | 'rose'

export interface AppSettings {
  pinned: boolean
  autoLaunch: boolean
  palette: PaletteId
  windowBounds?: { x: number; y: number; width: number; height: number }
  lastAutoRefreshDate?: string
}

const DEFAULTS: AppSettings = {
  pinned: false,
  autoLaunch: false,
  palette: 'default',
}

export function createSettingsStore(): Store<AppSettings> {
  return new Store<AppSettings>({ name: 'config', defaults: DEFAULTS })
}
