const CONFIG = {
  SPREADSHEET_ID: "15R-qY3U8S0JQarZWCPwj3l8mF22ZMRY30Gg6kp6Kfg4",
  TZ: "Asia/Taipei",
  FORM_RESPONSE_SHEET: "Form Responses 1",
  REPORT_SHEET: "今日財報",
  VAR_SHEET: "相關變數",
  LOG_SHEET: "寄送紀錄",
};

function setupFinanceMailSystem() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const reportSheet = getOrCreateSheet_(ss, CONFIG.REPORT_SHEET);
  if (reportSheet.getLastRow() === 0) {
    reportSheet.appendRow(["寄送日期", "信件標題", "今日報告", "狀態"]);
    reportSheet.appendRow([
      Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy/MM/dd"),
      "",
      "",
      "待填寫",
    ]);
  }

  const varSheet = getOrCreateSheet_(ss, CONFIG.VAR_SHEET);
  if (varSheet.getLastRow() === 0) {
    varSheet.appendRow(["key", "value", "note"]);
    varSheet.appendRow(["brand_name", "Chiyo 太極瑜珈", "品牌名稱"]);
    varSheet.appendRow(["sender_name", "Dean", "寄件人名稱"]);
    varSheet.appendRow(["reply_to_email", "exhalaok@gmail.com", "回信信箱"]);
    varSheet.appendRow(["replay_form_url", "https://forms.gle/koNZzvJAb8wo6Eyv9", "平常推廣"]);
    varSheet.appendRow(["subscription_form_url", "https://forms.gle/4xvknzqcvnKVBMCj6", "到期前三天續訂"]);
    varSheet.appendRow(["monthly_days", "30", "月方案天數"]);
    varSheet.appendRow(["yearly_days", "365", "年方案天數"]);
    varSheet.appendRow(["service_name", "每日盤中財經時事報告", "服務名稱"]);
    varSheet.appendRow(["replay_service_name", "指定時間線上瑜珈回放課程", "回放課程名稱"]);
    varSheet.appendRow(["unsubscribe_text", "若不想再收到信件，請直接回信告知。", "退訂文字"]);
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