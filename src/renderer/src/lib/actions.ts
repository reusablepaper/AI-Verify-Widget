import type { ProductView } from '../../../main/productsService'
import type { HistoryEntryType, InterruptKind } from '../../../main/data/schema'

type MainAdvanceType = Extract<
  HistoryEntryType,
  | 'stage:advance_to_schedule_request'
  | 'stage:advance_to_onsite_scheduled'
  | 'stage:advance_to_report_writing'
  | 'stage:advance_to_evidence_wait'
  | 'stage:advance_to_evidence_review'
  | 'stage:advance_to_senior_review'
  | 'stage:advance_to_lead_review'
  | 'stage:advance_to_pending_approval'
>

// stageIndex -> 그 단계에서 다음으로 넘어가는 버튼이 발생시키는 이벤트 타입.
const NEXT_STAGE_TYPE: MainAdvanceType[] = [
  'stage:advance_to_schedule_request', // 0 사전검토중 -> 1
  'stage:advance_to_onsite_scheduled', // 1 일정확정중 -> 2
  'stage:advance_to_report_writing', // 2 일정확정 -> 3
  'stage:advance_to_evidence_wait', // 3 심사완료 -> 4
  'stage:advance_to_evidence_review', // 4 증적자료대기 -> 5
  'stage:advance_to_senior_review', // 5 증적자료정리 -> 6
  'stage:advance_to_lead_review', // 6 수석검토 -> 7
  'stage:advance_to_pending_approval', // 7 팀장검토 -> 적합 처리
]

// 버튼 문구는 "누르면 무엇이 되는지"를 설명한다 (현재 상태명을 그대로 반복하지 않는다).
const NEXT_STAGE_BUTTON_LABEL = [
  '사전검토 완료', // 0에서 누르면 -> 1
  '일정 확정', // 1에서 누르면 -> 2
  '심사 완료', // 2에서 누르면 -> 3
  '증적자료 요청', // 3에서 누르면 -> 4
  '증적자료 수령', // 4에서 누르면 -> 5
  '수석 검토 요청', // 5에서 누르면 -> 6
  '팀장 검토 요청', // 6에서 누르면 -> 7
  '팀장 승인', // 7에서 누르면 -> 적합 처리
]

// 멈춘 본 단계를 다시 진행할 때: "OO 재개" (OO = 지금 멈춰 있는 단계를 가리키는 짧은 이름).
// 일정확정중(1)/증적자료대기(4)는 애초에 업체 대기 단계라 "멈춤·재개" 개념이 없다 — 다음 버튼을 바로 쓴다.
const RESUME_STAGE_SHORT_LABEL: Record<number, string> = {
  0: '사전검토',
  2: '일정확정',
  3: '심사',
  5: '증적자료 정리',
}

const REVIEW_STAGE_INDICES = [6, 7]
const EVIDENCE_REVIEW_INDEX = 5
// 증적자료(별도 업무)는 본 단계 자체가 증적을 다루는 3~7단계와 겹치면 혼동되므로,
// 아직 그 전인 0~2단계이거나(조기 요청), 적합 처리 대기/완료 이후(사후 보완)에만 열 수 있게 한다.
const SEPARATE_EVIDENCE_ALLOWED_MAX_STAGE = 2

export type ActionOption =
  | { kind: 'mainAdvance'; label: string; type: MainAdvanceType }
  | { kind: 'mainResume'; label: string }
  | { kind: 'evidenceReopen'; label: string }
  | { kind: 'interruptOpen'; label: string; taskKind: InterruptKind; round: number }
  | { kind: 'interruptReceived'; label: string; taskKind: InterruptKind; round: number }
  | { kind: 'interruptClose'; label: string; taskKind: InterruptKind; round: number }
  | { kind: 'interruptReopen'; label: string; taskKind: InterruptKind; round: number }
  | { kind: 'confirmExclude'; label: string }

export interface CardActions {
  /** 카드 버튼에 바로 보이는 단 하나의 본 단계 액션 (없으면 null — 적합 처리 대기/완료 등) */
  mainButton: { label: string; action: ActionOption } | null
  /** "특수사항" 드롭다운에 평평하게 나열되는 그 외 모든 액션 (차수 번호는 라벨에 넣지 않음) */
  specialOptions: ActionOption[]
}

