const SUBSCRIBER_MAIL_CONFIG = {
  FREE_SHEET_NAME: "\u514d\u8cbb\u8a02\u7d04",
  CANCEL_SHEET_NAME: "\u53d6\u6d88\u8a02\u95b1\u56de\u61c9",
  PAID_SHEET_NAME: "Form Responses 1",
  FREE_TIMESTAMP_HEADER: "\u6642\u9593\u6233\u8a18",
  FREE_EMAIL_HEADER: "\u96fb\u5b50\u90f5\u4ef6\u5730\u5740",
  CANCEL_TIMESTAMP_HEADER: "\u6642\u9593\u6233\u8a18",
  CANCEL_EMAIL_HEADER: "\u96fb\u5b50\u90f5\u4ef6\u5730\u5740",
  CANCEL_CHOICE_HEADER: "\u4f60\u78ba\u5b9a\u8981\u53d6\u6d88\u8a02\u95b1\u55ce\uff1f",
  CANCEL_CHOICE_CANCEL: "\u4ecd\u8981\u53d6\u6d88\u8a02\u95b1",
  CANCEL_CHOICE_UPGRADE: "\u5347\u7d1a\u4ed8\u8cbb\u8a02\u95b1",
  PAID_TIMESTAMP_HEADER: "\u6642\u9593\u6233\u8a18",
  PAID_EMAIL_HEADER: "\u96fb\u5b50\u90f5\u4ef6\u5730\u5740",
  PAID_NAME_HEADER: "LINE \u540d\u7a31\u6216\u65b9\u4fbf\u806f\u7d61\u7684\u540d\u7a31",
  PAID_PLAN_HEADER: "\u8acb\u9078\u64c7\u8a02\u95b1\u65b9\u6848",
  MAIL_SUBJECT_TITLE: "\u76e4\u4e2d\u5206\u6790\u770b\u5929\u4e0b",
  PAID_SUBSCRIPTION_FORM_URL: "https://forms.gle/6L1QwdSYZzWcXGg4A",
  YOGA_COURSE_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdePej5uncVdAt94k7fFbGhO688SGFvhXZsb1wb4H3Io2PS1Q/viewform",
  OFFICIAL_SITE_URL: "https://sites.google.com/view/taichiyo/%E6%89%80%E6%9C%89%E8%AA%B2%E7%A8%8B",
  EXPIRING_SOON_DAYS: 3,
  MAX_RECIPIENTS_PER_EMAIL: 50,
};

function sendDailyPaidFinanceReport() {
  sendDailyFinanceReportByAudience_("paid", buildPaidReportSlotForDate_(new Date()));
}

function sendDailyPaidMorningReport() {
  sendDailyFinanceReportByAudience_("paid", "morning");
}

function sendDailyPaidMiddayReport() {
  sendDailyFinanceReportByAudience_("paid", "midday");
}

function sendDailyPaidEveningReport() {
  sendDailyFinanceReportByAudience_("paid", "evening");
}

function sendDailyFreeFinanceReport() {
  sendDailyFinanceReportByAudience_("free");
}

function buildPaidReportSlotForDate_(date) {
  const hour = Number(Utilities.formatDate(date, CONFIG.TZ, "H"));
  const minute = Number(Utilities.formatDate(date, CONFIG.TZ, "m"));
  const minutes = hour * 60 + minute;

  if (minutes < 9 * 60 + 30) return "morning";
  if (minutes < 14 * 60) return "midday";
  return "evening";
}

