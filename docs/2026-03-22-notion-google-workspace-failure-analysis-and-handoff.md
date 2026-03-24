# VOXERA 인수인계 보고서
## Notion 템플릿 / 시각화 대시보드 실패 원인 + Google Workspace 현재 구조 + Make 연동 방식

- 작성일: 2026-03-22
- 목적: 어제 Notion/Google Workspace 작업에서 무엇이 왜 실패했는지, 현재 무엇이 적용되었는지, 내일 개발팀이 어디서부터 이어받아야 하는지를 한 문서로 명확히 정리
- 범위:
  - Notion direct-write 선회 이유와 공식 근거
  - Notion 템플릿 / 시각화 대시보드 실패 원인
  - Google Workspace 템플릿/대시보드 작업 경과와 실패 원인
  - Google Sheets를 메인으로 두고 Docs / Calendar / Mail을 조건부 자산으로 설계한 이유
  - Google Workspace를 Make.com 및 우리 서비스와 연동하는 구체적 방식
  - 현재 적용 완료 / 미완료 / 내일 테스트 범위

---

## 0. 한 줄 결론

1. **Notion은 Make.com을 거치지 않고 백엔드가 direct-write 하는 방향으로 선회하는 것이 맞다.**
2. **다만 Notion은 system-of-record가 아니라 협업 표면(collaboration surface)으로 써야 한다.** 즉 `Internal DB-first + Async Notion Sync`가 정답이다.
3. **Google Workspace는 Google Sheets를 메인 실행 보드로 두고, Docs / Calendar / Mail은 필요할 때만 생성되는 연결 자산으로 설계하는 것이 맞다.**
4. **Google Sheets의 셀을 SVG처럼 꾸며서 웹앱 대시보드를 흉내 내는 방식은 실패했다.** 실제 적용 가능한 방향은 `Apps Script HTML Modal Dashboard`다.
5. **KakaoTalk은 비즈니스 계정/템플릿 승인 절차가 남아 있으므로 지금 단계에서는 의도적으로 제외한다.**

---

## 1. 현재 제품 아키텍처 전제

이 보고서는 아래 전제를 유지한다.

- 오디오 엔진: `AudioWorklet + PCM over WSS only`
- 녹음 하드컷: `정확히 15초`
- 중복 잠금: `clientRequestId` 동기 생성 후 업로드 시작
- 상태 머신: `idle / permission-requesting / ready / recording / stopping / uploading / success / error`

즉, 이번 보고서는 협업 도구/운영 시스템 설계 보고서이지, 프런트 음성 파이프라인 구조를 다시 바꾸는 문서가 아니다.

---

## 2. Notion direct-write로 선회한 이유

## 2-1. 이전 후보 구조

기존에 열려 있던 구조는 다음과 같았다.

- `앱 -> 백엔드 -> Make.com -> Notion`

이 구조의 문제는 다음과 같았다.

1. 경로가 길다.
2. 실패 지점이 늘어난다.
3. 디버깅 위치가 분산된다.
4. `clientRequestId` 기반 멱등성과 중복 방어를 끝까지 백엔드가 책임지기 어렵다.

## 2-2. 선회 후 구조

현재 우리가 확정한 방향은 다음과 같다.

- `앱 -> 백엔드 -> Internal DB -> Queue -> Worker -> Notion`

핵심은 두 가지다.

1. **Notion 경로에서 Make.com 제거**
2. **Notion 앞에 Internal DB-first 구조 삽입**

즉, “Notion direct-write”는 맞지만, 정확히는 **“DB-first + Async Notion direct-write”**다.

## 2-3. 공식 근거

