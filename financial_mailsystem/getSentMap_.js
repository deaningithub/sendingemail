function getSentMap_(ss, today) {
  const sheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET);
  const values = sheet.getDataRange().getValues();
  const map = {};

  if (values.length < 2) return map;

  const headers = values[0].map(header => String(header).trim());
  const dateIndex = findLogHeaderIndex_(headers, ["date"]);
  const emailIndex = findLogHeaderIndex_(headers, ["email"]);
  const mailTypeIndex = findLogHeaderIndex_(headers, ["mailType", "mail_type"]);
  const statusIndex = findLogHeaderIndex_(headers, ["status"]);

  if (dateIndex === -1 || emailIndex === -1 || mailTypeIndex === -1 || statusIndex === -1) {
    throw new Error("Log sheet missing required headers: date, email, mailType, status");
  }

  values.slice(1).forEach(row => {
    const date = parseDate_(row[dateIndex]);
    const email = normalizeEmail_(row[emailIndex]);
    const mailType = String(row[mailTypeIndex] || "").trim();
    const status = String(row[statusIndex] || "").trim();

    if (!date || !email || !mailType || status !== "success") return;

    const key = buildLogKey_(date, email, mailType);
    map[key] = true;
  });

  return map;
}

function appendLog_(ss, today, subscriber, mailType, status, message) {
  const sheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(getDefaultLogHeaders_());
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(header => String(header).trim());

  sheet.appendRow(buildLogRow_(headers, today, subscriber, mailType, status, message));
}

function getDefaultLogHeaders_() {
  return [
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
  ];
}

function buildLogRow_(headers, today, subscriber, mailType, status, message) {
  const valuesByHeader = {
    timestamp: new Date(),
    date: Utilities.formatDate(today, CONFIG.TZ, "yyyy/MM/dd"),
    email: subscriber.email,
    linename: subscriber.lineName,
    plan: subscriber.plan,
    expiredate: Utilities.formatDate(subscriber.expireDate, CONFIG.TZ, "yyyy/MM/dd"),
    daysleft: subscriber.daysLeft,
    mailtype: mailType,
    status,
    message,
  };

  return headers.map(header => {
    const normalizedHeader = normalizeLogHeader_(header);
    return Object.prototype.hasOwnProperty.call(valuesByHeader, normalizedHeader)
      ? valuesByHeader[normalizedHeader]
      : "";
  });
}

function findLogHeaderIndex_(headers, names) {
  const normalizedNames = names.map(normalizeLogHeader_);
  for (let i = 0; i < headers.length; i++) {
    if (normalizedNames.indexOf(normalizeLogHeader_(headers[i])) !== -1) return i;
  }
  return -1;
}

function normalizeLogHeader_(header) {
  return String(header || "").trim().replace(/[_\s-]/g, "").toLowerCase();
}

function buildSubject_(report, subscriber, vars) {
  const base = buildConfiguredMailSubject_(report, vars || {});

  if (subscriber.isExpiringSoon) {
    return "【剩 " + subscriber.daysLeft + " 天到期】" + base;
  }

  return base;
}

