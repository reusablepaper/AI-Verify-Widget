# AI 확인제 진행현황 위젯

AI 확인제(인공지능 제품·서비스 확인제도) 심사를 담당하면서, 공용 Google 스프레드시트의 "상태" 값만으로는 드러나지 않는 실무 진행 상황(일정 조율 중인지, 업체 회신을 기다리는 중인지, 증적자료를 주고받는 중인지, 내부 검토 단계인지 등)을 직접 추적하기 위해 만든 개인용 Windows 데스크톱 위젯입니다.

- Google 스프레드시트는 **읽기 전용**으로만 연동합니다.
- 실제 진행 상태·이력은 전부 로컬에 저장되며, 매 조회마다 history를 재생해 현재 상태를 계산합니다(상태를 직접 저장하지 않음).
- 담당 건마다 8단계 본 심사 흐름(사전 검토 → 일정 확정 → 심사 → 증적자료 → 내부 검토 → 적합 처리)과, 그와 별개로 발생하는 "신청서 보완"/"증적자료 요청" 같은 끼어드는 업무를 함께 추적합니다.

## 기술 스택

Electron + Svelte 5(runes) + TypeScript, `electron-vite`로 빌드, `electron-builder`로 Windows 패키징.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Google OAuth 클라이언트 준비

[Google Cloud Console](https://console.cloud.google.com/)에서 OAuth 2.0 클라이언트 ID(데스크톱 앱)를 만들고, 다운로드한 JSON을 프로젝트 루트에 `credentials.json`으로 저장합니다. Sheets 읽기 권한(`spreadsheets.readonly`)만 있으면 됩니다.

### 3. 환경 설정 파일 생성

연동할 스프레드시트, 담당자명, 시트 헤더명을 본인 환경에 맞게 채웁니다.

```bash
cp src/main/config.example.ts src/main/config.ts
```

### 4. 개발 모드 실행

```bash
npm run dev
```

### 5. Windows 설치 파일 빌드

```bash
npm run build:win
```

`dist/win-unpacked/`에 실행 파일이, `dist/*-setup.exe`에 설치 파일이 생성됩니다.

## 테스트

핵심 상태 도출 로직(`src/main/data/derive.ts`)과 시트 동기화 로직(`src/main/sync/syncService.ts`)은 Node 내장 테스트 러너로 검증합니다.

```bash
node --test src/main/data/derive.test.ts src/main/sync/syncService.test.ts
```

## 로컬 데이터 위치

실행 중 쌓이는 진행 이력·설정값은 소스 트리와 분리되어 `%APPDATA%/ai-hwakinje-widget/`에 저장됩니다 (`products.json` + 백업, `config.json`, `token.json`).