function nextRoundFor(history: ProductView['history'], taskKind: InterruptKind): number {
  let max = 0
  for (const h of history) {
    if (h.taskKind !== taskKind || h.round === undefined) continue
    if (h.type === 'interrupt:open' && h.round > max) max = h.round
    if (h.type === 'interrupt:reopen' && h.round + 1 > max) max = h.round + 1
  }
  return max + 1
}

export function getCardActions(view: ProductView): CardActions {
  const { state, history } = view
  let mainButton: CardActions['mainButton'] = null
  const specialOptions: ActionOption[] = []

  const canOpenSeparateEvidence =
    !state.openInterrupts.some((t) => t.taskKind === '증빙자료') &&
    (state.completed || state.approvalPending || state.stageIndex <= SEPARATE_EVIDENCE_ALLOWED_MAX_STAGE)
  const canOpenAppSupplement =
    !state.openInterrupts.some((t) => t.taskKind === '신청서보완') &&
    !state.completed &&
    !state.approvalPending &&
    !REVIEW_STAGE_INDICES.includes(state.stageIndex)

  if (state.completed || state.approvalPending) {
    // 완료(적합) 제외 확인은 카드에 직접 보이는 배너 버튼으로 처리한다 (Card.svelte).
    // 팀장 승인 이후(적합 처리 대기/완료)에는 새로 열 수 있는 특수사항이 없다.
  } else if (REVIEW_STAGE_INDICES.includes(state.stageIndex)) {
    // 수석·팀장 검토 중 — 끼어드는 일을 열 수 없음
    const label = NEXT_STAGE_BUTTON_LABEL[state.stageIndex]
    mainButton = { label, action: { kind: 'mainAdvance', label, type: NEXT_STAGE_TYPE[state.stageIndex] } }
  } else {
    const label = state.mainPaused
      ? `${RESUME_STAGE_SHORT_LABEL[state.stageIndex]} 재개`
      : NEXT_STAGE_BUTTON_LABEL[state.stageIndex]
    mainButton = state.mainPaused
      ? { label, action: { kind: 'mainResume', label } }
      : { label, action: { kind: 'mainAdvance', label, type: NEXT_STAGE_TYPE[state.stageIndex] } }

    // 증적자료 정리 중 추가 자료가 필요하면 대기 상태로 되돌아갈 수 있다.
    if (state.stageIndex === EVIDENCE_REVIEW_INDEX) {
      specialOptions.push({ kind: 'evidenceReopen', label: '증적자료 다시 요청' })
    }

    if (canOpenAppSupplement) {
      specialOptions.push({
        kind: 'interruptOpen',
        label: '신청서 보완 요청',
        taskKind: '신청서보완',
        round: nextRoundFor(history, '신청서보완'),
      })
    }
    if (canOpenSeparateEvidence) {
      specialOptions.push({
        kind: 'interruptOpen',
        label: '증적자료 요청',
        taskKind: '증빙자료',
        round: nextRoundFor(history, '증빙자료'),
      })
    }
  }

  // 수석·팀장 검토 중(아직 완료/승인 전)에는 끼어드는 일을 관리하는 선택지도 보여주지 않는다.
  const allowInterruptManagement =
    state.completed || state.approvalPending || !REVIEW_STAGE_INDICES.includes(state.stageIndex)
  if (allowInterruptManagement) {
    for (const task of state.openInterrupts) {
      if (task.subState === 'requested') {
        specialOptions.push({
          kind: 'interruptReceived',
          label: task.taskKind === '신청서보완' ? '보완본 수령' : '증적자료 수령',
          taskKind: task.taskKind,
          round: task.round,
        })
      } else {
        specialOptions.push({
          kind: 'interruptClose',
          label: task.taskKind === '신청서보완' ? '보완 완료' : '증적자료 정리완료',
          taskKind: task.taskKind,
          round: task.round,
        })
        specialOptions.push({
          kind: 'interruptReopen',
          label: task.taskKind === '신청서보완' ? '재보완 요청' : '증적자료 추가요청',
          taskKind: task.taskKind,
          round: task.round,
        })
      }
    }
  }

  return { mainButton, specialOptions }
}
