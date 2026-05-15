const DAILY_REPORT_TRANSFER_CONFIG = {
  SOURCE_SPREADSHEET_ID: "1_w31qxAogDkc8_Dtm8aLBH53uhAZYf7e-IFm5NMombA",
  TARGET_SPREADSHEET_ID: "1hqtYYrLw-4oAS0exkqv0Ka0Usfq4bHJh5Gs2AHtj114",
  BACKUP_SPREADSHEET_ID: "1J6oeQrzEBsi3j23CSa3QrM1Uk5LtRn76W4NuYOC0a0A",
  SOURCE_SHEET_NAME: "DailyReports",
  BACKUP_SHEET_NAME: "\u539f\u59cb\u5831\u544a",
  TARGET_SHEET_NAME: "\u4eca\u65e5\u8ca1\u5831",
  SOURCE_DATE_HEADER: "day",
  SOURCE_CREATED_AT_HEADER: "created_at",
  SOURCE_REPORT_HEADER: "ai_report",
  BACKUP_HEADERS: [
    "day",
    "created_at",
    "report_path",
    "news_count",
    "market_snapshot_count",
    "risk_metric_count",
    "sheet_monitor_sync",
    "sheet_keyword_seed",
    "ai_report",
    "report_markdown",
  ],
  SOURCE_RETENTION_DAYS: 30,
  BACKUP_LOOKBACK_DAYS: 730,
  SOURCE_REPORT_SLOTS: [
    { name: "morning", startMinute: 8 * 60 + 45, title: "<\u76e4\u524d\u5206\u6790>" },
    { name: "midday", startMinute: 11 * 60 + 30, title: "<\u76e4\u4e2d\u5feb\u5831>" },
    { name: "evening", startMinute: 14 * 60, title: "<\u76e4\u5f8c\u6574\u7406>" },
  ],
  TARGET_HEADERS: [
    "\u5bc4\u9001\u65e5\u671f",
    "\u4fe1\u4ef6\u6a19\u984c",
    "\u4eca\u65e5\u5831\u544a",
    "\u72c0\u614b",
    "\u751f\u6210\u6642\u9593",
    "\u8f49\u5165\u6642\u9593",
  ],
  TARGET_STATUS_DRAFT: "\u5f85\u5bc4\u9001",
  TARGET_STATUS_NOT_FOUND: "\u627e\u4e0d\u5230\u5831\u544a",
};

function setupTransferLatestDailyReportEveryMinuteTrigger() {
  deleteTriggerByFunctionName_("transferLatestDailyReportAndTrashSource");

  ScriptApp.newTrigger("transferLatestDailyReportAndTrashSource")
    .timeBased()
    .everyMinutes(1)
    .create();
}

function transferLatestDailyReportAndTrashSource() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return {
      skipped: true,
      reason: "transferLatestDailyReportAndTrashSource is already running.",
    };
  }

  try {
    return transferLatestDailyReportAndTrashSourceLocked_();
  } finally {
    lock.releaseLock();
  }
}

function transferLatestDailyReportAndTrashSourceLocked_() {
  const today = new Date();
  const activeSlot = getActiveDailyReportSlot_(today);
  const backupResult = backupRecentDailyReportsAndPruneSource_(today);
  cleanupDuplicateMissingDailyReports_(today);
  cleanupDuplicateTransferredDailyReports_(today);
  const latestReport = activeSlot ? findLatestDailyAiReport_(today, activeSlot) : null;

  if (!latestReport) {
    writeMissingDailyAiReportToTarget_(today, activeSlot);
    return {
      sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
      targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
      backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
      day: Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd"),
      createdAt: Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ss"),
      slot: activeSlot ? activeSlot.name : "",
      htmlGenerated: false,
      backedUpRows: backupResult.backedUpRows,
      deletedOldSourceRows: backupResult.deletedOldSourceRows,
      maintenanceError: backupResult.error,
      message: activeSlot
        ? "No non-empty ai_report found for current slot: " + activeSlot.name
        : "No active report slot yet.",
    };
  }

  if (isDailyReportAlreadyTransferred_(today, latestReport)) {
    return {
      sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
      targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
      backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
      day: latestReport.dayText,
      createdAt: latestReport.createdAtText,
      slot: latestReport.slot.name,
      htmlGenerated: false,
      skippedDuplicate: true,
      backedUpRows: backupResult.backedUpRows,
      deletedOldSourceRows: backupResult.deletedOldSourceRows,
      maintenanceError: backupResult.error,
    };
  }

  const emailHtml = buildEmailHtmlFromAiReport_(latestReport.aiReport, latestReport.dayText);
  writeDailyAiReportToTarget_(latestReport, today, emailHtml);

  return {
    sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
    targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
    backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
    day: latestReport.dayText,
    createdAt: latestReport.createdAtText,
    slot: latestReport.slot.name,
    htmlGenerated: true,
    backedUpRows: backupResult.backedUpRows,
    deletedOldSourceRows: backupResult.deletedOldSourceRows,
    maintenanceError: backupResult.error,
  };
}

