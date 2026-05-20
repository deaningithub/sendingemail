function markTodayReportSent_(ss, today, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) return;

  const report = getTodayReport_(ss, today, vars);
  if (!report || !report._rowNumber) return;

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return;

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const subjectHeader = "信件標題";
  const statusHeader = "狀態";

  if (idx[subjectHeader] === undefined) return;
  if (idx[statusHeader] === undefined) return;

  const autoSubject = buildAutoReportSubject_(today, vars);
  sheet.getRange(report._rowNumber, idx[subjectHeader] + 1).setValue(report[subjectHeader] || autoSubject);
  sheet.getRange(report._rowNumber, idx[statusHeader] + 1).setValue("已寄送");
  markReportSentAt_(sheet, report._rowNumber, idx, new Date());
}

function markMailReportSent_(ss, report, sentAt) {
  if (!report || !report._rowNumber) return;

  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return;

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const statusHeader = "狀態";

  if (idx[statusHeader] === undefined) return;

  sheet.getRange(report._rowNumber, idx[statusHeader] + 1).setValue("已寄送");
  markReportSentAt_(sheet, report._rowNumber, idx, sentAt || new Date());
}

function markReportSentAt_(sheet, rowNumber, idx, sentAt) {
  const sentTimeHeader = "寄送時間";
  if (idx[sentTimeHeader] === undefined) return;

  sheet
    .getRange(rowNumber, idx[sentTimeHeader] + 1)
    .setValue(Utilities.formatDate(sentAt || new Date(), CONFIG.TZ, "HH:mm:ss"));
}
