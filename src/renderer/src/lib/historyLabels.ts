import type { HistoryEntry, InterruptKind } from '../../../main/data/schema'

const TASK_LABEL: Record<InterruptKind, string> = {
  신청서보완: '신청서 보완',
  증빙자료: '증적자료', // 내부 키/저장값은 기존 그대로, 화면 표시 용어만 "증적자료"로 통일
}

// 각 라벨은 "그 순간 눌렀던 버튼 문구"와 동일하게 맞춘다 — 히스토리는 실행한 동작의 기록이므로.
const STAGE_LABEL: Partial<Record<HistoryEntry['type'], string>> = {
  'stage:advance_to_schedule_request': '사전검토 완료',
  'stage:advance_to_onsite_scheduled': '일정 확정',
  'stage:advance_to_report_writing': '심사 완료',
  'stage:advance_to_evidence_wait': '증적자료 요청',
  'stage:advance_to_evidence_review': '증적자료 수령',
  'stage:evidence_reopen': '증적자료 다시 요청',
  'stage:advance_to_senior_review': '수석 검토 요청',
  'stage:advance_to_lead_review': '팀장 검토 요청',
  'stage:advance_to_pending_approval': '팀장 승인',
  'stage:completed_from_sheet': '완료(적합) 확정',
  'main:resume': '본 단계 재개',
  'exclude:confirmed': '목록에서 제외',
  'exclude:auto': '목록에서 자동 제외',
}

export function historyEntryLabel(entry: HistoryEntry): string {
  if (entry.taskKind && entry.round !== undefined) {
    const task = TASK_LABEL[entry.taskKind]
    switch (entry.type) {
      case 'interrupt:open':
        return `${task} ${entry.round}차 요청`
      case 'interrupt:received':
        return `${task} ${entry.round}차 ${entry.taskKind === '신청서보완' ? '보완본 수령' : '수령'}`
      case 'interrupt:close':
        return `${task} ${entry.round}차 ${entry.taskKind === '신청서보완' ? '보완 완료' : '정리 완료'}`
      case 'interrupt:reopen':
        return `${task} ${entry.round + 1}차 요청`
    }
  }
  return STAGE_LABEL[entry.type] ?? entry.type
}

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd}`
}