function sendDailyFinanceReportByAudience_(audienceType, paidSlot) {
  const today = new Date();
  if (isWeekend_(today)) {
    Logger.log("Weekend; skip daily finance report.");
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const vars = getVariables_(ss);
  const report = audienceType === "free"
    ? prepareTodayFreeMailReport_(ss, today, vars)
    : prepareTodayPaidMailReport_(ss, today, vars, paidSlot);
  if (!report) return;

  const recipients = audienceType === "paid"
    ? getActivePaidSubscribersForMail_(ss, vars, today)
    : getActiveFreeSubscribersForMail_(ss, today);
  const sentMap = getSentMap_(ss, today);
  const mailType = buildDailyReportMailType_(audienceType, paidSlot);
  const pendingRecipients = recipients.filter(recipient => {
    const logKey = buildLogKey_(today, recipient.email, mailType);
    if (sentMap[logKey]) {
      Logger.log("Already sent " + mailType + " to " + recipient.email);
      return false;
    }
    return true;
  });

  groupRecipientsForAudienceBatch_(pendingRecipients, audienceType)
    .forEach(group => {
      chunkRecipients_(group.recipients, SUBSCRIBER_MAIL_CONFIG.MAX_RECIPIENTS_PER_EMAIL)
        .forEach((batch, batchIndex) => {
          sendAudienceBatch_(ss, today, report, vars, batch, audienceType, mailType, group.name + "-" + (batchIndex + 1));
        });
    });
}

function buildDailyReportMailType_(audienceType, paidSlot) {
  if (audienceType !== "paid") return "daily_report_free";

  const slot = paidSlot || "morning";
  if (["morning", "midday", "evening"].indexOf(slot) === -1) {
    throw new Error("Unsupported paid report slot: " + slot);
  }

  return "daily_report_paid_" + slot;
}

function sendAudienceBatch_(ss, today, report, vars, recipients, audienceType, mailType, batchNumber) {
  if (recipients.length === 0) return;

  const emails = recipients.map(recipient => recipient.email);
  const toEmail = vars.reply_to_email || Session.getActiveUser().getEmail();

  try {
    MailApp.sendEmail({
      to: toEmail,
      bcc: emails.join(","),
      subject: buildBatchAudienceSubject_(report, recipients, audienceType, vars),
      htmlBody: buildBatchAudienceFinanceReportHtml_(report, vars, recipients, audienceType),
      name: vars.sender_name || vars.brand_name || "Dean",
      replyTo: vars.reply_to_email || undefined,
    });

    recipients.forEach(recipient => {
      appendLog_(ss, today, recipient, mailType, "success", "sent batch " + batchNumber);
    });
  } catch (error) {
    recipients.forEach(recipient => {
      appendLog_(ss, today, recipient, mailType, "error", error.message);
    });
  }
}

function chunkRecipients_(recipients, chunkSize) {
  const chunks = [];
  for (let i = 0; i < recipients.length; i += chunkSize) {
    chunks.push(recipients.slice(i, i + chunkSize));
  }
  return chunks;
}

function groupRecipientsForAudienceBatch_(recipients, audienceType) {
  if (audienceType !== "paid") {
    return [{ name: "free", recipients }];
  }

  return [
    {
      name: "paid-active",
      recipients: recipients.filter(recipient => !recipient.isExpiringSoon),
    },
    {
      name: "paid-renewal",
      recipients: recipients.filter(recipient => recipient.isExpiringSoon),
    },
  ].filter(group => group.recipients.length > 0);
}

function buildBatchAudienceSubject_(report, recipients, audienceType, vars) {
  const base = buildConfiguredMailSubject_(report, vars);
  if (audienceType === "paid" && recipients.some(recipient => recipient.isExpiringSoon)) {
    return "\u7e8c\u8a02\u63d0\u9192 | " + base;
  }
  return base;
}

function buildBatchAudienceFinanceReportHtml_(report, vars, recipients, audienceType) {
  const batchContext = {
    email: "",
    lineName: "",
    plan: audienceType === "paid" ? "\u4ed8\u8cbb\u8a02\u95b1" : "\u514d\u8cbb\u8a02\u95b1",
    expireDate: new Date(),
    daysLeft: 0,
    isExpiringSoon: audienceType === "paid" && recipients.some(recipient => recipient.isExpiringSoon),
    audienceType,
    isBatch: true,
  };

  return buildAudienceFinanceReportHtml_(report, vars, batchContext, audienceType);
}

function sendSingleAudienceMailForTesting_(ss, today, report, vars, recipient, audienceType, mailType) {
    try {
      MailApp.sendEmail({
        to: recipient.email,
        subject: buildAudienceSubject_(report, recipient, audienceType, vars),
        htmlBody: buildAudienceFinanceReportHtml_(report, vars, recipient, audienceType),
        name: vars.sender_name || vars.brand_name || "Dean",
        replyTo: vars.reply_to_email || undefined,
      });

      appendLog_(ss, today, recipient, mailType, "success", "sent");
    } catch (error) {
      appendLog_(ss, today, recipient, mailType, "error", error.message);
    }
}

function prepareTodayMailReport_(ss, today, vars) {
  normalizeReportSheet_(ss, vars);
  ensureNextBusinessDayReportRow_(ss);

  const report = getTodayReport_(ss, today, vars);
  if (!report) {
    Logger.log("No report found for today.");
    return null;
  }

  if (!String(report["\u4eca\u65e5\u5831\u544a"] || "").trim()) {
    Logger.log("Today report body is blank; skip sending.");
    return null;
  }

  return report;
}

function prepareTodayPaidMailReport_(ss, today, vars, paidSlot) {
  normalizeReportSheet_(ss, vars);
  ensureNextBusinessDayReportRow_(ss);

  const report = getTodayReportByPaidSlot_(ss, today, vars, paidSlot || buildPaidReportSlotForDate_(today));
  if (!report) {
    Logger.log("No paid report found for slot: " + (paidSlot || ""));
    return null;
  }

  return report;
}

function prepareTodayFreeMailReport_(ss, today, vars) {
  normalizeReportSheet_(ss, vars);
  ensureNextBusinessDayReportRow_(ss);

  const report = getTodayMiddayReport_(ss, today, vars);
  if (!report) {
    Logger.log("No midday report found for free subscribers today.");
    return null;
  }

  return report;
}

function getTodayReportByPaidSlot_(ss, today, vars, paidSlot) {
  return getTodayReportBySlotPredicate_(ss, today, vars, function(subject, row, idx) {
    return isPaidSlotMailReportCandidate_(subject, row, idx, paidSlot);
  });
}

function getTodayMiddayReport_(ss, today, vars) {
  return getTodayReportBySlotPredicate_(ss, today, vars, function(subject, row, idx) {
    return isMiddayMailReportCandidate_(subject, row, idx);
  });
}

function getTodayReportBySlotPredicate_(ss, today, vars, slotPredicate) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) throw new Error("找不到工作表：" + CONFIG.REPORT_SHEET);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(header => String(header).trim());
  const rows = values.slice(1);
  const idx = indexMap_(headers);
  const dateHeader = "\u5bc4\u9001\u65e5\u671f";
  const subjectHeader = "\u4fe1\u4ef6\u6a19\u984c";
  const reportHeader = "\u4eca\u65e5\u5831\u544a";
  const statusHeader = "\u72c0\u614b";

  [dateHeader, subjectHeader, reportHeader, statusHeader].forEach(header => {
    if (idx[header] === undefined) throw new Error("今日財報缺少欄位：" + header);
  });

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const candidates = [];

  rows.forEach((row, index) => {
    const rowDate = parseDate_(row[idx[dateHeader]]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");
    const reportBody = String(row[idx[reportHeader]] || "").trim();
    const subject = String(row[idx[subjectHeader]] || "").trim();
    if (rowDateText !== todayText || !reportBody) return;
    if (!slotPredicate(subject, row, idx)) return;

    candidates.push({
      rowIndex: index,
      rowNumber: index + 2,
      row,
    });
  });

  if (candidates.length === 0) return null;

  const latest = candidates[candidates.length - 1];
  const report = objectFromRow_(headers, latest.row);
  report[dateHeader] = today;
  report[subjectHeader] = report[subjectHeader] || buildAutoReportSubject_(today, vars);
  report._rowNumber = latest.rowNumber;

  return report;
}

