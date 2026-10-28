import type { DerivedState, HistoryEntry, InterruptKind, OpenInterruptTask, Product, Turn } from './schema.ts'
import { MAIN_STAGE_LABELS } from './schema.ts'

// 본 단계 인덱스 (0-based, MAIN_STAGE_LABELS와 1:1 대응):
// 0 사전검토중 · 1 일정확정중(업체 대기) · 2 심사대기중(구 일정확정) · 3 심사마무리중(구 심사완료)
// 4 증적자료대기중(업체 대기) · 5 증적자료정리중 · 6 수석검토중 · 7 팀장검토중
//
// 하위 호환: 과거(구 6단계 모델) history는 아래 5개 타입만 가지고 있었다.
// 구 모델의 숫자 의미가 바뀌었을 뿐 타입 문자열 자체는 그대로 재사용한다 —
// 기존에 저장된 history를 그대로 재생해도 에러 없이, 의미상 가장 가까운
// 새 단계로 자연스럽게 매핑된다 (증적자료 대기/정리는 신규라 과거 기록에는
// 애초에 없었으므로 건너뛰고 수석검토로 바로 도달 — 데이터 손실 아님).
const STAGE_ADVANCE_INDEX: Record<string, number> = {
  'stage:advance_to_schedule_request': 1, // 사전검토 완료 -> 일정확정중
  'stage:advance_to_onsite_scheduled': 2, // 일정 확정 -> 일정확정
  'stage:advance_to_report_writing': 3, // 심사 완료 -> 심사완료
  'stage:advance_to_evidence_wait': 4, // 증적자료 요청 -> 증적자료대기 (신규)
  'stage:advance_to_evidence_review': 5, // 증적자료 수령 -> 증적자료정리 (신규)
  'stage:advance_to_senior_review': 6, // 수석 검토 요청 -> 수석검토
  'stage:advance_to_lead_review': 7, // 팀장 검토 요청 -> 팀장검토
}

const EVIDENCE_WAIT_INDEX = 4
const EVIDENCE_REVIEW_INDEX = 5
const REVIEW_STAGE_INDICES = [6, 7]
const INHERENT_WAIT_STAGE_INDICES = [1, EVIDENCE_WAIT_INDEX]
const MY_ACTIVE_STAGE_INDICES = [0, 2, 3, EVIDENCE_REVIEW_INDEX]

const TASK_LABEL: Record<InterruptKind, string> = {
  신청서보완: '신청서 보완',
  증빙자료: '증적자료', // 내부 키/저장값은 기존 그대로, 화면 표시 용어만 "증적자료"로 통일
}

interface ReplayState {
  /** 현재 위치 — 증적자료 정리->대기 되돌림(evidence_reopen)으로 뒤로 갈 수 있다. */
  stageIndex: number
  /** 스텝 바 전용. 절대 감소하지 않는다. */
  maxStageIndex: number
  approvalPending: boolean
  completed: boolean
  completionConfirmed: boolean
  resumeActive: boolean
  interrupts: Map<string, OpenInterruptTask>
}

function interruptKey(taskKind: InterruptKind, round: number): string {
  return `${taskKind}:${round}`
}

