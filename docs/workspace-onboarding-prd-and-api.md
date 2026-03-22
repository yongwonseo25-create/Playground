# VOXERA Workspace Onboarding PRD + API Spec

Last updated: 2026-03-21
Owner: Product + Platform
Status: Ready for implementation

## 1. Product Goal

Provision a user's execution workspace with the lowest possible setup friction while preserving a high-quality destination experience.

Supported destinations:

- Notion
- Google Docs
- Google Sheets
- Google Calendar

Primary user promise:

- A new user can connect a workspace during signup.
- Their workspace is provisioned immediately.
- VOXERA can write transformed voice results into that workspace without extra manual mapping in the default path.

## 2. Scope

### In scope

- OAuth connection flows
- Notion template-based provisioning
- Google Docs/Sheets automatic template copy
- Google Calendar automatic calendar creation
- Destination discovery and ID persistence
- Direct write path into provisioned destinations
- Retry, idempotency, and reauthorization handling

### Out of scope

- BI dashboards
- Complex multi-destination sync rules
- Custom Agent orchestration as a required default path
- Manual Make.com-first routing as the core ingestion path

## 3. Product Decisions

### 3.1 Notion

Provisioning method:

- Public OAuth integration
- Authorization flow includes Notion `template` option

Why:

- Preserves dashboard fidelity better than reconstructing views through the API
- Minimizes onboarding friction by combining connect + template install

Write path:

- Direct server-side writes to the provisioned `Voice Inbox` data source using Notion API

### 3.2 Google Docs / Sheets

Provisioning method:

- Google OAuth
- Create `VOXERA` Drive folder
- Copy master Doc and Sheet templates into that folder

Write path:

- Server-side writes or updates to provisioned files

### 3.3 Google Calendar

Provisioning method:

- Google OAuth
- Create a dedicated secondary calendar named `VOXERA`

Write path:

- Server-side event creation into the dedicated calendar

## 4. User Flows

### 4.1 Notion onboarding flow

1. User clicks `Start with Notion`
2. Frontend requests a Notion OAuth authorization URL from backend
3. Backend returns OAuth URL with `template` configured
4. User completes Notion OAuth approval
5. Backend exchanges auth code for token
6. Backend stores Notion connection
7. Backend discovers duplicated template assets
8. Backend resolves:
   - template root page
   - `Voice Inbox` data source
   - `Execution Board` data source
9. User sees connection as active

### 4.2 Google Docs/Sheets onboarding flow

1. User clicks `Connect Google Docs & Sheets`
2. Frontend requests Google OAuth URL
3. User approves Drive/Docs/Sheets scopes
4. Backend exchanges code for tokens
5. Backend creates `VOXERA` Drive folder
6. Backend copies master Doc template
7. Backend copies master Sheet template
8. Backend stores created file IDs

### 4.3 Google Calendar onboarding flow

1. User clicks `Connect Google Calendar`
2. Frontend requests Google OAuth URL
3. User approves Calendar scopes
4. Backend exchanges code for tokens
5. Backend creates `VOXERA` secondary calendar
6. Backend stores calendar ID

## 5. Core Entities

## 5.1 WorkspaceConnection

Represents one provider connection for one VOXERA user.

Fields:

- `id`
- `user_id`
- `provider` enum: `notion`, `google_docs_sheets`, `google_calendar`
- `status` enum:
  - `pending_oauth`
  - `connected_pending_provision`
  - `connected_pending_discovery`
  - `active`
  - `reauthorization_required`
  - `failed`
- `external_workspace_id`
- `external_user_id` nullable
- `access_token_encrypted`
- `refresh_token_encrypted` nullable
- `scope_string`
- `last_synced_at` nullable
- `last_error_code` nullable
- `last_error_message` nullable
- `created_at`
- `updated_at`

## 5.2 ProvisionedAsset

Represents a specific asset created or discovered after connection.

Fields:

- `id`
- `workspace_connection_id`
- `asset_type` enum:
  - `notion_template_root_page`
  - `notion_voice_inbox_data_source`
  - `notion_execution_board_data_source`
  - `google_drive_folder`
  - `google_doc`
  - `google_sheet`
  - `google_calendar`
