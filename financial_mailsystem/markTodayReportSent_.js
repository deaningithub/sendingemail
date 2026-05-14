function markTodayReportSent_(ss, today, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);

  if (idx["寄送日期"] === undefined) return;
  if (idx["信件標題"] === undefined) return;
  if (idx["狀態"] === undefined) return;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const autoSubject = buildAutoReportSubject_(today, vars);

  values.slice(1).forEach((row, index) => {
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");

    if (rowDateText === todayText) {
      const rowNumber = index + 2;
      sheet.getRange(rowNumber, idx["信件標題"] + 1).setValue(autoSubject);
      sheet.getRange(rowNumber, idx["狀態"] + 1).setValue("已寄送");
    }
  });
}