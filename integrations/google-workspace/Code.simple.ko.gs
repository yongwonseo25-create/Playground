/**
 * VOXERA Google Workspace Simple KR Dashboard Edition
 * 한국 초보 사용자용 / 모달 대시보드 우선 / 실행 중심 버전
 */

const SIMPLE_SHEETS = {
  INBOX: {
    name: '받은 음성함',
    headers: [
      '받은 시각',
      '요청 ID',
      '말한 사람',
      '한 줄 요약',
      '실행 항목',
      '우선순위',
      '마감일',
      '문서 필요',
      '일정 필요',
      '상태',
      '처리 시각',
      '메모',
    ],
  },
  EXECUTION: {
    name: '실행 보드',
    headers: [
      '할 일',
      '담당자',
      '우선순위',
      '상태',
      '마감일',
      '문서',
      '일정',
      '완료일',
      '요청 ID',
      '요약',
      '문서 URL',
      '일정 URL',
    ],
  },
  SETTINGS: {
    name: '설정',
    headers: ['항목', '값', '설명'],
  },
};

const SIMPLE_DEFAULTS = [
  ['기본 담당자', '대표자명', '실행 보드에 기본으로 들어갈 담당자 이름'],
  ['문서 폴더 ID', '', 'Google Docs를 저장할 Drive 폴더 ID'],
  ['캘린더 ID', 'primary', '기본 캘린더는 primary'],
  ['알림 메일 사용', 'false', 'true 또는 false'],
  ['알림 메일 주소', '', '실행 전환 알림을 받을 메일 주소'],
  ['웹훅 비밀키', 'CHANGE_ME', '외부 POST 요청을 검증할 비밀 문자열'],
  ['기본 일정 시작 시각', '09', '시간이 없을 때 기본 시작 시각'],
  ['기본 일정 길이(분)', '30', '기본 일정 길이'],
];

const INBOX_STATUS = {
  REVIEW: '검토전',
  CONVERT: '실행전환',
  ARCHIVE: '보관',
  ERROR: '오류',
};

const EXECUTION_STATUS = {
  TODO: '해야함',
  DOING: '진행중',
  HOLD: '대기중',
  DONE: '완료',
};

const PRIORITIES = ['높음', '보통', '낮음'];
const DASHBOARD_WELCOME_KEY = 'voxera_dashboard_first_visit_seen';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VOXERA')
    .addItem('대시보드 열기', 'showDashboardDialog')
    .addSeparator()
    .addItem('받은 음성함 열기', 'openInboxSheet')
    .addItem('실행 보드 열기', 'openExecutionSheet')
    .addItem('설정 열기', 'openSettingsSheet')
    .addSeparator()
    .addItem('대시보드 데이터 새로고침', 'showDashboardDialog')
    .addToUi();

  maybeOpenDashboardOnFirstVisit_();
}

function setupSystem() {
  ensureSheetWithHeaders_(SIMPLE_SHEETS.INBOX.name, SIMPLE_SHEETS.INBOX.headers);
  ensureSheetWithHeaders_(SIMPLE_SHEETS.EXECUTION.name, SIMPLE_SHEETS.EXECUTION.headers);
  ensureSheetWithHeaders_(SIMPLE_SHEETS.SETTINGS.name, SIMPLE_SHEETS.SETTINGS.headers);

  seedSettings_();
  installSimpleTrigger_();
  applyFriendlyFormatting_();
  reorderSheets_();
  onOpen();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'VOXERA 작업 공간을 준비하는 중입니다...',
    'VOXERA',
    3
  );

  SpreadsheetApp.getUi().alert(
    'VOXERA 작업 공간 준비가 끝났습니다.\n이제 상단 메뉴에서 VOXERA > 대시보드 열기를 누르세요.'
  );
}

