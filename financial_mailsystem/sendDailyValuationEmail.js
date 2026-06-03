const VALUATION_EMAIL_CONFIG = {
  STOCK_SHEET_ID: "1c1COm9ppqpAgCzbtGqWQKzCPEdcH_oKsLv-qkqrT4No",
  AI_VALUATIONS_SHEET: "AIValuations",
  RECIPIENT: "deanisbetter@gmail.com",
  SENDER_NAME: "Dean AI 估值系統",
};

function sendDailyValuationEmailNow() {
  sendDailyValuationEmail_();
}

function setupDailyValuationEmailTrigger() {
  deleteTriggerByFunctionName_("sendDailyValuationEmail_");
  ScriptApp.newTrigger("sendDailyValuationEmail_")
    .timeBased()
    .atHour(9)
    .nearMinute(0)
    .everyDays(1)
    .create();
  Logger.log("Daily valuation email trigger created at 09:00 " + CONFIG.TZ);
}

function sendDailyValuationEmail_() {
  const today = new Date();
  if (isWeekend_(today)) {
    Logger.log("Weekend — skip valuation email.");
    return;
  }

  const ss = SpreadsheetApp.openById(VALUATION_EMAIL_CONFIG.STOCK_SHEET_ID);
  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/M/d");

  const dailyRows = readTodayValuationRows_(ss, VALUATION_EMAIL_CONFIG.AI_VALUATIONS_SHEET, todayText);

  if (dailyRows.length === 0) {
    Logger.log("No valuation data for " + todayText + "; skip email.");
    return;
  }

  MailApp.sendEmail({
    to: VALUATION_EMAIL_CONFIG.RECIPIENT,
    subject: buildValuationEmailSubject_(today, dailyRows),
    htmlBody: buildValuationEmailHtml_(today, dailyRows),
    name: VALUATION_EMAIL_CONFIG.SENDER_NAME,
  });
  Logger.log("Valuation email sent to " + VALUATION_EMAIL_CONFIG.RECIPIENT);
}

function readTodayValuationRows_(ss, sheetName, todayText) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(h) { return String(h).trim(); });
  return values.slice(1)
    .map(function(row) { return objectFromRow_(headers, row); })
    .filter(function(row) {
      return normalizeValuationDateText_(row["generatedAt"]) === todayText;
    });
}


function normalizeValuationDateText_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TZ, "yyyy/M/d");
  }
  return String(value || "").trim().replace(/^(\d{4})\/0*(\d+)\/0*(\d+)$/, "$1/$2/$3");
}

function buildValuationEmailSubject_(today, dailyRows) {
  const d = Utilities.formatDate(today, CONFIG.TZ, "M/d");
  const sb = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "strong_buy"; }).length;
  const b  = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "buy"; }).length;
  const w  = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "watch"; }).length;
  return "【AI估值】" + d + " 推薦買進 " + (sb + b) + " 支・不建議 " + w + " 支";
}
