const DAILY_REPORT_TRANSFER_CONFIG = {
  SOURCE_SPREADSHEET_ID: "1_w31qxAogDkc8_Dtm8aLBH53uhAZYf7e-IFm5NMombA",
  TARGET_SPREADSHEET_ID: "1hqtYYrLw-4oAS0exkqv0Ka0Usfq4bHJh5Gs2AHtj114",
  BACKUP_SPREADSHEET_ID: "1J6oeQrzEBsi3j23CSa3QrM1Uk5LtRn76W4NuYOC0a0A",
  SOURCE_SHEET_NAME: "DailyReports",
  BACKUP_SHEET_NAME: "\u539f\u59cb\u5831\u544a",
  TARGET_SHEET_NAME: "\u4eca\u65e5\u8ca1\u5831",
  SOURCE_RUN_ID_HEADER: "run_id",
  SOURCE_DATE_HEADER: "day",
  SOURCE_CREATED_AT_HEADER: "created_at",
  SOURCE_REPORT_HEADER: "ai_report",
  SOURCE_MARKDOWN_HEADER: "report_markdown",
  BACKUP_HEADERS: [
    "run_id",
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
    { name: "morning", startMinute: 8 * 60 + 30, endMinute: 10 * 60, title: "<\u76e4\u524d\u5206\u6790>" },
    { name: "midday", startMinute: 10 * 60, endMinute: 12 * 60, title: "<\u76e4\u4e2d\u5feb\u5831>" },
    { name: "evening", startMinute: 12 * 60, endMinute: 19 * 60, title: "<\u76e4\u5f8c\u6574\u7406>" },
  ],
  TARGET_HEADERS: [
    "\u5bc4\u9001\u65e5\u671f",
    "\u4fe1\u4ef6\u6a19\u984c",
    "\u4eca\u65e5\u5831\u544a",
    "\u72c0\u614b",
    "\u5bc4\u9001\u6642\u9593",
    "\u751f\u6210\u6642\u9593",
    "\u8f49\u5165\u6642\u9593",
    "run_id",
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
    return logDailyReportTransferResult_({
      skipped: true,
      reason: "transferLatestDailyReportAndTrashSource is already running.",
    });
  }

  try {
    return transferLatestDailyReportAndTrashSourceLocked_({});
  } finally {
    lock.releaseLock();
  }
}

function transferLatestDailyReportFromLatestSourceNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return logDailyReportTransferResult_({
      skipped: true,
      reason: "transferLatestDailyReportAndTrashSource is already running.",
    });
  }

  try {
    return transferLatestDailyReportAndTrashSourceLocked_({
      manualLatestToday: true,
    });
  } finally {
    lock.releaseLock();
  }
}

function inspectLatestDailyReportSourceNow() {
  const today = new Date();
  const result = inspectLatestDailyReportSource_(today);
  return logDailyReportTransferResult_(result);
}

function cleanupInvalidDailyReportRows() {
  cleanupInvalidTargetReportRows_(new Date());
}

