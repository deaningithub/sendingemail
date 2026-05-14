function ensureNextBusinessDayReportRow_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  const values = sheet.getDataRange().getValues();
  const headers = ["寄送日期", "信件標題", "今日報告", "狀態"];

  if (values.length === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const currentHeaders = values[0].map(header => String(header).trim());
  const idx = indexMap_(currentHeaders);
  if (idx["寄送日期"] === undefined) return;
  if (idx["今日報告"] === undefined) return;
  if (idx["狀態"] === undefined) return;

  const nextBusinessDay = getNextBusinessDay_(new Date());
  const nextText = Utilities.formatDate(nextBusinessDay, CONFIG.TZ, "yyyy/MM/dd");
  const rows = values.slice(1);
  const exists = rows.some(row => {
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    const reportBody = String(row[idx["今日報告"]] || "").trim();
    if (!rowDate || reportBody) return false;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    return rowDateText === nextText;
  });

  if (exists) return;

  sheet.appendRow([
    nextText,
    "",
    "",
    "待寄送",
  ]);
}
