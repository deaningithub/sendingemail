function getTodayReport_(ss, today, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) throw new Error("找不到工作表：" + CONFIG.REPORT_SHEET);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(header => String(header).trim());
  const rows = values.slice(1);
  const idx = indexMap_(headers);
  const dateHeader = "寄送日期";
  const subjectHeader = "信件標題";
  const reportHeader = "今日報告";
  const statusHeader = "狀態";

  [dateHeader, subjectHeader, reportHeader, statusHeader].forEach(header => {
    if (idx[header] === undefined) throw new Error("今日財報缺少欄位：" + header);
  });

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const autoSubject = buildAutoReportSubject_(today, vars);
  const candidates = [];

  rows.forEach((row, index) => {
    const rowDate = parseDate_(row[idx[dateHeader]]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    const reportBody = String(row[idx[reportHeader]] || "").trim();
    if (rowDateText !== todayText || !reportBody) return;

    candidates.push({
      rowIndex: index,
      rowNumber: index + 2,
      row,
    });
  });

  if (candidates.length === 0) return null;

  const latest = candidates[candidates.length - 1];
  const report = objectFromRow_(headers, latest.row);

  report[dateHeader] = today;
  report[subjectHeader] = report[subjectHeader] || autoSubject;
  report._rowNumber = latest.rowNumber;

  if (!latest.row[idx[subjectHeader]]) {
    sheet.getRange(latest.rowNumber, idx[subjectHeader] + 1).setValue(autoSubject);
  }

  return report;
}
