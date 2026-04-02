# 데이터 재생성

## 실행 순서
1. data/*.csv 파일 수정
2. npm run gen-data → src/data.js 재생성
3. npm start로 확인

## 주의
- src/data.js는 자동생성 파일 — 직접 수정 금지
- gen-data.js 로직 변경 시 기존 localStorage와 충돌 가능
  → Settings에서 데이터 백업 후 진행