function isPaidSlotMailReportCandidate_(subject, row, idx, paidSlot) {
  if (paidSlot === "morning") return isMorningMailReportCandidate_(subject, row, idx);
  if (paidSlot === "midday") return isMiddayMailReportCandidate_(subject, row, idx);
  if (paidSlot === "evening") return isEveningMailReportCandidate_(subject, row, idx);
  return false;
}

function isMorningMailReportCandidate_(subject, row, idx) {
  const subjectText = String(subject || "").trim();
  if (subjectText.indexOf("\u76e4\u4e2d") >= 0 || subjectText.indexOf("\u76e4\u5f8c") >= 0) return false;
  if (subjectText.indexOf("\u76e4\u524d") >= 0) return true;

  const generatedMinutes = getGeneratedMinutesForReportRow_(row, idx);
  return generatedMinutes !== null && generatedMinutes >= 8 * 60 + 45 && generatedMinutes < 11 * 60 + 30;
}

function isMiddayMailReportCandidate_(subject, row, idx) {
  const subjectText = String(subject || "").trim();
  if (subjectText.indexOf("\u76e4\u524d") >= 0 || subjectText.indexOf("\u76e4\u5f8c") >= 0) return false;

  if (subjectText.indexOf("\u76e4\u4e2d") >= 0 && subjectText !== SUBSCRIBER_MAIL_CONFIG.MAIL_SUBJECT_TITLE) {
    return true;
  }

  const generatedMinutes = getGeneratedMinutesForReportRow_(row, idx);
  return generatedMinutes !== null && generatedMinutes >= 11 * 60 + 30 && generatedMinutes < 14 * 60;
}

