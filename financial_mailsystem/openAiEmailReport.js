const OPENAI_EMAIL_REPORT_CONFIG = {
  API_TOKEN_PROPERTY: "API_TOKEN",
  MODEL_PROPERTY: "OPENAI_MODEL",
  DEFAULT_MODEL: "gpt-4.1",
  RESPONSES_URL: "https://api.openai.com/v1/responses",
  REQUIRED_TITLE_HTML: "<h2>\u4eca\u65e5\u53ca\u6642\u5e02\u5834\u5831\u544a</h2>",
  REQUIRED_CLOSING_HTML: "<p>\u6211\u662fDean\u958b\u767c\u7684AI\u5168\u7403\u8da8\u52e2\u8ffd\u7e31\u7cfb\u7d71\uff0c\u5e0c\u671b\u80fd\u5920\u5275\u9020\u4f60\u7684\u8ca1\u5bcc\u81ea\u7531\uff0c\u9080\u8acb\u4f60\u95dc\u6ce8\u4e26\u652f\u6301Dean\u7684\u5922\u60f3\u3002</p>",
};

function buildEmailHtmlFromAiReport_(aiReport, reportDateText) {
  const apiToken = getOpenAiApiToken_();
  const payload = {
    model: getOpenAiModel_(),
    input: buildEmailReportPrompt_(aiReport, reportDateText),
    tools: [
      {
        type: "web_search",
        user_location: {
          type: "approximate",
          country: "TW",
          city: "Taipei",
          region: "Taipei",
        },
      },
    ],
    tool_choice: "auto",
    max_output_tokens: 5000,
  };

  const response = UrlFetchApp.fetch(OPENAI_EMAIL_REPORT_CONFIG.RESPONSES_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiToken,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("OpenAI request failed (" + statusCode + "): " + body);
  }

  const data = JSON.parse(body);
  const html = extractOpenAiOutputText_(data);
  if (!html) throw new Error("OpenAI response did not include output text.");

  return sanitizeEmailHtmlOutput_(html);
}

function getOpenAiApiToken_() {
  const token = PropertiesService.getScriptProperties()
    .getProperty(OPENAI_EMAIL_REPORT_CONFIG.API_TOKEN_PROPERTY);

  if (!token) {
    throw new Error("Missing script property: " + OPENAI_EMAIL_REPORT_CONFIG.API_TOKEN_PROPERTY);
  }

  return token;
}

function getOpenAiModel_() {
  return PropertiesService.getScriptProperties()
    .getProperty(OPENAI_EMAIL_REPORT_CONFIG.MODEL_PROPERTY) ||
    OPENAI_EMAIL_REPORT_CONFIG.DEFAULT_MODEL;
}

function buildEmailReportPrompt_(aiReport, reportDateText) {
  return [
    "\u4f60\u662f\u4e00\u4f4d\u53ef\u4fe1\u4efb\u7684\u8ca1\u7d93\u53e3\u64ad\u7de8\u8f2f\uff0c\u8acb\u628a\u6211\u63d0\u4f9b\u7684\u6bcf\u65e5 ai_report \u6539\u5beb\u6210\u53ef\u4ee5\u76f4\u63a5\u653e\u9032 Gmail \u7684 HTML \u4fe1\u4ef6\u5167\u5bb9\u3002",
    "",
    "\u65e5\u671f\uff1a" + reportDateText,
    "",
    "\u8f38\u51fa\u898f\u5247\uff1a",
    "1. \u5831\u544a\u4f7f\u7528 HTML \u683c\u5f0f\u8f38\u51fa\u3002",
    "2. \u6bb5\u843d\u8981\u6e05\u695a\uff0c\u4e0d\u8981\u91cd\u8907\u3002",
    "3. \u7b2c\u4e00\u500b\u6a19\u984c\u5fc5\u9808\u662f <h2>\u4eca\u65e5\u53ca\u6642\u5e02\u5834\u5831\u544a</h2>\u3002",
    "4. \u91cd\u8981\u6a19\u984c\u8acb\u7528 <h2> \u6216 <h3>\u3002",
    "5. \u4e00\u822c\u6bb5\u843d\u8acb\u7528 <p>\u3002",
    "6. \u9700\u8981\u63db\u884c\u7684\u5730\u65b9\u8acb\u7528 <br>\u3002",
    "7. \u91cd\u9ede\u6587\u5b57\u8acb\u7528 <strong>\u3002",
    "8. \u6574\u9ad4\u8981\u9069\u5408 Gmail / Google Apps Script \u5bc4\u4fe1\u3002",
    "9. \u4e0d\u8981\u4f7f\u7528 Markdown\u3002",
    "10. \u4e0d\u8981\u4f7f\u7528\u8868\u683c\u3002",
    "11. \u8acb\u4fdd\u7559\u8212\u670d\u7684\u95b1\u8b80\u7bc0\u594f\u3002",
    "12. \u8a9e\u6c23\u8981\u81ea\u7136\u3001\u6e05\u695a\u3001\u6709\u4fe1\u4efb\u611f\u3002",
    "13. \u5167\u5bb9\u8981\u88dc\u8db3\u76f8\u95dc\u65b0\u805e\u8a73\u7d30\u8cc7\u8a0a\uff0c\u4ee5\u53ca\u8aaa\u660e\u70ba\u4f55\u9020\u6210\u91d1\u878d\u5e02\u5834\u5f71\u97ff\u3002",
    "14. \u8acb\u641c\u5c0b\u4e00\u500b\u4eca\u65e5\u91cd\u5927\u6642\u4e8b\u65b0\u805e\uff0c\u6574\u5408\u6210\u4fe1\u4ef6\u5167\u5bb9\u7684\u4e00\u6bb5\uff0c\u4e26\u8aaa\u660e\u5b83\u548c\u91d1\u878d\u5e02\u5834\u7684\u95dc\u806f\u3002",
    "15. \u6700\u5f8c\u4e00\u6bb5\u5fc5\u9808\u662f <p>\u6211\u662fDean\u958b\u767c\u7684AI\u5168\u7403\u8da8\u52e2\u8ffd\u7e31\u7cfb\u7d71\uff0c\u5e0c\u671b\u80fd\u5920\u5275\u9020\u4f60\u7684\u8ca1\u5bcc\u81ea\u7531\uff0c\u9080\u8acb\u4f60\u95dc\u6ce8\u4e26\u652f\u6301Dean\u7684\u5922\u60f3\u3002</p>",
    "16. \u53ea\u8f38\u51fa HTML \u7247\u6bb5\uff0c\u4e0d\u8981\u8f38\u51fa ```html \u6216\u4efb\u4f55\u7a0b\u5f0f\u78bc\u5340\u584a\u6a19\u8a18\u3002",
    "",
    "\u6bcf\u65e5 ai_report\uff1a",
    aiReport,
  ].join("\n");
}

