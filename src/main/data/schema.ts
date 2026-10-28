export type MainStageAdvanceType =
  | 'stage:advance_to_schedule_request'
  | 'stage:advance_to_onsite_scheduled'
  | 'stage:advance_to_report_writing'
  | 'stage:advance_to_evidence_wait'
  | 'stage:advance_to_evidence_review'
  | 'stage:advance_to_senior_review'
  | 'stage:advance_to_lead_review'
  | 'stage:advance_to_pending_approval'

export type HistoryEntryType =
  | MainStageAdvanceType
  | 'stage:evidence_reopen'
  | 'stage:completed_from_sheet'
  | 'main:resume'
  | 'interrupt:open'
  | 'interrupt:received'
  | 'interrupt:close'
  | 'interrupt:reopen'
  | 'exclude:confirmed'
  | 'exclude:auto'

export type InterruptKind = '신청서보완' | '증빙자료'

export interface HistoryEntry {
  id: string
  /** ISO timestamp; drives replay order (see sortHistory). */
  at: string
  type: HistoryEntryType
  note?: string
  /** 끼어드는 일 종류. interrupt:* 타입에서만 사용. */
  taskKind?: InterruptKind
  /** 차수. interrupt:* 타입에서만 사용. */
  round?: number
}

export interface SheetSnapshot {
  status: string
  deadlineDue?: string
  deadlineExtended?: string
  d3Due?: string
  d3Extended?: string
  reviewer: string
  rowIndex: number
}

export interface Product {
  /** 접수번호 */
  id: string
  companyName: string
  productName: string
  /** 최초로 위젯 필터를 통과한 시점, 등록 이후 불변. */
  registeredAt: string
  archived: boolean
  archivedAt?: string
  archivedReason?: 'removed_from_sheet' | 'reviewer_changed' | 'status_waiting' | 'completed_confirmed'
  sheetSnapshot: SheetSnapshot
  history: HistoryEntry[]
}

export interface ProductsFile {
  schemaVersion: number
  products: Product[]
}

export const CURRENT_SCHEMA_VERSION = 1

export const MAIN_STAGE_LABELS = [
  '사전 검토 중',
  '일정 확정 중',
  '심사 대기 중',
  '심사 마무리 중',
  '증적자료 대기 중',
  '증적자료 정리 중',
  '수석 검토 중',
  '팀장 검토 중',
] as const

export type Turn = '내 차례' | '업체 차례' | '수석·팀장 차례'

export interface OpenInterruptTask {
  taskKind: InterruptKind
  round: number
  subState: 'requested' | 'received'
}

export interface DerivedState {
  /** 0-based index into MAIN_STAGE_LABELS; monotonically non-decreasing. */
  stageIndex: number
  /** 승인 후 "적합 처리 대기" (stage 6 완료, 완료(적합) 시트 반영 전) */
  approvalPending: boolean
  /** 시트 상태가 완료(적합)으로 바뀌어 동기화됨 */
  completed: boolean
  /** 사용자가 "제외 확인"을 눌렀음 */
  completionConfirmed: boolean
  mainPaused: boolean
  openInterrupts: OpenInterruptTask[]
  turn: Turn
  /** 0~6, 6칸 스텝 바에서 채울 칸 수 */
  stepBarFilled: number
  stageLabel: string
  badges: string[]
}