function getActiveDailyReportSlot_(date) {
  const slots = DAILY_REPORT_TRANSFER_CONFIG.SOURCE_REPORT_SLOTS;
  const minutes = getTaipeiMinutesOfDay_(date);
  let activeSlot = null;

  slots.forEach((slot, index) => {
    const nextSlot = slots[index + 1] || null;
    if (minutes >= slot.startMinute && (!nextSlot || minutes < nextSlot.startMinute)) {
      activeSlot = Object.assign({}, slot, {
        endMinute: nextSlot ? nextSlot.startMinute : 24 * 60,
      });
    }
  });

  return activeSlot;
}

function getTaipeiMinutesOfDay_(date) {
  const hour = Number(Utilities.formatDate(date, CONFIG.TZ, "H"));
  const minute = Number(Utilities.formatDate(date, CONFIG.TZ, "m"));
  return hour * 60 + minute;
}

function backupRecentDailyReportsAndPruneSource_(today) {
  try {
    const backupResult = backupRecentDailyReports_(today);
    const pruneResult = pruneOldSourceDailyReports_(today);

    return {
      backedUpRows: backupResult.backedUpRows,
      deletedOldSourceRows: pruneResult.deletedRows,
      error: "",
    };
  } catch (error) {
    Logger.log("DailyReports maintenance failed: " + error.message);
    return {
      backedUpRows: 0,
      deletedOldSourceRows: 0,
      error: error.message,
    };
  }
}

function backupRecentDailyReports_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const sourceSs = SpreadsheetApp.openById(config.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(config.SOURCE_SHEET_NAME);
  if (!sourceSheet) throw new Error("Source sheet not found: " + config.SOURCE_SHEET_NAME);

  const sourceValues = sourceSheet.getDataRange().getValues();
  if (sourceValues.length === 0) return { backedUpRows: 0 };

  const sourceHeaders = sourceValues[0].map(header => String(header).trim());
  const sourceIdx = indexMap_(sourceHeaders);
  if (sourceIdx[config.SOURCE_DATE_HEADER] === undefined) {
    throw new Error("DailyReports missing header: " + config.SOURCE_DATE_HEADER);
  }
  if (sourceIdx[config.SOURCE_CREATED_AT_HEADER] === undefined) {
    throw new Error("DailyReports missing header: " + config.SOURCE_CREATED_AT_HEADER);
  }

  const backupSs = SpreadsheetApp.openById(config.BACKUP_SPREADSHEET_ID);
  const backupHeaders = config.BACKUP_HEADERS;
  const backupSheet = getOrCreateDailyReportBackupSheet_(backupSs, backupHeaders);
  const backupKeys = getDailyReportBackupKeys_(backupSheet, backupHeaders);
  const cutoff = addDays_(today, -config.BACKUP_LOOKBACK_DAYS);
  const rowsToAppend = [];

  sourceValues.slice(1).forEach(row => {
    const day = parseDate_(row[sourceIdx[config.SOURCE_DATE_HEADER]]);
    if (!day || day < cutoff) return;

    const backupRow = buildDailyReportBackupRow_(backupHeaders, sourceIdx, row);
    const key = buildDailyReportUniqueKey_(backupHeaders, backupRow);
    if (backupKeys[key]) return;

    rowsToAppend.push(backupRow);
    backupKeys[key] = true;
  });

  if (rowsToAppend.length > 0) {
    backupSheet
      .getRange(backupSheet.getLastRow() + 1, 1, rowsToAppend.length, backupHeaders.length)
      .setValues(rowsToAppend);
  }

  Logger.log(
    "DailyReports backup completed: spreadsheet=" + config.BACKUP_SPREADSHEET_ID
    + ", sheet=" + config.BACKUP_SHEET_NAME
    + ", appendedRows=" + rowsToAppend.length
  );

  return { backedUpRows: rowsToAppend.length };
}

