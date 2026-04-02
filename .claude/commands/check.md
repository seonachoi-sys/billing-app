# 체크리스트 검증

## 실행 순서
1. 전체 소스 파일 읽기
2. 아래 항목 코드에서 직접 확인
3. ✅ / ❌ / ⚠️ 로 표시
4. ❌ ⚠️ 항목 우선순위 정리

## 체크 항목

### 데이터
- [ ] localStorage CRUD가 DataContext에서만 처리되는지
- [ ] useLocalStorage 훅이 동기화 누락 없는지
- [ ] 부가세 계산이 calculations.js 함수 통해서만 하는지
- [ ] D-day 계산이 로컬 시간 기준인지 (UTC 아님)

### UI
- [ ] 모바일 반응형 (Tailwind 브레이크포인트)
- [ ] 연체 알림 배너 조건 정상 동작
- [ ] 거래명세서 출력 레이아웃 깨짐 없는지

### 데이터 안전
- [ ] localStorage 키 충돌 없는지 (billing_ prefix 유지)
- [ ] 데이터 백업/복원 Settings에서 정상 동작
