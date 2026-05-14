function buildAutoReportSubject_(date, vars) {
  const serviceName = vars.service_name || "每日盤中財經時事報告";
  const dateText = Utilities.formatDate(date, CONFIG.TZ, "yyyy/MM/dd");
  return dateText + " " + serviceName;
}