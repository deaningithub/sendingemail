function findLatestDraftReport_(rows, headers, idx) {
  const candidates = [];

  rows.forEach((row, rowIndex) => {
    const reportText = String(row[idx["今日報告"]] || "").trim();
    if (!reportText) return;

    const status = String(row[idx["狀態"]] || "").trim();
    if (status === "已寄送") return;

    candidates.push({
      rowIndex,
      row,
    });
  });

  if (candidates.length === 0) return null;

  return candidates[candidates.length - 1];
}