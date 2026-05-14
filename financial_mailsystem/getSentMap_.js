function getSentMap_(ss, today) {
  const sheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET);
  const values = sheet.getDataRange().getValues();
  const map = {};

  if (values.length < 2) return map;

  values.slice(1).forEach(row => {
    const date = parseDate_(row[1]);
    const email = normalizeEmail_(row[2]);
    const mailType = String(row[7] || "").trim();
    const status = String(row[8] || "").trim();

    if (!date || !email || !mailType || status !== "success") return;

    const key = buildLogKey_(date, email, mailType);
    map[key] = true;
  });

  return map;
}

function appendLog_(ss, today, subscriber, mailType, status, message) {
  const sheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
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

  sheet.appendRow([
    new Date(),
    Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd"),
    subscriber.email,
    subscriber.lineName,
    subscriber.plan,
    Utilities.formatDate(subscriber.expireDate, CONFIG.TZ, "yyyy/MM/dd"),
    subscriber.daysLeft,
    mailType,
    status,
    message,
  ]);
}

function buildSubject_(report, subscriber) {
  const base = report["信件標題"] || "每日盤中財經時事報告";

  if (subscriber.isExpiringSoon) {
    return "【剩 " + subscriber.daysLeft + " 天到期】" + base;
  }

  return base;
}

function buildFinanceReportHtml_(report, vars, subscriber) {
  const brandName = vars.brand_name || "Chiyo 太極瑜珈";
  const serviceName = vars.service_name || "每日盤中財經時事報告";
  const replayServiceName = vars.replay_service_name || "指定時間線上瑜珈回放課程";
  const replayFormUrl = vars.replay_form_url || "";
  const subscriptionFormUrl = vars.subscription_form_url || "";
  const unsubscribeText = vars.unsubscribe_text || "若不想再收到信件，請直接回信告知。";

  const reportTitle = report["信件標題"] || serviceName;
  const reportBody = report["今日報告"] || "";
  const reportDate = formatReportDate_(report["寄送日期"]);
  const expireText = Utilities.formatDate(subscriber.expireDate, CONFIG.TZ, "yyyy/MM/dd");

  const actionBlock = subscriber.isExpiringSoon
    ? buildRenewalBlock_(subscriptionFormUrl, subscriber.daysLeft, expireText)
    : buildReplayBlock_(replayServiceName, replayFormUrl);

  return `
<div style="margin:0;padding:0;background:#f7f4f2;font-family:Arial,'Noto Sans TC',sans-serif;color:#222;">
  <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
    <div style="background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e6ded9;">
      <div style="font-size:14px;color:#8c7f78;margin-bottom:8px;">${escapeHtml_(brandName)}</div>

      <h1 style="font-size:26px;line-height:1.35;margin:0 0 12px;color:#2d2724;">
        ${escapeHtml_(reportTitle)}
      </h1>

      <div style="font-size:14px;color:#8c7f78;margin-bottom:24px;">
        ${escapeHtml_(reportDate)}
      </div>

      <div style="font-size:16px;line-height:1.95;color:#332d29;">
        ${formatReportBody_(reportBody)}
      </div>

      <div style="margin:28px 0;padding:18px 20px;border-left:4px solid #b7a7a8;background:#fbfaf9;border-radius:12px;">
        <div style="font-size:13px;color:#8c7f78;margin-bottom:6px;">English Practice</div>
        <div style="font-size:18px;font-weight:700;line-height:1.6;">Stay calm before making decisions.</div>
        <div style="font-size:15px;line-height:1.7;color:#6f625d;">做決定之前，先保持冷靜。</div>
      </div>

      ${actionBlock}

      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e6ded9;font-size:13px;line-height:1.7;color:#8c7f78;">
        <div>你的方案：${escapeHtml_(subscriber.plan)}</div>
        <div>訂閱到期日：${escapeHtml_(expireText)}</div>
        <div>剩餘天數：${escapeHtml_(String(subscriber.daysLeft))} 天</div>
        <div style="margin-top:10px;">${escapeHtml_(unsubscribeText)}</div>
        <div style="margin-top:10px;">本信件內容僅供財經資訊整理與趨勢觀察，不構成任何投資建議。</div>
      </div>
    </div>
  </div>
</div>
`;
}

