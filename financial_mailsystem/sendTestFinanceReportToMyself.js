function sendTestFinanceReportToMyself() {
  const testEmail = Session.getActiveUser().getEmail();
  const today = new Date();

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);

  normalizeReportSheet_(ss, vars);
  ensureNextBusinessDayReportRow_(ss);

  const report = getTodayReport_(ss, today, vars);

  if (!report) {
    throw new Error("找不到今日財報。");
  }

  if (!String(report["今日報告"] || "").trim()) {
    throw new Error("今日報告是空白。請先在「今日財報」填入內容。");
  }

  const subscriber = {
    email: testEmail,
    lineName: "測試用戶",
    plan: "月訂閱｜NT$200｜每月手動續訂一次",
    timestamp: today,
    expireDate: addDays_(today, 30),
    daysLeft: 30,
    isExpiringSoon: false,
  };

  MailApp.sendEmail({
    to: testEmail,
    subject: "[測試] " + buildSubject_(report, subscriber),
    htmlBody: buildFinanceReportHtml_(report, vars, subscriber),
    name: vars.sender_name || vars.brand_name || "Dean",
    replyTo: vars.reply_to_email || undefined,
  });
}
