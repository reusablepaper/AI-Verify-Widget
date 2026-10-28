import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { ProductStore } from './data/productStore.ts'
import { deriveState } from './data/derive.ts'
import { isDeadlineImminent } from './deadline/deadlineRules.ts'
import { syncProducts, sortForDisplay } from './sync/syncService.ts'
import { readSheet } from './google/sheetsClient.ts'
import { mapRows } from './google/rowMapper.ts'
import type { GoogleAuthClient } from './google/authClient.ts'
import type { DerivedState, HistoryEntry, HistoryEntryType, InterruptKind, Product } from './data/schema.ts'

export interface ProductView {
  id: string
  companyName: string
  productName: string
  registeredAt: string
  state: DerivedState
  deadlineImminent: boolean
  history: HistoryEntry[]
}

export interface SyncSummary {
  added: number
  completed: number
  archived: number
}

export class ProductsService {
  private store: ProductStore
  private auth: GoogleAuthClient
  private windows = new Set<BrowserWindow>()

  constructor(store: ProductStore, auth: GoogleAuthClient) {
    this.store = store
    this.auth = auth
  }

  async init(): Promise<void> {
    await this.store.load()
  }

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win)
    win.on('closed', () => this.windows.delete(win))
  }

  getViews(): ProductView[] {
    const active = sortForDisplay(this.store.getAll().filter((p) => !p.archived))
    return active.map((p) => this.toView(p))
  }

  private toView(p: Product): ProductView {
    return {
      id: p.id,
      companyName: p.companyName,
      productName: p.productName,
      registeredAt: p.registeredAt,
      state: deriveState(p),
      deadlineImminent: isDeadlineImminent(p.sheetSnapshot),
      history: p.history,
    }
  }

  private broadcast(): void {
    const payload = this.getViews()
    for (const win of this.windows) {
      if (!win.isDestroyed()) win.webContents.send('products:updated', payload)
    }
  }

  async refreshFromSheet(): Promise<SyncSummary> {
    const client = await this.auth.getApiClient()
    const sheet = await readSheet(client)
    const rows = mapRows(sheet)
    const existing = this.store.getAll()
    const result = syncProducts(existing, rows, new Date().toISOString())
    await this.store.save(result.products)
    this.broadcast()
    return {
      added: result.added.length,
      completed: result.completedDetected.length,
      archived: result.archived.length,
    }
  }

  private async mutate(id: string, mutator: (p: Product) => Product): Promise<void> {
    const all = this.store.getAll()
    const idx = all.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`제품을 찾을 수 없습니다: ${id}`)
    const updated = [...all]
    updated[idx] = mutator(all[idx])
    await this.store.save(updated)
    this.broadcast()
  }

  async appendHistoryEntry(
    id: string,
    type: HistoryEntryType,
    opts?: { note?: string; taskKind?: InterruptKind; round?: number }
  ): Promise<void> {
    await this.mutate(id, (p) => ({
      ...p,
      history: [
        ...p.history,
        {
          id: randomUUID(),
          at: new Date().toISOString(),
          type,
          note: opts?.note,
          taskKind: opts?.taskKind,
          round: opts?.round,
        },
      ],
    }))
  }

  async undoLast(id: string): Promise<void> {
    await this.mutate(id, (p) => ({ ...p, history: p.history.slice(0, -1) }))
  }

  async editHistoryEntry(id: string, entryId: string, patch: { at?: string; note?: string }): Promise<void> {
    await this.mutate(id, (p) => ({
      ...p,
      history: p.history.map((h) => (h.id === entryId ? { ...h, ...patch } : h)),
    }))
  }

  async deleteHistoryEntry(id: string, entryId: string): Promise<void> {
    await this.mutate(id, (p) => ({ ...p, history: p.history.filter((h) => h.id !== entryId) }))
  }

  /** 완료(적합) 카드의 "제외 확인" — 사용자가 직접 눌러야 목록에서 빠진다 (§4.2). */
  async confirmExclude(id: string): Promise<void> {
    await this.mutate(id, (p) => ({
      ...p,
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedReason: 'completed_confirmed',
      history: [
        ...p.history,
        { id: randomUUID(), at: new Date().toISOString(), type: 'exclude:confirmed' },
      ],
    }))
  }
}