function buildFinanceReportHtml_(report, vars, subscriber) {
  const brandName = vars.brand_name || "Chiyo 財經";
  const serviceName = vars.service_name || SUBSCRIBER_MAIL_CONFIG.MAIL_SUBJECT_TITLE;
  const subscriptionFormUrl = vars.subscription_form_url || SUBSCRIBER_MAIL_CONFIG.PAID_SUBSCRIPTION_FORM_URL;
  const unsubscribeText = vars.unsubscribe_text || "若不想再收到信件，請直接回信告知。";

  const reportTitle = report["信件標題"] || serviceName;
  const reportBody = report["今日報告"] || "";
  const reportDate = formatReportDate_(report["寄送日期"]);
  const expireText = Utilities.formatDate(subscriber.expireDate, CONFIG.TZ, "yyyy/MM/dd");

  const actionBlock = subscriber.isExpiringSoon
    ? buildRenewalBlock_(subscriptionFormUrl, subscriber.daysLeft, expireText, serviceName)
    : buildPaidVersionBlock_(subscriptionFormUrl);

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

function buildPaidVersionBlock_(subscriptionFormUrl) {
  return `
<div style="margin:30px 0;padding:22px;background:#f3eeee;border-radius:16px;">
  <div style="font-size:13px;color:#8c7f78;margin-bottom:8px;">升級付費訂閱</div>
  <div style="font-size:20px;font-weight:700;line-height:1.5;margin-bottom:10px;color:#2d2724;">想要更完整的每日市場觀察，歡迎加入付費版。</div>
  <div style="font-size:15px;line-height:1.8;color:#4b403b;">
    免費版會提供盤中分析報告；付費版會提供更完整的每日財經整理與追蹤，讓你在市場變化中更快掌握重點。
  </div>
  <a href="${escapeHtml_(subscriptionFormUrl)}" style="display:inline-block;margin-top:14px;padding:12px 18px;background:#2d2724;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">加入付費版訂閱</a>
</div>
`;
}

function buildRenewalBlock_(subscriptionFormUrl, daysLeft, expireText, serviceName) {
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
    你的${escapeHtml_(serviceName)}訂閱將於 ${escapeHtml_(expireText)} 到期。<br>
    如果你希望繼續收到週一至週五的財經趨勢整理，請在到期前完成續訂。<br>
    建議選擇年方案，省去每月轉帳與核對流程，也能用更低的月平均成本持續追蹤市場。
  </div>
  ${button}
</div>
`;
}

function formatReportBody_(value) {
  const rawHtml = String(value || "").trim();

  return enhanceFinanceReportHtml_(sanitizeFinanceReportHtml_(rawHtml));
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

function enhanceFinanceReportHtml_(html) {
  const cleanedHtml = String(html || "").trim();
  if (!cleanedHtml) return "";

  const metricTable = buildMetricSummaryTable_(cleanedHtml);
  const styledHtml = highlightMarketMovesInHtml_(styleFinanceReportElements_(cleanedHtml));

  return [
    metricTable,
    `<div style="margin:22px 0 0;padding:0;">${styledHtml}</div>`,
  ].filter(Boolean).join("\n");
}

function styleFinanceReportElements_(html) {
  return String(html || "")
    .replace(/<h2(?![^>]*\bstyle=)([^>]*)>/gi, '<h2$1 style="font-size:22px;line-height:1.45;margin:26px 0 12px;color:#17212b;border-bottom:1px solid #dfe5ea;padding-bottom:8px;">')
    .replace(/<h3(?![^>]*\bstyle=)([^>]*)>/gi, '<h3$1 style="font-size:18px;line-height:1.5;margin:22px 0 10px;color:#243140;">')
    .replace(/<p(?![^>]*\bstyle=)([^>]*)>/gi, '<p$1 style="margin:0 0 14px;font-size:16px;line-height:1.9;color:#2d3845;">')
    .replace(/<ul(?![^>]*\bstyle=)([^>]*)>/gi, '<ul$1 style="margin:0 0 16px 20px;padding:0;color:#2d3845;">')
    .replace(/<ol(?![^>]*\bstyle=)([^>]*)>/gi, '<ol$1 style="margin:0 0 16px 20px;padding:0;color:#2d3845;">')
    .replace(/<li(?![^>]*\bstyle=)([^>]*)>/gi, '<li$1 style="margin:0 0 8px;font-size:16px;line-height:1.75;">')
    .replace(/<blockquote(?![^>]*\bstyle=)([^>]*)>/gi, '<blockquote$1 style="margin:18px 0;padding:14px 16px;background:#f6f8fa;border-left:4px solid #64748b;color:#334155;">')
    .replace(/<table(?![^>]*\bstyle=)([^>]*)>/gi, '<table$1 style="width:100%;border-collapse:collapse;margin:18px 0 22px;font-size:14px;line-height:1.5;border:1px solid #d8e0e8;">')
    .replace(/<th(?![^>]*\bstyle=)([^>]*)>/gi, '<th$1 style="padding:10px 12px;background:#eef3f7;border:1px solid #d8e0e8;color:#1f2a37;text-align:left;font-weight:700;">')
    .replace(/<td(?![^>]*\bstyle=)([^>]*)>/gi, '<td$1 style="padding:10px 12px;border:1px solid #d8e0e8;color:#2d3845;vertical-align:top;">');
}

function buildMetricSummaryTable_(html) {
  if (/<table\b/i.test(html)) return "";

  const rows = extractMetricRowsFromReportHtml_(html);
  if (rows.length < 3) return "";

  const bodyRows = rows.slice(0, 12).map(row => `
    <tr>
      <td style="padding:10px 12px;border:1px solid #d8e0e8;color:#334155;font-weight:700;background:#fbfcfd;">${escapeHtml_(row.label)}</td>
      <td style="padding:10px 12px;border:1px solid #d8e0e8;color:#1f2937;">${highlightMarketMovesInText_(escapeHtml_(row.value))}</td>
    </tr>`).join("");

  return `
<div style="margin:0 0 24px;">
  <div style="font-size:13px;color:#64748b;margin:0 0 8px;font-weight:700;">\u95dc\u9375\u6578\u64da\u8868</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5;border:1px solid #d8e0e8;">
    <tr>
      <th style="padding:10px 12px;background:#202833;border:1px solid #202833;color:#ffffff;text-align:left;">\u9805\u76ee</th>
      <th style="padding:10px 12px;background:#202833;border:1px solid #202833;color:#ffffff;text-align:left;">\u6578\u503c / \u8b8a\u5316</th>
    </tr>
    ${bodyRows}
  </table>
</div>`;
}

function extractMetricRowsFromReportHtml_(html) {
  const plainText = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*[\r\n]+[ \t]*/g, "\n");

  const seen = {};
  const rows = [];

  plainText.split(/\n|。|；|;/).forEach(line => {
    const text = String(line || "").replace(/\s+/g, " ").trim();
    if (!isMetricSummaryLine_(text)) return;

    const row = splitMetricSummaryLine_(text);
    if (!row || seen[row.label]) return;

    seen[row.label] = true;
    rows.push(row);
  });

  return rows;
}

function isMetricSummaryLine_(text) {
  if (!text || text.length > 110) return false;
  if (!/[0-9]/.test(text)) return false;
  return /[%％]|[+\-＋－−▲▼]|點|美元|元|億|兆|bp|bps|殖利率|指數|匯率|期貨|漲|跌/i.test(text);
}

function splitMetricSummaryLine_(text) {
  const separatorMatch = text.match(/^(.{2,32}?)[：:]\s*(.{1,80})$/);
  if (separatorMatch) {
    return {
      label: separatorMatch[1].replace(/^[-•\s]+/, "").trim(),
      value: separatorMatch[2].trim(),
    };
  }

  const valueMatch = text.match(/([+\-＋－−▲▼]?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|％|點|美元|元|億|兆|bp|bps)?(?:\s*[\/,，]\s*[+\-＋－−▲▼]?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|％|點|美元|元|億|兆|bp|bps)?)*)/i);
  if (!valueMatch || valueMatch.index === undefined || valueMatch.index < 2) return null;

  return {
    label: text.slice(0, valueMatch.index).replace(/^[-•\s]+/, "").trim(),
    value: text.slice(valueMatch.index).trim(),
  };
}

function highlightMarketMovesInHtml_(html) {
  return String(html || "").split(/(<[^>]+>)/g).map(part => {
    if (!part || part.charAt(0) === "<") return part;
    return highlightMarketMovesInText_(part);
  }).join("");
}

function highlightMarketMovesInText_(text) {
  return String(text || "").replace(/([+\uFF0B▲]\s*\d[\d,]*(?:\.\d+)?\s*(?:%|％|點|bp|bps)?|[-\u2212\uFF0D▼]\s*\d[\d,]*(?:\.\d+)?\s*(?:%|％|點|bp|bps)?)/g, function(match) {
    const isUp = /^[+\uFF0B▲]/.test(match);
    const color = isUp ? "#b42318" : "#027a48";
    const background = isUp ? "#fff1f0" : "#ecfdf3";
    return `<span style="display:inline-block;padding:1px 6px;margin:0 2px;border-radius:4px;font-weight:700;color:${color};background:${background};">${match}</span>`;
  });
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
  values.slice(1).forEach((row, index) => {
    const rowDate = parseDate_(row[idx["寄送日期"]]);
    if (!rowDate) return;

    const rowDateText = Utilities.formatDate(rowDate, CONFIG.TZ, "yyyy/MM/dd");

    if (rowDateText === todayText) {
      const rowNumber = index + 2;
      if (!row[idx["信件標題"]]) {
        sheet.getRange(rowNumber, idx["信件標題"] + 1).setValue(buildAutoReportSubject_(today, vars));
      }
      sheet.getRange(rowNumber, idx["狀態"] + 1).setValue("已寄送");
      markReportSentAt_(sheet, rowNumber, idx, new Date());
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
