# 매출청구 자동화 및 대시보드 웹앱

## Project Overview
- 기존 엑셀로 관리하던 '매출청구 관리 대장'과 '거래명세서 발급' 업무를 하나로 통합한 React 기반 SPA 웹앱
- 주요 기능: 매출 원장 관리, 거래명세서 자동 생성 및 출력/PDF 다운로드, 청구/발생 기준 대시보드, 타팀 공유용 요약표

## Core Features
1. **대시보드 (Dashboard)**
   - 청구기준(Billing Date) vs 발생기준(Occurrence Date) 매출 현황 비교 차트
   - 채권관리: 미수금 현황 파악 및 강조 표시
   - 병원별 청구 건수 및 금액 요약표 (타팀 공유용)
2. **매출청구 관리장 (Ledger)**
   - 데이터 필터링, 검색, 상태(청구확정, 미청구, 입금완료 등) 변경 기능
3. **거래명세서 자동화 (Invoice Generator)**
   - 청구 확정된 건을 선택하면 자동으로 거래명세서 템플릿에 데이터가 매핑되어 화면에 표시 및 인쇄/PDF 저장
4. **병원 거래처 관리 (Hospital Management)**
   - 등록된 병원(거래처) 목록 조회, 연락처/담당자 정보 관리
   - 특정 병원 클릭 시, 해당 병원의 누적 매출, 미수금, 발급된 거래명세서 내역을 한눈에 보는 '병원별 상세 페이지' 제공

## Data Processing Rules
- **국세청 홈텍스 기준 부가세 계산 로직 적용**
  - 공급가액 = 합계금액 / 1.1 (소수점 이하 반올림 `Math.round()`)
  - 부가세 = 합계금액 - 공급가액
- `data/` 폴더에 있는 CSV 파일들을 읽어 `node gen-data.js`를 통해 앱에서 사용할 `src/data.js`로 자동 생성하는 방식 채택

## Tech Stack & Style
- React 18, Recharts (차트용), Tailwind CSS
- 깔끔하고 전문적인 비즈니스 UI (한국어, Pretendard 폰트)

## Development Workflow
- 데이터 변경 시: `npm run gen-data` 실행하여 `src/data.js` 업데이트
- 빌드: `npm start`로 개발 서버 실행
- 프로덕션: `npm run build`

## Notes
- 원가 계산은 추후 데이터 준비 후 추가 예정
- 모든 금액은 원 단위, 콤마 포맷 적용