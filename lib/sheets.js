/**
 * lib/sheets.js — Google Sheets API v4 Helper
 * Handles authentication, reading, and writing to Google Sheets.
 */

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = 'DATA';

/**
 * Create authenticated Google Auth client using Service Account credentials.
 */
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Read all data from the DATA sheet.
 * Returns { headers, col (name→index map), dataRows (2D array) }
 */
async function getSheetData() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:Z500`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const rows = res.data.values || [];

  // Find the header row dynamically (the row containing "No" in its first non-empty cell)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i] && rows[i].some(c => String(c || '').trim() === 'No')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error("Header row with 'No' column not found in sheet DATA");
  }

  const headers = rows[headerIdx].map(h => String(h || '').trim());
  const col = {};
  headers.forEach((h, i) => {
    if (h) col[h] = i;
  });

  const dataRows = rows.slice(headerIdx + 1);

  return { headers, col, dataRows, headerIdx };
}

/**
 * Append a single row to the end of the DATA sheet.
 * @param {Array} values — array of cell values matching header column order
 */
async function appendRow(values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });
}

/**
 * Convert a 0-based column index to a spreadsheet column letter (A, B, ..., Z, AA, AB, ...).
 * @param {number} index — 0-based column index
 * @returns {string} column letter(s)
 */
function indexToColumnLetter(index) {
  let letter = '';
  let idx = index;
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}

/**
 * Update a single cell in the DATA sheet.
 * @param {number} rowNumber — 1-based row number in the sheet
 * @param {string} columnName — header name of the column to update
 * @param {*} value — new value for the cell
 */
async function updateCell(rowNumber, columnName, value) {
  const { col } = await getSheetData();

  const colIndex = col[columnName];
  if (colIndex === undefined) {
    throw new Error(`Column '${columnName}' not found in sheet headers`);
  }

  const colLetter = indexToColumnLetter(colIndex);
  const range = `${SHEET_NAME}!${colLetter}${rowNumber}`;

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[value]] },
  });
}

/**
 * Delete a row from the DATA sheet by its 1-based row number.
 * Uses batchUpdate with deleteDimension (0-based indices).
 * @param {number} rowNumber — 1-based row number in the sheet
 */
async function deleteRow(rowNumber) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Find the numeric sheetId (gid) for the DATA tab
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets.properties',
  });

  const dataSheet = spreadsheet.data.sheets.find(
    s => s.properties.title === SHEET_NAME
  );
  if (!dataSheet) {
    throw new Error(`Sheet tab '${SHEET_NAME}' not found`);
  }

  const sheetId = dataSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1, // 0-based
              endIndex: rowNumber,        // exclusive
            },
          },
        },
      ],
    },
  });
}

module.exports = { getSheetData, appendRow, updateCell, deleteRow };