function transferLatestDailyReportAndTrashSourceLocked_(options) {
  options = options || {};
  const today = new Date();
  if (isWeekend_(today)) {
    cleanupInvalidTargetReportRows_(today);
    return logDailyReportTransferResult_({
      sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
      targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
      backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
      day: Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd"),
      htmlGenerated: false,
      skippedWeekend: true,
      message: "Weekend; skip daily report transfer.",
    });
  }

  const activeSlot = getActiveDailyReportSlot_(today);
  const backupResult = backupRecentDailyReportsAndPruneSource_(today);
  cleanupInvalidTargetReportRows_(today);
  cleanupDuplicateMissingDailyReports_(today);
  cleanupDuplicateTransferredDailyReports_(today);
  const latestReport = options.manualLatestToday
    ? findLatestDailyAiReport_(today, null, { manualLatestToday: true })
    : activeSlot ? findLatestDailyAiReport_(today, activeSlot, {}) : null;

  if (!latestReport) {
    return logDailyReportTransferResult_({
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
    });
  }

  if (isDailyReportAlreadyTransferred_(today, latestReport)) {
    return logDailyReportTransferResult_({
      sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
      targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
      backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
      day: latestReport.dayText,
      runId: latestReport.runId,
      createdAt: latestReport.createdAtText,
      slot: latestReport.slot.name,
      htmlGenerated: false,
      skippedDuplicate: true,
      backedUpRows: backupResult.backedUpRows,
      deletedOldSourceRows: backupResult.deletedOldSourceRows,
      maintenanceError: backupResult.error,
      message: "Daily report already transferred.",
    });
  }

  if (!hasTransferableDailyAiReport_(latestReport)) {
    return logDailyReportTransferResult_({
      sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
      targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
      backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
      day: latestReport.dayText,
      runId: latestReport.runId,
      createdAt: latestReport.createdAtText,
      slot: latestReport.slot.name,
      htmlGenerated: false,
      skippedEmptyReport: true,
      backedUpRows: backupResult.backedUpRows,
      deletedOldSourceRows: backupResult.deletedOldSourceRows,
      maintenanceError: backupResult.error,
      message: "Latest report has no ai_report text; skip OpenAI request.",
    });
  }

  const emailHtml = buildEmailHtmlFromAiReport_(latestReport.aiReport, latestReport.reportMarkdown, latestReport.dayText);
  writeDailyAiReportToTarget_(latestReport, today, emailHtml);

  return logDailyReportTransferResult_({
    sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
    targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
    backupSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.BACKUP_SPREADSHEET_ID,
    day: latestReport.dayText,
    runId: latestReport.runId,
    createdAt: latestReport.createdAtText,
    slot: latestReport.slot.name,
    htmlGenerated: true,
    backedUpRows: backupResult.backedUpRows,
    deletedOldSourceRows: backupResult.deletedOldSourceRows,
    maintenanceError: backupResult.error,
    manualLatestToday: !!options.manualLatestToday,
    message: "Daily report transferred to target.",
  });
}

function hasTransferableDailyAiReport_(latestReport) {
  return !!latestReport && !!String(latestReport.aiReport || "").trim();
}

function logDailyReportTransferResult_(result) {
  Logger.log("DailyReport transfer result: " + JSON.stringify(result));
  return result;
}

function getActiveDailyReportSlot_(date) {
  const slots = DAILY_REPORT_TRANSFER_CONFIG.SOURCE_REPORT_SLOTS;
  const minutes = getTaipeiMinutesOfDay_(date);
  let activeSlot = null;

  slots.forEach((slot, index) => {
    const nextSlot = slots[index + 1] || null;
    const endMinute = slot.endMinute || (nextSlot ? nextSlot.startMinute : 24 * 60);
    if (minutes >= slot.startMinute && minutes < endMinute) {
      activeSlot = Object.assign({}, slot, {
        endMinute,
      });
    }
  });

  return activeSlot;
}

function getDefaultDailyReportSlot_() {
  const slots = DAILY_REPORT_TRANSFER_CONFIG.SOURCE_REPORT_SLOTS;
  if (!slots || slots.length === 0) return null;

  const firstSlot = slots[0];
  const nextSlot = slots[1] || null;
  return Object.assign({}, firstSlot, {
    endMinute: firstSlot.endMinute || (nextSlot ? nextSlot.startMinute : 24 * 60),
  });
}