function sortHistory(history: HistoryEntry[]): HistoryEntry[] {
  return [...history].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

function anyReceived(openInterrupts: OpenInterruptTask[]): boolean {
  return openInterrupts.some((t) => t.subState === 'received')
}

function applyEvent(state: ReplayState, entry: HistoryEntry): ReplayState {
  const stageAdvance = STAGE_ADVANCE_INDEX[entry.type]
  if (stageAdvance !== undefined) {
    state.stageIndex = stageAdvance
    state.maxStageIndex = Math.max(state.maxStageIndex, stageAdvance)
    return state
  }

  switch (entry.type) {
    case 'stage:evidence_reopen':
      // 증적자료 정리 중 추가 자료가 필요해 대기 상태로 되돌아감.
      // maxStageIndex(스텝 바)는 건드리지 않는다 — 핑퐁으로 바가 뒤로 가지 않게.
      state.stageIndex = EVIDENCE_WAIT_INDEX
      break
    case 'stage:advance_to_pending_approval':
      state.approvalPending = true
      break
    case 'stage:completed_from_sheet':
      state.completed = true
      break
    case 'main:resume':
      // 재개 = 더 이상 기다리지 않고 본 단계를 계속 진행한다는 뜻 — 그 시점에 열려있던
      // 끼어드는 일(대기·수령 상태 무관)은 함께 종료된다. 그래서 재개 후엔 badge/특수사항에
      // 더 이상 보이지 않는다.
      state.resumeActive = true
      state.interrupts.clear()
      break
    case 'interrupt:open':
      if (entry.taskKind && entry.round !== undefined) {
        state.interrupts.set(interruptKey(entry.taskKind, entry.round), {
          taskKind: entry.taskKind,
          round: entry.round,
          subState: 'requested',
        })
      }
      break
    case 'interrupt:received': {
      if (entry.taskKind && entry.round !== undefined) {
        const task = state.interrupts.get(interruptKey(entry.taskKind, entry.round))
        if (task) task.subState = 'received'
      }
      break
    }
    case 'interrupt:close':
      if (entry.taskKind && entry.round !== undefined) {
        state.interrupts.delete(interruptKey(entry.taskKind, entry.round))
      }
      break
    case 'interrupt:reopen':
      // entry.round = 닫히는(이전) 차수. 다음 차수를 새로 연다.
      if (entry.taskKind && entry.round !== undefined) {
        state.interrupts.delete(interruptKey(entry.taskKind, entry.round))
        state.interrupts.set(interruptKey(entry.taskKind, entry.round + 1), {
          taskKind: entry.taskKind,
          round: entry.round + 1,
          subState: 'requested',
        })
      }
      break
    case 'exclude:confirmed':
      state.completionConfirmed = true
      break
    case 'exclude:auto':
      // 기록용 — 실제 archived 처리는 Product.archived 필드(동기화 서비스)가 담당.
      break
  }
  return state
}

function replay(history: HistoryEntry[]): ReplayState {
  const state: ReplayState = {
    stageIndex: 0,
    maxStageIndex: 0,
    approvalPending: false,
    completed: false,
    completionConfirmed: false,
    resumeActive: false,
    interrupts: new Map(),
  }

  let prevOpenCount = 0
  for (const entry of sortHistory(history)) {
    applyEvent(state, entry)

    const openCount = state.interrupts.size
    // 열려있던 끼어드는 일이 모두 닫혔다가 새로 열리는 "새 멈춤 에피소드"는
    // 이전에 눌렀던 재개를 더 이상 적용하지 않는다 — 다시 재개를 눌러야 함.
    if (openCount > 0 && prevOpenCount === 0) {
      state.resumeActive = false
    }
    prevOpenCount = openCount
  }

  return state
}

function deriveTurn(state: ReplayState, openInterrupts: OpenInterruptTask[], mainPaused: boolean): Turn {
  if (state.completed) {
    const hasOpen = openInterrupts.length > 0
    const allWaiting = hasOpen && openInterrupts.every((t) => t.subState === 'requested')
    return allWaiting ? '업체 차례' : '내 차례'
  }

  if (REVIEW_STAGE_INDICES.includes(state.stageIndex) && !state.approvalPending) {
    return '수석·팀장 차례'
  }

  if (state.approvalPending) {
    return '내 차례'
  }

  // 일정확정중/증적자료대기는 그 자체로 업체 회신을 기다리는 단계이고,
  // 그 외 단계는 끼어드는 일(mainPaused)이 막고 있을 때만 업체 차례.
  // 단, 수령·검토 중인 끼어드는 일이 하나라도 있으면 항상 내 차례.
  const waitingOnCompany = INHERENT_WAIT_STAGE_INDICES.includes(state.stageIndex) || mainPaused
  if (!waitingOnCompany || anyReceived(openInterrupts)) {
    return '내 차례'
  }
  return '업체 차례'
}

function buildBadges(openInterrupts: OpenInterruptTask[]): string[] {
  return openInterrupts.map((t) => `${TASK_LABEL[t.taskKind]} ${t.round}차 ${t.subState === 'requested' ? '대기' : '처리중'}`)
}

function buildStageLabel(state: ReplayState, mainPaused: boolean): string {
  if (state.completed) {
    return state.completionConfirmed ? '완료(적합)' : '완료(적합) — 제외 확인 대기 중'
  }
  if (state.approvalPending) {
    return '적합 처리 중'
  }
  const base = MAIN_STAGE_LABELS[state.stageIndex]
  return mainPaused ? `${base} (업체 회신 대기로 일시중지)` : base
}

/** 순수 함수: history를 시간순으로 재생해 현재 상태를 계산한다. 절대 영속화하지 않는다. */
export function deriveState(product: Product): DerivedState {
  const state = replay(product.history)
  const openInterrupts = [...state.interrupts.values()]
  // 끼어드는 일에 의한 멈춤은 "내가 일을 하고 있을 수 있는" 단계에서만 의미가 있다
  // (일정확정중/증적자료대기는 애초에 업체 대기 단계라 "멈춤" 개념이 따로 없고,
  //  수석·팀장 검토 단계는 끼어드는 일 자체를 열 수 없다).
  const mainPaused = MY_ACTIVE_STAGE_INDICES.includes(state.stageIndex) && !state.resumeActive && state.interrupts.size > 0

  return {
    stageIndex: state.stageIndex,
    approvalPending: state.approvalPending,
    completed: state.completed,
    completionConfirmed: state.completionConfirmed,
    mainPaused,
    openInterrupts,
    turn: deriveTurn(state, openInterrupts, mainPaused),
    stepBarFilled: state.maxStageIndex + 1,
    stageLabel: buildStageLabel(state, mainPaused),
    badges: buildBadges(openInterrupts),
  }
}
