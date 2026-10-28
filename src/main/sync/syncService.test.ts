import { test } from 'node:test'
import assert from 'node:assert/strict'
import { syncProducts } from './syncService.ts'
import type { SheetRow } from '../google/rowMapper.ts'
import type { Product } from '../data/schema.ts'
import { TARGET_REVIEWER } from '../config.ts'

function row(partial: Partial<SheetRow> & { id: string; rowIndex: number }): SheetRow {
  return {
    companyName: '기업',
    productName: '제품',
    status: '심사중',
    reviewer: TARGET_REVIEWER,
    ...partial,
  }
}

const NOW = '2026-01-01T00:00:00.000Z'

test('신규 후보는 1단계로 등록되고, 시트 행 순서를 보존한다', () => {
  const rows = [row({ id: 'B', rowIndex: 3 }), row({ id: 'A', rowIndex: 2 })]
  const result = syncProducts([], rows, NOW)
  assert.deepEqual(
    result.products.map((p) => p.id),
    ['A', 'B']
  )
  assert.equal(result.products[0].history.length, 0)
  assert.equal(result.added.length, 2)
})

test('이미 완료(적합)인 신규 행은 등록하지 않는다', () => {
  const rows = [row({ id: 'A', rowIndex: 2, status: '완료(적합)' })]
  const result = syncProducts([], rows, NOW)
  assert.equal(result.products.length, 0)
  assert.equal(result.added.length, 0)
})

test('담당심사원이 다르거나 대기 상태면 후보에서 제외된다', () => {
  const rows = [
    row({ id: 'A', rowIndex: 2, reviewer: '다른사람' }),
    row({ id: 'B', rowIndex: 3, status: '대기' }),
  ]
  const result = syncProducts([], rows, NOW)
  assert.equal(result.products.length, 0)
})

test('추적 중 완료(적합)로 바뀌면 자동 제외하지 않고 완료 이벤트만 기록한다', () => {
  const existing: Product[] = [
    {
      id: 'A',
      companyName: '기업',
      productName: '제품',
      registeredAt: NOW,
      archived: false,
      sheetSnapshot: { status: '심사중', reviewer: TARGET_REVIEWER, rowIndex: 2 },
      history: [],
    },
  ]
  const rows = [row({ id: 'A', rowIndex: 2, status: '완료(적합)' })]
  const result = syncProducts(existing, rows, NOW)
  assert.equal(result.products[0].archived, false)
  assert.equal(result.products[0].history.at(-1)?.type, 'stage:completed_from_sheet')
  assert.deepEqual(result.completedDetected, ['A'])
})

test('이미 완료 감지된 제품은 재동기화해도 완료 이벤트를 중복 기록하지 않는다', () => {
  const existing: Product[] = [
    {
      id: 'A',
      companyName: '기업',
      productName: '제품',
      registeredAt: NOW,
      archived: false,
      sheetSnapshot: { status: '완료(적합)', reviewer: TARGET_REVIEWER, rowIndex: 2 },
      history: [{ id: 'h1', at: NOW, type: 'stage:completed_from_sheet' }],
    },
  ]
  const rows = [row({ id: 'A', rowIndex: 2, status: '완료(적합)' })]
  const result = syncProducts(existing, rows, NOW)
  assert.equal(result.products[0].history.length, 1)
  assert.equal(result.completedDetected.length, 0)
})

test('행 삭제/담당자 변경/대기 전환 시 확인 없이 즉시 자동 제외된다', () => {
  const existing: Product[] = [
    {
      id: 'DELETED',
      companyName: 'a',
      productName: 'a',
      registeredAt: NOW,
      archived: false,
      sheetSnapshot: { status: '심사중', reviewer: TARGET_REVIEWER, rowIndex: 2 },
      history: [],
    },
    {
      id: 'REASSIGNED',
      companyName: 'b',
      productName: 'b',
      registeredAt: NOW,
      archived: false,
      sheetSnapshot: { status: '심사중', reviewer: TARGET_REVIEWER, rowIndex: 3 },
      history: [],
    },
    {
      id: 'WAITING',
      companyName: 'c',
      productName: 'c',
      registeredAt: NOW,
      archived: false,
      sheetSnapshot: { status: '심사중', reviewer: TARGET_REVIEWER, rowIndex: 4 },
      history: [],
    },
  ]
  const rows = [
    row({ id: 'REASSIGNED', rowIndex: 3, reviewer: '다른사람' }),
    row({ id: 'WAITING', rowIndex: 4, status: '대기' }),
  ]
  const result = syncProducts(existing, rows, NOW)
  const byId = Object.fromEntries(result.products.map((p) => [p.id, p]))

  assert.equal(byId.DELETED.archived, true)
  assert.equal(byId.DELETED.archivedReason, 'removed_from_sheet')
  assert.equal(byId.REASSIGNED.archived, true)
  assert.equal(byId.REASSIGNED.archivedReason, 'reviewer_changed')
  assert.equal(byId.WAITING.archived, true)
  assert.equal(byId.WAITING.archivedReason, 'status_waiting')
  assert.equal(result.archived.length, 3)
  assert.equal(byId.DELETED.history.at(-1)?.type, 'exclude:auto')
})

test('이미 제외된(archived) 제품은 다시 후보에 나타나도 건드리지 않는다', () => {
  const existing: Product[] = [
    {
      id: 'A',
      companyName: 'a',
      productName: 'a',
      registeredAt: NOW,
      archived: true,
      archivedAt: NOW,
      archivedReason: 'status_waiting',
      sheetSnapshot: { status: '대기', reviewer: TARGET_REVIEWER, rowIndex: 2 },
      history: [{ id: 'h1', at: NOW, type: 'exclude:auto' }],
    },
  ]
  const rows = [row({ id: 'A', rowIndex: 2, status: '심사중' })]
  const result = syncProducts(existing, rows, NOW)
  assert.deepEqual(result.products, existing)
  assert.equal(result.added.length, 0)
})

test('동일 입력으로 두 번 동기화해도 멱등적이다(변화 없음)', () => {
  const rows = [row({ id: 'A', rowIndex: 2 })]
  const first = syncProducts([], rows, NOW)
  const second = syncProducts(first.products, rows, '2026-01-02T00:00:00.000Z')
  assert.equal(second.added.length, 0)
  assert.equal(second.archived.length, 0)
  assert.equal(second.completedDetected.length, 0)
  assert.deepEqual(second.products, first.products)
})
