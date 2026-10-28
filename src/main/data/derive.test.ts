import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveState } from './derive.ts'
import type { HistoryEntry, Product } from './schema.ts'

let seq = 0
function entry(partial: Omit<HistoryEntry, 'id' | 'at'> & { at?: string }): HistoryEntry {
  seq += 1
  // seq를 "일(day)"이 아니라 초(second) 단위 오프셋으로 넣는다 — day는 31에서 멱등적으로
  // 두 자리 문자열 비교가 깨지는 지점(두 자릿수 "99" vs 세 자릿수 "100")이 생기지만,
  // Date의 초 단위 오버플로/toISOString()은 자릿수와 무관하게 항상 올바르게 정렬된다.
  return {
    id: `e${seq}`,
    at: partial.at ?? new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    ...partial,
  }
}

function product(history: HistoryEntry[]): Product {
  return {
    id: 'AI-TEST-0001',
    companyName: '테스트기업',
    productName: '테스트제품',
    registeredAt: '2026-01-01T00:00:00.000Z',
    archived: false,
    sheetSnapshot: { status: '심사중', reviewer: '테스트심사원', rowIndex: 2 },
    history,
  }
}

test('신규 제품은 1단계 사전 검토 중, 내 차례', () => {
  const state = deriveState(product([]))
  assert.equal(state.stageIndex, 0)
  assert.equal(state.stageLabel, '사전 검토 중')
  assert.equal(state.turn, '내 차례')
  assert.equal(state.stepBarFilled, 1)
})

test('일정 확정 중(업체 대기)과 일정 확정은 서로 다른 상태로 구분된다', () => {
  const waitingSchedule = deriveState(product([entry({ type: 'stage:advance_to_schedule_request' })]))
  assert.equal(waitingSchedule.stageIndex, 1)
  assert.equal(waitingSchedule.stageLabel, '일정 확정 중')
  assert.equal(waitingSchedule.turn, '업체 차례') // 일정확정중은 그 자체로 업체 회신 대기

  const scheduled = deriveState(
    product([
      entry({ type: 'stage:advance_to_schedule_request' }),
      entry({ type: 'stage:advance_to_onsite_scheduled' }),
    ])
  )
  assert.equal(scheduled.stageIndex, 2)
  assert.equal(scheduled.stageLabel, '심사 대기 중')
  assert.equal(scheduled.turn, '내 차례') // 일정 확정은 "일정 확정 중"과 달리 업체 대기가 아님
})

test('심사 완료는 일정 확정과 구분되는 별개 단계다', () => {
  const state = deriveState(
    product([
      entry({ type: 'stage:advance_to_schedule_request' }),
      entry({ type: 'stage:advance_to_onsite_scheduled' }),
      entry({ type: 'stage:advance_to_report_writing' }),
    ])
  )
  assert.equal(state.stageIndex, 3)
  assert.equal(state.stageLabel, '심사 마무리 중')
})

test('8단계 전체 순서대로 전진 -> 적합 처리 대기 -> 완료(적합)', () => {
  const toStage = (n: number): HistoryEntry[] =>
    [
      entry({ type: 'stage:advance_to_schedule_request' }),
      entry({ type: 'stage:advance_to_onsite_scheduled' }),
      entry({ type: 'stage:advance_to_report_writing' }),
      entry({ type: 'stage:advance_to_evidence_wait' }),
      entry({ type: 'stage:advance_to_evidence_review' }),
      entry({ type: 'stage:advance_to_senior_review' }),
      entry({ type: 'stage:advance_to_lead_review' }),
    ].slice(0, n)

  const atEvidenceWait = deriveState(product(toStage(4)))
  assert.equal(atEvidenceWait.stageLabel, '증적자료 대기 중')
  assert.equal(atEvidenceWait.turn, '업체 차례')

  const atEvidenceReview = deriveState(product(toStage(5)))
  assert.equal(atEvidenceReview.stageLabel, '증적자료 정리 중')
  assert.equal(atEvidenceReview.turn, '내 차례')

  const atSenior = deriveState(product(toStage(6)))
  assert.equal(atSenior.stageLabel, '수석 검토 중')
  assert.equal(atSenior.turn, '수석·팀장 차례')

  const atLead = deriveState(product(toStage(7)))
  assert.equal(atLead.stageLabel, '팀장 검토 중')
  assert.equal(atLead.turn, '수석·팀장 차례')
  assert.equal(atLead.stepBarFilled, 8)

  const pending = deriveState(
    product([...toStage(7), entry({ type: 'stage:advance_to_pending_approval' })])
  )
  assert.equal(pending.stageLabel, '적합 처리 중')
  assert.equal(pending.turn, '내 차례')
  assert.equal(pending.stepBarFilled, 8)

  const completed = deriveState(
    product([...toStage(7), entry({ type: 'stage:advance_to_pending_approval' }), entry({ type: 'stage:completed_from_sheet' })])
  )
  assert.equal(completed.completed, true)
  assert.equal(completed.stageLabel, '완료(적합) — 제외 확인 대기 중')
})

