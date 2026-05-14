function isWeekend_(date) {
  const day = Number(Utilities.formatDate(date, CONFIG.TZ, "u"));
  return day === 6 || day === 7;
}

function getNextBusinessDay_(date) {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);

  while (isWeekend_(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

function indexMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[String(header).trim()] = index;
  });
  return map;
}

function objectFromRow_(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[String(header).trim()] = row[index];
  });
  return obj;
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!value) return null;

  const date = new Date(value);
  if (!isNaN(date.getTime())) return date;

  return null;
}

function addDays_(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

function diffDays_(fromDate, toDate) {
  const from = new Date(
    Number(Utilities.formatDate(fromDate, CONFIG.TZ, "yyyy")),
    Number(Utilities.formatDate(fromDate, CONFIG.TZ, "MM")) - 1,
    Number(Utilities.formatDate(fromDate, CONFIG.TZ, "dd"))
  );

  const to = new Date(
    Number(Utilities.formatDate(toDate, CONFIG.TZ, "yyyy")),
    Number(Utilities.formatDate(toDate, CONFIG.TZ, "MM")) - 1,
    Number(Utilities.formatDate(toDate, CONFIG.TZ, "dd"))
  );

  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

function formatReportDate_(value) {
  const date = parseDate_(value);
  if (!date) return "";
  return Utilities.formatDate(date, CONFIG.TZ, "yyyy/MM/dd");
}

function buildLogKey_(date, email, mailType) {
  const dateText = Utilities.formatDate(date, CONFIG.TZ, "yyyy/MM/dd");
  return [dateText, normalizeEmail_(email), mailType].join("|");
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function deleteTriggerByFunctionName_(functionName) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}