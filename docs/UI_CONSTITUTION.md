# UI Constitution

## Permanent Asset Delivery Rule

- 로컬 이미지 에셋을 Notion, Google Sheets, Google Docs, Slides, 또는 기타 외부 렌더링 표면에 주입할 때는 임시 이미지 호스팅 서비스(예: `0x0.st`, Imgur 등)를 절대 사용하지 않는다.
- 모든 UI 에셋은 반드시 저장소에 커밋하고 원격 GitHub 저장소에 푸시한 뒤, `raw.githubusercontent.com` 기반의 영구 Raw URL을 사용한다.
- 표준 포맷:
  - `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/assets/...`
- Notion 커버/아이콘 업데이트, Apps Script 이미지 렌더링, 외부 시스템 asset injection은 모두 이 Raw URL만 사용한다.

## Enforcement

- 임시 호스팅 URL을 발견하면 UI 자산 주입 작업은 실패로 간주한다.
- Raw URL이 아직 존재하지 않으면:
  1. 로컬 에셋을 저장소에 추가한다.
  2. 커밋한다.
  3. 원격 브랜치에 푸시한다.
  4. Raw URL을 생성한다.
  5. 그 URL로만 외부 시스템을 업데이트한다.