function isEveningMailReportCandidate_(subject, row, idx) {
  const subjectText = String(subject || "").trim();
  if (subjectText.indexOf("\u76e4\u524d") >= 0 || subjectText.indexOf("\u76e4\u4e2d") >= 0) return false;
  if (subjectText.indexOf("\u76e4\u5f8c") >= 0) return true;

  const generatedMinutes = getGeneratedMinutesForReportRow_(row, idx);
  return generatedMinutes !== null && generatedMinutes >= 14 * 60;
}

function getGeneratedMinutesForReportRow_(row, idx) {
  const generatedTimeIndex = idx["\u751f\u6210\u6642\u9593"];
  if (generatedTimeIndex === undefined) return null;

  return parseTaipeiTimeToMinutes_(row[generatedTimeIndex]);
}

function parseTaipeiTimeToMinutes_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Number(Utilities.formatDate(value, CONFIG.TZ, "H")) * 60
      + Number(Utilities.formatDate(value, CONFIG.TZ, "m"));
  }

  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function getActivePaidSubscribersForMail_(ss, vars, today) {
  const sheet = ss.getSheetByName(SUBSCRIBER_MAIL_CONFIG.PAID_SHEET_NAME);
  if (!sheet) throw new Error("Paid subscriber sheet not found: " + SUBSCRIBER_MAIL_CONFIG.PAID_SHEET_NAME);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const requiredHeaders = [
    SUBSCRIBER_MAIL_CONFIG.PAID_TIMESTAMP_HEADER,
    SUBSCRIBER_MAIL_CONFIG.PAID_EMAIL_HEADER,
    SUBSCRIBER_MAIL_CONFIG.PAID_NAME_HEADER,
    SUBSCRIBER_MAIL_CONFIG.PAID_PLAN_HEADER,
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) throw new Error("Paid subscriber sheet missing header: " + header);
  });

  const monthlyDays = Number(vars.monthly_days || 30);
  const yearlyDays = Number(vars.yearly_days || 365);
  const recordsByEmail = {};

  values.slice(1).forEach((row, index) => {
    const email = normalizeEmail_(row[idx[SUBSCRIBER_MAIL_CONFIG.PAID_EMAIL_HEADER]]);
    const timestamp = parseDate_(row[idx[SUBSCRIBER_MAIL_CONFIG.PAID_TIMESTAMP_HEADER]]);
    if (!email || !timestamp) return;

    const plan = String(row[idx[SUBSCRIBER_MAIL_CONFIG.PAID_PLAN_HEADER]] || "").trim();
    const planType = getSubscriptionPlanTypeForMail_(plan);
    const lineName = String(row[idx[SUBSCRIBER_MAIL_CONFIG.PAID_NAME_HEADER]] || "").trim();
    const durationDays = getPlanDurationDaysForMail_(plan, monthlyDays, yearlyDays);
    if (!recordsByEmail[email]) recordsByEmail[email] = [];

    recordsByEmail[email].push({
      email,
      lineName,
      plan,
      planType,
      timestamp,
      durationDays,
      rowIndex: index,
    });
  });

  return Object.keys(recordsByEmail)
    .map(email => buildPaidSubscriberFromRecords_(recordsByEmail[email], today))
    .filter(subscriber => subscriber && subscriber.daysLeft >= 0);
}

