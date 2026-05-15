const OPENAI_EMAIL_REPORT_CONFIG = {
  API_TOKEN_PROPERTY: "API_TOKEN",
  MODEL_PROPERTY: "OPENAI_MODEL",
  DEFAULT_MODEL: "gpt-4.1",
  RESPONSES_URL: "https://api.openai.com/v1/responses",
  REQUIRED_TITLE_HTML: "<h2>今日及時市場報告</h2>",
  REQUIRED_CLOSING_HTML: "<p>我是Dean開發的AI全球趨勢追縱系統，希望能夠創造你的財富自由，邀請你關注並支持Dean的夢想。</p>",
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
    "你是一位可信任的財經口播編輯。請只根據我提供的 ai_report 與 report_markdown，改寫成可以直接放進 Gmail 的 HTML 信件內容。",
    "你不需要、也不可以自行查網頁或補外部資料。ai_report 已經是從 report_markdown 整理出的參數與重點；你的任務是把它有故事、有脈絡地說出來。",
    "",
    "日期：" + reportDateText,
    "",
    "輸出規則：",
    "1. 報告使用 HTML 格式輸出。",
    "2. 段落要清楚，不要重複。",
    "3. 第一個標題必須是 <h2>今日及時市場報告</h2>。",
    "4. 重要標題請用 <h2> 或 <h3>。",
    "5. 一般段落請用 <p>。",
    "6. 需要換行的地方請用 <br>。",
    "7. 重點文字請用 <strong>。",
    "8. 整體要適合 Gmail / Google Apps Script 寄信。",
    "9. 不要使用 Markdown。",
    "10. 不要使用表格。",
    "11. 請保留舒服的閱讀節奏。",
    "12. 語氣要自然、清楚、有信任感。",
    "13. 內容只能使用 ai_report 與 report_markdown 內已存在的資訊，不要新增未提供的公司、數字、新聞、出處或連結。",
    "14. 請將 ai_report 的結論和 report_markdown 的脈絡串成故事，說清楚市場正在發生什麼、為何重要、可能影響哪些風險與資產。",
    "15. 最後一段必須是 <p>我是Dean開發的AI全球趨勢追縱系統，希望能夠創造你的財富自由，邀請你關注並支持Dean的夢想。</p>",
    "16. 只輸出 HTML 片段，不要輸出 ```html 或任何程式碼區塊標記。",
    "17. 不要輸出任何任務說明、改寫說明、整理說明、日期說明或自我描述，例如「以下為」、「經整理」、「適合 Gmail」、「可以直接使用」、「每日 AI 市場報告」這類句子。",
    "18. 第一個 <h2> 後面必須直接開始市場內容，不要加入介紹這份報告如何生成或如何使用的段落。",
    "",
    "每日 ai_report：",
    aiReport,
    "",
    "原始 report_markdown：",
    reportMarkdown || "（未提供 report_markdown，請只使用 ai_report。）",
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
  const closingTagPattern = /<\/(h[1-6]|p|div|section|article|ul|ol|li|blockquote|strong|em|a)>/gi;
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
    "以下為",
    "經整理",
    "適合Gmail",
    "可以直接使用",
    "直接放進Gmail",
    "每日AI市場報告",
    "HTML信件內容",
    "語氣自然清晰",
    "專業與信任",
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
  const closingText = "我是Dean開發的AI全球趨勢追縱系統";
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
