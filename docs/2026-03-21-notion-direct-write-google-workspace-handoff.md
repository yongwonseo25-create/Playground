# VOXERA 인수인계 문서
## Notion Direct-Write 선회 근거 + Google Workspace 연결 방식

- 작성일: 2026-03-21
- 목적: 내일 개발/적용/테스트를 바로 시작할 수 있도록, 오늘 확정한 구조를 한 문서로 정리
- 범위:
  - Notion을 Make.com 경유가 아니라 **백엔드 direct-write**로 선회한 이유
  - Google Workspace를 **Sheets 중심 실행 관제탑**으로 연결하는 이유와 적용 방법
  - 내일 바로 테스트해야 할 범위
  - 이번 단계에서 **보류**한 것: KakaoTalk 비즈니스 계정/알림톡 절차

---

## 1. 오늘 확정한 핵심 결론

### 1-1. Notion
- **최종 방향:** `백엔드 -> Notion API direct-write`
- **의미:** 음성 결과를 Make.com에 먼저 태우지 않고, 백엔드가 사용자의 Notion 워크스페이스 안 `받은 음성함`에 직접 적재
- **온보딩 방향:** `Notion OAuth + template option`으로 템플릿 복제/연결 마찰 최소화

### 1-2. Google Workspace
- **최종 방향:** `Google Sheets = 메인 실행 관제탑`
- **의미:** Docs / Calendar / Gmail을 각각 따로 메인으로 두지 않고, 전부 Sheets row에 연결되는 실행 자산으로 사용
- **UI 방향:** 시트 셀 꾸미기 방식 폐기, **Apps Script HTML Modal Dashboard** 사용

### 1-3. KakaoTalk
- **오늘 결론:** 아직 붙이지 않음
- **이유:** 비즈니스 계정/템플릿 승인/공급사 절차가 남아 있으므로 후순위

---

## 2. Notion을 Direct-Write로 선회한 이유

## 2-1. 왜 Make.com을 빼는가

오늘 결론은 **Notion만큼은 Make.com을 메인 경로로 두지 않는 것이 맞다**는 것입니다.

이유는 아래와 같습니다.

1. **경로가 짧아진다**
- 기존: `앱 -> 백엔드 -> Make.com -> Notion`
- 선회안: `앱 -> 백엔드 -> Notion`
- 홉이 하나 줄어들어 장애 지점, 디버깅 지점, 재시도 지점이 줄어듭니다.

2. **권한과 목적지가 더 명확하다**
- Make를 중간에 두면 “누가 최종 목적지인지”, “어디서 실패했는지”가 흐려집니다.
- Notion direct-write는 백엔드가 **명확히 한 데이터소스(data source)** 를 대상으로 씁니다.

3. **멱등성/중복 방어를 백엔드에서 직접 통제할 수 있다**
- VOXERA는 원래 `clientRequestId` 기반 중복 잠금이 핵심입니다.
- Notion까지 direct-write로 가야 이 잠금 흐름을 백엔드에서 끝까지 붙잡을 수 있습니다.

4. **Notion은 API 자체가 충분히 직접 적재에 적합하다**
- Notion 공식 문서는 OAuth, page create, template 기반 page create를 모두 지원합니다.

---

## 2-2. 검증된 공식 근거