function showDashboardDialog() {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'VOXERA 대시보드를 불러오는 중입니다...',
    'VOXERA',
    3
  );

  const template = HtmlService.createTemplateFromFile('Dashboard');
  template.initialData = JSON.stringify(getDashboardData());

  const html = template
    .evaluate()
    .setTitle('VOXERA 대시보드')
    .setWidth(1480)
    .setHeight(920)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showModalDialog(html, 'VOXERA 대시보드');
}

function maybeOpenDashboardOnFirstVisit_() {
  const props = PropertiesService.getUserProperties();
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const key = `${DASHBOARD_WELCOME_KEY}:${spreadsheetId}`;
  const seen = props.getProperty(key);
  if (seen === 'true') return;

  props.setProperty(key, 'true');
  showDashboardDialog();
}

function resetDashboardWelcomeState() {
  const props = PropertiesService.getUserProperties();
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const key = `${DASHBOARD_WELCOME_KEY}:${spreadsheetId}`;
  props.deleteProperty(key);
  SpreadsheetApp.getUi().alert('첫 방문 자동 오픈 상태를 초기화했습니다. 시트를 새로고침하면 다시 한 번 자동으로 열립니다.');
}

function getDashboardData() {
  const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
  const execution = getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name);

  const inboxRows = getSheetObjects_(inbox);
  const executionRows = getSheetObjects_(execution);
  const todayKey = normalizeDateKey_(new Date());

  const activeInbox = inboxRows
    .filter((row) => row['요청 ID'])
    .sort((a, b) => String(b['받은 시각'] || '').localeCompare(String(a['받은 시각'] || '')))[0] || null;

  const activeExecution = executionRows
    .filter((row) => row['할 일'] && row['상태'] !== EXECUTION_STATUS.DONE)
    .sort((a, b) => String(a['마감일'] || '').localeCompare(String(b['마감일'] || '')))[0] ||
    executionRows.find((row) => row['할 일']) ||
    null;

  return {
    title: 'VOXERA 구글 워크스페이스 대시보드',
    subtitle: '검토부터 실행 전환까지 한 화면에서 관리',
    links: {
      inbox: getSheetUrl_(SIMPLE_SHEETS.INBOX.name),
      execution: getSheetUrl_(SIMPLE_SHEETS.EXECUTION.name),
      settings: getSheetUrl_(SIMPLE_SHEETS.SETTINGS.name),
    },
    metrics: {
      reviewCount: inboxRows.filter((row) => String(row['상태'] || '') === INBOX_STATUS.REVIEW).length,
      progressCount: executionRows.filter((row) => {
        const status = String(row['상태'] || '');
        return status && status !== EXECUTION_STATUS.DONE;
      }).length,
      dueTodayCount: executionRows.filter((row) => {
        const status = String(row['상태'] || '');
        return status !== EXECUTION_STATUS.DONE && normalizeDateKey_(row['마감일']) === todayKey;
      }).length,
      doneCount: executionRows.filter((row) => String(row['상태'] || '') === EXECUTION_STATUS.DONE).length,
    },
    inbox: activeInbox
      ? {
          summary: String(activeInbox['한 줄 요약'] || '-'),
          speaker: String(activeInbox['말한 사람'] || '-'),
          priorityDue: `${activeInbox['우선순위'] || '-'} / ${normalizeDateDisplay_(activeInbox['마감일']) || '-'}`,
          actions: String(activeInbox['실행 항목'] || '-'),
        }
      : {
          summary: '아직 검토할 음성이 없습니다.',
          speaker: '-',
          priorityDue: '- / -',
          actions: '-',
        },
    execution: activeExecution
      ? {
          title: String(activeExecution['할 일'] || '-'),
          owner: String(activeExecution['담당자'] || '-'),
          status: String(activeExecution['상태'] || '-'),
          dueDate: normalizeDateDisplay_(activeExecution['마감일']) || '-',
          docLabel: String(activeExecution['문서'] || '없음'),
          docUrl: String(activeExecution['문서 URL'] || ''),
          calendarLabel: String(activeExecution['일정'] || '없음'),
          calendarUrl: String(activeExecution['일정 URL'] || ''),
        }
      : {
          title: '아직 실행 항목이 없습니다.',
          owner: '-',
          status: '-',
          dueDate: '-',
          docLabel: '없음',
          docUrl: '',
          calendarLabel: '없음',
          calendarUrl: '',
        },
  };
}

