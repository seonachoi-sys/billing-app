# 날짜 계산 규칙

## 필수 패턴
```js
// 로컬 날짜 파싱 (UTC 밀림 방지)
const parseLocalDate = (dateStr) =>
  new Date(dateStr + 'T00:00:00');

// D-day 계산
const getDday = (dueDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dueDate);
  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
};
```

## 금지 패턴
- new Date('YYYY-MM-DD') → UTC 파싱으로 하루 밀림
- 날짜 하드코딩
- getDate() + N 직접 덧셈 (월말 오류)

## 부가세 계산
- calculations.js의 함수만 사용
- 직접 계산 로직 작성 금지
