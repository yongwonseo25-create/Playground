# Voice OS 3-Layer Pipeline

## Goal
Route a single voice intake event into one or more downstream systems:
- `Notion Inbox` for raw capture and triage
- `Google Calendar` for schedule/event creation
- `Google Sheets` for CFO dashboard append-only finance rows

## Module Flow
1. `Webhook`
Receive the voice payload from Voxera.

Expected payload:
```json
{
  "transcript": "내일 오후 3시에 미팅 잡고 비용 50000원 마케팅 처리해",
  "language": "ko-KR",
  "capturedAt": "2026-03-14T10:00:00.000Z",
  "clientRequestId": "uuid",
  "workflow": "voice_os"
}
```

2. `OpenAI - GPT-4o`
Parse the transcript into strict JSON with three route sections.

Recommended schema:
```json
{
  "summary": {
    "title": "마케팅 미팅 및 비용 기록"
  },
  "notion": {
    "createInboxPage": true
  },
  "calendar": {
    "createEvent": true,
    "title": "마케팅 미팅",
    "description": "Voice OS auto-created event",
    "start": "2026-03-15T15:00:00+09:00",
    "end": "2026-03-15T16:00:00+09:00"
  },
  "sheets": {
    "appendRow": true,
    "date": "2026-03-15",
    "item": "마케팅 비용",
    "amount": 50000,
    "category": "marketing",
    "notes": "voice captured"
  }
}
```

3. `Router`
Use independent route conditions so one utterance can fan out to multiple systems.

## Route 1: Notion Inbox
- Module: `Notion > Create a Database Item`
- Target: 4-Core dashboard `Inbox` database
- Minimal fields:
  - `Name`
  - `Transcript`
  - `Client Request Id`
  - `Captured At`

## Route 2: Google Calendar
- Module: `Google Calendar > Create an Event`
- Auth: OAuth 2.0 connection in Make.com using the acquired Google Client ID / Client Secret
- Required scopes:
  - `https://www.googleapis.com/auth/calendar.events`
- Recommended mapping:
  - `Summary` -> parsed event title
  - `Description` -> transcript or AI summary
  - `Start / End` -> GPT-normalized RFC3339 timestamps

## Route 3: Google Sheets CFO Dashboard
- Module: `HTTP > Make a request`
- Target: deployed Apps Script Web App URL from [Code.gs](/Users/Master/.codex/worktrees/5d28/Playground/Code.gs)
- Method: `POST`
- Header: `Content-Type: application/json`
- Body:
```json
{
  "date": "{{parsed_date}}",
  "item": "{{parsed_item}}",
  "amount": "{{parsed_amount}}",
  "category": "{{parsed_category}}",
  "notes": "{{parsed_notes}}"
}
```

## Apps Script Deployment Notes
1. Paste [Code.gs](/Users/Master/.codex/worktrees/5d28/Playground/Code.gs) into a bound or standalone Apps Script project.
2. Replace `SPREADSHEET_ID`.
3. Deploy as `Web app`.
4. Execute as: `Me`
5. Access: `Anyone with the link` or the minimum policy Make.com can reach.

## Google Sheets Column Contract
- Column A: `date`
- Column B: `item`
- Column C: `amount`
- Column D: `category`
- Column E: `notes`

## Standby For 4-Core Notion
- The current Playwright installers are ready but the proper 4-Core template URL has not been supplied yet.
- As soon as the true template URL containing `Inbox`, `Tasks`, `Projects`, and `Notes` arrives, rerun:
  - `npm run notion:clone -- --url "<4-core-template-url>"`
  - `npm run notion:install-inbox-skill -- --url "<cloned-dashboard-url>"`
