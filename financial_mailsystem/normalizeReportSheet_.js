function normalizeReportSheet_(ss, vars) {
  const sheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(["寄送日期", "信件標題", "今日報告", "狀態"]);
    return;
  }

  const oldHeaders = values[0].map(header => String(header).trim());

  if (
    oldHeaders.length === 1 &&
    oldHeaders[0] === "今日報告"
  ) {
    const oldReports = values.slice(1)
      .map(row => String(row[0] || "").trim())
      .filter(text => text);

    sheet.clearContents();
    sheet.appendRow(["寄送日期", "信件標題", "今日報告", "狀態"]);

    oldReports.forEach((report, index) => {
      const date = index === 0
        ? new Date()
        : addDays_(new Date(), index);

      sheet.appendRow([
        Utilities.formatDate(date, CONFIG.TZ, "yyyy/MM/dd"),
        buildAutoReportSubject_(date, vars),
        report,
        "待寄送",
      ]);
    });

    return;
  }

  const requiredHeaders = ["寄送日期", "信件標題", "今日報告", "狀態"];
  const missing = requiredHeaders.filter(header => oldHeaders.indexOf(header) === -1);

  if (missing.length === 0) return;

  const oldRows = values.slice(1);
  const oldIdx = indexMap_(oldHeaders);

  sheet.clearContents();
  sheet.appendRow(requiredHeaders);

  oldRows.forEach(row => {
    const reportText = oldIdx["今日報告"] !== undefined
      ? row[oldIdx["今日報告"]]
      : "";

    const dateValue = oldIdx["日期"] !== undefined
      ? row[oldIdx["日期"]]
      : row[oldIdx["寄送日期"]];

    const titleValue = oldIdx["信件標題"] !== undefined
      ? row[oldIdx["信件標題"]]
      : "";

    const statusValue = oldIdx["狀態"] !== undefined
      ? row[oldIdx["狀態"]]
      : "待寄送";

    sheet.appendRow([
      dateValue || "",
      titleValue || "",
      reportText || "",
      statusValue || "待寄送",
    ]);
  });
}