# CLAUDE.md

㈜타이로스코프 매출청구 관리 앱 — Claude Code 프로젝트 가이드

## Project Overview

병원 거래처 대상 매출청구, 미수금 관리, 거래명세서 발급, 원가분석/BEP를 하나로 통합한 SPA 웹앱.
제품: Glandy CAS / EXO. 배포: GitHub Pages.

## Tech Stack

- **React 18** (CRA, react-scripts 5.0.1) — plain JavaScript, No TypeScript
- **Tailwind CSS 3.4** + Pretendard 폰트
- **Recharts 2.12** — 통계/인사이트 차트
- **상태관리**: Context API + localStorage (useLocalStorage 훅) + Firebase 실시간 동기화
- **DB**: Firestore (source of truth) + localStorage (캐시/오프라인 폴백)

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
data/*.csv → gen-data.js → src/data.js (시드)
                                ↓
                          DataContext (초기 로드)
                                ↓
                    Firestore ↔ localStorage ↔ 컴포넌트
```

- `src/data.js`는 자동 생성 파일 — **절대 직접 수정 금지**, CSV 수정 후 `npm run gen-data`
- 초기화: 설정 탭 → "초기 데이터로 복원" (원가설정 포함 전체 리셋)

### localStorage 키 (billing_ 접두사 필수)

| 키 | 내용 |
|----|------|
| `billing_ledger` | 매출 원장 배열 |
| `billing_hospitals` | 병원 마스터 배열 |
| `billing_master` | 계약 정보 배열 |
| `billing_template` | 거래명세서 템플릿 |
| `billing_cost_settings` | 원가 설정 (글로벌) |
| `billing_hospital_costs` | 병원별 원가 설정 (소모품비, 디바이스 수량) |
| `billing_slack_url` | Slack webhook URL |
| `billing_notified` | 알림 발송 이력 |

### Firestore 컬렉션

| 컬렉션 | 내용 | 비고 |
|--------|------|------|
| `billing_ledger` | 매출 원장 | _id 기반, 비즈니스 키 중복제거 |
| `billing_hospitals` | 병원 마스터 | _id 기반 |
| `billing_master` | 계약 정보 | _id 기반 |
| `billing_cost_settings` | 원가 설정 | 단일 문서 (doc ID: `global`) |
| `billing_hospital_costs` | 병원별 원가 | doc ID = 병원명 |
| `billing_monthly_summary` | 월별 집계 | doc ID = `월__병원명` |
| `billing_email_history` | 이메일 이력 | _id 기반 |

### Page Structure

| 탭 | 컴포넌트 | 역할 |
|----|---------|------|
| 대시보드 | `Dashboard` | KPI 카드 + 채권 관리현황 테이블 (차트 없음, 심플) |
| 월별 청구 | `MonthlyBilling` | 월별 청구 입력/확정 |
| 미수금 관리 | `Ledger` | 진행/완납 분리, D-day 연체순, 상태변경 |
| 거래명세서 | `InvoiceGenerator` | 청구확정 건 → 거래명세서 → print() |
| 거래처 관리 | `HospitalManagement` | 거래처 CRUD + 누적매출/미수금 |
| **통계** | `Statistics` | 병원별/월별/제품별 매출·처방 현황 + 차트 |
| **인사이트** | `Insights` | 원가/BEP 분석 + 차트 (경영진용) |
| 설정 | `Settings` + `CostSettings` | 일반(알림/Firebase/백업) + 원가설정 서브탭 |

**공유 경로** (읽기전용):
- `#/stats` → SharedStats (통계 공유)
- `#/insights` → SharedInsights (인사이트 공유)

### Components (`src/components/`)

| 컴포넌트 | 역할 |
|---------|------|
| **Dashboard** | KPI 카드(청구/미수/회수율/완납/연체) + 월별입금예정 + D-day 테이블 |
| **MonthlyBilling** | 월별 청구 입력/확정 |
| **Ledger** | 매출청구 관리장 — 진행/완납 분리, D-day 정렬, 필터링, 상태변경 |
| **InvoiceGenerator** | 청구확정 건 → 거래명세서 생성 → window.print() 출력 |
| **HospitalManagement** | 거래처 목록 + 상세 (누적매출, 미수금 = ledger에서 실시간 합산) |
| **Statistics** | 매출/처방 통계 차트 (BarChart, LineChart, PieChart) |
| **Insights** | BEP 대시보드: KPI + 인사이트 텍스트 + 병원별 BEP 테이블 + 4종 차트 |
| **CostSettings** | 원가 변수 입력 폼 (6개 섹션: 초기도입/직접원가/인프라/유지보수/배분/병원별) |
| **Settings** | Slack/이메일 알림, Firebase 상태, 데이터 백업/복원/초기화 |
| **OverdueAlerts** | 연체 알림 배너 |
| **SharedStats** | 통계 공유 페이지 (읽기전용) |
| **forms/BillingEntryForm** | 매출 입력/수정 폼 |
| **forms/HospitalForm** | 병원 등록/수정 폼 |

### Core Logic (`src/`)

| 파일 | 역할 |
|------|------|
| `context/DataContext.js` | 전역 상태 CRUD, Firebase 동기화, 원가설정 관리, 월별 자동생성 |
| `utils/calculations.js` | 부가세 계산, D-day, 금액 포맷(fmt), ID 생성, 병원분류 |
| `utils/bepCalculations.js` | 원가/BEP 전체 계산 로직 (아래 상세) |
| `services/firestoreService.js` | Firestore CRUD, 배치쓰기, 실시간 구독, 마이그레이션 |
| `hooks/useLocalStorage.js` | localStorage 읽기/쓰기 + 탭 간 동기화 훅 |

### CSV Data Files (`data/`)

| 파일 | 내용 |
|------|------|
| `2026.csv` | 2026 매출 원장 (월별 청구건수, 금액, 입금상태, 채권연령) |
| `병원.csv` | 병원 마스터 (업체코드, 진료과, 청구형태, 단가, 연락처) |
| `마스터.csv` | 계약 정보 (계약일, 갱신, 계약단가, 정산주기) |
| `거래명세서 템플릿.csv` | 거래명세서 레이아웃 (회사정보, 계좌) |

## Cost Analysis & BEP (원가분석/손익분기점)

### 원가 구조

```
원가 = 초기도입비(1회) + 월 고정비(배분) + 월 변동비(병원별)

초기도입비 = 거치대 + 소모품(병원별) + 세팅인건비
월 고정비  = AWS + GMP/36 + ISO/12 + 인허가인력 + 보험/12 + 메시지 + 기술지원 + 무형자산/60
월 변동비  = 디바이스감가(수량×단가/연수/12) + 통신비(수량×월) + 보안비(수량×년/12)
건당 변동비 = AI추론 + 데이터저장 + 데이터전송
```

### BEP 계산 흐름 (`bepCalculations.js`)

```
calcMonthlyFixedCost(settings)           → 전체 월 고정비 합계
calcInitialCost(settings, hospitalCost)  → 병원별 초기도입비
calcMonthlyVariableCost(settings, hCost) → 병원별 월 변동비
calcPerCaseVariableCost(settings)        → 건당 변동비 (3원)
calcAllocatedFixedCost(...)              → 병원별 고정비 배분액

공헌이익          = 공급단가 - 건당변동비
BEP 처방건수(월)  = (월고정비배분 + 월변동비) / 공헌이익
월순이익          = 월매출 - 월유지비 - (건당변동비 × 건수)
도입비 회수기간    = 초기도입비 / 월순이익
```

### 고정비 배분 규칙

- 병원구분: `상급종합` (병원구분에 '상급' 포함) vs `로컬` (나머지)
- 배분비율: 상급종합 95% : 로컬 5% (설정에서 수정 가능)
- 병원별 배분 = 전체고정비 × 구분비율 / 해당 구분 병원수

### 수정 시 주의사항

- **bepCalculations.js는 순수 함수만** — 상태/부수효과 없음, 계산만 담당
- **DataContext.js에서 costSettings/hospitalCosts는 useLocalStorage** — Firebase 실패해도 유지
- **Insights.js는 useMemo로 계산** — ledger/costSettings 변경 시만 재계산
- **CostSettings.js에서 수정 즉시 Firebase + localStorage 동시 저장**
- **resetToSeed()는 원가설정도 초기화** — DEFAULT_COST_SETTINGS로 복원

## Business Rules

- **미수금 자동 계산**: 채권상태 ≠ 완납 → 미수금 = 청구금액 / 완납 → 미수금 = 0
- **부가세 (국세청 홈택스 기준)**: 공급가액 = `Math.round(합계금액 / 1.1)`, 부가세 = 합계금액 - 공급가액
- **채권상태**: 미청구 → 정상/청구확정 → 완납 / 연체
- **D-day**: 양수 = 연체일수, 음수 = 입금예정까지 남은 일수
- **거래처 미수금**: ledger에서 해당 거래처의 미수금 합산 (실시간 연동)
- **BEP 달성률 색상**: 100%+ 초록 / 50~99% 노랑 / 50% 미만 빨강

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
| 원가 / 손익분기점 | Cost / Break-even point (BEP) |
| 공헌이익 | Contribution margin |
| 초기도입비 | Initial setup cost |
| 고정비 배분 | Fixed cost allocation |

## Notes

- CSV 금액은 콤마 포함 문자열 (e.g., "13,000") — `.replace(/,/g, '')` 후 숫자 변환
- 앱 전체 한국어 UI — 라벨, 필드명, 컬럼 헤더 모두 한국어
- 원가설정 입력 필드는 천단위 콤마 자동 포맷 (포커스 시 숫자모드 전환)