test('증적자료 대기 <-> 정리 사이를 반복해도 스텝 바는 후퇴하지 않는다', () => {
  const base = [
    entry({ type: 'stage:advance_to_schedule_request' }),
    entry({ type: 'stage:advance_to_onsite_scheduled' }),
    entry({ type: 'stage:advance_to_report_writing' }),
    entry({ type: 'stage:advance_to_evidence_wait' }),
    entry({ type: 'stage:advance_to_evidence_review' }),
  ]
  const afterFirstReview = deriveState(product(base))
  assert.equal(afterFirstReview.stepBarFilled, 6)

  const loopedBack = deriveState(product([...base, entry({ type: 'stage:evidence_reopen' })]))
  assert.equal(loopedBack.stageLabel, '증적자료 대기 중') // 현재 위치는 되돌아감
  assert.equal(loopedBack.stepBarFilled, 6) // 스텝 바(최고 도달점)는 그대로 유지
  assert.equal(loopedBack.turn, '업체 차례')

  const reviewedAgain = deriveState(
    product([...base, entry({ type: 'stage:evidence_reopen' }), entry({ type: 'stage:advance_to_evidence_review' })])
  )
  assert.equal(reviewedAgain.stageLabel, '증적자료 정리 중')
  assert.equal(reviewedAgain.stepBarFilled, 6) // 반복해도 여전히 6/8에서 유지
})

test('신청서 보완(별도 업무)이 열리면 본 단계가 멈추고, 완료되면 본 단계로 복귀한다', () => {
  const opened = deriveState(
    product([
      entry({ type: 'stage:advance_to_report_writing' }), // 심사 완료 단계
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
    ])
  )
  assert.equal(opened.mainPaused, true)
  assert.equal(opened.turn, '업체 차례')
  assert.deepEqual(opened.badges, ['신청서 보완 1차 대기'])

  const received = deriveState(
    product([
      entry({ type: 'stage:advance_to_report_writing' }),
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'interrupt:received', taskKind: '신청서보완', round: 1 }),
    ])
  )
  assert.equal(received.turn, '내 차례') // 검토 중인 일이 있으면 내 차례

  const closed = deriveState(
    product([
      entry({ type: 'stage:advance_to_report_writing' }),
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'interrupt:received', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'interrupt:close', taskKind: '신청서보완', round: 1 }),
    ])
  )
  // 별도 업무가 모두 닫히면 기존 본 단계(심사 마무리 중)로 완전히 복귀 — 멈춤 해제, 내 차례
  assert.equal(closed.mainPaused, false)
  assert.equal(closed.stageLabel, '심사 마무리 중')
  assert.equal(closed.turn, '내 차례')
  assert.equal(closed.stepBarFilled, 4)
})

test('본 단계 재개: 멈춘 동안에도 재개를 누르면 계속 진행할 수 있다', () => {
  const resumed = deriveState(
    product([
      entry({ type: 'stage:advance_to_report_writing' }),
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'main:resume' }),
    ])
  )
  assert.equal(resumed.mainPaused, false)
  assert.equal(resumed.turn, '내 차례')
  assert.equal(resumed.stageLabel, '심사 마무리 중') // 재개 중엔 멈춤 안내 문구가 붙지 않음
  assert.deepEqual(resumed.openInterrupts, []) // 재개하면 대기 중이던 끼어드는 일도 함께 종료된다
  assert.deepEqual(resumed.badges, [])

  // 재개 중에도 다음 단계로 그대로 전진할 수 있다
  const advancedWhileResumed = deriveState(
    product([
      entry({ type: 'stage:advance_to_report_writing' }),
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'main:resume' }),
      entry({ type: 'stage:advance_to_evidence_wait' }),
    ])
  )
  assert.equal(advancedWhileResumed.stageLabel, '증적자료 대기 중')
})

