import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { SHEET_HEADERS, SHEET_TAB, SPREADSHEET_ID } from '../config.ts'

export type HeaderIndex = Record<(typeof SHEET_HEADERS)[number], number>

export interface SheetReadResult {
  header: string[]
  headerIndex: HeaderIndex
  missingHeaders: string[]
  rows: string[][]
}

function buildHeaderIndex(header: string[]): { index: HeaderIndex; missing: string[] } {
  const index = {} as HeaderIndex
  const missing: string[] = []
  for (const name of SHEET_HEADERS) {
    const i = header.indexOf(name)
    index[name] = i
    if (i === -1) missing.push(name)
  }
  return { index, missing }
}

export async function readSheet(auth: OAuth2Client): Promise<SheetReadResult> {
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_TAB,
  })

  const values = res.data.values ?? []
  if (values.length === 0) {
    return { header: [], headerIndex: {} as HeaderIndex, missingHeaders: [...SHEET_HEADERS], rows: [] }
  }

  const [header, ...rows] = values
  const { index, missing } = buildHeaderIndex(header)
  return { header, headerIndex: index, missingHeaders: missing, rows }
}
