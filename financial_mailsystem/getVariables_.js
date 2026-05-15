function getVariables_(ss) {
  const sheet = ss.getSheetByName(CONFIG.VAR_SHEET);
  if (!sheet) throw new Error("找不到工作表：" + CONFIG.VAR_SHEET);

  const values = sheet.getDataRange().getValues();
  const vars = {};

  values.slice(1).forEach(row => {
    const key = String(row[0] || "").trim();
    const value = String(row[1] || "").trim();
    if (key) vars[key] = value;
  });

  return vars;
}

function getPlanDurationDays_(plan, monthlyDays, yearlyDays) {
  return getSubscriptionPlanTypeForMail_(plan) === "yearly" ? yearlyDays : monthlyDays;
}

function getActiveSubscribers_(ss, vars, today) {
  const sheet = ss.getSheetByName(CONFIG.FORM_RESPONSE_SHEET);
  if (!sheet) throw new Error("找不到工作表：" + CONFIG.FORM_RESPONSE_SHEET);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());
  const rows = values.slice(1);
  const idx = indexMap_(headers);

  const requiredHeaders = [
    "Timestamp",
    "Email Address",
    "LINE 名稱或方便聯絡的名稱",
    "請選擇訂閱方案",
  ];

  requiredHeaders.forEach(header => {
    if (idx[header] === undefined) {
      throw new Error("Form Responses 1 缺少欄位：" + header);
    }
  });

  const monthlyDays = Number(vars.monthly_days || 30);
  const yearlyDays = Number(vars.yearly_days || 365);
  const recordsByEmail = {};

  rows.forEach((row, index) => {
    const email = normalizeEmail_(row[idx["Email Address"]]);
    if (!email) return;

    const timestamp = parseDate_(row[idx["Timestamp"]]);
    if (!timestamp) return;

    const plan = String(row[idx["請選擇訂閱方案"]] || "").trim();
    const lineName = String(row[idx["LINE 名稱或方便聯絡的名稱"]] || "").trim();
    if (!recordsByEmail[email]) recordsByEmail[email] = [];

    recordsByEmail[email].push({
      email,
      lineName,
      plan,
      planType: getSubscriptionPlanTypeForMail_(plan),
      timestamp,
      durationDays: getPlanDurationDays_(plan, monthlyDays, yearlyDays),
      rowIndex: index,
    });
  });

  return Object.keys(recordsByEmail)
    .map(email => buildPaidSubscriberFromRecords_(recordsByEmail[email], today))
    .filter(subscriber => subscriber && subscriber.daysLeft >= 0);
}