- `external_id`
- `external_url` nullable
- `display_name`
- `metadata_json`
- `created_at`

## 5.3 DestinationWrite

Tracks outbound writes for idempotency and debugging.

Fields:

- `id`
- `user_id`
- `provider`
- `destination_asset_id`
- `request_id`
- `idempotency_key`
- `payload_hash`
- `status` enum:
  - `pending`
  - `succeeded`
  - `failed`
  - `deduplicated`
- `external_record_id` nullable
- `error_code` nullable
- `error_message` nullable
- `created_at`
- `updated_at`

## 6. System Rules

1. Every external write must be idempotent.
2. Every provider token must be stored encrypted.
3. VOXERA must not depend on Make.com for the primary destination write path.
4. Notion must use template-based provisioning, not dashboard reconstruction through API.
5. Google Docs/Sheets must use template copy, not blank file creation as the default.
6. Google Calendar must use dedicated calendar creation, not event writes into the user's main calendar by default.

## 7. API Design

Base path:

`/api/workspaces`

All authenticated routes require the VOXERA user session.

## 7.1 Create Notion authorization URL

### Endpoint

`POST /api/workspaces/notion/authorize`

### Purpose

Return a Notion OAuth URL configured with the VOXERA template option.

### Request body

```json
{
  "redirectPath": "/settings/integrations/notion/callback"
}
```

### Response 200

```json
{
  "ok": true,
  "provider": "notion",
  "authorizationUrl": "https://api.notion.com/v1/oauth/authorize?...",
  "state": "opaque-csrf-state"
}
```

### Validation

- `redirectPath` optional, must be allowlisted if provided

### Side effects

- Create or update a `WorkspaceConnection` in `pending_oauth`
- Generate and persist OAuth state

## 7.2 Handle Notion OAuth callback

### Endpoint

`GET /api/workspaces/notion/callback`

### Query params

- `code`
- `state`

### Purpose

Exchange code for token and enqueue provisioning/discovery.

### Response

- Redirect to frontend success/failure page

### Backend actions

1. Validate `state`
2. Exchange `code` for tokens
3. Upsert `WorkspaceConnection`
4. Set status to `connected_pending_discovery`
5. Enqueue Notion discovery job

### Failure modes

- invalid state -> reject
- code exchange failure -> `failed`

## 7.3 Discover Notion provisioned assets

### Endpoint

`POST /api/workspaces/notion/discover`

### Purpose

Internal or admin-only endpoint/job handler that discovers duplicated template assets.

### Request body

```json
{
  "workspaceConnectionId": "uuid"
}
```

### Discovery logic

1. Resolve duplicated template root page from OAuth install/template flow metadata if available
2. Traverse children under template root
3. Find data sources with names:
   - `Voice Inbox`
   - `Execution Board`
4. Persist `ProvisionedAsset` rows
5. Mark `WorkspaceConnection.status = active`

### Response 200

```json
{
  "ok": true,
  "workspaceConnectionId": "uuid",
  "assets": [
    {
      "assetType": "notion_voice_inbox_data_source",
      "externalId": "..."
    },
    {
      "assetType": "notion_execution_board_data_source",
      "externalId": "..."
    }
  ]
}
```

### Failure behavior

- If assets not found, keep status `connected_pending_discovery`
- Save error and retry later

## 7.4 Create Google Docs/Sheets authorization URL

### Endpoint

`POST /api/workspaces/google/docs-sheets/authorize`

### Purpose

Return Google OAuth URL for Drive/Docs/Sheets scopes.

### Response 200

```json
{
  "ok": true,
  "provider": "google_docs_sheets",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "opaque-csrf-state"
}
```

## 7.5 Handle Google Docs/Sheets callback

### Endpoint

`GET /api/workspaces/google/docs-sheets/callback`

### Purpose

Exchange code, create folder, copy templates, persist assets.

### Backend actions

1. Validate state
2. Exchange code for tokens
3. Create `VOXERA` folder in Drive
4. Copy master Doc template
5. Copy master Sheet template
6. Persist created asset IDs
7. Mark connection `active`

## 7.6 Create Google Calendar authorization URL

### Endpoint