function refreshDashboardData() {
  return getDashboardData();
}

function openInboxSheet() {
  return openSheetTab(SIMPLE_SHEETS.INBOX.name);
}

function openExecutionSheet() {
  return openSheetTab(SIMPLE_SHEETS.EXECUTION.name);
}

function openSettingsSheet() {
  return openSheetTab(SIMPLE_SHEETS.SETTINGS.name);
}

function openSheetTab(sheetName) {
  const sheet = getSimpleSheet_(sheetName);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  SpreadsheetApp.flush();
  return true;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    checkSimpleSecret_(e);
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    upsertInboxRow_(payload);
    return jsonOut_({ ok: true });
  } catch (error) {
    return jsonOut_({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function handleSimpleEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() === SIMPLE_SHEETS.INBOX.name) {
    const statusColumn = getHeaderIndex_(sheet, '상태');
    if (e.range.getColumn() === statusColumn && String(e.value || '') === INBOX_STATUS.CONVERT) {
      convertInboxRow_(e.range.getRow());
    }
  }
  if (sheet.getName() === SIMPLE_SHEETS.EXECUTION.name) {
    const statusColumn = getHeaderIndex_(sheet, '상태');
    if (e.range.getColumn() === statusColumn) {
      syncExecutionCompletion_(e.range.getRow());
    }
  }
}

function convertInboxRow_(rowNumber) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
    const execution = getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name);
    const values = inbox.getRange(rowNumber, 1, 1, inbox.getLastColumn()).getValues()[0];
    const headers = SIMPLE_SHEETS.INBOX.headers;
    const row = objectFromRow_(headers, values);

    const requestId = String(row['요청 ID'] || '').trim();
    if (!requestId) {
      inbox.getRange(rowNumber, getHeaderIndex_(inbox, '메모')).setValue('요청 ID가 없어 실행 전환할 수 없습니다.');
      inbox.getRange(rowNumber, getHeaderIndex_(inbox, '상태')).setValue(INBOX_STATUS.ERROR);
      return;
    }

    const existingExecutionRow = findSimpleRow_(execution, '요청 ID', requestId);
    if (existingExecutionRow) {
      inbox.getRange(rowNumber, getHeaderIndex_(inbox, '처리 시각')).setValue(new Date());
      inbox.getRange(rowNumber, getHeaderIndex_(inbox, '메모')).setValue('이미 실행 보드에 전환된 요청입니다.');
      return;
    }

    const owner = getSimpleConfig_('기본 담당자') || '대표자명';
    const title = String(row['실행 항목'] || row['한 줄 요약'] || '').trim() || '새 실행 항목';
    const summary = String(row['한 줄 요약'] || '').trim();
    const priority = normalizePriorityKr_(row['우선순위']);
    const dueDate = normalizeDateDisplay_(row['마감일']);

    const docRequired = toYesNo_(row['문서 필요']) === '예';
    const calendarRequired = toYesNo_(row['일정 필요']) === '예';

    const docUrl = docRequired ? createSimpleDoc_(row) : '';
    const eventUrl = calendarRequired ? createSimpleCalendarEvent_(row, title, owner) : '';

    const newRow = [
      title,
      owner,
      priority,
      EXECUTION_STATUS.TODO,
      dueDate,
      docUrl ? '문서 열기' : '없음',
      eventUrl ? '일정 보기' : '없음',
      '',
      requestId,
      summary,
      docUrl,
      eventUrl,
    ];

    execution.appendRow(newRow);
    const targetRow = execution.getLastRow();
    setLinkChip_(execution.getRange(targetRow, 6), docUrl ? '문서 열기' : '없음', docUrl, '#0B57D0');
    setLinkChip_(execution.getRange(targetRow, 7), eventUrl ? '일정 보기' : '없음', eventUrl, '#188038');

    inbox.getRange(rowNumber, getHeaderIndex_(inbox, '처리 시각')).setValue(new Date());
    inbox.getRange(rowNumber, getHeaderIndex_(inbox, '메모')).setValue('실행 보드로 전환 완료');

    maybeSendNotificationMail_(title, owner, dueDate);
  } catch (error) {
    const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
    inbox.getRange(rowNumber, getHeaderIndex_(inbox, '상태')).setValue(INBOX_STATUS.ERROR);
    inbox.getRange(rowNumber, getHeaderIndex_(inbox, '메모')).setValue(String(error && error.message ? error.message : error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function syncExecutionCompletion_(rowNumber) {
  if (rowNumber <= 1) return;
  const execution = getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name);
  const status = String(execution.getRange(rowNumber, getHeaderIndex_(execution, '상태')).getValue() || '');
  const completeCell = execution.getRange(rowNumber, getHeaderIndex_(execution, '완료일'));

  if (status === EXECUTION_STATUS.DONE && !completeCell.getValue()) {
    completeCell.setValue(new Date());
  }

  if (status !== EXECUTION_STATUS.DONE) {
    completeCell.clearContent();
  }
}

function createSimpleDoc_(row) {
  const folderId = getSimpleConfig_('문서 폴더 ID');
  if (!folderId) return '';

  const folder = DriveApp.getFolderById(folderId);
  const dueDate = normalizeDateDisplay_(row['마감일']) || '미정';
  const title = `[VOXERA] ${normalizeDateKey_(new Date())}_${String(row['한 줄 요약'] || '새 문서').slice(0, 40)}`;
  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  body.appendParagraph(String(row['한 줄 요약'] || '실행 문서')).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`말한 사람: ${row['말한 사람'] || '-'}`);
  body.appendParagraph(`마감일: ${dueDate}`);
  body.appendParagraph(`우선순위: ${normalizePriorityKr_(row['우선순위'])}`);
  body.appendParagraph('');
  body.appendParagraph('실행 항목').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(String(row['실행 항목'] || '-'));
  body.appendParagraph('');
  body.appendParagraph('원문 메모').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(String(row['메모'] || row['한 줄 요약'] || '-'));

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return doc.getUrl();
}

function createSimpleCalendarEvent_(row, title, owner) {
  const calendarId = getSimpleConfig_('캘린더 ID') || 'primary';
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) return '';

  const dueDateKey = normalizeDateKey_(row['마감일']);
  if (!dueDateKey) return '';

  const defaultHour = Number(getSimpleConfig_('기본 일정 시작 시각') || '9');
  const duration = Number(getSimpleConfig_('기본 일정 길이(분)') || '30');

  const start = new Date(`${dueDateKey}T${String(defaultHour).padStart(2, '0')}:00:00`);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const event = calendar.createEvent(
    title,
    start,
    end,
    {
      description: `담당자: ${owner}\n요약: ${String(row['한 줄 요약'] || '-')}\n요청 ID: ${String(row['요청 ID'] || '-')}`,
    }
  );

  return event.getHtmlLink();
}

