/**
 * VOXERA Google Workspace Automation
 * Production-oriented Google Apps Script package.
 *
 * Core principles:
 * - Inbox is for review
 * - Execution Board is for action
 * - Docs are conditional assets
 * - Calendar events are conditional assets
 */

const VOXERA_SHEETS = {
  INBOX: {
    name: 'Inbox',
    headers: [
      'created_at',
      'source_id',
      'speaker',
      'raw_transcript',
      'summary',
      'action_items',
      'urgency',
      'due_date',
      'due_time',
      'category',
      'requires_doc',
      'requires_calendar',
      'status',
      'processed_at',
      'conversion_note',
    ],
  },
  EXECUTION: {
    name: 'Execution Board',
    headers: [
      'task_id',
      'created_at',
      'source_id',
      'title',
      'owner',
      'priority',
      'status',
      'due_date',
      'due_time',
      'category',
      'execution_note',
      'source_summary',
      'source_doc_url',
      'calendar_event_id',
      'calendar_event_url',
      'completion_date',
    ],
  },
  ARCHIVE: {
    name: 'Archive',
    headers: [
      'task_id',
      'created_at',
      'source_id',
      'title',
      'owner',
      'priority',
      'status',
      'completion_date',
      'source_doc_url',
      'calendar_event_url',
    ],
  },
  CONFIG: {
    name: 'Config',
    headers: ['Key', 'Value', 'Description'],
  },
  DASHBOARD: {
    name: 'Dashboard Feed',
    headers: [
      'task_id',
      'title',
      'owner',
      'priority',
      'status',
      'category',
      'due_date',
      'is_overdue',
      'completion_date',
    ],
  },
};

const CONFIG_DEFAULTS = [
  ['company_name', 'VOXERA', '회사명'],
  ['default_owner', '대표자명', '기본 담당자'],
  ['timezone', 'Asia/Seoul', '기본 타임존'],
  ['doc_folder_id', '', '문서 저장 Google Drive 폴더 ID'],
  ['calendar_id', 'primary', 'Google Calendar ID'],
  ['mail_notifications_enabled', 'false', '신규 실행 항목 메일 알림 사용 여부'],
  ['notification_email', '', '실행 알림 수신 이메일'],
  ['webhook_secret', 'CHANGE_ME', 'Webhook Bearer Secret'],
  ['default_event_hour', '09', 'due_time 미존재시 시작 시각'],
  ['default_event_duration_min', '30', '기본 일정 길이(분)'],
];

const INBOX_STATUS = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  CONVERTED: 'CONVERTED',
  ARCHIVED: 'ARCHIVED',
  ERROR: 'ERROR',
};

const EXEC_STATUS = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
};

const PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(VOXERA_SHEETS).forEach((key) => {
    const def = VOXERA_SHEETS[key];
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    headerRange.setValues([def.headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#eef6ff');
    sheet.setFrozenRows(1);
  });

  const configSheet = getSheetByDef_(VOXERA_SHEETS.CONFIG);
  if (configSheet.getLastRow() <= 1) {
    configSheet.getRange(2, 1, CONFIG_DEFAULTS.length, 3).setValues(CONFIG_DEFAULTS);
  }

  installTriggers_();

  SpreadsheetApp.getUi().alert(
    'VOXERA 세팅 완료. Config 시트 값을 채우고 deployWebApp()를 실행하세요.'
  );
}

function installTriggers_() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const existing = ScriptApp.getProjectTriggers();
  const hasOnEdit = existing.some((trigger) => trigger.getHandlerFunction() === 'handleInboxEdit');

  if (!hasOnEdit) {
    ScriptApp.newTrigger('handleInboxEdit').forSpreadsheet(ssId).onEdit().create();
  }
}

function deployWebApp() {
  SpreadsheetApp.getUi().alert(
    'Apps Script 편집기에서 배포 > 새 배포 > 웹 앱으로 배포를 진행하세요. 실행 사용자: 나, 액세스 권한: 모든 사용자(헤더 secret 필수).'
  );
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    assertAuthorized_(e);

    const payload = parsePayload_(e);
    validatePayload_(payload);

    const inboxSheet = getSheetByDef_(VOXERA_SHEETS.INBOX);
    const existingRow = findRowByValue_(inboxSheet, 'source_id', payload.source_id);

    if (existingRow) {
      return jsonResponse_({
        status: 'ok',
        deduped: true,
        source_id: payload.source_id,
      });
    }

    const row = mapPayloadToInboxRow_(payload);
    inboxSheet.appendRow(row);

    return jsonResponse_({
      status: 'ok',
      deduped: false,
      source_id: payload.source_id,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      status: 'error',
      message: String(error && error.message ? error.message : error),
    });
  } finally {
    lock.releaseLock();
  }
}

function handleInboxEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== VOXERA_SHEETS.INBOX.name) return;

  const headerMap = getHeaderMap_(sheet);
  const statusCol = headerMap.status;
  if (!statusCol || e.range.getColumn() !== statusCol) return;

  const newValue = String(e.value || '').trim();
  if (newValue !== INBOX_STATUS.CONVERTED) return;

  processInboxRow_(sheet, e.range.getRow());
}

function processInboxRow_(inboxSheet, rowNumber) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const rowObject = getRowObject_(inboxSheet, rowNumber);
    if (!rowObject.source_id) {
      throw new Error('Inbox row missing source_id.');
    }

    const executionSheet = getSheetByDef_(VOXERA_SHEETS.EXECUTION);
    const existingTaskRow = findRowByValue_(executionSheet, 'source_id', rowObject.source_id);
    if (existingTaskRow) {
      stampInboxProcessed_(inboxSheet, rowNumber, '중복 source_id로 변환 생략');
      rebuildDashboardFeed();
      return;
    }

    const title = buildTitle_(rowObject);
    const owner = getConfig_('default_owner') || rowObject.speaker || '담당자 미지정';
    const taskId = buildTaskId_();

    let docUrl = '';
    if (shouldCreateDoc_(rowObject)) {
      docUrl = createGoogleDoc_(rowObject, title, owner);
    }

    let calendarEventId = '';
    let calendarEventUrl = '';
    if (shouldCreateCalendar_(rowObject)) {
      const calendarResult = createCalendarEvent_(rowObject, title, owner, docUrl);
      calendarEventId = calendarResult.id;
      calendarEventUrl = calendarResult.url;
    }

    const execRow = [
      taskId,
      toIsoString_(new Date()),
      rowObject.source_id,
      title,
      owner,
      normalizePriority_(rowObject.urgency),
      EXEC_STATUS.NEW,
      rowObject.due_date || '',
      rowObject.due_time || '',
      rowObject.category || '',
      '',
      rowObject.summary || '',
      docUrl,
      calendarEventId,
      calendarEventUrl,
      '',
    ];

    executionSheet.appendRow(execRow);
    maybeSendExecutionEmail_(execRow);
    stampInboxProcessed_(inboxSheet, rowNumber, '');
    rebuildDashboardFeed();
  } catch (error) {
    markInboxError_(inboxSheet, rowNumber, String(error && error.message ? error.message : error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function archiveCompletedTasks() {
  const executionSheet = getSheetByDef_(VOXERA_SHEETS.EXECUTION);
  const archiveSheet = getSheetByDef_(VOXERA_SHEETS.ARCHIVE);
  const headerMap = getHeaderMap_(executionSheet);
  const values = executionSheet.getDataRange().getValues();

  const rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = row[headerMap.status - 1];
    if (status !== EXEC_STATUS.DONE) continue;

    archiveSheet.appendRow([
      row[headerMap.task_id - 1],
      row[headerMap.created_at - 1],
      row[headerMap.source_id - 1],
      row[headerMap.title - 1],
      row[headerMap.owner - 1],
      row[headerMap.priority - 1],
      status,
      row[headerMap.completion_date - 1] || toIsoDate_(new Date()),
      row[headerMap.source_doc_url - 1],
      row[headerMap.calendar_event_url - 1],
    ]);

    rowsToDelete.push(i + 1);
  }

  rowsToDelete.reverse().forEach((rowNumber) => executionSheet.deleteRow(rowNumber));
  rebuildDashboardFeed();
}

function rebuildDashboardFeed() {
  const executionSheet = getSheetByDef_(VOXERA_SHEETS.EXECUTION);
  const dashboardSheet = getSheetByDef_(VOXERA_SHEETS.DASHBOARD);
  const headerMap = getHeaderMap_(executionSheet);
  const values = executionSheet.getDataRange().getValues();

  dashboardSheet.clearContents();
  dashboardSheet.getRange(1, 1, 1, VOXERA_SHEETS.DASHBOARD.headers.length).setValues([
    VOXERA_SHEETS.DASHBOARD.headers,
  ]);

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[headerMap.task_id - 1]) continue;

    const dueDate = row[headerMap.due_date - 1];
    const status = row[headerMap.status - 1];
    rows.push([
      row[headerMap.task_id - 1],
      row[headerMap.title - 1],
      row[headerMap.owner - 1],
      row[headerMap.priority - 1],
      status,
      row[headerMap.category - 1],
      dueDate,
      isOverdue_(dueDate, status) ? 'Yes' : 'No',
      row[headerMap.completion_date - 1],
    ]);
  }

  if (rows.length) {
    dashboardSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body.');
  }
  return JSON.parse(e.postData.contents);
}