function buildDailyReportBackupRow_(backupHeaders, sourceIdx, sourceRow) {
  return backupHeaders.map(header => {
    const sourceIndex = sourceIdx[header];
    return sourceIndex === undefined ? "" : sourceRow[sourceIndex] || "";
  });
}

function getOrCreateDailyReportBackupSheet_(backupSs, backupHeaders) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  let sheet = backupSs.getSheetByName(config.BACKUP_SHEET_NAME);

  if (!sheet) {
    sheet = backupSs.insertSheet(config.BACKUP_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(backupHeaders);
    return sheet;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), backupHeaders.length))
    .getValues()[0]
    .map(header => String(header).trim());

  const hasSameHeaders = backupHeaders.every((header, index) => currentHeaders[index] === header);
  if (!hasSameHeaders) {
    sheet.getRange(1, 1, 1, backupHeaders.length).setValues([backupHeaders]);
  }

  return sheet;
}

function getDailyReportBackupKeys_(backupSheet, headers) {
  const values = backupSheet.getDataRange().getValues();
  const keys = {};

  if (values.length < 2) return keys;

  values.slice(1).forEach(row => {
    keys[buildDailyReportUniqueKey_(headers, row)] = true;
  });

  return keys;
}

function buildDailyReportUniqueKey_(headers, row) {
  const idx = indexMap_(headers);
  const day = normalizeDailyReportKeyDate_(row[idx[DAILY_REPORT_TRANSFER_CONFIG.SOURCE_DATE_HEADER]]);
  const createdAt = normalizeDailyReportKeyDateTime_(row[idx[DAILY_REPORT_TRANSFER_CONFIG.SOURCE_CREATED_AT_HEADER]]);

  return [day, createdAt].join("|");
}

function normalizeDailyReportKeyDate_(value) {
  const date = parseDate_(value);
  if (date) return Utilities.formatDate(date, CONFIG.TZ, "yyyy-MM-dd");
  return String(value || "").trim();
}

