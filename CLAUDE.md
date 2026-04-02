# CLAUDE.md

㈜타이로스코프 매출청구 관리 앱 — Claude Code 프로젝트 가이드

## Project Overview

병원 거래처 대상 매출청구, 미수금 관리, 거래명세서 발급을 하나로 통합한 SPA 웹앱.
제품: Glandy CAS / EXO. 배포: GitHub Pages.

## Tech Stack

- **React 18** (CRA, react-scripts 5.0.1) — plain JavaScript, No TypeScript
- **Tailwind CSS 3.4** + Pretendard 폰트
- **Recharts 2.12** — 대시보드 차트
- **상태관리**: Context API + localStorage (useLocalStorage 훅)
- **DB 없음** — CSV → 시드 데이터 → localStorage가 런타임 DB

## Commands

```bash
npm install          # 의존성 설치
npm run gen-data     # CSV → src/data.js 재생성 (data/ 변경 후 필수)
npm start            # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run deploy       # GitHub Pages 배포 (build → gh-pages)
```

## Architecture

### Data Flow

```
data/*.csv → gen-data.js → src/data.js (시드, 자동생성) → DataContext → localStorage → 컴포넌트
```

- `src/data.js`는 자동 생성 파일 — **절대 직접 수정 금지**, CSV 수정 후 `npm run gen-data`
- localStorage 키: `billing_ledger`, `billing_hospitals`, `billing_master`, `billing_template`
- 초기화: 설정 탭 → "초기 데이터로 복원" (localStorage를 시드 데이터로 리셋)

### Components (`src/components/`)

| 컴포넌트 | 역할 |
|---------|------|
| **Dashboard** | 매출 차트 (청구/발생기준 비교), 미수금 요약, 병원별 테이블 |
| **Ledger** | 매출청구 관리장 — 진행/완납 분리, D-day 연체순 정렬, 필터링, 상태변경 |
| **InvoiceGenerator** | 청구확정 건 → 거래명세서 생성 → window.print() 출력 |
| **HospitalManagement** | 거래처 목록 + 상세 (누적매출, 미수금 = ledger에서 실시간 합산) |
| **OverdueAlerts** | 연체 알림 배너 |
| **Settings** | Slack/이메일 알림, 데이터 백업/복원/초기화 |
| **forms/BillingEntryForm** | 매출 입력/수정 폼 |
| **forms/HospitalForm** | 병원 등록/수정 폼 |

### Core Logic (`src/`)

| 파일 | 역할 |
|------|------|
| `context/DataContext.js` | 전역 상태 CRUD, 월별 자동생성, 연체 판별, 내보내기/가져오기 |
| `utils/calculations.js` | 부가세 계산, D-day, 금액 포맷(fmt), ID 생성, 업체코드 생성 |
| `hooks/useLocalStorage.js` | localStorage 읽기/쓰기 + 탭 간 동기화 훅 |

### CSV Data Files (`data/`)

| 파일 | 내용 |
|------|------|
| `2026.csv` | 2026 매출 원장 (월별 청구건수, 금액, 입금상태, 채권연령) |
| `병원.csv` | 병원 마스터 (업체코드, 진료과, 청구형태, 단가, 연락처) |
| `마스터.csv` | 계약 정보 (계약일, 갱신, 계약단가, 정산주기) |
| `거래명세서 템플릿.csv` | 거래명세서 레이아웃 (회사정보, 계좌) |

## Business Rules

- **미수금 자동 계산**: 채권상태 ≠ 완납 → 미수금 = 청구금액 / 완납 → 미수금 = 0
- **부가세 (국세청 홈택스 기준)**: 공급가액 = `Math.round(합계금액 / 1.1)`, 부가세 = 합계금액 - 공급가액
- **채권상태**: 미청구 → 정상/청구확정 → 완납 / 연체
- **D-day**: 양수 = 연체일수, 음수 = 입금예정까지 남은 일수
- **거래처 미수금**: ledger에서 해당 거래처의 미수금 합산 (실시간 연동)

## Key Domain Terms

| Korean | English |
|--------|---------|
| 청구기준 | Billing basis (month) |
| 발생기준 | Occurrence basis (month) |
| 채권상태 | Receivable status |
| 청구확정/미청구/완납/연체 | Confirmed / Unbilled / Paid / Overdue |
| 미수금 | Outstanding receivables |
| 거래명세서 | Transaction statement / Invoice |
| 공급가 / 부가세 | Supply price / VAT |
| 직납/간납 | Direct / Indirect delivery billing |
| 정산주기 | Settlement period (days) |

## Notes

- CSV 금액은 콤마 포함 문자열 (e.g., "13,000") — `.replace(/,/g, '')` 후 숫자 변환
- 앱 전체 한국어 UI — 라벨, 필드명, 컬럼 헤더 모두 한국어
- 원가 계산은 추후 데이터 준비 후 추가 예정
