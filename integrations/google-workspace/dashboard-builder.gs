/**
 * VOXERA Google Sheets main dashboard builder.
 *
 * Design rules:
 * - First sheet becomes "🚀 VOXERA MAIN 통제실"
 * - A1:Z100 keeps gridlines off and uses the pastel dashboard background
 * - Master assets 2/3/4 are rendered as over-grid images
 * - Existing drawings can be rebound to real Apps Script handlers if the user
 *   converts the visual buttons into Drawings in the UI
 */

const VOXERA_MAIN_SHEET_NAME = '🚀 VOXERA MAIN 통제실';
const VOXERA_CANVAS_RANGE = 'A1:Z100';
const VOXERA_SHEET_BACKGROUND = '#f8fafc';
const VOXERA_PANEL_BACKGROUND = '#ffffff';
const VOXERA_PANEL_BORDER = '#d9e5f2';
const VOXERA_HEADER_TEXT = '#1f2a44';
const VOXERA_MUTED_TEXT = '#64748b';
const VOXERA_ACTION_HINT =
  'Google Sheets Apps Script는 새 Drawing 버튼을 코드로 직접 생성하지 못합니다. ' +
  '현재 이미지는 over-grid로 배치되며, 실제 매크로 클릭 연결이 필요하면 시트 UI에서 Drawing으로 교체 후 bindExistingDrawingsIfPresent_()를 실행하십시오.';

const VOXERA_ASSET_URLS = {
  quickAction: 'https://raw.githubusercontent.com/yongwonseo25-create/Playground/main/assets/voxera/2.png',
  promptDb: 'https://raw.githubusercontent.com/yongwonseo25-create/Playground/main/assets/voxera/3.png',
  voiceInbox: 'https://raw.githubusercontent.com/yongwonseo25-create/Playground/main/assets/voxera/4.png',
  mainIcon: 'https://raw.githubusercontent.com/yongwonseo25-create/Playground/main/assets/voxera/5.png'
};

const VOXERA_ACTIONS = [
  {
    label: '⚡ 오늘 할 일 취합',
    iconUrl: VOXERA_ASSET_URLS.quickAction,
    iconAnchor: { column: 4, row: 21, offsetX: 16, offsetY: 10, width: 58, height: 58 },
    range: 'D22:I27',
    fill: '#fff4de',
    border: '#f5c67a',
    font: '#9a5b00',
    handler: 'runCollectTodayTasks'
  },
  {
    label: '📝 AI 영업일지 병합',
    iconUrl: VOXERA_ASSET_URLS.voiceInbox,
    iconAnchor: { column: 11, row: 21, offsetX: 16, offsetY: 10, width: 58, height: 58 },
    range: 'K22:P27',
    fill: '#e9f7ff',
    border: '#9fd6ff',
    font: '#0b63a5',
    handler: 'runMergeSalesJournal'
  },
  {
    label: '🚀 보고서 자동 생성',
    iconUrl: VOXERA_ASSET_URLS.promptDb,
    iconAnchor: { column: 18, row: 21, offsetX: 16, offsetY: 10, width: 58, height: 58 },
    range: 'R22:W27',
    fill: '#eef4ff',
    border: '#b9caf9',
    font: '#394ea5',
    handler: 'runGenerateReport'
  }
];

function buildVoxeraMainDashboard() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureMainDashboardSheet_(spreadsheet);

  resetDashboardCanvas_(sheet);
  paintDashboardShell_(sheet);
  paintStatusCards_(sheet);
  paintActionButtons_(sheet);
  renderOverGridAssets_(sheet);
  paintGuidanceBlock_(sheet);
  bindExistingDrawingsIfPresent_(sheet);

  SpreadsheetApp.flush();
  spreadsheet.toast('VOXERA MAIN 통제실이 마스터 에셋 기준으로 렌더링되었습니다.', 'VOXERA', 4);
}

function ensureMainDashboardSheet_(spreadsheet) {
  const firstSheet = spreadsheet.getSheets()[0];
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
  sheet.getRange(VOXERA_CANVAS_RANGE)
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

  clearOverGridImagesIfSupported_(sheet);
}

