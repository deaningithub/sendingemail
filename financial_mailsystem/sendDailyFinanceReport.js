function sendDailyFinanceReport() {
  const today = new Date();

  if (isWeekend_(today)) {
    Logger.log("Weekend; skip daily finance report.");
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);

  sendDailyPaidFinanceReport();
  sendDailyFreeFinanceReport();

  markTodayReportSent_(ss, today, vars);
  ensureNextBusinessDayReportRow_(ss);
}