function extractOpenAiOutputText_(data) {
  if (data.output_text) return String(data.output_text).trim();
  if (!data.output || !Array.isArray(data.output)) return "";

  return data.output
    .filter(item => item.type === "message" && Array.isArray(item.content))
    .map(item => item.content
      .filter(content => content.type === "output_text" && content.text)
      .map(content => content.text)
      .join(""))
    .join("")
    .trim();
}

function sanitizeEmailHtmlOutput_(html) {
  return trimOpenAiEmailHtml_(String(html || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, ""));
}

function trimOpenAiEmailHtml_(value) {
  let html = String(value || "").trim();
  if (!html) return "";

  html = trimBeforeFirstHeadingTag_(html);
  html = trimAfterLastEmailHtmlTag_(html);
  html = enforceRequiredEmailReportTitle_(html);
  html = enforceRequiredEmailReportClosing_(html);

  return html.trim();
}

function trimBeforeFirstHeadingTag_(html) {
  const match = html.match(/<h[1-6]\b/i);
  if (!match || match.index === undefined) return html;
  return html.slice(match.index);
}

function trimAfterLastEmailHtmlTag_(html) {
  const closingTagPattern = /<\/(h[1-6]|p|div|section|article|ul|ol|li|blockquote|strong|em|a)>/gi;
  let match;
  let lastEndIndex = -1;

  while ((match = closingTagPattern.exec(html)) !== null) {
    lastEndIndex = match.index + match[0].length;
  }

  if (lastEndIndex === -1) return html;
  return html.slice(0, lastEndIndex);
}

function enforceRequiredEmailReportTitle_(html) {
  const firstHeadingPattern = /^\s*<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/i;
  if (firstHeadingPattern.test(html)) {
    return html.replace(firstHeadingPattern, OPENAI_EMAIL_REPORT_CONFIG.REQUIRED_TITLE_HTML);
  }

  return OPENAI_EMAIL_REPORT_CONFIG.REQUIRED_TITLE_HTML + "\n\n" + html;
}

function enforceRequiredEmailReportClosing_(html) {
  const requiredClosing = OPENAI_EMAIL_REPORT_CONFIG.REQUIRED_CLOSING_HTML;
  const closingText = "\u6211\u662fDean\u958b\u767c\u7684AI\u5168\u7403\u8da8\u52e2\u8ffd\u7e31\u7cfb\u7d71";
  const closingIndex = html.indexOf(closingText);

  if (closingIndex >= 0) {
    const beforeClosing = html.slice(0, closingIndex);
    const paragraphStart = beforeClosing.lastIndexOf("<p");

    if (paragraphStart >= 0) {
      return html.slice(0, paragraphStart).trim() + "\n\n" + requiredClosing;
    }

    return html.slice(0, closingIndex).trim() + "\n\n" + requiredClosing;
  }

  return html.trim() + "\n\n" + requiredClosing;
}

function cleanExistingOpenAiEmailHtml() {
  const ss = SpreadsheetApp.openById(DAILY_REPORT_TRANSFER_CONFIG.TARGET_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DAILY_REPORT_TRANSFER_CONFIG.TARGET_SHEET_NAME);
  if (!sheet) throw new Error("Target sheet not found: " + DAILY_REPORT_TRANSFER_CONFIG.TARGET_SHEET_NAME);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { cleaned: false, reason: "No report rows." };

  const headers = values[0].map(header => String(header).trim());
  const idx = indexMap_(headers);
  const dateHeader = DAILY_REPORT_TRANSFER_CONFIG.TARGET_HEADERS[0];
  const reportHeader = DAILY_REPORT_TRANSFER_CONFIG.TARGET_HEADERS[2];

  if (idx[dateHeader] === undefined) throw new Error("Target sheet missing header: " + dateHeader);
  if (idx[reportHeader] === undefined) throw new Error("Target sheet missing header: " + reportHeader);

  const todayText = Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy/MM/dd");
  const rowNumber = findTargetReportRowByDate_(values.slice(1), idx, todayText);
  if (!rowNumber) return { cleaned: false, reason: "No target row for today: " + todayText };

  const cell = sheet.getRange(rowNumber, idx[reportHeader] + 1);
  const originalHtml = String(cell.getValue() || "");
  const cleanedHtml = sanitizeEmailHtmlOutput_(originalHtml);
  cell.setValue(cleanedHtml);

  return {
    cleaned: true,
    rowNumber,
    originalLength: originalHtml.length,
    cleanedLength: cleanedHtml.length,
  };
}