`POST /api/workspaces/google/calendar/authorize`

### Response 200

```json
{
  "ok": true,
  "provider": "google_calendar",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "opaque-csrf-state"
}
```

## 7.7 Handle Google Calendar callback

### Endpoint

`GET /api/workspaces/google/calendar/callback`

### Backend actions

1. Validate state
2. Exchange code
3. Create secondary calendar named `VOXERA`
4. Optionally seed starter events
5. Persist calendar asset
6. Mark connection `active`

## 7.8 List connected workspaces

### Endpoint

`GET /api/workspaces`

### Purpose

Return all provider connections and provisioned assets for current user.

### Response 200

```json
{
  "ok": true,
  "connections": [
    {
      "provider": "notion",
      "status": "active",
      "assets": [
        {
          "assetType": "notion_voice_inbox_data_source",
          "displayName": "Voice Inbox"
        }
      ]
    }
  ]
}
```

## 7.9 Disconnect workspace

### Endpoint

`DELETE /api/workspaces/:provider`

### Purpose

Disconnect a provider connection from VOXERA.

### Notes

- Does not delete the user's Notion/Google content by default
- Revokes token when supported
- Marks connection inactive in VOXERA

### Response 200

```json
{
  "ok": true,
  "provider": "notion"
}
```

## 7.10 Direct write to Notion Voice Inbox

### Endpoint

`POST /api/destinations/notion/voice-inbox`

### Purpose

Write one transformed voice result into the user's provisioned Notion `Voice Inbox`.

### Request body

```json
{
  "requestId": "req_123",
  "userId": "user_123",
  "idempotencyKey": "voxera_req_123",
  "title": "회의 후 후속 연락",
  "rawTranscript": "대표님, A사에 내일 오전까지 수정본 보내고...",
  "summary": "A사 제안서 수정본 발송 필요",
  "actionItems": "1. 제안서 수정\n2. 오전 11시 전 발송",
  "recordedAt": "2026-03-21T05:00:00.000Z"
}
```

### Server behavior

1. Resolve active Notion connection
2. Resolve `Voice Inbox` data source asset
3. Check `DestinationWrite` by `idempotencyKey`
4. If already succeeded, return deduplicated success
5. Call Notion `POST /v1/pages`
6. Persist `DestinationWrite`

### Response 200

```json
{
  "ok": true,
  "provider": "notion",
  "deduplicated": false,
  "externalRecordId": "notion_page_id"
}
```

### Response 200 deduplicated

```json
{
  "ok": true,
  "provider": "notion",
  "deduplicated": true,
  "externalRecordId": "existing_notion_page_id"
}
```

### Response 409

Returned only if idempotency state is ambiguous and retry should be deferred.

### Response 424

```json
{
  "ok": false,
  "error": "destination_not_ready",
  "message": "Notion workspace is connected but Voice Inbox has not been discovered yet."
}
```

## 7.11 Direct write to Google Docs

### Endpoint

`POST /api/destinations/google/docs`

### Purpose

Append or inject generated content into the provisioned Google Doc.

### Request body

```json
{
  "requestId": "req_123",
  "idempotencyKey": "voxera_req_123",
  "title": "회의 후 실행 요약",
  "body": "요약...\n\n액션 아이템..."
}
```

### Implementation note

Initial version may append a new section to the provisioned Doc instead of complex cursor-aware edits.

## 7.12 Direct write to Google Sheets

### Endpoint

`POST /api/destinations/google/sheets`

### Purpose

Append one structured row to the provisioned sheet.

### Request body

```json
{
  "requestId": "req_123",
  "idempotencyKey": "voxera_req_123",
  "row": {
    "title": "회의 후 후속 연락",
    "summary": "A사 제안서 수정본 발송 필요",
    "owner": "김OO",
    "priority": "높음",
    "dueDate": "2026-03-22"
  }
}
```

## 7.13 Direct write to Google Calendar

### Endpoint

`POST /api/destinations/google/calendar/events`

### Purpose

Create an event in the provisioned VOXERA calendar.

### Request body