function assertAuthorized_(e) {
  const secret = getConfig_('webhook_secret');
  if (!secret || secret === 'CHANGE_ME') {
    throw new Error('Config.webhook_secret is not configured.');
  }

  const headers = normalizeHeaders_(e);
  const authHeader = headers.authorization || '';
  const expected = `Bearer ${secret}`;
  if (authHeader !== expected) {
    throw new Error('Unauthorized request.');
  }
}

function normalizeHeaders_(e) {
  const candidate = (e && e.headers) || (e && e.parameter) || {};
  const output = {};
  Object.keys(candidate).forEach((key) => {
    output[String(key).toLowerCase()] = candidate[key];
  });
  return output;
}

function validatePayload_(payload) {
  const required = ['source_id', 'created_at', 'summary'];
  required.forEach((field) => {
    if (!payload[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  });
}

function mapPayloadToInboxRow_(payload) {
  return [
    payload.created_at || toIsoString_(new Date()),
    payload.source_id,
    payload.speaker || '',
    payload.raw_transcript || '',
    payload.summary || '',
    Array.isArray(payload.action_items)
      ? payload.action_items.join('\n')
      : String(payload.action_items || ''),
    normalizePriority_(payload.urgency),
    payload.due_date || '',
    payload.due_time || '',
    payload.category || '',
    toBooleanString_(payload.requires_doc),
    toBooleanString_(payload.requires_calendar),
    INBOX_STATUS.NEW,
    '',
    '',
  ];
}

function shouldCreateDoc_(rowObject) {
  const category = String(rowObject.category || '').toUpperCase();
  const text = `${rowObject.summary || ''} ${rowObject.raw_transcript || ''}`;
  const keywordPattern = /(회의록|제안서|보고서|정리해줘|브리프|문서화)/;
  return (
    category === 'MEETING' ||
    String(rowObject.requires_doc || '').toLowerCase() === 'true' ||
    keywordPattern.test(text)
  );
}

function shouldCreateCalendar_(rowObject) {
  const text = `${rowObject.summary || ''} ${rowObject.raw_transcript || ''}`;
  const keywordPattern = /(일정|미팅|회의|약속|시까지|시에|캘린더)/;
  return (
    !!rowObject.due_date ||
    String(rowObject.requires_calendar || '').toLowerCase() === 'true' ||
    keywordPattern.test(text)
  );
}

function createGoogleDoc_(rowObject, title, owner) {
  const folderId = getConfig_('doc_folder_id');
  const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
  const companyName = getConfig_('company_name') || 'VOXERA';
  const fileName = `[${companyName}] ${toIsoDate_(new Date())}_${rowObject.category || 'GENERAL'}_${title}`;

  const doc = DocumentApp.create(fileName);
  const body = doc.getBody();
  body.clear();
  body.appendParagraph(fileName).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`생성일시: ${new Date().toLocaleString('ko-KR')}`);
  body.appendParagraph(`담당자: ${owner}`);
  body.appendParagraph(`마감일: ${rowObject.due_date || '-'} ${rowObject.due_time || ''}`);
  body.appendHorizontalRule();
  body.appendParagraph('원문 요약').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowObject.summary || '');
  body.appendParagraph('핵심 액션 아이템').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowObject.action_items || '');
  body.appendParagraph('상세 메모').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('');
  body.appendParagraph('원문 전체').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(rowObject.raw_transcript || '');
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    // Shared Drive or permission differences can make this a no-op; ignore.
  }
  return doc.getUrl();
}

function createCalendarEvent_(rowObject, title, owner, docUrl) {
  const calendarId = getConfig_('calendar_id') || 'primary';
  const calendar = CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar();
  const start = buildEventStart_(rowObject.due_date, rowObject.due_time);
  const durationMin = Number(getConfig_('default_event_duration_min') || '30');
  const end = new Date(start.getTime() + durationMin * 60000);
  const description = [
    '[VOXERA 자동 생성 일정]',
    `담당자: ${owner}`,
    `source_id: ${rowObject.source_id || ''}`,
    `요약: ${rowObject.summary || ''}`,
    `문서: ${docUrl || '-'}`,
  ].join('\n');

  const event = calendar.createEvent(title, start, end, { description });
  return {
    id: event.getId(),
    url: buildCalendarEventUrl_(calendar.getId(), event.getId()),
  };
}

