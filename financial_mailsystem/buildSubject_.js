function buildSubject_(report, subscriber, vars) {
  const base = buildConfiguredMailSubject_(report, vars || {});

  if (subscriber.isExpiringSoon) {
    return "【剩 " + subscriber.daysLeft + " 天到期】" + base;
  }

  return base;
}
