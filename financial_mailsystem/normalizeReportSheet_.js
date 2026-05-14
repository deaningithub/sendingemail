function normalizeReportSheet_(ss, vars) {
  const sheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  const values = sheet.getDataRange().getValues();
  const requiredHeaders = ["寄送日期", "信件標題", "今日報告", "狀態"];

  if (values.length === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return;
  }

  const oldHeaders = values[0].map(header => String(header).trim());
  const missing = requiredHeaders.filter(header => oldHeaders.indexOf(header) === -1);
  if (missing.length === 0) return;

  const oldRows = values.slice(1);
  const oldIdx = indexMap_(oldHeaders);

  sheet.clearContents();
  sheet.appendRow(requiredHeaders);

  oldRows.forEach(row => {
    const reportText = getFirstExistingColumnValue_(row, oldIdx, ["今日報告", "財報內容", "報告內容"]);
    const dateValue = getFirstExistingColumnValue_(row, oldIdx, ["寄送日期", "日期", "date"]);
    const titleValue = getFirstExistingColumnValue_(row, oldIdx, ["信件標題", "標題", "subject"]);
    const statusValue = getFirstExistingColumnValue_(row, oldIdx, ["狀態", "status"]);

    sheet.appendRow([
      dateValue || "",
      titleValue || "",
      reportText || "",
      statusValue || "待寄送",
    ]);
  });
}

function getFirstExistingColumnValue_(row, idx, candidateHeaders) {
  for (let i = 0; i < candidateHeaders.length; i++) {
    const header = candidateHeaders[i];
    if (idx[header] !== undefined) return row[idx[header]];
  }

  return "";
}
