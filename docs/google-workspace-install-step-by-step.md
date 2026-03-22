# VOXERA Google Workspace 설치 가이드

이 문서는 **Google Sheets 안에서 VOXERA 모달 대시보드**를 실제로 띄우기 위한 가장 쉬운 설치 순서입니다.

이번 버전은:
- 시트 셀을 꾸미는 방식이 아닙니다.
- 상단 메뉴 `VOXERA > 대시보드 열기`를 누르면 **큰 모달 대시보드**가 뜹니다.
- `Code.simple.ko.gs` 와 `Dashboard.html` **두 파일이 모두 필요합니다.**

---

## 준비물

- Google 계정
- 새 Google 스프레드시트 1개
- 아래 두 파일
  - [Code.simple.ko.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.simple.ko.gs)
  - [Dashboard.html](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Dashboard.html)

---

## 1단계. 새 스프레드시트 만들기

1. Google Drive를 엽니다.
2. `새로 만들기`를 누릅니다.
3. `Google 스프레드시트`를 누릅니다.
4. 파일 이름을 아래처럼 바꿉니다.

```text
VOXERA 실행 대시보드
```

---

## 2단계. Apps Script 열기

1. 방금 만든 시트를 엽니다.
2. 상단 메뉴에서 `확장 프로그램`을 누릅니다.
3. `Apps Script`를 누릅니다.
4. 새 탭이 열립니다.

---

## 3단계. Code.gs 교체

1. 왼쪽 파일 목록에서 `Code.gs`를 누릅니다.
2. 기본으로 들어 있는 코드를 전부 지웁니다.
3. 아래 파일의 내용을 **처음부터 끝까지 전부 복사**합니다.

[Code.simple.ko.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.simple.ko.gs)

4. Apps Script 편집기에 붙여넣습니다.
5. `Ctrl + S`로 저장합니다.

---

## 4단계. Dashboard HTML 파일 추가

이 단계가 빠지면 대시보드가 안 뜹니다.

1. 왼쪽 파일 목록 위쪽의 `+` 버튼을 누릅니다.
2. `HTML`을 선택합니다.
3. 파일 이름을 정확히 아래처럼 입력합니다.

```text
Dashboard
```

4. 새로 열린 HTML 파일 안의 기본 코드를 전부 지웁니다.
5. 아래 파일의 내용을 **처음부터 끝까지 전부 복사**합니다.

[Dashboard.html](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Dashboard.html)

6. Apps Script 편집기에 붙여넣습니다.
7. `Ctrl + S`로 저장합니다.

---

## 5단계. 첫 실행

1. 상단 함수 선택 칸에서 `setupSystem`을 고릅니다.
2. `실행` 버튼을 누릅니다.
3. 권한 허용 창이 뜨면 계속 진행합니다.
4. 경고 화면이 뜨면 하단의 `안전하지 않음` 링크로 계속 진행합니다.
5. 실행이 끝나면 시트로 돌아갑니다.

---

## 6단계. 반드시 새로고침

이 단계가 중요합니다.

1. 스프레드시트 탭으로 돌아갑니다.
2. `Ctrl + F5` 또는 브라우저 새로고침을 합니다.
3. 상단 메뉴에 `VOXERA`가 생겼는지 확인합니다.

정상이라면 메뉴에 아래가 보입니다.
- `대시보드 열기`
- `받은 음성함 열기`
- `실행 보드 열기`
- `설정 열기`

---

## 7단계. 대시보드 열기

1. 상단 메뉴 `VOXERA`를 누릅니다.
2. `대시보드 열기`를 누릅니다.
3. 큰 모달 창이 뜨면 정상입니다.

이 창이 바로 VOXERA HTML 대시보드입니다.

---

## 8단계. 시트 생성 확인

이제 아래 3개 탭이 보여야 합니다.

- `받은 음성함`
- `실행 보드`
- `설정`

---

## 9단계. 설정 입력

`설정` 탭에서 아래 값들을 채웁니다.

### 기본 담당자
- 예: `대표자명`

### 문서 폴더 ID
- Google Docs를 저장할 드라이브 폴더 ID
- 아직 폴더가 없으면 Google Drive에서 폴더를 먼저 하나 만듭니다.

### 캘린더 ID
- 기본 캘린더면 `primary`

### 알림 메일 사용
- `true` 또는 `false`

### 알림 메일 주소
- 실행 전환 알림을 받을 메일 주소

### 웹훅 비밀키
- 외부 POST 요청을 검증할 비밀 문자열
- 예:

```text
voxera_super_secret_2026_abc123
```

### 기본 일정 시작 시각
- 예: `09`

### 기본 일정 길이(분)
- 예: `30`

---

## 10단계. 테스트 데이터 넣기

`받은 음성함` 탭에 아래처럼 한 줄 넣습니다.

| 받은 시각 | 요청 ID | 말한 사람 | 한 줄 요약 | 실행 항목 | 우선순위 | 마감일 | 문서 필요 | 일정 필요 | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| 지금 시각 | test-001 | 대표님 | 금요일까지 간략 보고서 초안 작성 | 간략 보고서 초안 작성 | 높음 | 오늘 또는 원하는 날짜 | 예 | 예 | 실행전환 |

잠깐 기다리면 `실행 보드`에 항목이 생깁니다.

---

## 11단계. 결과 확인

### 실행 보드
- 새 줄이 생겼는지 확인
- `문서` 칸에 `문서 열기`
- `일정` 칸에 `일정 보기`

### 문서
- `문서 열기`를 누르면 Google Docs가 열리는지 확인

### 일정
- `일정 보기`를 누르면 Google Calendar가 열리는지 확인

### 대시보드
- `VOXERA > 대시보드 열기`
- KPI 숫자와 미리보기 카드가 보이는지 확인

---

## 파일을 찾을 수 없다고 뜰 때

아래를 순서대로 확인합니다.

1. Apps Script에 `Dashboard` HTML 파일이 실제로 있는지
2. 파일 이름이 정확히 `Dashboard`인지
3. `Code.gs`가 아니라 **[Code.simple.ko.gs](/Users/Master/.codex/worktrees/87ac/Playground/integrations/google-workspace/Code.simple.ko.gs)** 최신 내용으로 교체했는지
4. 저장했는지
5. 시트를 새로고침했는지
6. `VOXERA` 메뉴를 다시 눌렀는지

---

## 가장 자주 틀리는 것

### 1. HTML 파일 이름이 다름
- `Dashboard.html` 파일을 추가할 때 이름을 `Dashboard`로 만들어야 합니다.

### 2. 저장 안 함
- `Ctrl + S`로 저장하지 않으면 메뉴가 옛 코드를 씁니다.

### 3. 시트 새로고침 안 함
- 새로고침 안 하면 `VOXERA` 메뉴가 갱신되지 않습니다.

### 4. Code.gs만 넣고 HTML 파일은 안 넣음
- 이번 구조는 **두 파일이 모두 필요**합니다.

---

## 한 줄 요약

1. `Code.simple.ko.gs` 넣기  
2. `Dashboard.html` 넣기  
3. `setupSystem()` 실행  
4. 시트 새로고침  
5. `VOXERA > 대시보드 열기`
