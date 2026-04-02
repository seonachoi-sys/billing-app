# 버그 수정 가이드

## 수정 전 필수 확인
1. 해당 파일 전체 읽기
2. DataContext.js 영향 여부 확인 (전역 상태라 파급 큼)
3. localStorage 키 변경 금지 (기존 사용자 데이터 유실)

## 자주 발생하는 버그 패턴

### 날짜 하루 밀림
원인: new Date('YYYY-MM-DD') → UTC 파싱
해결: new Date('YYYY-MM-DD' + 'T00:00:00') 로컬 파싱

### localStorage 동기화 누락
원인: DataContext 거치지 않고 직접 localStorage 수정
해결: 반드시 DataContext CRUD 함수 사용

### 부가세 계산 오류
원인: calculations.js 함수 미사용, 직접 계산
해결: calculateVAT(), formatAmount() 등 함수 재사용

### 차트 데이터 빈 값
원인: 월별 데이터 없을 때 null 처리 누락
해결: 빈 달은 0으로 fallback

## 수정 후
- npm start로 로컬 확인
- 커밋: fix: [버그 내용] ([파일명])
- npm run deploy