function normalizeDailyReportKeyDateTime_(value) {
  const date = parseDate_(value);
  if (date) return Utilities.formatDate(date, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  return String(value || "").trim();
}

function pruneOldSourceDailyReports_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const sourceSs = SpreadsheetApp.openById(config.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(config.SOURCE_SHEET_NAME);
  if (!sourceSheet) throw new Error("Source sheet not found: " + config.SOURCE_SHEET_NAME);

  const values = sourceSheet.getDataRange().getValues();
  if (values.length < 2) return { deletedRows: 0 };

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  if (idx[config.SOURCE_DATE_HEADER] === undefined) {
    throw new Error("DailyReports missing header: " + config.SOURCE_DATE_HEADER);
  }

  const cutoff = addDays_(today, -config.SOURCE_RETENTION_DAYS);
  let deletedRows = 0;

  for (let rowNumber = values.length; rowNumber >= 2; rowNumber--) {
    const row = values[rowNumber - 1];
    const day = parseDate_(row[idx[config.SOURCE_DATE_HEADER]]);
    if (!day || day >= cutoff) continue;

    sourceSheet.deleteRow(rowNumber);
    deletedRows++;
  }

  return { deletedRows };
}

function findLatestDailyAiReport_(today, activeSlot) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const sourceSs = SpreadsheetApp.openById(config.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(config.SOURCE_SHEET_NAME);
  if (!sourceSheet) throw new Error("Source sheet not found: " + config.SOURCE_SHEET_NAME);

  const values = sourceSheet.getDataRange().getValues();
  if (values.length < 2) return null;

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
      const createdAtMinutes = getTaipeiMinutesOfDay_(createdAt);
      if (activeSlot && createdAtMinutes < activeSlot.startMinute) return null;
      if (activeSlot && createdAtMinutes >= activeSlot.endMinute) return null;

      return {
        rowIndex: index + 2,
        dayText,
        createdAt,
        createdAtText: Utilities.formatDate(createdAt, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ss"),
        generatedTimeText: Utilities.formatDate(createdAt, CONFIG.TZ, "HH:mm:ss"),
        slot: activeSlot,
        aiReport,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.rowIndex - a.rowIndex);

  if (candidates.length === 0) return null;

  return candidates[0];
}

function writeDailyAiReportToTarget_(latestReport, today, emailHtml) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const dateText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const generatedAt = latestReport.createdAt || today;
  const title = latestReport.slot ? latestReport.slot.title : buildTimedDailyReportSubject_(generatedAt);
  const generatedTimeText = latestReport.generatedTimeText || Utilities.formatDate(generatedAt, CONFIG.TZ, "HH:mm:ss");
  const transferredTimeText = Utilities.formatDate(new Date(), CONFIG.TZ, "HH:mm:ss");
  const rowValues = [
    dateText,
    title,
    emailHtml,
    config.TARGET_STATUS_DRAFT,
    generatedTimeText,
    transferredTimeText,
  ];
  const rowNumber = findReusableMissingDailyReportRow_(targetSheet, today, latestReport.slot);

  if (rowNumber) {
    targetSheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
    return;
  }

  targetSheet.appendRow(rowValues);
}

function writeMissingDailyAiReportToTarget_(today, activeSlot) {
  if (!activeSlot) return;

  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const rowNumber = findReusableMissingDailyReportRow_(targetSheet, today, activeSlot) || Math.max(targetSheet.getLastRow(), 2);

  targetSheet.getRange(rowNumber, 1).setValue(Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd"));
  targetSheet.getRange(rowNumber, 2).setValue(activeSlot.title);
  targetSheet.getRange(rowNumber, 4).setValue(config.TARGET_STATUS_NOT_FOUND);
  targetSheet.getRange(rowNumber, 5).setValue(Utilities.formatDate(today, CONFIG.TZ, "HH:mm:ss"));
  targetSheet.getRange(rowNumber, 6).setValue(Utilities.formatDate(new Date(), CONFIG.TZ, "HH:mm:ss"));
}

function cleanupDuplicateMissingDailyReports_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const values = targetSheet.getDataRange().getValues();
  if (values.length < 3) return;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const activeSlot = getActiveDailyReportSlot_(today);
  if (!activeSlot) return;

  const title = activeSlot.title;
  const duplicateRows = [];

  values.slice(1).forEach((row, index) => {
    const rowDate = parseDate_(row[0]);
    const rowDateText = rowDate
      ? Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd")
      : String(row[0] || "").trim();
    const rowTitle = String(row[1] || "").trim();
    const reportBody = String(row[2] || "").trim();
    const status = String(row[3] || "").trim();

    if (rowDateText === todayText && rowTitle === title && !reportBody && status === config.TARGET_STATUS_NOT_FOUND) {
      duplicateRows.push(index + 2);
    }
  });

  if (duplicateRows.length < 2) return;

  for (let i = duplicateRows.length - 2; i >= 0; i--) {
    targetSheet.deleteRow(duplicateRows[i]);
  }
}

function cleanupDuplicateTransferredDailyReports_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const range = targetSheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  if (displayValues.length < 3) return;

  const rowsByKey = {};

  displayValues.slice(1).forEach((displayRow, index) => {
    const rowNumber = index + 2;
    const rowDateText = normalizeDisplayDateText_(displayRow[0], values[index + 1][0]);
    const rowTitle = String(displayRow[1] || "").trim();
    const reportBody = String(displayRow[2] || "").trim();
    const status = String(displayRow[3] || "").trim();
    const generatedTime = normalizeDisplayTimeText_(displayRow[4], values[index + 1][4]);

    if (!rowDateText || !rowTitle || !reportBody || !generatedTime) return;

    const key = [rowDateText, rowTitle, generatedTime].join("|");
    if (!rowsByKey[key]) rowsByKey[key] = [];
    rowsByKey[key].push({
      rowNumber,
      status,
    });
  });

  const duplicateRows = [];

  Object.keys(rowsByKey).forEach(key => {
    const rows = rowsByKey[key];
    if (rows.length < 2) return;

    const sentRows = rows.filter(row => row.status === "\u5df2\u5bc4\u9001");
    const keepRowNumber = sentRows.length > 0
      ? sentRows[sentRows.length - 1].rowNumber
      : rows[rows.length - 1].rowNumber;

    rows.forEach(row => {
      if (row.rowNumber !== keepRowNumber) duplicateRows.push(row.rowNumber);
    });
  });

  duplicateRows
    .sort((a, b) => b - a)
    .forEach(rowNumber => targetSheet.deleteRow(rowNumber));
}