function maybeSendNotificationMail_(title, owner, dueDate) {
  const enabled = String(getSimpleConfig_('알림 메일 사용') || '').toLowerCase() === 'true';
  const email = String(getSimpleConfig_('알림 메일 주소') || '').trim();
  if (!enabled || !email) return;

  MailApp.sendEmail({
    to: email,
    subject: `[VOXERA] 새 실행 항목이 등록되었습니다`,
    htmlBody: `
      <div style="font-family:Arial,sans-serif">
        <h2 style="margin:0 0 12px">새 실행 항목이 등록되었습니다</h2>
        <p><strong>할 일:</strong> ${escapeHtml_(title)}</p>
        <p><strong>담당자:</strong> ${escapeHtml_(owner)}</p>
        <p><strong>마감일:</strong> ${escapeHtml_(dueDate || '미정')}</p>
      </div>
    `,
  });
}

function installSimpleTrigger_() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const existing = ScriptApp.getProjectTriggers();
  const hasTrigger = existing.some((t) => t.getHandlerFunction() === 'handleSimpleEdit');
  if (!hasTrigger) {
    ScriptApp.newTrigger('handleSimpleEdit').forSpreadsheet(ssId).onEdit().create();
  }
}

function seedSettings_() {
  const settings = getSimpleSheet_(SIMPLE_SHEETS.SETTINGS.name);
  const dataRowCount = Math.max(settings.getLastRow() - 1, 0);
  const current = dataRowCount > 0
    ? settings.getRange(2, 1, dataRowCount, 1).getValues().flat().filter(Boolean)
    : [];
  if (current.length > 0) return;
  settings.getRange(2, 1, SIMPLE_DEFAULTS.length, 3).setValues(SIMPLE_DEFAULTS);
}

function reorderSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(getSimpleSheet_(SIMPLE_SHEETS.INBOX.name));
  ss.moveActiveSheet(1);
  ss.setActiveSheet(getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name));
  ss.moveActiveSheet(2);
  ss.setActiveSheet(getSimpleSheet_(SIMPLE_SHEETS.SETTINGS.name));
  ss.moveActiveSheet(3);
  ss.setActiveSheet(getSimpleSheet_(SIMPLE_SHEETS.INBOX.name));
}

function applyFriendlyFormatting_() {
  const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
  const execution = getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name);
  const settings = getSimpleSheet_(SIMPLE_SHEETS.SETTINGS.name);

  [inbox, execution, settings].forEach((sheet) => {
    sheet.getDataRange().setFontFamily('Pretendard');
    sheet.setFrozenRows(1);
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    header
      .setFontWeight('bold')
      .setBackground('#F2F7FF')
      .setFontColor('#23344C')
      .setHorizontalAlignment('center');
  });

  inbox.setColumnWidths(1, 12, 132);
  inbox.setColumnWidth(4, 250);
  inbox.setColumnWidth(5, 260);
  inbox.setColumnWidth(12, 180);

  execution.setColumnWidths(1, 12, 120);
  execution.setColumnWidth(1, 260);
  execution.setColumnWidth(2, 110);
  execution.setColumnWidth(10, 220);
  execution.hideColumns(11, 2);

  settings.setColumnWidths(1, 3, 240);

  applyDropdowns_();
}

function applyDropdowns_() {
  const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
  const execution = getSimpleSheet_(SIMPLE_SHEETS.EXECUTION.name);

  const inboxLastRow = Math.max(inbox.getMaxRows() - 1, 1);
  const execLastRow = Math.max(execution.getMaxRows() - 1, 1);

  const yesNoRule = SpreadsheetApp.newDataValidation().requireValueInList(['예', '아니오'], true).build();
  const inboxStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(INBOX_STATUS), true)
    .build();
  const executionStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(EXECUTION_STATUS), true)
    .build();
  const priorityRule = SpreadsheetApp.newDataValidation().requireValueInList(PRIORITIES, true).build();

  inbox.getRange(2, getHeaderIndex_(inbox, '문서 필요'), inboxLastRow, 1).setDataValidation(yesNoRule);
  inbox.getRange(2, getHeaderIndex_(inbox, '일정 필요'), inboxLastRow, 1).setDataValidation(yesNoRule);
  inbox.getRange(2, getHeaderIndex_(inbox, '상태'), inboxLastRow, 1).setDataValidation(inboxStatusRule);
  inbox.getRange(2, getHeaderIndex_(inbox, '우선순위'), inboxLastRow, 1).setDataValidation(priorityRule);

  execution.getRange(2, getHeaderIndex_(execution, '상태'), execLastRow, 1).setDataValidation(executionStatusRule);
  execution.getRange(2, getHeaderIndex_(execution, '우선순위'), execLastRow, 1).setDataValidation(priorityRule);
}

