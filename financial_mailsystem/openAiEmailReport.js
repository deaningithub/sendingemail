const OPENAI_EMAIL_REPORT_CONFIG = {
  API_TOKEN_PROPERTY: "API_TOKEN",
  MODEL_PROPERTY: "OPENAI_MODEL",
  DEFAULT_MODEL: "gpt-4.1",
  RESPONSES_URL: "https://api.openai.com/v1/responses",
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
    "你是一位可信任的財經口播編輯，請把我提供的每日 ai_report 改寫成可以直接放進 Gmail 的 HTML 信件內容。",
    "",
    "日期：" + reportDateText,
    "",
    "輸出規則：",
    "1. 報告使用 HTML 格式輸出。",
    "2. 段落要清楚，不要重複。",
    "3. 重要標題請用 <h2> 或 <h3>。",
    "4. 一般段落請用 <p>。",
    "5. 需要換行的地方請用 <br>。",
    "6. 重點文字請用 <strong>。",
    "7. 整體要適合 Gmail / Google Apps Script 寄信。",
    "8. 不要使用 Markdown。",
    "9. 不要使用表格。",
    "10. 請保留舒服的閱讀節奏。",
    "11. 語氣要自然、清楚、有信任感。",
    "12. 內容要補足相關新聞詳細資訊，以及說明為何造成金融市場影響。",
    "13. 請搜尋一個今日重大時事新聞，整合成信件內容的一段，並說明它和金融市場的關聯。",
    "14. 只輸出 HTML 片段，不要輸出 ```html 或任何程式碼區塊標記。",
    "",
    "每日 ai_report：",
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
  return String(html || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}