### A. Notion OAuth와 권한 연결
- Notion Public Integration은 OAuth 2.0 기반 연결이 공식 경로다.
- 출처: [Notion Authorization](https://developers.notion.com/guides/get-started/authorization)

### B. 템플릿 적용 / 페이지 생성
- Notion은 페이지 생성과 템플릿 기반 생성 흐름을 공식 지원한다.
- 출처:
  - [Create a page](https://developers.notion.com/reference/post-page)
  - [Creating pages from templates](https://developers.notion.com/docs/creating-pages-from-templates)

### C. Request limit
- Notion API는 integration당 평균 초당 3 requests 수준의 request limit을 문서화한다.
- 429 시 `Retry-After`를 따라야 한다.
- 출처: [Notion Request Limits](https://developers.notion.com/reference/request-limits)

## 2-4. 최종 판단

Notion direct-write는 맞다.

하지만 아래 방식으로만 맞다.

- `앱 -> 백엔드 -> Internal DB 저장`
- `Internal DB -> Queue`
- `Queue -> Worker`
- `Worker -> Notion 받는 음성함 data source write`

즉, **Notion을 직접 쓰되, Notion을 진실 원본으로 두지 않는다.**

---

## 3. Notion 템플릿 / 시각화 대시보드 실패 원인

어제 Notion에서 두 종류의 실패가 있었다.

1. 템플릿/레이아웃 자체는 만들 수 있었지만, **우리가 확정한 웹앱 가이드라인의 미감과 구조를 재현하지 못했다.**
2. Agent가 만든 결과물은 “구조를 흉내 낸 노션 페이지”였지, “실행형 홈 대시보드”는 아니었다.

## 3-1. 실패 원인 A: 노션이 웹앱처럼 렌더링되지 않는다

우리가 원하는 것은 아래였다.

- 상단 KPI 카드 4개
- 중단: `받은 음성함 -> 실행 전환 -> 실행 보드`
- 하단 빠른 링크
- 카드 간 간격 / 배치 / 시각 흐름이 웹앱처럼 정리된 홈 화면

하지만 Notion은 기본적으로 다음 제약이 있다.

1. absolute positioning이 없다.
2. 자유로운 카드 레이아웃 제어가 어렵다.
3. block 단위 흐름이라 “픽셀 단위” 조정이 안 된다.
4. 데이터베이스 뷰가 박스 폭/높이/정렬에 큰 영향을 준다.

즉, **SVG 시각안의 느낌을 노션 블록만으로 그대로 복제하려 한 것 자체가 무리였다.**

## 3-2. 실패 원인 B: Agent 결과물이 구조만 맞고 미감은 틀렸다

실제 실패 사례:

1. KPI 카드가 숫자 카드가 아니라 “빈 리스트 카드”처럼 보였다.
2. 가운데 `실행 전환`이 흐름 노드가 아니라 어색한 큰 박스로 나왔다.
3. `받은 음성함`, `실행 보드` linked database 폭이 좁아 잘려 보였다.
4. 영어 표기(`Voice Inbox`, `Execution Board`)가 남았다.
5. 커버/아이콘/중복 제목 등 불필요한 장식이 남았다.
6. 하단 `실행 가이드`가 단순 링크가 아니라 실제 페이지 블록처럼 한 번 더 노출됐다.

즉, **Agent는 구조만 비슷하게 만들었고, 사용자가 처음 보는 “메인 홈 대시보드”의 감각은 살리지 못했다.**

## 3-3. 실패 원인 C: Notion에서 “실행 전환”을 시각 요소로만 처리하기 어려웠다

웹앱에서는 `받은 음성함 -> 실행 전환 -> 실행 보드`를 중앙 흐름 요소로 자연스럽게 표현할 수 있다.

하지만 노션에서는:

- 가운데 노드 배치가 어색하고
- 좌우 DB 폭과 간격이 매번 흔들리고
- 흐름 요소가 너무 크거나 너무 약하게 보이는 문제가 계속 발생했다.

즉, **노션에서 이 흐름은 '강한 UI 구조'가 아니라 '약한 시각 힌트' 정도로만 표현해야 맞다.**

## 3-4. Notion 쪽 최종 교훈

Notion에서는 아래만 노려야 한다.

1. **홈 대시보드 구조**
2. **짧은 KPI**
3. **받은 음성함 / 실행 보드 linked DB 2열**
4. **과한 시각 연출 금지**

즉, **Notion은 웹앱처럼 만들지 말고, 노션 안에서 가장 깔끔한 실행 대시보드로 만들어야 한다.**

---

## 4. Google Workspace 템플릿 작업: 현재 적용한 방식

## 4-1. 현재 구조

현재 적용 방향은 다음과 같다.

- `Google Sheets = 메인 실행 보드`
- `Google Docs = 조건부 상세 문서`
- `Google Calendar = 조건부 일정`
- `Google Mail = 조건부 알림`
- `Apps Script HTML Modal Dashboard = 사용자가 보는 첫 화면`

즉, **시트는 데이터/실행 엔진이고, 실제 대시보드 UI는 Apps Script HTML 모달**이다.

## 4-2. 실제 적용 파일

현재 기준 핵심 파일은 아래다.

- [Code.simple.ko.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.simple.ko.gs)
- [Dashboard.html](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Dashboard.html)

적용 방식:

1. Google Spreadsheet 생성
2. Apps Script 열기
3. `Code.gs`에 `Code.simple.ko.gs` 붙여넣기
4. HTML 파일 `Dashboard` 생성
5. `Dashboard.html` 붙여넣기
6. `setupSystem()` 실행
7. 시트 새로고침
8. `VOXERA > 대시보드 열기`

## 4-3. 현재 동작 방식

### 시트 구조
- `받은 음성함`
- `실행 보드`
- `설정`

### 대시보드 동작
- Apps Script `showModalDialog()`로 HTML UI 표시
- 첫 방문 1회 자동 오픈
- 이후에는 `VOXERA > 대시보드 열기`

### 데이터 흐름
1. 외부에서 구조화된 payload 수신
2. Apps Script Web App `doPost(e)`로 `받은 음성함` 적재
3. 사용자가 `상태 = 실행전환`
4. `실행 보드`에 실제 할 일 생성
5. 조건 충족 시 Docs / Calendar / Mail 생성
6. `실행 보드` row에 연결 링크 저장
7. HTML 대시보드에서 버튼으로 접근

---

## 5. 왜 SVG 시각안으로 Google Sheets 대시보드를 구현하려 했고, 왜 실패했는가

## 5-1. 시도한 방식

우리는 처음에 다음 접근을 시도했다.

1. SVG로 이상적인 대시보드 구조를 먼저 설계
2. 그 구조를 Google Sheets 셀 배치/색상/병합/테두리로 흉내
3. 실제 시트가 웹앱형 홈 대시보드처럼 보이게 만들기

## 5-2. 실패 원인

이 접근은 실패했다. 이유는 아래와 같다.

### A. Google Sheets는 웹 레이아웃 엔진이 아니다
- 셀 기반 격자 구조
- 픽셀 단위 자유 배치 불가
- 카드형 absolute layout 불가
- 클릭 요소를 자연스럽게 배치하기 어려움

즉, **SVG에서 가능한 자유로운 카드 구조가 셀 그리드에 들어가면 그냥 색칠된 표가 된다.**

### B. 시트 격자가 너무 강하게 보인다
- 행/열 경계가 남는다
- 카드가 아니라 셀 병합 블록처럼 보인다
- 버튼도 앱 버튼이 아니라 색칠된 셀처럼 보인다

결과적으로 사용자는 “대시보드”가 아니라 **“색칠된 시트”**로 받아들였다.

### C. 인터랙션이 UX와 어긋났다
- SVG에서 버튼처럼 보인 요소가 실제론 클릭 동작을 자연스럽게 갖기 어려웠다.
- 시트 셀은 문서/캘린더/이동 버튼을 앱처럼 처리하기 어렵다.

### D. 시각안과 실제 구현 매체가 달랐다
SVG는 자유 배치 캔버스다.
Google Sheets는 표다.

즉, **설계 매체와 구현 매체가 달라서, 아무리 맞추려 해도 결과가 어색할 수밖에 없었다.**

## 5-3. 최종 교훈

Google Sheets는:

- 데이터 입력/조회/상태 변경
- row 기반 실행 관리

에는 좋다.

하지만:

- 카드형 홈 대시보드
- 화사한 앱형 UI
- 흐름형 시각 구조

에는 맞지 않는다.

그래서 최종 방향은 **`Sheets = 데이터`, `Apps Script HTML = UI`** 로 바꿨다.

---

## 6. Google Sheets를 메인으로 두고 Docs / Calendar / Mail은 조건부 자산으로 설계한 이유

## 6-1. 왜 Sheets가 메인인가

Google Workspace를 사용자 친화적으로 만들려면 “메인이 하나”여야 한다.

Docs, Sheets, Calendar, Mail을 동등한 메인으로 두면 초보자는 바로 길을 잃는다.

그래서 다음처럼 설계했다.

- `받은 음성함` = 검토용 인입함
- `실행 보드` = 실제 할 일 관리
- 나머지는 row에 연결되는 부속 자산

## 6-2. Docs를 메인에서 뺀 이유

Docs는 문서 작성에 좋지만, 업무 전체 관제탑으로는 약하다.

- 할 일 상태를 한눈에 보기 어려움
- 담당자/우선순위/상태/마감일 관리에 부적합
- 문서가 많아지면 찾기 어려움

따라서 Docs는:

- 보고서
- 회의록
- 브리프
- 제안서

처럼 **필요할 때만 자동 생성되는 상세 문서 자산**으로 두는 게 맞다.

## 6-3. Calendar를 메인에서 뺀 이유

Calendar는 “시간이 있는 항목”에만 적합하다.

모든 실행 항목을 Calendar에 넣으면:

- 단순 아이디어도 일정처럼 보이고
- 메인 캘린더가 오염되고
- 실행 관리가 아니라 일정 관리로 변질된다.

그래서 Calendar는:

- 마감일이 분명한 경우
- 일정 필요가 `예`인 경우

에만 생성해야 한다.

## 6-4. Mail을 메인에서 뺀 이유

Mail은 알림 도구다.

메인 작업 화면으로 쓰면 안 된다.

Mail은:

- 실행 전환 알림
- 마감 임박 알림
- 실패/보류 알림

정도로만 써야 한다.

## 6-5. 최종 장점

이 구조의 장점은 다음과 같다.

1. 사용자는 메인 화면을 하나만 기억하면 된다.
2. 모든 상태는 Sheets row에서 관리된다.
3. 문서/일정/알림은 필요할 때만 보인다.
4. Looker Studio 연동도 쉬워진다.
5. Apps Script에서 한 프로젝트로 통제 가능하다.

즉, **Google Workspace에서 가장 단순하고 가장 실행 중심적인 구조**다.

---

## 7. Google Workspace를 Make.com과 연동하는 구체적 방식

## 7-1. Make.com의 역할

Google Workspace에서 Make.com은 **메인 엔진이 아니라 인입 라우터** 역할만 맡는 것이 맞다.

즉, Make.com이 해야 할 일은 아래 정도다.

1. 우리 서비스에서 webhook 수신
2. payload 정리
3. Apps Script Web App endpoint로 POST 전달

즉, **비즈니스 로직은 Apps Script / 백엔드가 맡고, Make.com은 전달자 역할만 한다.**

## 7-2. Make.com -> Apps Script payload

Make.com이 보내야 할 최소 payload 예시는 아래와 같다.

```json
{
  "source_id": "voice-req-001",
  "created_at": "2026-03-22T10:00:00+09:00",
  "speaker": "대표님",
  "summary": "금요일까지 간략 보고서 초안 작성",
  "action_items": "간략 보고서 초안 작성 / 검토 일정 준비",
  "urgency": "높음",
  "due_date": "2026-03-27",
  "requires_doc": true,
  "requires_calendar": true,
  "status": "검토전"
}
```

Apps Script는 이를 `받은 음성함`에 적재한다.

## 7-3. Apps Script Web App 쪽 처리

1. `doPost(e)` 수신
2. bearer secret 검증
3. payload를 `받은 음성함`에 upsert
4. 사용자가 `상태 = 실행전환`
5. `실행 보드` 생성 + Docs / Calendar / Mail 조건부 생성

즉, Make.com은 여기서 **입력 라우터**일 뿐이다.

---

## 8. 사용자 마찰을 최소화하면서 Google Workspace 템플릿을 복제/연동하는 방식

이 부분은 “현재 내부 검증용 방식”과 “프로덕션 권장 방식”을 나눠 봐야 한다.

## 8-1. 현재 내부 검증용 방식

현재는 다음처럼 수동에 가깝다.

1. 사용자가 Google Spreadsheet 생성 또는 사본 생성
2. Apps Script에 `Code.gs`, `Dashboard` HTML 삽입
3. `setupSystem()` 실행
4. Apps Script Web App 배포
5. Make.com webhook 또는 우리 서비스에서 해당 endpoint로 POST

이건 내부 검증에는 충분하지만, 일반 사용자용 최종 온보딩으로는 마찰이 크다.

## 8-2. 프로덕션 권장 방식

최종적으로는 아래 흐름이 맞다.

### A. Google OAuth 연결
사용자가 우리 서비스에서 `Google Workspace 연결` 버튼 클릭

### B. 템플릿 복제
우리 서비스가 Google Drive API `files.copy`로 마스터 템플릿 Sheet를 사용자 Drive에 복제

공식 근거:
- [Google Drive create/manage files](https://developers.google.com/workspace/drive/api/guides/create-file)
- [Google Docs document concepts](https://developers.google.com/docs/api/concepts/document)
- [Google Sheets create/manage](https://developers.google.com/workspace/sheets/api/guides/create)

### C. Config 초기값 주입
복제된 템플릿의 `설정` 시트에:

- user / workspace 식별값
- webhook secret
- 기본 담당자
- 문서 폴더 / 캘린더 id

를 채운다.

### D. 수집 경로 연결
우리 서비스 또는 Make.com이 해당 사용자 전용 endpoint / sheet identity로 payload를 전송한다.

### E. 사용자 체감
사용자는:

1. Google 연결
2. 템플릿 생성 완료
3. 바로 `받은 음성함` / `실행 보드` 사용

이면 끝나야 한다.

## 8-3. 현실적 주의점

이 부분은 내일 테스트에서 반드시 확인해야 한다.

1. Google Spreadsheet 사본 복제 시 Apps Script 바운드 프로젝트가 어떻게 복사되는지
2. 사용자별 Apps Script Web App endpoint 전략을 갈지, 중앙 엔드포인트 전략을 갈지
3. Drive copy 후 Config 자동 주입이 어느 수준까지 가능한지

즉, **프로덕션용 “완전 자동 복제 + 자동 연결”은 가능성이 높지만, 현재는 내부 검증 단계라 실제 복제/연동 테스트가 남아 있다.**

---

## 9. 현재 적용 완료 / 미완료 / 내일 테스트 범위

## 9-1. 적용 완료

### Notion
- Notion direct-write가 맞다는 구조 판단
- OAuth + template option + direct-write 방향 문서화
- Notion visual blueprint 1차 / 2차 생성

### Google Workspace
- `Code.simple.ko.gs` 작성
- `Dashboard.html` 작성
- Apps Script Modal Dashboard 구조 완성
- `VOXERA` 메뉴 / 첫 방문 1회 자동 오픈 / 수동 재오픈 흐름 완성

## 9-2. 아직 미완료

### Notion
- 실제 레이아웃 최종 마감 안 됨
- Agent 결과물 비주얼 품질 미달
- 홈 대시보드 미감은 아직 수동 정리 필요

### Google Workspace
- 사용자 마찰 최소화된 “자동 템플릿 복제 + 자동 연동”은 아직 최종 실험 전
- Apps Script/Drive copy 전략 최종 확정 전

## 9-3. 내일 테스트 항목

### Notion
1. OAuth 연결
2. template option 적용
3. direct-write payload write
4. `clientRequestId` 기준 중복 방어 검증
5. `받은 음성함`에 page 생성 확인

### Google Workspace
1. Spreadsheet 템플릿 복제
2. Apps Script setupSystem 실행
3. `VOXERA > 대시보드 열기`
4. `받은 음성함` ingest
5. `상태 = 실행전환`
6. `실행 보드` row 생성
7. `문서 열기` / `일정 보기` / Mail 알림 확인

---

## 10. 최종 권고

### Notion
- Make.com 메인 경로에서 제거
- `Internal DB-first + Queue + Async Worker + Notion direct-write`

### Google Workspace
- `Sheets = 메인`
- `Docs / Calendar / Mail = 조건부 자산`
- `Apps Script HTML Modal Dashboard = 사용자 UI`

### KakaoTalk
- 비즈니스 계정 / 알림톡 절차 완료 전까지 보류

---

## 11. 개발팀장이 기억해야 할 핵심 5줄

1. **Notion direct-write는 맞지만, Notion-first는 틀리다. DB-first + async sync로 가야 한다.**
2. **Google Workspace는 Sheets를 메인 실행 보드로 두고, Docs/Calendar/Mail은 row 기반 연결 자산으로만 붙여야 한다.**
3. **Google Sheets 셀을 SVG처럼 꾸며 웹앱 대시보드를 만들려 한 시도는 실패했다. 이유는 구현 매체가 표(grid)이기 때문이다.**
4. **그래서 Google Workspace 대시보드는 Apps Script HTML Modal Dashboard로 전환했고, 이게 현재 적용된 방식이다.**
5. **KakaoTalk은 지금 제외하고, 내일은 Notion direct-write와 Google Workspace 연결만 테스트하면 된다.**