function upsertInboxRow_(payload) {
  const inbox = getSimpleSheet_(SIMPLE_SHEETS.INBOX.name);
  const sourceId = String(payload.source_id || '').trim();
  if (!sourceId) {
    throw new Error('source_id가 없습니다.');
  }

  const existing = findSimpleRow_(inbox, '요청 ID', sourceId);
  const row = [
    payload.created_at || new Date().toISOString(),
    sourceId,
    payload.speaker || '',
    payload.summary || '',
    Array.isArray(payload.action_items) ? payload.action_items.join(' / ') : (payload.action_items || ''),
    normalizePriorityKr_(payload.urgency),
    payload.due_date || '',
    toYesNo_(payload.requires_doc),
    toYesNo_(payload.requires_calendar),
    INBOX_STATUS.REVIEW,
    '',
    '',
  ];

  if (existing) {
    inbox.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    inbox.appendRow(row);
  }
}

function setLinkChip_(range, label, url, fill) {
  const style = SpreadsheetApp.newTextStyle()
    .setBold(true)
    .setForegroundColor(url ? '#FFFFFF' : '#5E6A7B')
    .setFontFamily('Pretendard')
    .build();

  range
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground(url ? fill : '#EEF3F8')
    .setBorder(true, true, true, true, true, true, url ? fill : '#D7DFEA', SpreadsheetApp.BorderStyle.SOLID);

  if (url) {
    range.setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(url).setTextStyle(style).build()
    );
  } else {
    range.setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(label).setTextStyle(style).build()
    );
  }
}

function getSheetObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map((row) => objectFromRow_(headers, row));
}

function objectFromRow_(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[String(header)] = row[index];
  });
  return obj;
}

function ensureSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureSheetWithHeaders_(name, headers) {
  const sheet = ensureSheet_(name);
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function getSimpleSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`시트를 찾을 수 없습니다: ${name}`);
  return sheet;
}

function findSimpleRow_(sheet, headerName, value) {
  const index = getHeaderIndex_(sheet, headerName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const values = sheet.getRange(2, index, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return null;
}

function getHeaderIndex_(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(headerName);
  if (index === -1) throw new Error(`헤더를 찾을 수 없습니다: ${headerName}`);
  return index + 1;
}

function getSheetUrl_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSimpleSheet_(sheetName);
  return `${ss.getUrl()}#gid=${sheet.getSheetId()}`;
}

function getSimpleConfig_(label) {
  const settings = getSimpleSheet_(SIMPLE_SHEETS.SETTINGS.name);
  const data = settings.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === label) return data[i][1];
  }
  return '';
}

function checkSimpleSecret_(e) {
  const secret = String(getSimpleConfig_('웹훅 비밀키') || '').trim();
  if (!secret || secret === 'CHANGE_ME') {
    throw new Error('설정 시트의 웹훅 비밀키를 먼저 입력해 주세요.');
  }

  const headers = (e && e.headers) || {};
  const normalized = {};
  Object.keys(headers).forEach((key) => {
    normalized[String(key).toLowerCase()] = headers[key];
  });

  const auth = normalized.authorization || '';
  if (auth !== `Bearer ${secret}`) {
    throw new Error('인증에 실패했습니다.');
  }
}

function normalizePriorityKr_(value) {
  const upper = String(value || '').toUpperCase();
  if (upper === 'HIGH') return '높음';
  if (upper === 'LOW') return '낮음';
  if (String(value) === '높음' || String(value) === '보통' || String(value) === '낮음') return String(value);
  return '보통';
}

function toYesNo_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '예' ? '예' : '아니오';
}

function normalizeDateKey_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const raw = String(value).trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return raw;
}

function normalizeDateDisplay_(value) {
  return normalizeDateKey_(value);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