function maybeSendExecutionEmail_(execRow) {
  const enabled = String(getConfig_('mail_notifications_enabled')).toLowerCase() === 'true';
  const recipient = String(getConfig_('notification_email') || '').trim();
  if (!enabled || !recipient) return;

  const [taskId, createdAt, sourceId, title, owner, priority, status, dueDate, dueTime, category, executionNote, sourceSummary, sourceDocUrl, calendarEventId, calendarEventUrl] =
    execRow;

  const subject = `[VOXERA] 신규 실행 항목: ${title}`;
  const body = [
    'VOXERA에서 새로운 실행 항목이 생성되었습니다.',
    '',
    `할 일: ${title}`,
    `담당자: ${owner}`,
    `우선순위: ${priority}`,
    `상태: ${status}`,
    `마감일: ${dueDate || '-'} ${dueTime || ''}`,
    `카테고리: ${category || '-'}`,
    '',
    `요약: ${sourceSummary || '-'}`,
    `문서 링크: ${sourceDocUrl || '-'}`,
    `캘린더 링크: ${calendarEventUrl || '-'}`,
    '',
    `task_id: ${taskId}`,
    `source_id: ${sourceId}`,
    `created_at: ${createdAt}`,
    `calendar_event_id: ${calendarEventId || '-'}`,
    `execution_note: ${executionNote || '-'}`,
  ].join('\n');

  MailApp.sendEmail(recipient, subject, body);
}

function buildCalendarEventUrl_(calendarId, eventId) {
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${encodeURIComponent(
    eventId
  )}?cid=${encodeURIComponent(calendarId)}`;
}

function buildEventStart_(dueDate, dueTime) {
  const hour = getConfig_('default_event_hour') || '09';
  const safeTime = dueTime ? String(dueTime) : `${hour}:00`;
  return new Date(`${dueDate}T${safeTime}:00`);
}

function stampInboxProcessed_(sheet, rowNumber, note) {
  const headerMap = getHeaderMap_(sheet);
  if (headerMap.processed_at) {
    sheet.getRange(rowNumber, headerMap.processed_at).setValue(toIsoString_(new Date()));
  }
  if (headerMap.conversion_note) {
    sheet.getRange(rowNumber, headerMap.conversion_note).setValue(note || '');
  }
}

function markInboxError_(sheet, rowNumber, message) {
  const headerMap = getHeaderMap_(sheet);
  sheet.getRange(rowNumber, headerMap.status).setValue(INBOX_STATUS.ERROR);
  if (headerMap.conversion_note) {
    sheet.getRange(rowNumber, headerMap.conversion_note).setValue(message);
  }
}

function getSheetByDef_(def) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.name);
  if (!sheet) {
    throw new Error(`Missing sheet: ${def.name}`);
  }
  return sheet;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index + 1;
  });
  return map;
}

function getRowObject_(sheet, rowNumber) {
  const headerMap = getHeaderMap_(sheet);
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const object = {};
  Object.keys(headerMap).forEach((key) => {
    object[key] = row[headerMap[key] - 1];
  });
  return object;
}

function findRowByValue_(sheet, headerName, value) {
  const headerMap = getHeaderMap_(sheet);
  const col = headerMap[headerName];
  if (!col) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) {
      return i + 2;
    }
  }
  return null;
}

function getConfig_(key) {
  const sheet = getSheetByDef_(VOXERA_SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      return values[i][1];
    }
  }
  return '';
}

function buildTaskId_() {
  return `TSK-${Utilities.getUuid().split('-')[0].toUpperCase()}`;
}

function buildTitle_(rowObject) {
  const summary = String(rowObject.summary || '').trim();
  if (summary) {
    return summary.split('\n')[0].slice(0, 80);
  }
  return '실행 항목';
}

function normalizePriority_(urgency) {
  const value = String(urgency || PRIORITY.MEDIUM).toUpperCase();
  if (value === PRIORITY.HIGH || value === PRIORITY.LOW) return value;
  return PRIORITY.MEDIUM;
}

function toIsoString_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function toIsoDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function isOverdue_(dueDate, status) {
  if (!dueDate || status === EXEC_STATUS.DONE) return false;
  const today = toIsoDate_(new Date());
  return String(dueDate) < today;
}

function toBooleanString_(value) {
  return value === true || String(value).toLowerCase() === 'true' ? 'true' : 'false';
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
