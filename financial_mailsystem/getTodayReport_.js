function getTodayReport_(ss, today, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) throw new Error("找不到工作表：" + CONFIG.REPORT_SHEET);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(header => String(header).trim());
  const rows = values.slice(1);
  const idx = indexMap_(headers);

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");

  if (idx["寄送日期"] === undefined) throw new Error("今日財報缺少欄位：寄送日期");
  if (idx["信件標題"] === undefined) throw new Error("今日財報缺少欄位：信件標題");
  if (idx["今日報告"] === undefined) throw new Error("今日財報缺少欄位：今日報告");
  if (idx["狀態"] === undefined) throw new Error("今日財報缺少欄位：狀態");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    if (!rowDate) continue;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");

    if (rowDateText === todayText) {
      const report = objectFromRow_(headers, row);
      const autoSubject = buildAutoReportSubject_(today, vars);

      report["寄送日期"] = today;
      report["信件標題"] = report["信件標題"] || autoSubject;

      sheet.getRange(i + 2, idx["信件標題"] + 1).setValue(autoSubject);

      return report;
    }
  }

  const latestDraft = findLatestDraftReport_(rows, headers, idx);
  if (!latestDraft) return null;

  const autoSubject = buildAutoReportSubject_(today, vars);
  const targetRow = latestDraft.rowIndex + 2;

  sheet.getRange(targetRow, idx["寄送日期"] + 1).setValue(todayText);
  sheet.getRange(targetRow, idx["信件標題"] + 1).setValue(autoSubject);
  sheet.getRange(targetRow, idx["狀態"] + 1).setValue("待寄送");

  const report = objectFromRow_(headers, latestDraft.row);
  report["寄送日期"] = today;
  report["信件標題"] = autoSubject;

  return report;
}