# VOXERA Google Workspace Production Runbook

## 목적

이 문서는 VOXERA의 Google Workspace 연동을 운영 투입 가능한 수준으로 고정하기 위한 최종 기준 문서다.
핵심 원칙은 기록이 아니라 실행이다.

- Google Sheets: 실행 관제탑
- Google Docs: 조건부 상세 문서
- Google Calendar: 조건부 일정 자산
- Looker Studio: 실행 현황 대시보드
- Apps Script Web App: 외부 음성 결과 인입 엔드포인트

## 최종 구조

### 1. Google Sheets가 메인이다

Google Workspace 안에서 메인 Source of Truth는 `VOXERA Execution Board` 스프레드시트다.

시트 탭은 아래 5개로 고정한다.

1. `Inbox`
2. `Execution Board`
3. `Archive`
4. `Config`
5. `Dashboard Feed`

### 2. Google Docs는 모든 건에 만들지 않는다

Docs는 아래 중 하나를 만족할 때만 만든다.

- `category === MEETING`
- `requires_doc === true`
- summary/raw_transcript에 아래 키워드 포함
  - `회의록`
  - `제안서`
  - `보고서`
  - `정리해줘`
  - `브리프`
  - `문서화`

즉, Docs는 상세 브리프나 회의 정리 자산이지 메인 보드가 아니다.

### 3. Google Calendar는 실제 일정이 있을 때만 만든다

Calendar는 아래 중 하나를 만족할 때만 만든다.

- `due_date` 존재
- `requires_calendar === true`
- summary/raw_transcript에 일정성 표현 포함

즉, 모호한 아이디어나 단순 메모는 Calendar로 보내지 않는다.

## 데이터 흐름

1. 외부 시스템이 Apps Script Web App `POST` 호출
2. payload가 `Inbox`에 `NEW` 상태로 적재
3. 운영자가 `Inbox.status`를 `CONVERTED`로 변경
4. installable trigger가 `Execution Board`에 실제 task 생성
5. 조건 만족 시 Google Docs 생성
6. 조건 만족 시 Google Calendar 이벤트 생성
7. `Dashboard Feed` 재빌드
8. 완료된 업무는 필요 시 `Archive`로 이관

## 왜 이렇게 설계하는가

### Sheets
- 빠른 검토와 대량 정렬에 가장 적합
- 상태/담당자/우선순위/마감일 관리가 쉽다
- Looker Studio와 연결이 쉽다

### Docs
- 회의 정리, 제안서 초안, 상세 브리프처럼 긴 텍스트에 적합
- 모든 건에 자동 생성하면 오히려 실행 속도를 떨어뜨린다

### Calendar
- 마감일과 실제 일정이 분명한 일에만 써야 한다
- 그렇지 않으면 캘린더 오염이 생긴다

## 시트 스키마

### Inbox
- `created_at`
- `source_id`
- `speaker`
- `raw_transcript`
- `summary`
- `action_items`
- `urgency`
- `due_date`
- `due_time`
- `category`
- `requires_doc`
- `requires_calendar`
- `status`
- `processed_at`
- `conversion_note`

상태값:
- `NEW`
- `REVIEWED`
- `CONVERTED`
- `ARCHIVED`
- `ERROR`

### Execution Board
- `task_id`
- `created_at`
- `source_id`
- `title`
- `owner`
- `priority`
- `status`
- `due_date`
- `due_time`
- `category`
- `execution_note`
- `source_summary`
- `source_doc_url`
- `calendar_event_id`
- `calendar_event_url`
- `completion_date`

상태값:
- `NEW`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

우선순위:
- `HIGH`
- `MEDIUM`
- `LOW`

### Archive
- `task_id`
- `created_at`
- `source_id`
- `title`
- `owner`
- `priority`
- `status`
- `completion_date`
- `source_doc_url`
- `calendar_event_url`

### Config
- `Key`
- `Value`
- `Description`

필수 key:
- `company_name`
- `default_owner`
- `timezone`
- `doc_folder_id`
- `calendar_id`
- `mail_notifications_enabled`
- `notification_email`
- `webhook_secret`
- `default_event_hour`
- `default_event_duration_min`

### Dashboard Feed
- `task_id`
- `title`
- `owner`
- `priority`
- `status`
- `category`
- `due_date`
- `is_overdue`
- `completion_date`

