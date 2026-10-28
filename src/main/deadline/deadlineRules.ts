import type { SheetSnapshot } from '../data/schema.ts'

const IMMINENT_WINDOW_DAYS = 3

function parseSheetDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * 마감 임박 여부 (§4.3). 지금은 달력일 기준 단순 비교로 스텁 처리했다.
 * TODO: 시트에 연결된 Apps Script의 영업일(공휴일 탭 반영) 계산 로직을 확인해
 * d3Due/d3Extended 기준으로 교체할 것 — 그 로직 함수 부분만 필요할 때 찾아서 읽는다
 * (전체 스크립트를 미리 읽지 않는다, 토큰 절약을 위해).
 */
export function isDeadlineImminent(snapshot: SheetSnapshot, now = new Date()): boolean {
  const due = parseSheetDate(snapshot.d3Due) ?? parseSheetDate(snapshot.deadlineDue)
  const extended = parseSheetDate(snapshot.d3Extended) ?? parseSheetDate(snapshot.deadlineExtended)
  const effective = extended ?? due
  if (!effective) return false

  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((effective.getTime() - now.getTime()) / msPerDay)
  return daysLeft >= 0 && daysLeft <= IMMINENT_WINDOW_DAYS
}
