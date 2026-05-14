const CONFIG = {
  SPREADSHEET_ID: "1hqtYYrLw-4oAS0exkqv0Ka0Usfq4bHJh5Gs2AHtj114",
  TZ: "Asia/Taipei",
  FORM_RESPONSE_SHEET: "Form Responses 1",
  REPORT_SHEET: "\u4eca\u65e5\u8ca1\u5831",
  VAR_SHEET: "\u76f8\u95dc\u8b8a\u6578",
  LOG_SHEET: "\u5bc4\u9001\u7d00\u9304",
};

function setupFinanceMailSystem() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const reportSheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  if (reportSheet.getLastRow() === 0) {
    reportSheet.appendRow(["\u5bc4\u9001\u65e5\u671f", "\u4fe1\u4ef6\u6a19\u984c", "\u4eca\u65e5\u5831\u544a", "\u72c0\u614b"]);
    reportSheet.appendRow([
      Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy/MM/dd"),
      "",
      "",
      "\u5f85\u5bc4\u9001",
    ]);
  }

  const varSheet = getOrCreateSheet_(ss, CONFIG.VAR_SHEET);
  if (varSheet.getLastRow() === 0) {
    varSheet.appendRow(["key", "value", "note"]);
    varSheet.appendRow(["brand_name", "Chiyo \u592a\u6975\u745c\u73c8", "\u54c1\u724c\u540d\u7a31"]);
    varSheet.appendRow(["sender_name", "Dean", "\u5bc4\u4ef6\u4eba\u540d\u7a31"]);
    varSheet.appendRow(["reply_to_email", "exhalaok@gmail.com", "\u56de\u4fe1\u4fe1\u7bb1"]);
    varSheet.appendRow(["replay_form_url", "https://forms.gle/koNZzvJAb8wo6Eyv9", "\u5e73\u5e38\u63a8\u5ee3"]);
    varSheet.appendRow(["subscription_form_url", "https://forms.gle/4xvknzqcvnKVBMCj6", "\u5230\u671f\u524d\u4e09\u5929\u7e8c\u8a02"]);
    varSheet.appendRow(["official_site_url", SUBSCRIBER_MAIL_CONFIG.OFFICIAL_SITE_URL, "\u5b98\u65b9\u8ab2\u7a0b\u7db2\u7ad9"]);
    varSheet.appendRow(["free_unsubscribe_form_url", "", "\u514d\u8cbb\u8a02\u95b1\u8abf\u6574\u6216\u53d6\u6d88\u8868\u55ae"]);
    varSheet.appendRow(["monthly_days", "30", "\u6708\u65b9\u6848\u5929\u6578"]);
    varSheet.appendRow(["yearly_days", "365", "\u5e74\u65b9\u6848\u5929\u6578"]);
    varSheet.appendRow(["service_name", "\u6bcf\u65e5\u76e4\u4e2d\u8ca1\u7d93\u6642\u4e8b\u5831\u544a", "\u670d\u52d9\u540d\u7a31"]);
  }

  const logSheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET);
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow([
      "timestamp",
      "date",
      "email",
      "lineName",
      "plan",
      "expireDate",
      "daysLeft",
      "mailType",
      "status",
      "message",
    ]);
  }

  ensureNextBusinessDayReportRow_(ss);
}