## 설치 순서

1. 새 Google Spreadsheet 생성
2. `확장 프로그램 > Apps Script` 열기
3. [Code.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.gs) 전체 붙여넣기
4. `setupSystem` 수동 실행
5. 권한 승인
6. 생성된 `Config` 시트 값 입력
7. `deployWebApp` 수동 실행
8. 표시된 Web App URL 확보
9. Make.com 또는 백엔드에서 해당 URL로 POST 연결
10. `Inbox` 상태를 `CONVERTED`로 바꿨을 때 `Execution Board`가 생성되는지 확인

## Web App 보안 규칙

운영 환경에서는 아래를 필수로 적용한다.

- `Authorization: Bearer {webhook_secret}` 헤더 확인
- 필수 필드 검증
- `source_id` 기준 멱등성 방어
- `LockService`로 동시 요청 보호
- raw payload와 에러를 로그 시트 또는 Apps Script 로그로 기록

## Make.com 연결 기준

Make.com은 메인 자동화 엔진이 아니라 단순 인입 라우터로 사용한다.

필수 payload:

```json
{
  "source_id": "voice_20260321_001",
  "created_at": "2026-03-21T15:30:00+09:00",
  "speaker": "대표님",
  "raw_transcript": "오늘 오후 5시까지 제안서 초안 정리해줘",
  "summary": "오늘 5시까지 제안서 초안을 정리해야 함",
  "action_items": [
    "제안서 초안 수정",
    "완성본 공유"
  ],
  "urgency": "HIGH",
  "due_date": "2026-03-21",
  "due_time": "17:00",
  "category": "SALES",
  "requires_doc": true,
  "requires_calendar": true
}
```

필수 헤더:

```text
Content-Type: application/json
Authorization: Bearer {Config.webhook_secret}
```

## Looker Studio 기준

데이터 소스:
- `Dashboard Feed` 시트

필수 카드:
- 전체 오픈 업무 수
- 오늘 마감 업무 수
- overdue 업무 수
- 완료 업무 수

필수 차트:
- 담당자별 오픈 업무량
- priority 분포
- category 분포
- 주간 완료 추이

## 운영 규칙

- Inbox는 검토용이다.
- Execution Board는 실행용이다.
- Docs는 상세 정리가 필요한 건만 만든다.
- Calendar는 실제 일정이 있는 것만 만든다.
- 완료되면 반드시 `DONE`으로 바꾸고 `completion_date`를 남긴다.

## 독스와 캘린더는 어떻게 동작하나

### Docs
`Execution Board` row 생성 시 조건이 맞으면 `source_doc_url`에 링크가 자동 저장된다.
즉, 시트 안에서 해당 상세 문서로 바로 들어간다.

### Calendar
`Execution Board` row 생성 시 일정 조건이 맞으면 `calendar_event_id`와 `calendar_event_url`이 같이 저장된다.
즉, 시트 안에서 해당 일정으로 바로 들어간다.

### Gmail
`mail_notifications_enabled=true` 이고 `notification_email`이 설정되어 있으면,
`Execution Board` row 생성 직후 MailApp으로 실행 알림 메일을 발송한다.
즉, Google Mail도 별도 시스템이 아니라 시트 기반 실행 흐름의 일부로 동작한다.

결론적으로 시트가 메인 보드이고, Docs/Calendar는 시트 row에 연결된 실행 자산이다.

## 운영 투입 전 체크리스트

- `Config.webhook_secret` 설정 완료
- `doc_folder_id` 설정 완료
- `calendar_id` 설정 완료
- Apps Script Web App 배포 완료
- installable `onEdit` trigger 생성 완료
- test payload 1건 성공
- `CONVERTED` 변경 시 task 생성 확인
- 문서 생성 조건 테스트 완료
- 일정 생성 조건 테스트 완료
- `Dashboard Feed` 재빌드 확인

## 주의사항

- Apps Script Web App은 `Anyone` 공개만으로 끝내지 말고 secret 검증을 반드시 켜야 한다.
- `onEdit`는 installable trigger 기준으로 운영해야 한다.
- Drive/Calendar 권한은 처음 설치 시 승인 필요하다.
- Looker Studio는 append-only feed가 아니라 재빌드된 `Dashboard Feed`를 읽게 해야 정확하다.
