function ensureNextBusinessDayReportRow_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length === 0) {
    sheet.appendRow(["寄送日期", "信件標題", "今日報告", "狀態"]);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(header => String(header).trim());
  const idx = indexMap_(headers);

  if (idx["寄送日期"] === undefined) return;
  if (idx["今日報告"] === undefined) return;
  if (idx["狀態"] === undefined) return;

  const nextBusinessDay = getNextBusinessDay_(new Date());
  const nextText = Utilities.formatDate(nextBusinessDay, CONFIG.TZ, "yyyy/MM/dd");

  const rows = data.slice(1);

  const exists = rows.some(row => {
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    if (!rowDate) return false;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    return rowDateText === nextText;
  });

  if (exists) return;

  sheet.appendRow([
    nextText,
    "",
    "",
    "待填寫",
  ]);
}