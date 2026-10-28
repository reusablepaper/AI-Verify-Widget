// 실제 운영 환경값이 담기는 config.ts는 .gitignore에 포함되어 저장소에 올라가지 않는다.
// 이 파일을 복사해 src/main/config.ts로 만들고, 아래 값을 본인 환경에 맞게 채워 넣을 것.
//
//   cp src/main/config.example.ts src/main/config.ts

export const SPREADSHEET_ID = 'YOUR_GOOGLE_SPREADSHEET_ID'
export const SHEET_TAB = '일정관리'
export const TARGET_REVIEWER = 'YOUR_NAME'
export const STATUS_WAITING = '대기'
export const STATUS_COMPLETED = '완료(적합)'

export const SHEET_HEADERS = [
  '접수번호',
  '마감예정일',
  '연장마감일',
  '상태',
  '담당심사원',
  '기업명',
  '제품명',
  'D3기준일_마감',
  'D3기준일_연장마감',
] as const