function buildPaidSubscriberFromRecords_(records, today) {
  if (!records || records.length === 0) return null;

  const sortedRecords = records.slice().sort((a, b) => {
    const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
    return timeDiff || a.rowIndex - b.rowIndex;
  });

  let expireDate = null;
  let latestRecord = null;

  sortedRecords.forEach(record => {
    const startDate = expireDate && expireDate > record.timestamp
      ? expireDate
      : record.timestamp;

    expireDate = addDays_(startDate, record.durationDays);
    latestRecord = record;
  });

  if (!latestRecord || !expireDate) return null;

  const daysLeft = diffDays_(today, expireDate);

  return {
    email: latestRecord.email,
    lineName: latestRecord.lineName,
    plan: latestRecord.plan,
    planType: latestRecord.planType,
    timestamp: latestRecord.timestamp,
    expireDate,
    daysLeft,
    isExpiringSoon: daysLeft >= 0 && daysLeft <= SUBSCRIBER_MAIL_CONFIG.EXPIRING_SOON_DAYS,
    audienceType: "paid",
  };
}

function getActiveFreeSubscribersForMail_(ss, today) {
  const sheet = ss.getSheetByName(SUBSCRIBER_MAIL_CONFIG.FREE_SHEET_NAME);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const requiredHeaders = [
    SUBSCRIBER_MAIL_CONFIG.FREE_TIMESTAMP_HEADER,
    SUBSCRIBER_MAIL_CONFIG.FREE_EMAIL_HEADER,
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) throw new Error("Free subscriber sheet missing header: " + header);
  });

  const cancelMap = getLatestFreeCancelChoiceByEmail_(ss);
  const paidEmails = getActivePaidSubscribersForMail_(ss, getVariables_(ss), today)
    .reduce((map, subscriber) => {
      map[subscriber.email] = true;
      return map;
    }, {});
  const latestByEmail = {};

  values.slice(1).forEach(row => {
    const email = normalizeEmail_(row[idx[SUBSCRIBER_MAIL_CONFIG.FREE_EMAIL_HEADER]]);
    const timestamp = parseDate_(row[idx[SUBSCRIBER_MAIL_CONFIG.FREE_TIMESTAMP_HEADER]]);
    if (!email || !timestamp) return;
    if (paidEmails[email]) return;

    const cancelChoice = cancelMap[email] && cancelMap[email].choice;
    if (cancelChoice === SUBSCRIBER_MAIL_CONFIG.CANCEL_CHOICE_CANCEL) return;
    if (cancelChoice === SUBSCRIBER_MAIL_CONFIG.CANCEL_CHOICE_UPGRADE) return;

    const subscriber = {
      email,
      lineName: "",
      plan: "\u514d\u8cbb\u8a02\u95b1",
      timestamp,
      expireDate: addDays_(today, 3650),
      daysLeft: 3650,
      isExpiringSoon: false,
      audienceType: "free",
    };

    if (!latestByEmail[email] || timestamp > latestByEmail[email].timestamp) {
      latestByEmail[email] = subscriber;
    }
  });

  return Object.values(latestByEmail);
}

function getLatestFreeCancelChoiceByEmail_(ss) {
  const sheet = ss.getSheetByName(SUBSCRIBER_MAIL_CONFIG.CANCEL_SHEET_NAME);
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const requiredHeaders = [
    SUBSCRIBER_MAIL_CONFIG.CANCEL_TIMESTAMP_HEADER,
    SUBSCRIBER_MAIL_CONFIG.CANCEL_EMAIL_HEADER,
    SUBSCRIBER_MAIL_CONFIG.CANCEL_CHOICE_HEADER,
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) throw new Error("Cancel sheet missing header: " + header);
  });

  return values.slice(1).reduce((latestByEmail, row) => {
    const email = normalizeEmail_(row[idx[SUBSCRIBER_MAIL_CONFIG.CANCEL_EMAIL_HEADER]]);
    const timestamp = parseDate_(row[idx[SUBSCRIBER_MAIL_CONFIG.CANCEL_TIMESTAMP_HEADER]]);
    if (!email || !timestamp) return latestByEmail;

    const choice = String(row[idx[SUBSCRIBER_MAIL_CONFIG.CANCEL_CHOICE_HEADER]] || "").trim();
    if (!latestByEmail[email] || timestamp > latestByEmail[email].timestamp) {
      latestByEmail[email] = { timestamp, choice };
    }

    return latestByEmail;
  }, {});
}