```json
{
  "requestId": "req_123",
  "idempotencyKey": "voxera_req_123",
  "title": "A사 수정 제안서 발송",
  "startAt": "2026-03-22T02:00:00.000Z",
  "endAt": "2026-03-22T02:30:00.000Z",
  "description": "VOXERA generated follow-up action"
}
```

## 8. Error Model

All JSON error responses must follow:

```json
{
  "ok": false,
  "error": "machine_readable_code",
  "message": "Human readable error message",
  "retryable": false
}
```

### Standard error codes

- `invalid_state`
- `oauth_exchange_failed`
- `provider_token_invalid`
- `workspace_not_connected`
- `destination_not_ready`
- `asset_not_found`
- `duplicate_request_in_progress`
- `provider_rate_limited`
- `provider_write_failed`
- `reauthorization_required`

## 9. Idempotency Rules

### Required behavior

- Every write endpoint requires `idempotencyKey`
- Server must store write attempts keyed by:
  - `user_id`
  - `provider`
  - `destination_asset_id`
  - `idempotency_key`

### Decision table

- If existing write is `succeeded`:
  - return `deduplicated = true`
- If existing write is `pending`:
  - return conflict or retryable response
- If existing write is `failed` and retryable:
  - allow retry

## 10. Security Spec

- Encrypt access and refresh tokens at rest
- Never expose provider tokens to frontend
- Validate OAuth state on every callback
- Store scope strings for auditability
- Support token revocation and disconnect
- Log provider writes with request IDs

## 11. Retry and Background Jobs

Required jobs:

- Notion discovery retry job
- Provider write retry job
- Token health check job

### Retry strategy

- exponential backoff
- capped retries
- dead-letter visibility after repeated failure

## 12. Implementation Order

### Phase 1

- Notion OAuth authorize/callback
- Notion template-based provisioning
- Notion discovery
- Direct write to `Voice Inbox`

### Phase 2

- Google Docs/Sheets OAuth
- Drive folder creation
- template copy
- direct write endpoints

### Phase 3

- Google Calendar OAuth
- secondary calendar creation
- event write endpoint

## 13. Acceptance Criteria

### Notion

- User completes one OAuth flow
- VOXERA template appears in user's workspace
- `Voice Inbox` is discoverable and writable
- First transformed voice result appears in Notion without manual DB mapping

### Google Docs/Sheets

- User completes one OAuth flow
- `VOXERA` folder is created
- Doc and Sheet templates are copied
- First transformed voice result can be written without manual file selection

### Google Calendar

- User completes one OAuth flow
- `VOXERA` secondary calendar exists
- First generated event can be written without manual calendar selection

## 14. Explicit Non-Goals

- Rebuilding Notion dashboard views through API
- Requiring Make.com for default ingestion
- Relying on Notion Custom Agents for baseline product correctness

## 15. Source Links

- Notion OAuth authorization: https://developers.notion.com/guides/get-started/authorization
- Notion authentication: https://developers.notion.com/reference/authentication
- Notion create page: https://developers.notion.com/reference/post-page
- Notion database reference: https://developers.notion.com/reference/database
- Notion data source reference: https://developers.notion.com/reference/data-source
- Notion create database: https://developers.notion.com/reference/create-a-database
- Notion create data source: https://developers.notion.com/reference/create-a-data-source
- Notion duplicate public pages: https://www.notion.com/help/duplicate-public-pages
- Notion custom agents: https://www.notion.com/help/custom-agent
- Notion custom agent pricing: https://www.notion.com/help/custom-agent-pricing
- Google Drive create/manage files: https://developers.google.com/workspace/drive/api/guides/create-file
- Google Drive files copy: https://developers.google.com/drive/api/v2/reference/files/copy
- Google Docs document concepts: https://developers.google.com/docs/api/concepts/document
- Google Docs create/manage docs: https://developers.google.com/workspace/docs/api/how-tos/documents
- Google Sheets create/manage spreadsheets: https://developers.google.com/workspace/sheets/api/guides/create
- Google Sheets spreadsheets.create: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/create
- Google Calendar calendars.insert: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
- Google Calendar create events: https://developers.google.com/workspace/calendar/api/guides/create-events
- Google Calendar events.import: https://developers.google.com/workspace/calendar/api/v3/reference/events/import
