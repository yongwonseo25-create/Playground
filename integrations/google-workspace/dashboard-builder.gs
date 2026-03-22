/**
 * VOXERA Google Sheets main dashboard builder.
 *
 * Scope:
 * - Renames first tab to "🚀 VOXERA MAIN 통제실"
 * - Hides gridlines
 * - Styles A1:Z100 like a pastel web dashboard
 * - Creates large button-like merged cells for three primary actions
 * - Optionally binds already-existing drawings to functions if the user inserts them manually
 *
 * Important limitation:
 * Apps Script can read/update existing spreadsheet drawings via getDrawings()/setOnAction(),
 * but it does not expose a method to create brand-new Drawing objects from script alone.
 */

const VOXERA_MAIN_SHEET_NAME = '🚀 VOXERA MAIN 통제실';
const VOXERA_SHEET_BACKGROUND = '#f8fafc';
const VOXERA_PANEL_BACKGROUND = '#ffffff';
const VOXERA_PANEL_BORDER = '#d9e5f2';
const VOXERA_HEADER_TEXT = '#24324a';
const VOXERA_MUTED_TEXT = '#64748b';
const VOXERA_ACTIONS = [
  {
    label: '⚡ 오늘 할 일 취합',
    range: 'C22:H27',
    fill: '#dbeafe',
    border: '#93c5fd',
    font: '#1d4ed8',
    handler: 'runCollectTodayTasks'
  },
  {
    label: '📝 AI 영업일지 병합',
    range: 'J22:O27',
    fill: '#fef3c7',
    border: '#fcd34d',
    font: '#b45309',
    handler: 'runMergeSalesJournal'
  },
  {
    label: '🚀 보고서 자동 생성',
    range: 'Q22:V27',
    fill: '#dcfce7',
    border: '#86efac',
    font: '#15803d',
    handler: 'runGenerateReport'
  }
];

function buildVoxeraMainDashboard() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureMainDashboardSheet_(spreadsheet);

  resetDashboardCanvas_(sheet);
  paintDashboardShell_(sheet);
  paintActionButtons_(sheet);
  paintStatusCards_(sheet);
  paintGuidanceBlock_(sheet);
  bindExistingDrawingsIfPresent_(sheet);

  SpreadsheetApp.flush();
  spreadsheet.toast('VOXERA 메인 통제실 레이아웃을 적용했습니다.', 'VOXERA', 4);
}

function ensureMainDashboardSheet_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  const firstSheet = sheets[0];
  if (firstSheet.getName() !== VOXERA_MAIN_SHEET_NAME) {
    firstSheet.setName(VOXERA_MAIN_SHEET_NAME);
  }

  firstSheet.activate();
  firstSheet.setHiddenGridlines(true);
  firstSheet.setFrozenRows(0);
  firstSheet.setFrozenColumns(0);
  return firstSheet;
}

function resetDashboardCanvas_(sheet) {
  sheet.clear();
  sheet.clearConditionalFormatRules();
  sheet.getRange('A1:Z100')
    .setBackground(VOXERA_SHEET_BACKGROUND)
    .setFontFamily('Noto Sans KR')
    .setFontColor(VOXERA_HEADER_TEXT)
    .setBorder(false, false, false, false, false, false);

  for (let column = 1; column <= 26; column += 1) {
    sheet.setColumnWidth(column, 88);
  }

  for (let row = 1; row <= 100; row += 1) {
    sheet.setRowHeight(row, 28);
  }
}

function paintDashboardShell_(sheet) {
  sheet.getRange('B3:Y9')
    .merge()
    .setBackground('#fffdf8')
    .setBorder(true, true, true, true, false, false, VOXERA_PANEL_BORDER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sheet.getRange('B4:Y5')
    .merge()
    .setValue('VOXERA MAIN 통제실')
    .setFontSize(22)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_HEADER_TEXT);

  sheet.getRange('B6:Y7')
    .merge()
    .setValue('오늘 해야 할 일, 영업일지 병합, 보고서 자동화를 한 화면에서 제어합니다.')
    .setFontSize(11)
    .setFontWeight('normal')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_MUTED_TEXT);
}