function getPlanDurationDaysForMail_(plan, monthlyDays, yearlyDays) {
  return getSubscriptionPlanTypeForMail_(plan) === "yearly" ? yearlyDays : monthlyDays;
}

function getSubscriptionPlanTypeForMail_(plan) {
  const text = String(plan || "").toLowerCase();
  if (text.indexOf("\u5e74\u8a02\u95b1") >= 0 || text.indexOf("\u5e74") >= 0 || text.indexOf("year") >= 0 || text.indexOf("1800") >= 0) {
    return "yearly";
  }

  if (text.indexOf("\u6708\u8a02\u95b1") >= 0 || text.indexOf("\u6bcf\u6708\u624b\u52d5") >= 0 || text.indexOf("month") >= 0 || text.indexOf("200") >= 0) {
    return "monthly";
  }

  return "monthly";
}

function buildAudienceSubject_(report, recipient, audienceType, vars) {
  const base = buildConfiguredMailSubject_(report, vars);
  if (audienceType === "paid" && recipient.isExpiringSoon) {
    return "\u7e8c\u8a02\u63d0\u9192\uff1a\u5269 " + recipient.daysLeft + " \u5929 | " + base;
  }
  return base;
}

function buildAudienceFinanceReportHtml_(report, vars, recipient, audienceType) {
  const brandName = vars.brand_name || "Chiyo \u8ca1\u7d93";
  const reportTitle = report["\u4fe1\u4ef6\u6a19\u984c"] || vars.service_name || SUBSCRIBER_MAIL_CONFIG.MAIL_SUBJECT_TITLE;
  const reportBody = formatReportBody_(report["\u4eca\u65e5\u5831\u544a"] || "");
  const reportDate = formatReportDate_(report["\u5bc4\u9001\u65e5\u671f"]);
  const officialSiteUrl = getOfficialSiteUrl_(vars);
  const paidSubscriptionFormUrl = vars.subscription_form_url || SUBSCRIBER_MAIL_CONFIG.PAID_SUBSCRIPTION_FORM_URL;

  return `
<div style="margin:0;padding:0;background:#f7f4f2;font-family:Arial,'Noto Sans TC',sans-serif;color:#222;">
  <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
    <div style="background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e6ded9;">
      <div style="font-size:14px;color:#8c7f78;margin-bottom:8px;">${escapeHtml_(brandName)}</div>
      <h1 style="font-size:26px;line-height:1.35;margin:0 0 12px;color:#2d2724;">${escapeHtml_(reportTitle)}</h1>
      <div style="font-size:14px;color:#8c7f78;margin-bottom:24px;">${escapeHtml_(reportDate)}</div>
      ${recipient.isWelcome ? buildWelcomeSubscriberBlock_(audienceType) : ""}
      <div style="font-size:16px;line-height:1.95;color:#332d29;">${reportBody}</div>
      ${audienceType === "free" ? buildPaidSubscriptionCtaBlock_(paidSubscriptionFormUrl) : ""}
      ${audienceType === "paid"
        ? buildPaidSubscriberBlock_(vars, recipient, officialSiteUrl)
        : buildFreeSubscriberBlock_(vars, paidSubscriptionFormUrl)}
    </div>
  </div>
</div>
`;
}

function buildConfiguredMailSubject_(report, vars) {
  return vars.email_subject
    || vars.mail_subject
    || vars.service_name
    || report["\u4fe1\u4ef6\u6a19\u984c"]
    || SUBSCRIBER_MAIL_CONFIG.MAIL_SUBJECT_TITLE;
}

function getOfficialSiteUrl_(vars) {
  return vars.official_site_url || vars.official_url || SUBSCRIBER_MAIL_CONFIG.OFFICIAL_SITE_URL;
}

