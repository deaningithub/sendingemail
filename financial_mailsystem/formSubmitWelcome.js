function setupSubscriptionFormSubmitTrigger() {
  deleteTriggerByFunctionName_("onFormSubmit");

  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(CONFIG.SPREADSHEET_ID)
    .onFormSubmit()
    .create();
}

function onFormSubmit(e) {
  if (!e || !e.range) {
    Logger.log("Missing form submit event range.");
    return;
  }

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  if (sheetName === SUBSCRIBER_MAIL_CONFIG.PAID_SHEET_NAME) {
    sendWelcomeReportForSubmittedPaidSubscriber_(sheet, e.range.getRow());
    return;
  }

  if (sheetName === SUBSCRIBER_MAIL_CONFIG.FREE_SHEET_NAME) {
    sendWelcomeReportForSubmittedFreeSubscriber_(sheet, e.range.getRow());
    return;
  }

  Logger.log("Ignored form submit from sheet: " + sheetName);
}

function sendWelcomeReportForSubmittedPaidSubscriber_(sheet, rowNumber) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);
  const today = new Date();
  const subscriber = buildPaidSubscriberFromSubmittedRow_(sheet, rowNumber, vars, today);

  sendWelcomeReportToSubscriber_(ss, today, vars, subscriber, "paid");
}

function sendWelcomeReportForSubmittedFreeSubscriber_(sheet, rowNumber) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);
  const today = new Date();
  const subscriber = buildFreeSubscriberFromSubmittedRow_(sheet, rowNumber, today);

  sendWelcomeReportToSubscriber_(ss, today, vars, subscriber, "free");
}

function sendWelcomeReportToSubscriber_(ss, today, vars, subscriber, audienceType) {
  if (!subscriber.email) {
    Logger.log("Submitted subscriber has no email; skip welcome report.");
    return;
  }

  const report = getLatestAvailableMailReport_(ss, vars);
  if (!report) {
    Logger.log("No available report for welcome email.");
    return;
  }

  const mailType = audienceType === "paid" ? "welcome_paid" : "welcome_free";
  const sentMap = getSentMap_(ss, today);
  const logKey = buildLogKey_(today, subscriber.email, mailType);
  if (sentMap[logKey]) {
    Logger.log("Welcome report already sent today to " + subscriber.email);
    return;
  }

  subscriber.isWelcome = true;

  try {
    MailApp.sendEmail({
      to: subscriber.email,
      subject: buildWelcomeSubject_(report, audienceType),
      htmlBody: buildAudienceFinanceReportHtml_(report, vars, subscriber, audienceType),
      name: vars.sender_name || vars.brand_name || "Dean",
      replyTo: vars.reply_to_email || undefined,
    });

    appendLog_(ss, today, subscriber, mailType, "success", "welcome sent");
  } catch (error) {
    appendLog_(ss, today, subscriber, mailType, "error", error.message);
  }
}

function buildPaidSubscriberFromSubmittedRow_(sheet, rowNumber, vars, today) {
  const rowObject = getSubmittedRowObject_(sheet, rowNumber);
  const timestamp = parseDate_(rowObject[SUBSCRIBER_MAIL_CONFIG.PAID_TIMESTAMP_HEADER]) || today;
  const plan = String(rowObject[SUBSCRIBER_MAIL_CONFIG.PAID_PLAN_HEADER] || "").trim();
  const monthlyDays = Number(vars.monthly_days || 30);
  const yearlyDays = Number(vars.yearly_days || 365);
  const expireDate = addDays_(timestamp, getPlanDurationDaysForMail_(plan, monthlyDays, yearlyDays));
  const daysLeft = diffDays_(today, expireDate);

  return {
    email: normalizeEmail_(rowObject[SUBSCRIBER_MAIL_CONFIG.PAID_EMAIL_HEADER]),
    lineName: String(rowObject[SUBSCRIBER_MAIL_CONFIG.PAID_NAME_HEADER] || "").trim(),
    plan,
    timestamp,
    expireDate,
    daysLeft,
    isExpiringSoon: daysLeft >= 0 && daysLeft <= SUBSCRIBER_MAIL_CONFIG.EXPIRING_SOON_DAYS,
    audienceType: "paid",
  };
}

function buildFreeSubscriberFromSubmittedRow_(sheet, rowNumber, today) {
  const rowObject = getSubmittedRowObject_(sheet, rowNumber);
  const timestamp = parseDate_(rowObject[SUBSCRIBER_MAIL_CONFIG.FREE_TIMESTAMP_HEADER]) || today;

  return {
    email: normalizeEmail_(rowObject[SUBSCRIBER_MAIL_CONFIG.FREE_EMAIL_HEADER]),
    lineName: "",
    plan: "\u514d\u8cbb\u8a02\u95b1",
    timestamp,
    expireDate: addDays_(today, 3650),
    daysLeft: 3650,
    isExpiringSoon: false,
    audienceType: "free",
  };
}

function getSubmittedRowObject_(sheet, rowNumber) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(header => String(header).trim());
  const row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];

  return objectFromRow_(headers, row);
}

function getLatestAvailableMailReport_(ss, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) throw new Error("Report sheet not found: " + CONFIG.REPORT_SHEET);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const dateHeader = "\u5bc4\u9001\u65e5\u671f";
  const subjectHeader = "\u4fe1\u4ef6\u6a19\u984c";
  const bodyHeader = "\u4eca\u65e5\u5831\u544a";

  [dateHeader, subjectHeader, bodyHeader].forEach(header => {
    if (idx[header] === undefined) throw new Error("Report sheet missing header: " + header);
  });

  const candidates = values.slice(1)
    .map((row, index) => {
      const body = String(row[idx[bodyHeader]] || "").trim();
      if (!body) return null;

      const reportDate = parseDate_(row[idx[dateHeader]]) || new Date(0);
      return {
        rowIndex: index + 2,
        reportDate,
        row,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.reportDate.getTime() - a.reportDate.getTime() || b.rowIndex - a.rowIndex);

  if (candidates.length === 0) return null;

  const latest = objectFromRow_(headers, candidates[0].row);
  latest[dateHeader] = candidates[0].reportDate;
  latest[subjectHeader] = latest[subjectHeader] || buildAutoReportSubject_(candidates[0].reportDate, vars);

  return latest;
}

function buildWelcomeSubject_(report, audienceType) {
  const base = report["\u4fe1\u4ef6\u6a19\u984c"] || "\u6bcf\u65e5\u76e4\u4e2d\u8ca1\u7d93\u6642\u4e8b\u5831\u544a";
  const prefix = audienceType === "paid"
    ? "\u6b61\u8fce\u52a0\u5165\u4ed8\u8cbb\u8a02\u95b1"
    : "\u6b61\u8fce\u52a0\u5165\u514d\u8cbb\u8a02\u95b1";

  return prefix + " | " + base;
}
