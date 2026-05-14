const DAILY_REPORT_TRANSFER_CONFIG = {
  SOURCE_SPREADSHEET_ID: "1_w31qxAogDkc8_Dtm8aLBH53uhAZYf7e-IFm5NMombA",
  TARGET_SPREADSHEET_ID: "1hqtYYrLw-4oAS0exkqv0Ka0Usfq4bHJh5Gs2AHtj114",
  SOURCE_SHEET_NAME: "DailyReports",
  TARGET_SHEET_NAME: "\u4eca\u65e5\u8ca1\u5831",
  SOURCE_DATE_HEADER: "day",
  SOURCE_CREATED_AT_HEADER: "created_at",
  SOURCE_REPORT_HEADER: "ai_report",
  TARGET_HEADERS: [
    "\u5bc4\u9001\u65e5\u671f",
    "\u4fe1\u4ef6\u6a19\u984c",
    "\u4eca\u65e5\u5831\u544a",
    "\u72c0\u614b",
  ],
  TARGET_STATUS_DRAFT: "\u5f85\u5bc4\u9001",
};

function transferLatestDailyReportAndTrashSource() {
  const today = new Date();
  const latestReport = findLatestDailyAiReport_(today);
  const emailHtml = buildEmailHtmlFromAiReport_(latestReport.aiReport, latestReport.dayText);
  let deleteResult;

  writeDailyAiReportToTarget_(latestReport, today, emailHtml);
  deleteResult = tryDeleteSourceDailyReportRow_(latestReport.rowIndex);

  return {
    sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
    targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
    day: latestReport.dayText,
    createdAt: latestReport.createdAtText,
    htmlGenerated: true,
    deletedSourceRow: deleteResult.deleted,
    deletedSourceRowNumber: deleteResult.rowIndex,
    deleteSourceRowError: deleteResult.error,
  };
}

function findLatestDailyAiReport_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const sourceSs = SpreadsheetApp.openById(config.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(config.SOURCE_SHEET_NAME);
  if (!sourceSheet) throw new Error("Source sheet not found: " + config.SOURCE_SHEET_NAME);

  const values = sourceSheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("Source DailyReports has no data rows.");

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const requiredHeaders = [
    config.SOURCE_DATE_HEADER,
    config.SOURCE_CREATED_AT_HEADER,
    config.SOURCE_REPORT_HEADER,
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) throw new Error("DailyReports missing header: " + header);
  });

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd");
  const candidates = values.slice(1)
    .map((row, index) => {
      const day = parseDate_(row[idx[config.SOURCE_DATE_HEADER]]);
      const aiReport = String(row[idx[config.SOURCE_REPORT_HEADER]] || "").trim();
      if (!day || !aiReport) return null;

      const dayText = Utilities.formatDate(day, CONFIG.TZ, "yyyy-MM-dd");
      if (dayText !== todayText) return null;

      const createdAt = parseDate_(row[idx[config.SOURCE_CREATED_AT_HEADER]]) || day;
      return {
        rowIndex: index + 2,
        dayText,
        createdAt,
        createdAtText: Utilities.formatDate(createdAt, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ss"),
        aiReport,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.rowIndex - a.rowIndex);

  if (candidates.length === 0) {
    throw new Error("No non-empty ai_report found for today: " + todayText);
  }

  return candidates[0];
}

function writeDailyAiReportToTarget_(latestReport, today, emailHtml) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const values = targetSheet.getDataRange().getValues();
  const dateText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const title = buildAutoReportSubject_(today, getVariables_(targetSs));
  const rowValues = [
    dateText,
    title,
    emailHtml,
    config.TARGET_STATUS_DRAFT,
  ];

  targetSheet.appendRow(rowValues);
}

function ensureDailyReportTargetHeaders_(sheet) {
  const headers = DAILY_REPORT_TRANSFER_CONFIG.TARGET_HEADERS;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
    .getValues()[0]
    .map(header => String(header).trim());
  const hasAllHeaders = headers.every((header, index) => currentHeaders[index] === header);
  if (hasAllHeaders) return;

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function findTargetReportRowByDate_(rows, idx, dateText) {
  const dateHeader = DAILY_REPORT_TRANSFER_CONFIG.TARGET_HEADERS[0];
  if (idx[dateHeader] === undefined) return null;

  for (let i = 0; i < rows.length; i++) {
    const rowDate = parseDate_(rows[i][idx[dateHeader]]);
    if (!rowDate) continue;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    if (rowDateText === dateText) return i + 2;
  }

  return null;
}

function deleteSourceDailyReportRow_(rowIndex) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const sourceSs = SpreadsheetApp.openById(config.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(config.SOURCE_SHEET_NAME);
  if (!sourceSheet) throw new Error("Source sheet not found: " + config.SOURCE_SHEET_NAME);
  sourceSheet.deleteRow(rowIndex);
}

function tryDeleteSourceDailyReportRow_(rowIndex) {
  try {
    deleteSourceDailyReportRow_(rowIndex);
    return {
      deleted: true,
      rowIndex,
      error: "",
    };
  } catch (error) {
    Logger.log("Source report was transferred but row was not deleted: " + error.message);
    return {
      deleted: false,
      rowIndex,
      error: error.message,
    };
  }
}