function buildWelcomeSubscriberBlock_(audienceType) {
  const title = audienceType === "paid"
    ? "\u6b61\u8fce\u52a0\u5165\u4ed8\u8cbb\u8a02\u95b1"
    : "\u6b61\u8fce\u52a0\u5165\u514d\u8cbb\u8a02\u95b1";

  return `
<div style="margin:0 0 26px;padding:22px;background:#fbfaf9;border-left:4px solid #8f7b6c;border-radius:12px;">
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#2d2724;">${title}</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    \u5f88\u958b\u5fc3\u4f60\u4f86\u5230\u9019\u88e1\u3002<br>
    \u9019\u5c01\u4fe1\u5148\u628a\u6700\u65b0\u7684\u8ca1\u7d93\u5831\u544a\u9001\u7d66\u4f60\uff0c\u672a\u4f86\u6211\u6703\u6301\u7e8c\u7528\u6e05\u695a\u3001\u7a69\u5b9a\u3001\u597d\u5438\u6536\u7684\u65b9\u5f0f\uff0c\u966a\u4f60\u770b\u61c2\u5e02\u5834\u4e0a\u7684\u91cd\u8981\u8b8a\u5316\u3002
  </div>
</div>
`;
}

function buildPaidSubscriptionCtaBlock_(paidSubscriptionFormUrl) {
  return `
<div style="margin:30px 0;padding:22px;background:#f3eeee;border-radius:16px;">
  <div style="font-size:13px;color:#8c7f78;margin-bottom:8px;">\u5347\u7d1a\u4ed8\u8cbb\u8a02\u95b1</div>
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#2d2724;">\u60f3\u8981\u66f4\u5b8c\u6574\u7684\u6bcf\u65e5\u5e02\u5834\u89c0\u5bdf\uff0c\u6b61\u8fce\u52a0\u5165\u4ed8\u8cbb\u7248\u3002</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    \u514d\u8cbb\u7248\u6703\u63d0\u4f9b\u76e4\u4e2d\u5206\u6790\u5831\u544a\uff1b\u4ed8\u8cbb\u7248\u6703\u63d0\u4f9b\u66f4\u5b8c\u6574\u7684\u6bcf\u65e5\u8ca1\u7d93\u6574\u7406\u8207\u8ffd\u8e64\uff0c\u8b93\u4f60\u5728\u5e02\u5834\u8b8a\u5316\u4e2d\u66f4\u5feb\u638c\u63e1\u91cd\u9ede\u3002
  </div>
  <a href="${escapeHtml_(paidSubscriptionFormUrl)}" style="display:inline-block;margin-top:14px;padding:12px 18px;background:#2d2724;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">\u52a0\u5165\u4ed8\u8cbb\u7248\u8a02\u95b1</a>
</div>
`;
}

function buildPaidSubscriberBlock_(vars, recipient, officialSiteUrl) {
  if (recipient.isBatch && recipient.isExpiringSoon) {
    return buildPaidRenewalBlock_(vars.subscription_form_url || officialSiteUrl, recipient);
  }

  if (recipient.isBatch) {
    return `
<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e6ded9;font-size:13px;line-height:1.7;color:#8c7f78;">
  <div>\u4f60\u76ee\u524d\u662f\u4ed8\u8cbb\u8a02\u95b1\u8005\uff0c\u4ed8\u8cbb\u671f\u9593\u5c07\u6301\u7e8c\u6536\u5230\u6bcf\u65e5\u8ca1\u7d93\u6574\u7406\u3002</div>
  <div>\u4ed8\u8cbb\u8a02\u95b1\u5230\u671f\u5f8c\u5c07\u81ea\u52d5\u505c\u6b62\u5bc4\u9001\uff1b\u82e5\u63a5\u8fd1\u5230\u671f\uff0c\u7cfb\u7d71\u6703\u53e6\u884c\u63d0\u9192\u7e8c\u8a02\u3002</div>
</div>
`;
  }

  if (recipient.isExpiringSoon) {
    return buildPaidRenewalBlock_(vars.subscription_form_url || officialSiteUrl, recipient);
  }

  return `
<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e6ded9;font-size:13px;line-height:1.7;color:#8c7f78;">
  <div>\u4ed8\u8cbb\u8a02\u95b1\u65b9\u6848\uff1a${escapeHtml_(recipient.plan)}</div>
  <div>\u8a02\u95b1\u5230\u671f\u65e5\uff1a${escapeHtml_(formatReportDate_(recipient.expireDate))}</div>
  <div>\u82e5\u4f60\u63d0\u524d\u7e8c\u8a02\u6216\u5f9e\u6708\u8a02\u95b1\u5347\u7d1a\u5e74\u8a02\u95b1\uff0c\u7cfb\u7d71\u6703\u81ea\u52d5\u63a5\u5728\u76ee\u524d\u5230\u671f\u65e5\u5f8c\u9762\u8a08\u7b97\uff0c\u4e0d\u6703\u91cd\u8907\u5217\u5165\u5bc4\u9001\u540d\u55ae\u3002</div>
</div>
`;
}