function paintDashboardShell_(sheet) {
  sheet.getRange('B3:Y9')
    .merge()
    .setBackground('#fffdf8')
    .setBorder(true, true, true, true, false, false, VOXERA_PANEL_BORDER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sheet.getRange('E4:V5')
    .merge()
    .setValue('VOXERA MAIN 통제실')
    .setFontSize(22)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_HEADER_TEXT);

  sheet.getRange('E6:V7')
    .merge()
    .setValue('오늘 할 일, 영업일지 병합, 보고서 자동 생성까지 한 화면에서 제어합니다.')
    .setFontSize(11)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_MUTED_TEXT);
}

function paintStatusCards_(sheet) {
  const cards = [
    { range: 'C12:G16', title: '검토할 음성', value: '0건', fill: '#e8f5ff', border: '#9fd6ff', font: '#0b63a5' },
    { range: 'I12:M16', title: '진행 중 업무', value: '0건', fill: '#fff6de', border: '#f5d37a', font: '#9a6a00' },
    { range: 'O12:S16', title: '오늘 마감', value: '0건', fill: '#faecff', border: '#e1b4f7', font: '#8c2ab8' },
    { range: 'U12:Y16', title: '완료한 업무', value: '0건', fill: '#ebfff4', border: '#a7e3bf', font: '#16794c' }
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

function paintActionButtons_(sheet) {
  sheet.getRange('D19:W19')
    .merge()
    .setValue('1-Click 액션 존')
    .setFontSize(12)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontColor(VOXERA_MUTED_TEXT)
    .setBackground(VOXERA_SHEET_BACKGROUND);

  VOXERA_ACTIONS.forEach((action) => {
    sheet.getRange(action.range)
      .merge()
      .setValue(action.label)
      .setBackground(action.fill)
      .setFontColor(action.font)
      .setFontWeight('bold')
      .setFontSize(15)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, action.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
      .setNote(`매크로 함수: ${action.handler}\n${VOXERA_ACTION_HINT}`);
  });
}

function renderOverGridAssets_(sheet) {
  insertImageIfPossible_(sheet, VOXERA_ASSET_URLS.mainIcon, 3, 3, 14, 8, 70, 70);
  VOXERA_ACTIONS.forEach((action) => {
    insertImageIfPossible_(
      sheet,
      action.iconUrl,
      action.iconAnchor.column,
      action.iconAnchor.row,
      action.iconAnchor.offsetX,
      action.iconAnchor.offsetY,
      action.iconAnchor.width,
      action.iconAnchor.height
    );
  });
}

function insertImageIfPossible_(sheet, url, column, row, offsetX, offsetY, width, height) {
  try {
    const response = UrlFetchApp.fetch(url);
    const blob = response.getBlob();
    const image = sheet.insertImage(blob, column, row, offsetX, offsetY);
    if (image && typeof image.setWidth === 'function') {
      image.setWidth(width);
    }
    if (image && typeof image.setHeight === 'function') {
      image.setHeight(height);
    }
  } catch (error) {
    Logger.log(`Failed to insert image ${url}: ${error}`);
  }
}

function clearOverGridImagesIfSupported_(sheet) {
  if (typeof sheet.getImages !== 'function') {
    return;
  }

  const images = sheet.getImages();
  images.forEach((image) => {
    if (image && typeof image.remove === 'function') {
      image.remove();
    }
  });
}

function paintGuidanceBlock_(sheet) {
  sheet.getRange('B32:Y40')
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
        '• 오늘 할 일 취합: 음성 수신함과 실행 보드를 기준으로 오늘 액션을 모읍니다.',
        '• AI 영업일지 병합: 영업 기록과 컨텍스트를 통합합니다.',
        '• 보고서 자동 생성: 요약 보고서 생성 플로우를 시작합니다.',
        '',
        VOXERA_ACTION_HINT
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
      .setWidth(240)
      .setHeight(84);
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
