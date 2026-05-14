function sendDailyFinanceReport() {
  const today = new Date();

  if (isWeekend_(today)) {
    Logger.log("六日不寄送。");
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);

  normalizeReportSheet_(ss, vars);
  ensureNextBusinessDayReportRow_(ss);

  const report = getTodayReport_(ss, today, vars);

  if (!report) {
    Logger.log("找不到今日財報。");
    return;
  }

  if (!String(report["今日報告"] || "").trim()) {
    Logger.log("今日報告是空白，不寄送。");
    return;
  }

  const subscribers = getActiveSubscribers_(ss, vars, today);
  const sentMap = getSentMap_(ss, today);

  subscribers.forEach(subscriber => {
    const logKey = buildLogKey_(today, subscriber.email, "daily_report");

    if (sentMap[logKey]) {
      Logger.log("已寄送，略過：" + subscriber.email);
      return;
    }

    const subject = buildSubject_(report, subscriber);
    const htmlBody = buildFinanceReportHtml_(report, vars, subscriber);

    try {
      MailApp.sendEmail({
        to: subscriber.email,
        subject: subject,
        htmlBody: htmlBody,
        name: vars.sender_name || vars.brand_name || "Dean",
        replyTo: vars.reply_to_email || undefined,
      });

      appendLog_(ss, today, subscriber, "daily_report", "success", "寄送成功");
    } catch (error) {
      appendLog_(ss, today, subscriber, "daily_report", "error", error.message);
    }
  });

  markTodayReportSent_(ss, today, vars);
  ensureNextBusinessDayReportRow_(ss);
}