function buildPaidRenewalBlock_(subscriptionFormUrl, recipient) {
  const renewalTitle = recipient.isBatch
    ? "\u4ed8\u8cbb\u8a02\u95b1\u5373\u5c07\u5230\u671f\u63d0\u9192"
    : "\u4f60\u7684\u8a02\u95b1\u5269\u4e0b " + escapeHtml_(String(recipient.daysLeft)) + " \u5929";

  return `
<div style="margin:30px 0;padding:22px;background:#fff3ef;border:1px solid #e8c8bd;border-radius:16px;">
  <div style="font-size:13px;color:#a86f62;margin-bottom:8px;">\u7e8c\u8a02\u63d0\u9192</div>
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#5a2c24;">${renewalTitle}</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    \u4ed8\u8cbb\u8a02\u95b1\u5230\u671f\u5f8c\u5c07\u81ea\u52d5\u505c\u6b62\u5bc4\u9001\u3002<br>
    \u82e5\u4f60\u5e0c\u671b\u6301\u7e8c\u6536\u5230\u6bcf\u65e5\u8ca1\u7d93\u6574\u7406\uff0c\u53ef\u4ee5\u5148\u5b8c\u6210\u7e8c\u8a02\uff0c\u8b93\u9019\u4efd\u966a\u4f34\u4e0d\u4e2d\u65b7\u3002
  </div>
  <a href="${escapeHtml_(subscriptionFormUrl)}" style="display:inline-block;margin-top:14px;padding:12px 18px;background:#8f4f42;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">\u7acb\u5373\u7e8c\u8a02</a>
</div>
`;
}

function buildFreeSubscriberBlock_(vars, paidSubscriptionFormUrl) {
  const unsubscribeUrl = vars.free_unsubscribe_form_url || vars.unsubscribe_form_url || "";
  const unsubscribeLine = unsubscribeUrl
    ? `<div style="margin-top:10px;"><a href="${escapeHtml_(unsubscribeUrl)}" style="color:#8c7f78;">\u8abf\u6574\u6216\u53d6\u6d88\u514d\u8cbb\u8a02\u95b1</a></div>`
    : "";

  return `
<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e6ded9;font-size:13px;line-height:1.7;color:#8c7f78;">
  <div>\u4f60\u76ee\u524d\u662f\u514d\u8cbb\u8a02\u95b1\uff0c\u9019\u5c01\u4fe1\u6703\u4fdd\u6301\u8f15\u91cf\u7684\u966a\u4f34\u8207\u4e92\u52d5\u3002</div>
  <div>\u60f3\u8981\u66f4\u5b8c\u6574\u7684\u6bcf\u65e5\u8ca1\u7d93\u6574\u7406\uff0c\u4e5f\u6b61\u8fce\u5347\u7d1a\u4ed8\u8cbb\u8a02\u95b1\u3002</div>
  <div style="margin-top:10px;"><a href="${escapeHtml_(paidSubscriptionFormUrl)}" style="color:#8c7f78;">\u5347\u7d1a\u4ed8\u8cbb\u7248\u8a02\u95b1</a></div>
  ${unsubscribeLine}
</div>
`;
}
