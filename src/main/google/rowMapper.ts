import { STATUS_WAITING, TARGET_REVIEWER } from '../config.ts'
import type { HeaderIndex, SheetReadResult } from './sheetsClient.ts'

export interface SheetRow {
  id: string
  companyName: string
  productName: string
  status: string
  reviewer: string
  deadlineDue?: string
  deadlineExtended?: string
  d3Due?: string
  d3Extended?: string
  /** 1-based 시트 행 번호 (헤더가 1행이므로 첫 데이터 행은 2) */
  rowIndex: number
}

function cell(row: string[], index: HeaderIndex, key: keyof HeaderIndex): string {
  const i = index[key]
  return i === -1 || i === undefined ? '' : (row[i] ?? '')
}

function optionalCell(row: string[], index: HeaderIndex, key: keyof HeaderIndex): string | undefined {
  const value = cell(row, index, key)
  return value === '' ? undefined : value
}

export function mapRows(result: SheetReadResult): SheetRow[] {
  return result.rows.map((row, i) => ({
    id: cell(row, result.headerIndex, '접수번호'),
    companyName: cell(row, result.headerIndex, '기업명'),
    productName: cell(row, result.headerIndex, '제품명'),
    status: cell(row, result.headerIndex, '상태'),
    reviewer: cell(row, result.headerIndex, '담당심사원'),
    deadlineDue: optionalCell(row, result.headerIndex, '마감예정일'),
    deadlineExtended: optionalCell(row, result.headerIndex, '연장마감일'),
    d3Due: optionalCell(row, result.headerIndex, 'D3기준일_마감'),
    d3Extended: optionalCell(row, result.headerIndex, 'D3기준일_연장마감'),
    rowIndex: i + 2,
  }))
}

/** 대상 제품 필터: 담당심사원=TARGET_REVIEWER & 상태≠대기. (완료(적합) 신규등록 제외는 syncService가 처리) */
export function filterCandidateRows(rows: SheetRow[]): SheetRow[] {
  return rows.filter((r) => r.reviewer === TARGET_REVIEWER && r.status !== STATUS_WAITING && r.id !== '')
}