test('재개를 누르면 요청만 했든 수령까지 했든 열려있던 끼어드는 일이 모두 자동으로 종료된다', () => {
  const resumedWhileRequested = deriveState(
    product([
      entry({ type: 'stage:advance_to_onsite_scheduled' }), // 2단계: 심사 대기 중
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'main:resume' }),
    ])
  )
  assert.deepEqual(resumedWhileRequested.openInterrupts, [])
  assert.deepEqual(resumedWhileRequested.badges, [])
  assert.equal(resumedWhileRequested.mainPaused, false)

  const resumedWhileReceived = deriveState(
    product([
      entry({ type: 'stage:advance_to_onsite_scheduled' }),
      entry({ type: 'interrupt:open', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'interrupt:received', taskKind: '신청서보완', round: 1 }),
      entry({ type: 'main:resume' }),
    ])
  )
  assert.deepEqual(resumedWhileReceived.openInterrupts, [])
  assert.deepEqual(resumedWhileReceived.badges, [])
})

test('수석·팀장 검토 중에는 끼어드는 일을 열 수 없다는 전제하에 차례가 고정된다', () => {
  const senior = deriveState(
    product(
      [
        'stage:advance_to_schedule_request',
        'stage:advance_to_onsite_scheduled',
        'stage:advance_to_report_writing',
        'stage:advance_to_evidence_wait',
        'stage:advance_to_evidence_review',
        'stage:advance_to_senior_review',
      ].map((type) => entry({ type: type as HistoryEntry['type'] }))
    )
  )
  assert.equal(senior.turn, '수석·팀장 차례')
})

test('완료(적합) 이후에도 증적자료(별도 업무)를 열고 닫을 수 있다', () => {
  const full = [
    'stage:advance_to_schedule_request',
    'stage:advance_to_onsite_scheduled',
    'stage:advance_to_report_writing',
    'stage:advance_to_evidence_wait',
    'stage:advance_to_evidence_review',
    'stage:advance_to_senior_review',
    'stage:advance_to_lead_review',
    'stage:advance_to_pending_approval',
    'stage:completed_from_sheet',
  ].map((type) => entry({ type: type as HistoryEntry['type'] }))

  const waiting = deriveState(product([...full, entry({ type: 'interrupt:open', taskKind: '증빙자료', round: 1 })]))
  assert.equal(waiting.turn, '업체 차례')

  const confirmed = deriveState(
    product([
      ...full,
      entry({ type: 'interrupt:open', taskKind: '증빙자료', round: 1 }),
      entry({ type: 'interrupt:received', taskKind: '증빙자료', round: 1 }),
      entry({ type: 'interrupt:close', taskKind: '증빙자료', round: 1 }),
      entry({ type: 'exclude:confirmed' }),
    ])
  )
  assert.equal(confirmed.completionConfirmed, true)
  assert.equal(confirmed.stageLabel, '완료(적합)')
})

test('하위 호환: 구 모델(6단계)의 history만 있던 과거 제품도 에러 없이 재생되고, 수석 검토로 자연 승격된다', () => {
  // 과거(이번 변경 전) 데이터는 evidence_wait/evidence_review 이벤트가 존재할 수 없었다 —
  // 그 시절엔 "보고서 작성 완료 -> 바로 수석 검토 요청"이 유일한 경로였기 때문에,
  // 재생 시 증적자료 단계를 건너뛰고 수석 검토로 바로 승격되는 것이 올바른 동작이다.
  const legacyHistory: HistoryEntry[] = [
    entry({ type: 'stage:advance_to_schedule_request' }),
    entry({ type: 'stage:advance_to_onsite_scheduled' }),
    entry({ type: 'stage:advance_to_report_writing' }),
    entry({ type: 'stage:advance_to_senior_review' }), // 구 모델: 보고서작성 -> 수석검토 (4단계였음)
    entry({ type: 'stage:advance_to_lead_review' }), // 구 모델: 수석검토 -> 팀장검토 (5단계였음)
  ]
  const state = deriveState(product(legacyHistory))
  assert.equal(state.stageLabel, '팀장 검토 중')
  assert.equal(state.turn, '수석·팀장 차례')
  assert.equal(state.stepBarFilled, 8)
})
