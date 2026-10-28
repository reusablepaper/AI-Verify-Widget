import { STATUS_COMPLETED, STATUS_WAITING, TARGET_REVIEWER } from '../config.ts'
import type { HistoryEntry, Product, SheetSnapshot } from '../data/schema.ts'
import { filterCandidateRows } from '../google/rowMapper.ts'
import type { SheetRow } from '../google/rowMapper.ts'

export interface SyncResult {
  products: Product[]
  added: string[]
  completedDetected: string[]
  archived: { id: string; reason: NonNullable<Product['archivedReason']> }[]
}

function toSnapshot(row: SheetRow): SheetSnapshot {
  return {
    status: row.status,
    deadlineDue: row.deadlineDue,
    deadlineExtended: row.deadlineExtended,
    d3Due: row.d3Due,
    d3Extended: row.d3Extended,
    reviewer: row.reviewer,
    rowIndex: row.rowIndex,
  }
}

function classifyDropoutReason(row: SheetRow | undefined): NonNullable<Product['archivedReason']> {
  if (!row) return 'removed_from_sheet'
  if (row.reviewer !== TARGET_REVIEWER) return 'reviewer_changed'
  if (row.status === STATUS_WAITING) return 'status_waiting'
  return 'removed_from_sheet'
}

/**
 * 시트 행과 로컬 제품 목록을 비교해 추가/갱신/완료감지/자동제외를 수행한다.
 * 순수 함수 — 저장은 호출자(ProductStore)가 담당한다.
 */
export function syncProducts(existing: Product[], allRows: SheetRow[], nowIso: string): SyncResult {
  const candidates = filterCandidateRows(allRows)
  const candidateById = new Map(candidates.map((r) => [r.id, r]))
  const rowById = new Map(allRows.map((r) => [r.id, r]))

  const added: string[] = []
  const completedDetected: string[] = []
  const archived: SyncResult['archived'] = []
  const result: Product[] = []

  for (const product of existing) {
    if (product.archived) {
      result.push(product)
      continue
    }

    const candidateRow = candidateById.get(product.id)
    if (!candidateRow) {
      const reason = classifyDropoutReason(rowById.get(product.id))
      archived.push({ id: product.id, reason })
      result.push({
        ...product,
        archived: true,
        archivedAt: nowIso,
        archivedReason: reason,
        history: [
          ...product.history,
          { id: `sys-exclude-${product.id}-${nowIso}`, at: nowIso, type: 'exclude:auto' },
        ],
      })
      continue
    }

    const wasCompleted = product.sheetSnapshot.status === STATUS_COMPLETED
    const nowCompleted = candidateRow.status === STATUS_COMPLETED
    const history: HistoryEntry[] = nowCompleted && !wasCompleted
      ? [
          ...product.history,
          { id: `sys-completed-${product.id}-${nowIso}`, at: nowIso, type: 'stage:completed_from_sheet' },
        ]
      : product.history

    if (nowCompleted && !wasCompleted) completedDetected.push(product.id)

    result.push({
      ...product,
      companyName: candidateRow.companyName,
      productName: candidateRow.productName,
      sheetSnapshot: toSnapshot(candidateRow),
      history,
    })
  }

  // 신규 등록: 기존에 없던 후보 중 상태≠완료(적합)인 것만, 시트 행 순서를 보존해 추가.
  // (등록 시각이 같아도 배열 삽입 순서가 유지되고, 표시 정렬은 registeredAt에 대한
  // 안정 정렬(stable sort)을 쓰므로 동시 등록 시 시트 행 순서가 그대로 보존된다.)
  const knownIds = new Set(existing.map((p) => p.id))
  const newCandidates = [...candidates]
    .filter((r) => !knownIds.has(r.id) && r.status !== STATUS_COMPLETED)
    .sort((a, b) => a.rowIndex - b.rowIndex)

  for (const row of newCandidates) {
    added.push(row.id)
    result.push({
      id: row.id,
      companyName: row.companyName,
      productName: row.productName,
      registeredAt: nowIso,
      archived: false,
      sheetSnapshot: toSnapshot(row),
      history: [],
    })
  }

  return { products: result, added, completedDetected, archived }
}

/** 표시용 정렬: 등록 시점 오름차순, 동시 등록 시 배열(=시트 행) 순서를 안정 정렬로 보존. */
export function sortForDisplay(products: Product[]): Product[] {
  return [...products].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
}
