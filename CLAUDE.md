# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

매출청구(Sales Billing) management app for ㈜타이로스코프 — tracks hospital client billing, receivables, and generates 거래명세서 (transaction statements). The product being billed is "Glandy CAS".

## Tech Stack

- React 18 (Create React App via react-scripts)
- Recharts for dashboard charts
- Tailwind CSS for styling, Pretendard font
- No TypeScript — plain JavaScript (.js)

## Commands

```bash
npm install          # Install dependencies
npm run gen-data     # Generate src/data.js from CSV files (runs node gen-data.js)
npm start            # Start dev server
npm run build        # Production build
```

**Important:** After any CSV data change in `data/`, run `npm run gen-data` to regenerate `src/data.js` before starting the app.

## Architecture

### Data Flow

CSV files in `data/` → `node gen-data.js` → `src/data.js` (generated, do not edit manually) → imported by all components.

The generated `src/data.js` exports:
- `ledger` — billing records from `매출청구 관리 대장 - 2026.csv` (columns: 청구기준, 발생기준, 거래처명, 제품명, 청구금액, 미수금, 채권상태, etc.)
- `hospitals` — hospital master data from `매출청구 관리 대장 - 병원.csv` (columns: 업체코드, 거래처명, 단가, 정산주기, etc.) with computed `totalSales` and `outstanding`
- `invoiceTemplate` — template metadata from `매출청구 관리 대장 - 거래명세서 템플릿.csv`

### Components (`src/components/`)

- **Dashboard** — Overview charts (billing vs occurrence-based revenue via Recharts BarChart), receivables summary, per-hospital summary table
- **Ledger** — Main billing ledger table with filtering by 거래처명 and 채권상태 (청구확정/미청구/입금완료), inline status editing
- **InvoiceGenerator** — Select 청구확정 items → generate 거래명세서 with supply/VAT breakdown → print via `window.print()`
- **HospitalManagement** — Hospital list with detail view showing cumulative sales, outstanding receivables, and issued invoices

### CSV Data Files (`data/`)

- `마스터.csv` — Contract master: hospital names, contract dates, unit prices, renewal terms, settlement periods
- `병원.csv` — Hospital details: codes, departments, doctors, billing type (직납/간납), contacts
- `2026.csv` — 2026 billing ledger: monthly records with quantities, amounts, payment status, receivable aging
- `거래명세서 템플릿.csv` — Invoice template layout for ㈜타이로스코프

## Key Domain Terms

| Korean | English |
|--------|---------|
| 청구기준 | Billing basis (month) |
| 발생기준 | Occurrence basis (month) |
| 채권상태 | Receivable status |
| 청구확정 | Billing confirmed |
| 미청구 | Unbilled |
| 입금완료 | Payment received |
| 미수금 | Outstanding receivables |
| 거래명세서 | Transaction statement / Invoice |
| 공급가 | Supply price (pre-tax) |
| 부가세 | VAT |
| 직납/간납 | Direct/Indirect delivery billing |
| 정산주기 | Settlement period |

## Notes

- Currency amounts in CSVs use Korean comma-formatted strings (e.g., "13,000") — must be parsed with `.replace(/,/g, '')` before numeric operations
- **국세청 홈택스 기준 부가세 계산:** 공급가액 = `Math.round(합계금액 / 1.1)`, 부가세 = 합계금액 - 공급가액
- The app is Korean-language throughout — UI labels, data fields, and column headers are all in Korean
- `src/data.js` is auto-generated — edit CSV source files, not this file directly
- 원가 계산은 추후 데이터 준비 후 추가 예정