function paintActionButtons_(sheet) {
  VOXERA_ACTIONS.forEach((action) => {
    const range = sheet.getRange(action.range);
    range
      .merge()
      .setValue(action.label)
      .setBackground(action.fill)
      .setFontColor(action.font)
      .setFontWeight('bold')
      .setFontSize(15)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, action.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  sheet.getRange('C19:V19')
    .merge()
    .setValue('1-Click 실행 영역')
    .setFontSize(12)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_MUTED_TEXT)
    .setBackground(VOXERA_SHEET_BACKGROUND);
}

function paintStatusCards_(sheet) {
  const cards = [
    { range: 'C12:G16', title: '검토할 음성', value: '0건', fill: '#e0f2fe', border: '#7dd3fc', font: '#0f4c81' },
    { range: 'I12:M16', title: '진행 중 업무', value: '0건', fill: '#fef3c7', border: '#fcd34d', font: '#92400e' },
    { range: 'O12:S16', title: '오늘 마감', value: '0건', fill: '#fae8ff', border: '#f0abfc', font: '#86198f' },
    { range: 'U12:Y16', title: '완료한 업무', value: '0건', fill: '#dcfce7', border: '#86efac', font: '#166534' }
  ];

  cards.forEach((card) => {
    const range = sheet.getRange(card.range);
    range
      .merge()
      .setBackground(card.fill)
      .setBorder(true, true, true, true, false, false, card.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
      .setFontColor(card.font)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontWeight('bold')
      .setFontSize(18)
      .setValue(`${card.title}\n${card.value}`);
  });
}

function paintGuidanceBlock_(sheet) {
  sheet.getRange('B32:Y44')
    .merge()
    .setBackground(VOXERA_PANEL_BACKGROUND)
    .setBorder(true, true, true, true, false, false, VOXERA_PANEL_BORDER, SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('top')
    .setWrap(true)
    .setFontColor(VOXERA_MUTED_TEXT)
    .setFontSize(11)
    .setValue(
      [
        '실행 안내',
        '',
        '• ⚡ 오늘 할 일 취합: 받은 음성함과 실행 보드 기준으로 오늘 액션을 모읍니다.',
        '• 📝 AI 영업일지 병합: 영업일지 초안/컨텍스트를 병합합니다.',
        '• 🚀 보고서 자동 생성: 요약 보고서 생성 플로우를 시작합니다.',
        '',
        '주의: Google Sheets Apps Script는 새 Drawing 객체를 코드만으로 생성하는 API를 제공하지 않습니다.',
        '따라서 실제 드로잉 버튼이 필요하면 시트에 도형을 한 번 수동 삽입한 뒤 아래 bindExistingDrawingsIfPresent_()로 함수만 연결하십시오.'
      ].join('\n')
    );
}

function bindExistingDrawingsIfPresent_(sheet) {
  const drawings = sheet.getDrawings();
  if (!drawings || drawings.length === 0) {
    return;
  }

  drawings.slice(0, VOXERA_ACTIONS.length).forEach((drawing, index) => {
    drawing
      .setOnAction(VOXERA_ACTIONS[index].handler)
      .setWidth(220)
      .setHeight(74);
  });
}

function runCollectTodayTasks() {
  SpreadsheetApp.getActiveSpreadsheet().toast('오늘 할 일 취합 실행', 'VOXERA', 3);
}

function runMergeSalesJournal() {
  SpreadsheetApp.getActiveSpreadsheet().toast('AI 영업일지 병합 실행', 'VOXERA', 3);
}

function runGenerateReport() {
  SpreadsheetApp.getActiveSpreadsheet().toast('보고서 자동 생성 실행', 'VOXERA', 3);
}