function getDailyReportSlotForCreatedAt_(date) {
  const slots = DAILY_REPORT_TRANSFER_CONFIG.SOURCE_REPORT_SLOTS;
  const minutes = getTaipeiMinutesOfDay_(date);
  let matchedSlot = null;

  slots.forEach((slot, index) => {
    const nextSlot = slots[index + 1] || null;
    const upperBound = slot.endMinute || (nextSlot ? nextSlot.startMinute : 24 * 60);
    if (minutes >= slot.startMinute && minutes < upperBound) {
      matchedSlot = Object.assign({}, slot, {
        endMinute: upperBound,
      });
    }
  });

  return matchedSlot;
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
    const values = sheet.getDataRange().getValues();
    const oldIdx = indexMap_(currentHeaders);
    const migratedRows = values.slice(1).map(row => {
      return backupHeaders.map(header => {
        const oldColumnIndex = oldIdx[header];
        return oldColumnIndex === undefined ? "" : row[oldColumnIndex];
      });
    });

    sheet.clearContents();
    sheet.getRange(1, 1, 1, backupHeaders.length).setValues([backupHeaders]);
    if (migratedRows.length > 0) {
      sheet.getRange(2, 1, migratedRows.length, backupHeaders.length).setValues(migratedRows);
    }
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
  const runIdIndex = idx[DAILY_REPORT_TRANSFER_CONFIG.SOURCE_RUN_ID_HEADER];
  const runId = runIdIndex === undefined ? "" : String(row[runIdIndex] || "").trim();
  if (runId) return runId;

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

function findLatestDailyAiReport_(today, activeSlot, options) {
  options = options || {};
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
    config.SOURCE_MARKDOWN_HEADER,
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) throw new Error("DailyReports missing header: " + header);
  });

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd");
  const candidates = values.slice(1)
    .map((row, index) => {
      const day = parseDate_(row[idx[config.SOURCE_DATE_HEADER]]);
      const aiReport = String(row[idx[config.SOURCE_REPORT_HEADER]] || "").trim();
      const reportMarkdown = String(row[idx[config.SOURCE_MARKDOWN_HEADER]] || "").trim();
      if (!day || !aiReport) return null;

      const dayText = Utilities.formatDate(day, CONFIG.TZ, "yyyy-MM-dd");
      if (dayText !== todayText) return null;

      const createdAt = parseDate_(row[idx[config.SOURCE_CREATED_AT_HEADER]]) || day;
      const createdAtMinutes = getTaipeiMinutesOfDay_(createdAt);
      if (activeSlot && !isDailyReportCreatedAtInSlot_(createdAtMinutes, activeSlot)) return null;
      const runIdIndex = idx[config.SOURCE_RUN_ID_HEADER];
      const reportSlot = activeSlot
        || getDailyReportSlotForCreatedAt_(createdAt)
        || getActiveDailyReportSlot_(today)
        || getDefaultDailyReportSlot_();

      return {
        rowIndex: index + 2,
        runId: runIdIndex === undefined ? "" : String(row[runIdIndex] || "").trim(),
        dayText,
        createdAt,
        createdAtText: Utilities.formatDate(createdAt, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ss"),
        generatedTimeText: Utilities.formatDate(createdAt, CONFIG.TZ, "HH:mm:ss"),
        slot: reportSlot,
        aiReport,
        reportMarkdown,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.rowIndex - a.rowIndex);

  if (candidates.length === 0) return null;

  return candidates[0];
}

function isDailyReportCreatedAtInSlot_(createdAtMinutes, activeSlot) {
  return createdAtMinutes >= activeSlot.startMinute && createdAtMinutes < activeSlot.endMinute;
}

function inspectLatestDailyReportSource_(today) {
  const activeSlot = getActiveDailyReportSlot_(today);
  const latestForActiveSlot = activeSlot ? findLatestDailyAiReport_(today, activeSlot, {}) : null;
  const latestToday = findLatestDailyAiReport_(today, null, { manualLatestToday: true });

  return {
    sourceSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.SOURCE_SPREADSHEET_ID,
    targetSpreadsheetId: DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID,
    day: Utilities.formatDate(today, CONFIG.TZ, "yyyy-MM-dd"),
    activeSlot: activeSlot ? activeSlot.name : "",
    activeSlotStart: activeSlot ? minutesToTimeText_(activeSlot.startMinute) : "",
    activeSlotEnd: activeSlot ? minutesToTimeText_(activeSlot.endMinute) : "",
    latestForActiveSlot: buildDailyReportInspectSummary_(latestForActiveSlot),
    latestToday: buildDailyReportInspectSummary_(latestToday),
    message: latestForActiveSlot
      ? "Found transferable ai_report for active slot."
      : latestToday
        ? "No active-slot match; latest today exists and can be transferred manually."
        : "No non-empty ai_report found for today.",
  };
}

function buildDailyReportInspectSummary_(report) {
  if (!report) return null;

  return {
    rowIndex: report.rowIndex,
    runId: report.runId,
    day: report.dayText,
    createdAt: report.createdAtText,
    generatedTime: report.generatedTimeText,
    slot: report.slot ? report.slot.name : "",
    aiReportLength: String(report.aiReport || "").length,
    reportMarkdownLength: String(report.reportMarkdown || "").length,
  };
}

function minutesToTimeText_(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return ("0" + hour).slice(-2) + ":" + ("0" + minute).slice(-2);
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
    "",
    generatedTimeText,
    transferredTimeText,
    latestReport.runId || "",
  ];
  const rowNumber = findReusableMissingDailyReportRow_(targetSheet, today, latestReport.slot);

  if (rowNumber) {
    targetSheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
    return;
  }

  targetSheet.appendRow(rowValues);
}

function cleanupInvalidTargetReportRows_(today) {
  const config = DAILY_REPORT_TRANSFER_CONFIG;
  const targetSs = SpreadsheetApp.openById(config.TARGET_SPREADSHEET_ID);
  const targetSheet = getOrCreateSheet_(targetSs, config.TARGET_SHEET_NAME);

  ensureDailyReportTargetHeaders_(targetSheet);

  const values = targetSheet.getDataRange().getValues();
  if (values.length < 2) return;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const rowsToDelete = [];

  values.slice(1).forEach((row, index) => {
    const rowDate = parseDate_(row[0]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    const reportBody = String(row[2] || "").trim();
    const status = String(row[3] || "").trim();
    const isPlaceholder = !reportBody
      && (status === config.TARGET_STATUS_DRAFT || status === config.TARGET_STATUS_NOT_FOUND || !status);
    const isMissingReportPlaceholder = !reportBody && status === config.TARGET_STATUS_NOT_FOUND;

    if (isWeekend_(rowDate) || isMissingReportPlaceholder || (rowDateText > todayText && isPlaceholder)) {
      rowsToDelete.push(index + 2);
    }
  });

  rowsToDelete
    .sort((a, b) => b - a)
    .forEach(rowNumber => targetSheet.deleteRow(rowNumber));
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
    const generatedTime = normalizeDisplayTimeText_(displayRow[5], values[index + 1][5]);
    const runId = String(displayRow[7] || values[index + 1][7] || "").trim();

    if (!reportBody) return;

    const key = runId || [rowDateText, rowTitle, generatedTime].join("|");
    if (!key || key === "||") return;
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
  const latestRunId = String(latestReport.runId || "").trim();

  return displayValues.slice(1).some((displayRow, index) => {
    const rowRunId = String(displayRow[7] || values[index + 1][7] || "").trim();
    if (latestRunId && rowRunId === latestRunId) {
      return !!String(displayRow[2] || values[index + 1][2] || "").trim();
    }

    const rowDateText = normalizeDisplayDateText_(displayRow[0], values[index + 1][0]);
    const rowTitle = String(displayRow[1] || "").trim();
    const reportBody = String(displayRow[2] || "").trim();
    const generatedTime = normalizeDisplayTimeText_(displayRow[5], values[index + 1][5]);

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

  const values = sheet.getDataRange().getValues();
  const oldIdx = indexMap_(currentHeaders);
  const migratedRows = values.slice(1).map(row => {
    return headers.map(header => {
      const oldColumnIndex = oldIdx[header];
      return oldColumnIndex === undefined ? "" : row[oldColumnIndex];
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (migratedRows.length > 0) {
    sheet.getRange(2, 1, migratedRows.length, headers.length).setValues(migratedRows);
  }
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
