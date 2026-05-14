function buildSubject_(report, subscriber) {
  const base = report["信件標題"] || "每日盤中財經時事快報";

  if (subscriber.isExpiringSoon) {
    return "【剩 " + subscriber.daysLeft + " 天到期】" + base;
  }

  return base;
}