function findReusableMissingDailyReportRow_(targetSheet, today, activeSlot) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const values = targetSheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const title = activeSlot ? activeSlot.title : buildTimedDailyReportSubject_(today);

  for (let index = values.length - 1; index >= 1; index--) {
    const row = values[index];
    const rowDate = parseDate_(row[0]);
    const rowDateText = rowDate
      ? Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd")
      : String(row[0] || "").trim();
    const rowTitle = String(row[1] || "").trim();
    const reportBody = String(row[2] || "").trim();
    const status = String(row[3] || "").trim();

    if (rowDateText === todayText && rowTitle === title && !reportBody && status === config.TARGET_STATUS_NOT_FOUND) {
      return index + 1;
    }
  }

  return null;
}

function buildTimedDailyReportSubject_(date) {
  const activeSlot = getActiveDailyReportSlot_(date);
  if (activeSlot) return activeSlot.title;

  return "<\u76e4\u524d\u5206\u6790>";
}

function isDailyReportAlreadyTransferred_(today, latestReport) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const range = targetSheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  if (displayValues.length < 2) return false;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const title = latestReport.slot ? latestReport.slot.title : buildTimedDailyReportSubject_(latestReport.createdAt);
  const generatedTimeText = latestReport.generatedTimeText || Utilities.formatDate(latestReport.createdAt, CONFIG.TZ, "HH:mm:ss");

  return displayValues.slice(1).some((displayRow, index) => {
    const rowDateText = normalizeDisplayDateText_(displayRow[0], values[index + 1][0]);
    const rowTitle = String(displayRow[1] || "").trim();
    const reportBody = String(displayRow[2] || "").trim();
    const generatedTime = normalizeDisplayTimeText_(displayRow[4], values[index + 1][4]);

    return rowDateText === todayText
      && rowTitle === title
      && generatedTime === generatedTimeText
      && !!reportBody;
  });
}

function normalizeDisplayDateText_(displayValue, rawValue) {
  const displayText = String(displayValue || "").trim();
  if (displayText) {
    const parsedDisplayDate = parseDate_(displayText);
    if (parsedDisplayDate) return Utilities.formatDate(parsedDisplayDate, CONFIG.TZ, "yyyy/MM/dd");
    return displayText;
  }

  const rawDate = parseDate_(rawValue);
  return rawDate ? Utilities.formatDate(rawDate, CONFIG.TZ, "yyyy/MM/dd") : "";
}

function normalizeDisplayTimeText_(displayValue, rawValue) {
  const displayText = String(displayValue || "").trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(displayText)) {
    const parts = displayText.split(":");
    const hour = ("0" + parts[0]).slice(-2);
    const minute = parts[1];
    const second = parts[2] || "00";
    return [hour, minute, second].join(":");
  }

  if (displayText) return displayText;

  return normalizeTimeText_(rawValue);
}

function normalizeTimeText_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TZ, "HH:mm:ss");
  }

  return String(value || "").trim();
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
