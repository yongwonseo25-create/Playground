# VOXERA Channel Delivery Architecture

## 목표

VOXERA의 음성 실행 결과를 가장 안정적으로 전달하기 위한 최종 채널 구조를 정의한다.

대상 채널:
- Notion
- Google Workspace
  - Sheets
  - Docs
  - Calendar
  - Gmail
- KakaoTalk

핵심 원칙:
- 실행 시스템의 Source of Truth는 하나만 둔다
- 채널별 역할을 분리한다
- 승인과 권한은 최소화한다
- 사용자 마찰이 큰 경로는 기본값으로 두지 않는다

## 최종 권장 구조

### 1. Notion

권장 구조:
- `앱 -> 백엔드 -> Notion API direct write`

설정 구조:
- Public OAuth
- auth flow의 `template option`으로 템플릿 복제
- 복제된 `Voice Inbox` / `Execution Board`를 backend가 발견
- backend가 `Voice Inbox`에 직접 page 생성

왜 Make를 빼는가:
- Notion은 API direct write가 가능하다
- 템플릿 복제는 OAuth flow에서 처리 가능하다
- 중간 Make hop을 두면 지연과 운영 복잡성이 늘어난다

공식 근거:
- Notion OAuth + template option: [Authorization](https://developers.notion.com/guides/get-started/authorization)
- Bearer token auth: [Authentication](https://developers.notion.com/reference/authentication)
- Create page with templates: [Creating pages from templates](https://developers.notion.com/guides/data-apis/creating-pages-from-templates)

결론:
- **Notion은 Make를 기본 경로로 두지 않는다**
- **Direct write가 최선**

### 2. Google Workspace

권장 구조:
- `앱 또는 Make -> Apps Script Web App -> Google Sheets`
- `Google Sheets`에서 조건부로 Docs/Calendar/Gmail 생성

역할:
- Sheets: 메인 실행 보드
- Docs: 상세 브리프
- Calendar: 일정 자산
- Gmail: 운영 알림 또는 실행 통지

왜 묶는가:
- 한 번의 승인으로 같은 Workspace 자산을 연결하기 쉽다
- 시트를 기준으로 Docs/Calendar/Gmail을 파생시키면 운영이 단순하다
- Looker Studio와 연결이 쉽다

공식 근거:
- Docs 파일은 Drive `files.copy`로 복제 가능: [Document concepts](https://developers.google.com/workspace/docs/api/concepts/document)
- Sheets 생성: [Create a spreadsheet](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/create)
- Calendar 이벤트 생성과 사용자 지정 event ID: [Create events](https://developers.google.com/workspace/calendar/api/guides/create-events)
- MailApp은 send-only 최소 권한: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- Apps Script quotas: [Quotas](https://developers.google.com/apps-script/guides/services/quotas)

결론:
- **Google Workspace는 Sheets를 메인으로 묶는 것이 최선**

### 3. Gmail

권장 구조:
- `Apps Script MailApp.sendEmail()`

이유:
- Gmail inbox 권한이 필요 없다
- send-only scope라 재승인 리스크가 작다
- 같은 Apps Script 안에서 Sheets/Docs/Calendar와 같이 운용 가능하다

공식 근거:
- MailApp은 `script.send_mail` scope만 사용하고 Gmail inbox 접근을 요구하지 않는다: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)
- Google 공식 설명상 MailApp은 GmailApp보다 재승인 요구 가능성이 낮다: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)

대안:
- Gmail API direct send는 가능하지만 scope/verification 복잡도가 커질 수 있다
- inbox 조회/라벨/스레드 관리가 필요할 때만 Gmail API를 쓴다

결론:
- **단순 실행 알림은 Gmail API보다 MailApp이 더 적합**

### 4. KakaoTalk

권장 구조:
- 서비스 알림 목적이면 `알림톡`
- 상담/채널 유도 목적이면 `카카오톡 채널`
- 사용자 간 메시지나 친구 간 상호작용이 아니면 `카카오톡 메시지 API`는 기본 경로가 아님

공식 근거:
- 카카오 공식 FAQ는 회원가입/주문/배송/결제 같은 서비스의 자동 안내에는 `알림톡`이 적합하다고 명시한다: [카카오톡 메시지 FAQ](https://developers.kakao.com/docs/latest/ko/kakaotalk-message/faq)
- 같은 FAQ는 사용자 간 소셜 메시지 기능일 때만 카카오톡 메시지 API를 쓰라고 구분한다: [카카오톡 메시지 FAQ](https://developers.kakao.com/docs/latest/ko/kakaotalk-message/faq)
- 카카오톡 메시지 API는 서비스 사용자 간 상호작용용이며 quota/승인 제한이 있다: [카카오톡 메시지 이해하기](https://developers.kakao.com/docs/latest/ko/kakaotalk-message), [Quota](https://developers.kakao.com/docs/latest/en/getting-started/quota)

결론:
- **VOXERA 같은 실행 알림에는 카카오 Developers 메시지 API가 아니라 알림톡/비즈메시지가 최선**
- **상담 진입은 카카오톡 채널 링크/1:1 채팅 연결로 보완**

## Make.com의 최종 위치

권장 구조:
- `Make = 인입 라우터 또는 보조 분기기`

### Notion
- 기본은 direct write
- Make 비권장

### Google Workspace
- Apps Script Web App로 POST할 때 Make를 중간 라우터로 둘 수 있다
- 단, 핵심 비즈니스 로직은 Apps Script 또는 backend에 둔다

### KakaoTalk
- Kakao 알림톡은 대개 파트너/비즈니스 시스템을 거친다
- Make는 파트너 API 호출용 보조 라우터 정도로만 쓴다

결론:
- **Make는 메인 시스템이 아니라 연결부에만 쓴다**

## Google Workspace 3개를 묶을 때 장점

여기서 말하는 3개는:
- Sheets
- Docs
- Calendar

실무 장점:

1. 승인 흐름 단순화
- 같은 Google 계정으로 연결 가능

2. 시트를 메인 보드로 두고 Docs/Calendar를 row에 연결 가능
- 운영자가 한 화면에서 실행과 자산을 같이 본다

3. Looker Studio 연결이 쉬움
- Dashboard Feed만 읽으면 된다

4. 메일과도 자연스럽게 연결됨
- 같은 Apps Script에서 MailApp 사용 가능

5. 운영 위치가 한곳으로 고정됨
- docs, 일정, 메일, 보드를 따로 관리하지 않아도 된다

## 실전 권장 아키텍처

1. 앱 음성 처리
- 앱 -> backend

2. Notion
- backend -> Notion direct write

3. Google Workspace
- backend 또는 Make -> Apps Script Web App
- Inbox -> Execution Board -> Docs/Calendar/Gmail

4. KakaoTalk
- 실행 알림: 알림톡
- 상담 유도: 카카오톡 채널

## 최종 권장안 한 줄

- Notion: direct write
- Google Workspace: Sheets 중심 묶음
- Gmail: MailApp
- KakaoTalk: 알림톡/채널
