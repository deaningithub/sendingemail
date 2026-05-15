function buildSubject_(report, subscriber) {
  const base = "盤中分析看天下";

  if (subscriber.isExpiringSoon) {
    return "【剩 " + subscriber.daysLeft + " 天到期】" + base;
  }

  return base;
}
