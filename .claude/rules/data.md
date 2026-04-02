# 데이터 규칙

## 구조
CSV → gen-data.js → src/data.js (시드)
                          ↓
                    DataContext (초기 로드)
                          ↓
                    localStorage (CRUD 영속)

## localStorage 키 (변경 금지)
- billing_ledger    : 매출 원장 배열
- billing_hospitals : 병원 마스터 배열
- billing_master    : 계약 정보 배열
- billing_template  : 거래명세서 템플릿
- billing_slack_url : Slack webhook URL
- billing_notified  : 알림 발송 이력

## 필수 규칙
1. localStorage 직접 접근 금지 → useLocalStorage 훅 사용
2. CRUD는 반드시 DataContext 함수 통해서
3. src/data.js 직접 수정 금지 (자동생성 파일)
4. 새 데이터 키 추가 시 billing_ prefix 유지
5. 계산 로직은 calculations.js 함수 재사용
