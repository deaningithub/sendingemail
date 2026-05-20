const OPENAI_EMAIL_REPORT_CONFIG = {
  API_TOKEN_PROPERTY: "API_TOKEN",
  MODEL_PROPERTY: "OPENAI_MODEL",
  DEFAULT_MODEL: "gpt-4.1",
  RESPONSES_URL: "https://api.openai.com/v1/responses",
  REQUIRED_TITLE_HTML: "<h2>\u4eca\u65e5\u53ca\u6642\u5e02\u5834\u5831\u544a</h2>",
  REQUIRED_CLOSING_HTML: "<p>\u6211\u662fDean\u958b\u767c\u7684AI\u5168\u7403\u8da8\u52e2\u8ffd\u8e64\u7cfb\u7d71\uff0c\u5e0c\u671b\u80fd\u5920\u5275\u9020\u4f60\u7684\u8ca1\u5bcc\u81ea\u7531\uff0c\u9080\u8acb\u4f60\u95dc\u6ce8\u4e26\u652f\u6301Dean\u7684\u5922\u60f3\u3002</p>",
};

function buildEmailHtmlFromAiReport_(aiReport, reportMarkdown, reportDateText) {
  const apiToken = getOpenAiApiToken_();
  const payload = {
    model: getOpenAiModel_(),
    input: buildEmailReportPrompt_(aiReport, reportMarkdown, reportDateText),
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

function buildEmailReportPrompt_(aiReport, reportMarkdown, reportDateText) {
  return [
    "\u4f60\u662f\u4e00\u4f4d\u53ef\u4fe1\u4efb\u7684\u8ca1\u7d93\u7de8\u8f2f\u8207\u6295\u8cc7\u7b56\u7565\u7c21\u5831\u8a2d\u8a08\u5e2b\u3002\u8acb\u53ea\u6839\u64da\u6211\u63d0\u4f9b\u7684 ai_report \u8207 report_markdown\uff0c\u6539\u5beb\u6210\u53ef\u4ee5\u76f4\u63a5\u653e\u9032 Gmail / Google Apps Script \u7684 HTML \u4fe1\u4ef6\u7247\u6bb5\u3002",
    "\u4f60\u4e0d\u9700\u8981\u3001\u4e5f\u4e0d\u53ef\u4ee5\u81ea\u884c\u67e5\u7db2\u9801\u6216\u88dc\u5916\u90e8\u8cc7\u6599\u3002\u6240\u6709\u516c\u53f8\u3001\u6307\u6578\u3001\u6578\u5b57\u3001\u65b0\u805e\u8207\u7d50\u8ad6\u90fd\u5fc5\u9808\u4f86\u81ea\u8f38\u5165\u5167\u5bb9\u3002",
    "",
    "\u65e5\u671f\uff1a" + reportDateText,
    "",
    "\u8f38\u51fa\u898f\u683c\uff1a",
    "1. \u53ea\u8f38\u51fa HTML \u7247\u6bb5\uff0c\u4e0d\u8981\u8f38\u51fa ```html\u3001Markdown\u3001\u8aaa\u660e\u6587\u6216\u81ea\u6211\u63cf\u8ff0\u3002",
    "2. \u7b2c\u4e00\u500b\u6a19\u984c\u5fc5\u9808\u662f <h2>\u4eca\u65e5\u53ca\u6642\u5e02\u5834\u5831\u544a</h2>\u3002",
    "3. \u8acb\u7528\u5c08\u696d\u4fe1\u4ef6\u5e03\u5c40\uff1a\u958b\u5834\u7e3d\u7d50\u3001\u95dc\u9375\u6578\u64da\u8868\u3001\u5e02\u5834\u8108\u7d61\u3001\u98a8\u96aa\u89c0\u5bdf\u3001\u4eca\u65e5\u95dc\u6ce8\u91cd\u9ede\u3001\u7d50\u8a9e\u3002",
    "4. \u51e1\u662f\u8f38\u5165\u5167\u5bb9\u4e2d\u6709\u660e\u78ba\u6578\u503c\u7684\u9805\u76ee\uff08\u4f8b\u5982\u6307\u6578\u3001\u6f32\u8dcc\u5e45\u3001\u532f\u7387\u3001\u6b96\u5229\u7387\u3001\u671f\u8ca8\u3001\u91d1\u984d\u3001\u767e\u5206\u6bd4\uff09\uff0c\u512a\u5148\u6574\u7406\u6210 <table>\u3002",
    "5. \u8868\u683c\u81f3\u5c11\u5305\u542b\u300c\u9805\u76ee\u300d\u8207\u300c\u6578\u503c / \u8b8a\u5316\u300d\u5169\u6b04\uff1b\u5982\u8cc7\u6599\u8db3\u5920\uff0c\u53ef\u52a0\u300c\u89e3\u8b80\u300d\u6b04\u3002",
    "6. \u6f32\u8dcc\u6578\u5b57\u8acb\u76f4\u63a5\u5728\u6578\u5b57\u4e0a\u4f7f\u7528 inline style\uff1a\u4e0a\u6f32\u7528\u7d05\u8272 #b42318\uff0c\u4e0b\u8dcc\u7528\u7da0\u8272 #027a48\u3002",
    "7. \u6240\u6709 HTML \u6a23\u5f0f\u90fd\u8981\u7528 inline style\uff0c\u4e0d\u8981\u7528 <style>\u3001class\u3001script\u3001iframe\u3002",
    "8. \u6bb5\u843d\u8981\u7cbe\u7c21\u3001\u53ef\u6383\u8b80\uff0c\u6bcf\u6bb5\u4e0d\u8981\u904e\u9577\uff1b\u6a19\u984c\u4f7f\u7528 <h2> \u8207 <h3>\u3002",
    "9. \u91cd\u9ede\u53ef\u7528 <strong>\uff0c\u689d\u5217\u53ef\u7528 <ul><li>\uff0c\u4f46\u4e0d\u8981\u904e\u5ea6\u88dd\u98fe\u3002",
    "10. \u4e0d\u8981\u65b0\u589e\u8f38\u5165\u5167\u5bb9\u6c92\u6709\u7684\u6578\u5b57\u3001\u516c\u53f8\u3001\u7522\u696d\u3001\u65b0\u805e\u3001\u9023\u7d50\u6216\u7d50\u8ad6\u3002",
    "11. \u6700\u5f8c\u4e00\u6bb5\u5fc5\u9808\u662f " + OPENAI_EMAIL_REPORT_CONFIG.REQUIRED_CLOSING_HTML,
    "",
    "\u6bcf\u65e5 ai_report\uff1a",
    aiReport,
    "",
    "\u539f\u59cb report_markdown\uff1a",
    reportMarkdown || "\uff08\u672a\u63d0\u4f9b report_markdown\uff0c\u8acb\u53ea\u4f7f\u7528 ai_report\u3002\uff09",
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
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, ""));
}

function trimOpenAiEmailHtml_(value) {
  let html = String(value || "").trim();
  if (!html) return "";

  html = trimBeforeFirstHeadingTag_(html);
  html = trimAfterLastEmailHtmlTag_(html);
  html = removePromptEchoParagraphs_(html);
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
  const closingTagPattern = /<\/(h[1-6]|p|div|section|article|ul|ol|li|blockquote|strong|em|a|table|tbody|thead|tr|td|th)>/gi;
  let match;
  let lastEndIndex = -1;

  while ((match = closingTagPattern.exec(html)) !== null) {
    lastEndIndex = match.index + match[0].length;
  }

  if (lastEndIndex === -1) return html;
  return html.slice(0, lastEndIndex);
}

function removePromptEchoParagraphs_(html) {
  return String(html || "")
    .replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, paragraph => {
      const text = paragraph
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      return isPromptEchoText_(text) ? "" : paragraph;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPromptEchoText_(text) {
  const normalizedText = String(text || "").replace(/\s+/g, "");
  if (!normalizedText) return false;

  const promptEchoPhrases = [
    "\u8f38\u51fa\u898f\u683c",
    "\u53ea\u8f38\u51faHTML",
    "\u53ef\u4ee5\u76f4\u63a5\u653e\u9032Gmail",
    "\u4e0d\u8981\u8f38\u51faMarkdown",
    "\u6bcf\u65e5ai_report",
    "\u539f\u59cbreport_markdown",
    "HTML\u4fe1\u4ef6\u7247\u6bb5",
  ];
  const matches = promptEchoPhrases.filter(phrase => normalizedText.indexOf(phrase) !== -1).length;

  return matches >= 2;
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
  const closingText = "\u6211\u662fDean\u958b\u767c\u7684AI\u5168\u7403\u8da8\u52e2\u8ffd\u8e64\u7cfb\u7d71";
  const closingIndex = String(html || "").indexOf(closingText);

  if (closingIndex >= 0) {
    const beforeClosing = html.slice(0, closingIndex);
    const paragraphStart = beforeClosing.lastIndexOf("<p");

    if (paragraphStart >= 0) {
      return html.slice(0, paragraphStart).trim() + "\n\n" + requiredClosing;
    }

    return html.slice(0, closingIndex).trim() + "\n\n" + requiredClosing;
  }

  return String(html || "").trim() + "\n\n" + requiredClosing;
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