### A. OAuth + 설치/권한 연결
- Notion Public Integration은 OAuth 2.0으로 연결하는 것이 공식 경로입니다.
- 공식 문서: [Authorization](https://developers.notion.com/guides/get-started/authorization)

### B. 템플릿 적용/복제
- Notion은 템플릿 기반으로 새 페이지를 만들 수 있습니다.
- 템플릿은 API에서 `template[type]=default` 또는 `template_id` 방식으로 적용할 수 있습니다.
- 공식 문서: [Creating pages from templates](https://developers.notion.com/docs/creating-pages-from-templates)

### C. 실제 적재
- Notion은 `Create a page` API로 data source 아래에 새 page를 만들 수 있습니다.
- 공식 문서: [Create a page](https://developers.notion.com/reference/post-page)

### D. 중요한 기술 포인트
- 템플릿 적용은 **비동기**입니다.
- 즉, 페이지 create 응답 직후에는 비어 있고, 뒤에서 템플릿이 적용됩니다.
- 그래서 백엔드는:
  1. 페이지 생성
  2. 생성 page id 저장
  3. 필요한 경우 템플릿 적용 완료를 기다리는 후속 처리
  를 가져야 합니다.

---

## 2-3. 최종 판단

Notion은 아래 방식이 최적입니다.

### 권장 구조
1. 사용자 OAuth 연결
2. 템플릿 옵션으로 워크스페이스 안에 VOXERA 템플릿 준비
3. 백엔드가 `받은 음성함` data source id를 식별
4. 백엔드가 음성 결과를 직접 page create

### 오늘 결론
- **Notion은 direct-write가 최선**
- **Make.com은 Notion 메인 경로에서 제외**

---

## 3. Google Workspace를 Sheets 중심으로 묶은 이유

## 3-1. 왜 Sheets를 메인으로 두는가

Google Workspace는 Docs, Sheets, Calendar, Gmail이 따로 놀면 초보 사용자에게 너무 복잡해집니다.

그래서 오늘 확정한 구조는:

- `Sheets = 메인 실행 보드`
- `Docs = 조건부 상세 문서`
- `Calendar = 조건부 일정`
- `Gmail = 조건부 알림`

즉, **모든 실행 흐름의 중심은 Sheets row** 입니다.

---

## 3-2. 이렇게 묶는 장점

1. **사용자가 메인 화면을 하나만 기억하면 된다**
- 시트 한 곳만 보면 됨

2. **문서/일정/메일이 모두 특정 row에 연결된다**
- 문서 링크
- 일정 링크
- 알림 발송 상태

3. **운영자가 헷갈리지 않는다**
- “진짜 해야 할 일”은 항상 실행 보드 row로 관리

4. **Looker Studio와 연결하기 쉽다**
- Sheets 한 소스를 기준으로 KPI를 뽑을 수 있음

5. **Apps Script에서 한 프로젝트로 처리 가능하다**
- SpreadsheetApp
- DocumentApp / DriveApp
- CalendarApp
- MailApp

---

## 3-3. Google 공식 근거

### HTML UI
- Sheets 바운드 스크립트는 HTML 기반 dialog/sidebar를 공식 지원합니다.
- 공식 문서:
  - [Dialogs and Sidebars](https://developers.google.com/apps-script/guides/dialogs)
  - [HTML Service](https://developers.google.com/apps-script/guides/html)
  - [Templated HTML](https://developers.google.com/apps-script/guides/html/templates)

### 메일
- MailApp은 Gmail inbox 접근이 없고, 단순 발송에 더 적합합니다.
- 공식 문서: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)

---

## 4. 오늘 확정한 Google Workspace 구조

## 4-1. 사용자에게 보이는 탭
- `받은 음성함`
- `실행 보드`
- `설정`

## 4-2. 사용자 UI
- 시트 셀로 대시보드를 꾸미는 방식은 실패로 판단
- 최종 방향은 **Apps Script HTML Modal Dashboard**

### 이유
- Sheets 셀만으로는 앱 같은 대시보드 퀄리티가 나오지 않음
- HTML Modal은 KPI / 받은 음성함 / 실행 보드 / Docs / Calendar 버튼을 더 자연스럽게 보여줄 수 있음

---

## 4-3. 사용자 흐름

1. 사용자가 시트를 처음 열면
2. 첫 방문 1회만 대시보드 모달 자동 오픈
3. 이후엔 `VOXERA > 대시보드 열기`
4. 받은 음성함 검토
5. `상태 = 실행전환`
6. 실행 보드에 row 생성
7. 조건이 맞으면 Docs / Calendar / Mail 연결

---

## 5. Google Workspace 현재 연결 방식

## 5-1. Apps Script 프로젝트 구성

필수 파일:
- `Code.gs`
- `Dashboard.html`

현재 작업 결과물 원본 경로:
- [Code.simple.ko.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.simple.ko.gs)
- [Dashboard.html](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Dashboard.html)

---

## 5-2. 적용 순서

1. 새 Google Spreadsheet 생성
2. `확장 프로그램 -> Apps Script`
3. `Code.gs` 전체 삭제 후 `Code.simple.ko.gs` 붙여넣기
4. `+ -> HTML`로 `Dashboard` 파일 생성
5. `Dashboard.html` 내용 붙여넣기
6. 저장
7. `setupSystem()` 실행
8. 권한 승인
9. 스프레드시트 새로고침
10. 상단 `VOXERA` 메뉴 확인

---

## 5-3. 동작 방식

### 메뉴
- `VOXERA > 대시보드 열기`
- `VOXERA > 받은 음성함 열기`
- `VOXERA > 실행 보드 열기`
- `VOXERA > 설정 열기`

### 첫 방문
- 사용자별 + 스프레드시트별 1회만 자동 오픈

### 테스트 리셋
- `resetDashboardWelcomeState()` 실행 후 새로고침하면 첫 방문 상태 재테스트 가능

---

## 5-4. Docs / Calendar는 어떻게 열리나

이건 별도 탭으로 메인에 박아두지 않습니다.

동작은 아래와 같습니다.

1. `받은 음성함` row에서 조건 충족
- `문서 필요 = 예`
- `일정 필요 = 예`

2. `상태 = 실행전환`

3. Apps Script가:
- Google Docs 문서 생성
- Google Calendar 일정 생성

4. `실행 보드` row에:
- 문서 링크
- 일정 링크
를 저장

5. HTML 대시보드에서:
- `문서 열기`
- `일정 보기`
버튼으로 접근

즉, **Docs/Calendar는 실행 보드 row에 붙는 실행 자산**입니다.

---

## 6. 내일 테스트 범위

## 6-1. Notion

내일 테스트 목표:
- OAuth 연결
- 템플릿/워크스페이스 연결 확인
- `받은 음성함` direct-write 시도
- page create 성공 여부 확인

테스트 포인트:
- 사용자가 템플릿 연결 후 별도 Make 경유 없이 적재 가능한가
- `clientRequestId` 기반 중복 방어가 백엔드에서 유지되는가
- 템플릿 비동기 적용 문제 없이 `받은 음성함`에 정상 적재되는가

---

## 6-2. Google Workspace

내일 테스트 목표:
- `setupSystem()` 정상 완료
- `VOXERA` 메뉴 정상 표시
- 첫 방문 자동 오픈 확인
- `받은 음성함 -> 실행전환 -> 실행 보드` 동작 확인
- Docs 생성 확인
- Calendar 생성 확인
- 문서 열기 / 일정 보기 버튼 연결 확인

---

## 7. KakaoTalk은 왜 오늘 제외했는가

KakaoTalk은 기능 설계보다 **비즈니스 승인 절차**가 먼저입니다.

즉 오늘 결론:
- KakaoTalk은 보류
- Google / Notion 먼저 확정 및 테스트
- Kakao는 비즈니스 계정/템플릿 승인 후 붙인다

따라서 **내일은 Kakao 제외하고 나머지 테스트를 진행하면 됩니다.**

---

## 8. 개발팀장용 최종 판단

### 오늘 기준으로 확정된 것

1. **Notion은 direct-write로 선회**
- 이유: 경로 단축, 디버깅 단순화, 멱등성/중복 통제, 공식 API 적합성

2. **Google Workspace는 Sheets 중심**
- 이유: 실행 관제탑 일원화, Docs/Calendar/Gmail 연결 단순화, 초보 사용자 혼란 감소

3. **Google UI는 Apps Script HTML Modal**
- 이유: 셀 꾸미기 방식은 실패, HTML Modal이 실전 UX에 가장 적합

4. **KakaoTalk은 후순위**
- 이유: 기능보다 비즈니스 승인 절차가 먼저

---

## 9. 내일 바로 할 일

### A. Notion
- OAuth 연결
- template / workspace 연결
- data source 식별
- direct-write 테스트

### B. Google Workspace
- Apps Script 최신본 재확인
- `setupSystem()`
- 모달 대시보드 확인
- test row 투입
- Docs/Calendar 확인

### C. 보류
- KakaoTalk

---

## 10. 참고 공식 문서

### Notion
- [Authorization](https://developers.notion.com/guides/get-started/authorization)
- [Creating pages from templates](https://developers.notion.com/docs/creating-pages-from-templates)
- [Create a page](https://developers.notion.com/reference/post-page)

### Google Apps Script
- [Dialogs and Sidebars](https://developers.google.com/apps-script/guides/dialogs)
- [HTML Service](https://developers.google.com/apps-script/guides/html)
- [Templated HTML](https://developers.google.com/apps-script/guides/html/templates)
- [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)

---

## 최종 한 줄 결론

**내일은 KakaoTalk을 제외하고, Notion direct-write와 Google Workspace HTML 대시보드 + Sheets 중심 실행 구조를 바로 적용/테스트하면 됩니다.**
