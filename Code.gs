const SPREADSHEET_ID = '1D0xxymMBDUXIjPFmzUypCiLHEB7Za_WZ2pkiC-zTT7A';
const SHEET_NAME = 'Dashboard_Data';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_(400, {
        ok: false,
        error: 'Request body is required.',
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const sheet = getSheet_(
      payload.spreadsheetId || SPREADSHEET_ID,
      payload.sheetName || SHEET_NAME
    );

    const row = normalizeRow_(payload);
    sheet.appendRow(row);

    return jsonResponse_(200, {
      ok: true,
      spreadsheetId: payload.spreadsheetId || SPREADSHEET_ID,
      sheetName: payload.sheetName || SHEET_NAME,
      rowNumber: sheet.getLastRow(),
      row,
    });
  } catch (error) {
    return jsonResponse_(500, {
      ok: false,
      error: error.message,
    });
  }
}

function getSheet_(spreadsheetId, sheetName) {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is required.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  return sheet;
}

function normalizeRow_(payload) {
  const row = payload.row;
  if (Array.isArray(row) && row.length >= 5) {
    return row.slice(0, 5);
  }

  return [
    payload.date || new Date().toISOString(),
    payload.item || payload.title || '',
    payload.amount || '',
    payload.category || '',
    payload.notes || payload.memo || '',
  ];
}

function jsonResponse_(status, data) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status,
      ...data,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
