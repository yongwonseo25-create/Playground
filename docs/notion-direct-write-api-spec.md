# VOXERA Notion Direct-Write Backend Spec

## 목적

이 문서는 VOXERA가 Make.com을 통하지 않고 Notion에 직접 적재하기 위한 백엔드 구현 명세다.

핵심 목표:
- 사용자는 Notion 템플릿을 한 번 연결하면 된다
- 음성 실행 결과는 backend가 Notion `Voice Inbox`에 직접 쓴다
- `Execution Board`는 Notion 안에서 운영자가 관리한다
- 템플릿 복제와 권한 연결은 OAuth에서 최대한 한 번에 처리한다

## 최종 구조

1. 사용자가 `Notion으로 연결` 클릭
2. backend가 Notion OAuth URL 생성
3. OAuth 승인 시 template option으로 템플릿 복제
4. callback 이후 backend가 복제된 root page와 child data source를 발견
5. backend가 `Voice Inbox` data source ID 저장
6. 이후 음성 결과가 들어오면 backend가 Notion API로 직접 `Voice Inbox`에 page 생성

## 전제

- Public Integration 사용
- 사용자별 access token 저장
- duplicated template 안의 `Voice Inbox`, `Execution Board`를 title 기준으로 식별
- idempotency key는 `clientRequestId` 또는 `source_id`

## Source of Truth

- 앱의 실행 이벤트 원본: backend
- Notion review queue: `Voice Inbox`
- Notion action board: `Execution Board`

## 엔티티 설계

### 1. notion_connections
- `id`
- `user_id`
- `workspace_id`
- `workspace_name`
- `access_token_encrypted`
- `bot_id`
- `root_page_id`
- `voice_inbox_data_source_id`
- `execution_board_data_source_id`
- `status`
- `created_at`
- `updated_at`

상태값:
- `pending`
- `connected`
- `discovery_failed`
- `revoked`

### 2. notion_write_events
- `id`
- `user_id`
- `source_id`
- `client_request_id`
- `destination_page_id`
- `status`
- `attempt_count`
- `last_error`
- `created_at`
- `updated_at`

상태값:
- `queued`
- `written`
- `duplicate`
- `failed`

## 환경변수

- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`
- `NOTION_TEMPLATE_PAGE_ID`
- `NOTION_WEBHOOK_SIGNING_SECRET` (webhook 이벤트를 쓸 경우)
- `APP_BASE_URL`

## OAuth 플로우

### 1. authorize
클라이언트가 backend에 authorize 요청

`POST /api/integrations/notion/authorize`

request:
```json
{
  "userId": "usr_123",
  "returnUrl": "https://app.voxera.example/settings/integrations"
}
```

response:
```json
{
  "authorizeUrl": "https://api.notion.com/v1/oauth/authorize?...",
  "state": "st_abc123"
}
```

동작:
- state 생성 및 저장
- authorize URL 생성
- template option 포함
- returnUrl 저장

### 2. callback
Notion이 redirect

`GET /api/integrations/notion/callback?code=...&state=...`

동작:
- state 검증
- token exchange
- workspace metadata 저장
- `root_page_id` 확보
- background discovery job enqueue
- 성공 시 frontend settings page로 redirect

callback success backend action:
- `notion_connections.status = pending`

### 3. discovery
템플릿 복제 후 child data source 식별

`POST /api/integrations/notion/discover`

request:
```json
{
  "userId": "usr_123"
}
```

response:
```json
{
  "status": "connected",
  "rootPageId": "32a7e2408cc080bc901dde5e931c9385",
  "voiceInboxDataSourceId": "ds_voice_inbox",
  "executionBoardDataSourceId": "ds_execution_board"
}
```

동작:
- connection token으로 root page children 탐색
- `Voice Inbox` title을 가진 data source 찾기
- `Execution Board` title을 가진 data source 찾기
- 둘 다 찾으면 `connected`
- 못 찾으면 `discovery_failed`

## 음성 결과 direct write

### 엔드포인트
`POST /api/integrations/notion/voice-inbox/write`

request:
```json
{
  "userId": "usr_123",
  "sourceId": "voice_20260321_001",
  "clientRequestId": "req_123",
  "createdAt": "2026-03-21T15:30:00+09:00",
  "speaker": "대표님",
  "summary": "오늘 5시까지 제안서 초안을 정리해야 함",
  "rawTranscript": "오늘 오후 5시까지 제안서 초안 정리해줘",
  "actionItems": [
    "제안서 초안 수정",
    "완성본 공유"
  ],
  "urgency": "HIGH",
  "dueDate": "2026-03-21",
  "dueTime": "17:00",
  "category": "SALES",
  "requiresDoc": true,
  "requiresCalendar": true
}
```

response:
```json
{
  "status": "written",
  "pageId": "pg_123",
  "duplicate": false
}
```

동작:
- userId 기준 notion connection 조회
- `status === connected` 확인
- `clientRequestId` 또는 `sourceId` 기준 dedupe 검사
- Notion Create Page API 호출
- parent는 `voice_inbox_data_source_id`
- properties 매핑
- 성공 시 `notion_write_events` 저장

## Notion property mapping

`Voice Inbox` 기준:
- `이름` <- summary 첫 줄 또는 fallback title
- `상태` <- `신규`
- `녹음일` <- createdAt 또는 dueDate와 분리해서 날짜 저장
- `원문` <- rawTranscript
- `요약` <- summary
- `액션 아이템` <- actionItems join
- `우선순위` <- urgency normalized

숨김 메타를 유지하고 싶으면 선택적으로:
- `요청 ID` <- clientRequestId
- `세션 ID` <- sourceId

## 내부 서비스 경계

### 1. NotionOAuthService
- authorize URL 생성
- token exchange
- state 검증

### 2. NotionDiscoveryService
- root page children 탐색
- `Voice Inbox` / `Execution Board` 식별

### 3. NotionWriteService
- payload -> Notion property 매핑
- create page 호출
- dedupe 관리

### 4. NotionConnectionRepository
- token 및 data source id 저장

## 에러 처리

### authorize 단계
- state mismatch -> `400`
- token exchange 실패 -> `502`

### discovery 단계
- root page 찾기 실패 -> `409`
- Voice Inbox data source 미발견 -> `409`
- Execution Board data source 미발견 -> `409`

### write 단계
- integration 미연결 -> `409`
- duplicate sourceId/clientRequestId -> `200 duplicate=true`
- Notion 401/403 -> `424`
- Notion validation error -> `422`
- network timeout -> `503`, retryable

## 멱등성 규칙

- primary key: `clientRequestId`
- fallback key: `sourceId`
- 같은 key로 이미 `written` 상태가 있으면 duplicate로 종료
- backend는 Notion 재호출 전에 DB에서 먼저 차단

## 재시도 규칙

- Notion 5xx / timeout만 retry
- 3회 exponential backoff
- 4xx validation error는 retry 금지

## 백엔드 작업 순서

1. DB migration
2. authorize endpoint
3. callback endpoint
4. discovery service
5. write endpoint
6. dedupe table 적용
7. integration settings UI 연결
8. 실제 user smoke test

## 수용 기준

- 사용자 1회 OAuth 후 템플릿이 워크스페이스에 복제된다
- backend가 `Voice Inbox` data source id를 저장한다
- 음성 결과 1건이 Make 없이 `Voice Inbox`에 직접 적재된다
- 중복 요청은 DB에서 차단된다
- 권한 해제 시 연결 상태가 `revoked`로 바뀐다

## 주의사항

- template 적용은 비동기일 수 있으므로 callback 직후 discovery가 실패하면 재시도 job이 필요하다
- template ID/parent schema mismatch를 피하려면 운영 템플릿 구조를 고정해야 한다
- Notion 권한 목록이 바뀌면 token을 다시 연결해야 할 수 있다