function buildReplayBlock_(replayServiceName, replayFormUrl) {
  const button = replayFormUrl
    ? `<a href="${escapeHtml_(replayFormUrl)}" style="display:inline-block;margin-top:14px;padding:12px 18px;background:#2d2724;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">了解回放課程</a>`
    : "";

  return `
<div style="margin:30px 0;padding:22px;background:#f3eeee;border-radius:16px;">
  <div style="font-size:13px;color:#8c7f78;margin-bottom:8px;">今日收束</div>
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#2d2724;">看完市場，回到身體。</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    財經資訊會讓人保持警覺，但長期警覺，也會讓肩頸、胸口、下背與呼吸變得僵硬。<br>
    如果你每天工作、看盤、閱讀新聞，卻很少真正放鬆身體，可以從「${escapeHtml_(replayServiceName)}」開始。<br>
    不用固定時間，不用跟上別人。你只需要在一天之中，留一段時間，讓身體重新回到穩定。
  </div>
  ${button}
</div>
`;
}

function buildRenewalBlock_(subscriptionFormUrl, daysLeft, expireText) {
  const title = daysLeft === 0
    ? "你的財報訂閱今天到期"
    : "你的財報訂閱剩 " + daysLeft + " 天到期";

  const button = subscriptionFormUrl
    ? `<a href="${escapeHtml_(subscriptionFormUrl)}" style="display:inline-block;margin-top:14px;padding:12px 18px;background:#8f4f42;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">前往續訂</a>`
    : "";

  return `
<div style="margin:30px 0;padding:22px;background:#fff3ef;border:1px solid #e8c8bd;border-radius:16px;">
  <div style="font-size:13px;color:#a86f62;margin-bottom:8px;">訂閱提醒</div>
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#5a2c24;">${escapeHtml_(title)}</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    你的每日盤中財經時事報告將於 ${escapeHtml_(expireText)} 到期。<br>
    如果你希望繼續收到週一至週五的財經趨勢整理，請在到期前完成續訂。<br>
    建議選擇年方案，省去每月轉帳與核對流程，也能用更低的月平均成本持續追蹤市場。
  </div>
  ${button}
</div>
`;
}

function formatReportBody_(value) {
  const rawHtml = String(value || "").trim();

  return sanitizeFinanceReportHtml_(rawHtml);
}

function sanitizeFinanceReportHtml_(html) {
  return String(html || "")
    .replace(/:contentReference\[.*?\]\{.*?\}/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function markTodayReportSent_(ss, today, vars) {
  const sheet = ss.getSheetByName(CONFIG.REPORT_SHEET);
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);

  if (idx["寄送日期"] === undefined) return;
  if (idx["信件標題"] === undefined) return;
  if (idx["狀態"] === undefined) return;

  const todayText = Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd");
  const autoSubject = buildAutoReportSubject_(today, vars);

  values.slice(1).forEach((row, index) => {
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");

    if (rowDateText === todayText) {
      const rowNumber = index + 2;
      sheet.getRange(rowNumber, idx["信件標題"] + 1).setValue(autoSubject);
      sheet.getRange(rowNumber, idx["狀態"] + 1).setValue("已寄送");
    }
  });
}

function findLatestDraftReport_(rows, headers, idx) {
  const candidates = [];

  rows.forEach((row, rowIndex) => {
    const reportText = String(row[idx["今日報告"]] || "").trim();
    if (!reportText) return;

    const status = String(row[idx["狀態"]] || "").trim();
    if (status === "已寄送") return;

    candidates.push({
      rowIndex,
      row,
    });
  });

  if (candidates.length === 0) return null;

  return candidates[candidates.length - 1];
}