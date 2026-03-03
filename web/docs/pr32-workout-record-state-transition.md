# PR32 - WorkoutRecord State Transition

## State Diagram
```text
Idle
  ├─ (사용자 입력 수정 / 운동 추가 / 운동 삭제)
  ▼
Editing
  ├─ (완료 버튼 탭 + 유효성 실패) ───────────────┐
  │                                              │
  ├─ (완료 버튼 탭 + 유효성 통과)                │
  ▼                                              │
Saving
  ├─ (저장 성공)
  ▼
Done  -> Home 이동(/)

Saving
  ├─ (저장 실패)
  ▼
Editing
```

## 전이 규칙
- `Idle -> Editing`
  - 자동 시드된 항목을 사용자가 수정
  - 사용자 임의 운동 추가/삭제
  - 세션 메모 편집
- `Editing -> Saving`
  - 완료 버튼 탭 + 검증 통과
- `Editing -> Editing`
  - 완료 버튼 탭 + 검증 실패(오류 메시지 표시)
- `Saving -> Done`
  - `/api/logs` 저장 성공
- `Saving -> Editing`
  - `/api/logs` 저장 실패
