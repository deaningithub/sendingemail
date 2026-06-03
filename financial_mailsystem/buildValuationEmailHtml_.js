var VALUATION_RATING_STYLE_ = {
  strong_buy: {
    label: "強力買進",
    icon: "🔥",
    headerBg: "#14532d",
    cardBg: "#f0fdf4",
    cardBorder: "#86efac",
    labelColor: "#14532d",
    badgeBg: "#16a34a",
    priceBg: "#dcfce7",
    priceLabel: "#166534",
  },
  buy: {
    label: "建議買進",
    icon: "✅",
    headerBg: "#1e3a8a",
    cardBg: "#eff6ff",
    cardBorder: "#93c5fd",
    labelColor: "#1e3a8a",
    badgeBg: "#2563eb",
    priceBg: "#dbeafe",
    priceLabel: "#1e40af",
  },
  watch: {
    label: "不建議進場",
    icon: "⚠️",
    headerBg: "#78350f",
    cardBg: "#fffbeb",
    cardBorder: "#fcd34d",
    labelColor: "#78350f",
    badgeBg: "#d97706",
    priceBg: "#fef3c7",
    priceLabel: "#92400e",
  },
  sell: {
    label: "建議離場",
    icon: "🔴",
    headerBg: "#7f1d1d",
    cardBg: "#fef2f2",
    cardBorder: "#fca5a5",
    labelColor: "#7f1d1d",
    badgeBg: "#dc2626",
    priceBg: "#fee2e2",
    priceLabel: "#991b1b",
  },
};

var VALUATION_RATING_ORDER_ = ["strong_buy", "buy", "watch", "sell"];

/* ── main entry ── */

function buildValuationEmailHtml_(today, dailyRows) {
  var dateDisplay = Utilities.formatDate(today, CONFIG.TZ, "yyyy 年 M 月 d 日 (EEE)");
  var dateShort   = Utilities.formatDate(today, CONFIG.TZ, "yyyy/M/d");
  var sb = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "strong_buy"; }).length;
  var b  = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "buy"; }).length;
  var w  = dailyRows.filter(function(r) { return normalizeValuationRating_(r.rating) === "watch" || normalizeValuationRating_(r.rating) === "sell"; }).length;

  return [
    '<div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,\'Noto Sans TC\',sans-serif;color:#1e293b;">',
    '<div style="max-width:600px;margin:0 auto;padding:10px 8px;">',

    /* ── Header ── */
    '<div style="background:#0f172a;border-radius:12px 12px 0 0;padding:22px 20px 18px;text-align:center;">',
    '  <div style="font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:5px;">Dean AI 估值系統</div>',
    '  <div style="font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:6px;">每日盤中估值快報</div>',
    '  <div style="font-size:13px;color:#94a3b8;margin-bottom:16px;">' + escapeHtml_(dateDisplay) + '</div>',
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">',
    '  <tr>',
    '    <td style="text-align:center;padding:8px 4px;background:#1e293b;border-radius:8px;">',
    '      <div style="font-size:20px;font-weight:700;color:#f8fafc;">' + dailyRows.length + '</div>',
    '      <div style="font-size:11px;color:#94a3b8;">覆蓋標的</div>',
    '    </td>',
    '    <td style="width:6px;"></td>',
    '    <td style="text-align:center;padding:8px 4px;background:#14532d;border-radius:8px;">',
    '      <div style="font-size:20px;font-weight:700;color:#f8fafc;">' + sb + '</div>',
    '      <div style="font-size:11px;color:#86efac;">強力買進</div>',
    '    </td>',
    '    <td style="width:6px;"></td>',
    '    <td style="text-align:center;padding:8px 4px;background:#1e3a8a;border-radius:8px;">',
    '      <div style="font-size:20px;font-weight:700;color:#f8fafc;">' + b + '</div>',
    '      <div style="font-size:11px;color:#93c5fd;">建議買進</div>',
    '    </td>',
    '    <td style="width:6px;"></td>',
    '    <td style="text-align:center;padding:8px 4px;background:#78350f;border-radius:8px;">',
    '      <div style="font-size:20px;font-weight:700;color:#f8fafc;">' + w + '</div>',
    '      <div style="font-size:11px;color:#fcd34d;">不建議進場</div>',
    '    </td>',
    '  </tr>',
    '  </table>',
    '</div>',

    /* ── Daily section ── */
    buildValuationSectionHtml_(dailyRows),

    /* ── Footer ── */
    '<div style="background:#1e293b;border-radius:0 0 12px 12px;padding:14px 20px;text-align:center;">',
    '  <div style="font-size:11px;color:#64748b;line-height:1.8;">',
    '    本報告由 Dean AI 估值系統自動生成，僅供參考，不構成投資建議。<br>',
    '    資料截點：' + escapeHtml_(dateShort) + ' · AIValuations',
    '  </div>',
    '</div>',

    '</div>',
    '</div>',
  ].join("\n");
}

/* ── section builder ── */

function buildValuationSectionHtml_(rows) {
  var groups = VALUATION_RATING_ORDER_
    .map(function(rating) {
      var groupRows = rows
        .filter(function(r) { return normalizeValuationRating_(r.rating) === rating; })
        .map(function(r) {
          var m = computeValuationMetrics_(r);
          return { row: r, metrics: m };
        })
        .sort(function(a, b) {
          /* sort by R/R ratio desc; null falls to bottom */
          if (a.metrics.rrRatio === null && b.metrics.rrRatio === null) return 0;
          if (a.metrics.rrRatio === null) return 1;
          if (b.metrics.rrRatio === null) return -1;
          return b.metrics.rrRatio - a.metrics.rrRatio;
        });
      return { rating: rating, style: VALUATION_RATING_STYLE_[rating], items: groupRows };
    })
    .filter(function(g) { return g.items.length > 0; });

  if (groups.length === 0) return "";

  var cardsHtml = groups.map(function(g) { return buildRatingGroupHtml_(g); }).join("\n");

  return [
    '<div style="background:#ffffff;padding:14px 14px 4px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">',
    '  <div style="font-size:15px;font-weight:700;color:#0f172a;padding:6px 0 12px;border-bottom:2px solid #e2e8f0;">',
    '    📊 今日盤中估值 &amp; 操作建議',
    '  </div>',
    cardsHtml,
    '</div>',
  ].join("\n");
}

function buildRatingGroupHtml_(group) {
  var s = group.style;
  var cards = group.items.map(function(item) {
    return buildStockCardHtml_(item.row, item.metrics, s);
  }).join("\n");

  return [
    '<div style="margin-top:14px;">',
    '  <div style="background:' + s.headerBg + ';color:#ffffff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700;">',
    '    ' + s.icon + ' ' + escapeHtml_(s.label) + ' · ' + group.items.length + ' 支',
    '    <span style="float:right;font-size:11px;font-weight:400;opacity:0.8;">依風險報酬比排序</span>',
    '  </div>',
    cards,
    '  <div style="height:8px;"></div>',
    '</div>',
  ].join("\n");
}

/* ── stock card ── */

function buildStockCardHtml_(row, metrics, s) {
  var isBuy   = (s === VALUATION_RATING_STYLE_.strong_buy || s === VALUATION_RATING_STYLE_.buy);
  return isBuy
    ? buildBuyCardHtml_(row, metrics, s)
    : buildWatchCardHtml_(row, metrics, s);
}

/* ─── BUY card ─── */

function buildBuyCardHtml_(row, metrics, s) {
  var symbol     = escapeHtml_(String(row.symbol || "").trim());
  var name       = escapeHtml_(String(row.name || "").trim());
  var themes     = buildValuationThemeTagsHtml_(row.themes);
  var lastPrice  = fmtPrice_(row.lastPrice);
  var fairValue  = fmtPrice_(row.fairValue);
  var target     = fmtPrice_(row.intradayTarget);
  var stopLoss   = fmtPrice_(row.downsideRisk);
  var upsidePct  = fmtPct_(row.upsidePct);
  var confidence = fmtConfidence_(row.confidence);
  var plan       = escapeHtml_(String(row.limitUpPlan || "").trim());

  /* entry/exit gain% and loss% */
  var lp = typeof row.lastPrice === "number" ? row.lastPrice : Number(row.lastPrice);
  var it = typeof row.intradayTarget === "number" ? row.intradayTarget : Number(row.intradayTarget);
  var sl = typeof row.downsideRisk === "number" ? row.downsideRisk : Number(row.downsideRisk);
  var gainPct = (!isNaN(lp) && !isNaN(it) && lp > 0) ? ((it - lp) / lp * 100).toFixed(2) + "%" : "";
  var lossPct = (!isNaN(lp) && !isNaN(sl) && lp > 0) ? ((sl - lp) / lp * 100).toFixed(2) + "%" : "";

  /* R/R badge color */
  var rrText = "—";
  var rrColor = "#64748b";
  if (metrics.rrRatio !== null) {
    rrText = "×" + metrics.rrRatio.toFixed(1);
    rrColor = metrics.rrRatio >= 2.0 ? "#15803d" : metrics.rrRatio >= 1.5 ? "#b45309" : "#dc2626";
  }

  return [
    '<div style="background:' + s.cardBg + ';border:1px solid ' + s.cardBorder + ';border-top:none;padding:14px;margin-bottom:1px;">',

    /* Name + badge */
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">',
    '  <tr>',
    '    <td style="vertical-align:middle;">',
    '      <span style="font-size:17px;font-weight:700;color:' + s.labelColor + ';">' + symbol + '</span>',
    '      <span style="font-size:15px;font-weight:600;color:#334155;margin-left:6px;">' + name + '</span>',
    '    </td>',
    '    <td style="text-align:right;vertical-align:middle;white-space:nowrap;">',
    '      <span style="background:' + s.badgeBg + ';color:#fff;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;">' + escapeHtml_(s.label) + '</span>',
    '    </td>',
    '  </tr>',
    '  </table>',

    themes ? '<div style="margin-top:6px;">' + themes + '</div>' : "",

    /* Key metrics row */
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:10px;">',
    '  <tr>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:8px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:3px;">現價</div>',
    '      <div style="font-size:16px;font-weight:700;color:' + s.labelColor + ';">' + lastPrice + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:8px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:3px;">公平值</div>',
    '      <div style="font-size:16px;font-weight:700;color:' + s.labelColor + ';">' + fairValue + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:8px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:3px;">漲幅</div>',
    '      <div style="font-size:16px;font-weight:700;color:#b91c1c;">↑' + upsidePct + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:8px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:3px;">信心</div>',
    '      <div style="font-size:16px;font-weight:700;color:' + s.labelColor + ';">' + confidence + '</div>',
    '    </td>',
    '  </tr>',
    '  </table>',

    /* R/R ratio */
    '  <div style="margin-top:8px;font-size:12px;color:#64748b;">',
    '    風險報酬比 <strong style="color:' + rrColor + ';font-size:14px;">' + rrText + '</strong>',
    '    <span style="color:#94a3b8;font-size:11px;margin-left:4px;">(上漲 ' + upsidePct + ' vs 下跌 ' + fmtPct_(metrics.riskPct) + ')</span>',
    '  </div>',

    /* Exit / stop table */
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:10px;">',
    '  <tr>',
    '    <td style="background:#dcfce7;border-radius:6px;padding:10px 6px;text-align:center;vertical-align:middle;">',
    '      <div style="font-size:10px;color:#166534;margin-bottom:3px;">🎯 目標離場</div>',
    '      <div style="font-size:17px;font-weight:700;color:#14532d;">' + target + '</div>',
    gainPct ? '<div style="font-size:11px;color:#15803d;margin-top:2px;">+' + gainPct + '</div>' : "",
    '    </td>',
    '    <td style="width:8px;"></td>',
    '    <td style="background:#fee2e2;border-radius:6px;padding:10px 6px;text-align:center;vertical-align:middle;">',
    '      <div style="font-size:10px;color:#991b1b;margin-bottom:3px;">🛑 止損設在</div>',
    '      <div style="font-size:17px;font-weight:700;color:#7f1d1d;">' + stopLoss + '</div>',
    lossPct ? '<div style="font-size:11px;color:#dc2626;margin-top:2px;">' + lossPct + '</div>' : "",
    '    </td>',
    '  </tr>',
    '  </table>',

    /* Strategy */
    plan
      ? '<div style="margin-top:10px;font-size:12px;color:#374151;background:#ffffff;border-left:3px solid ' + s.badgeBg + ';padding:8px 10px;line-height:1.7;border-radius:0 4px 4px 0;">' + plan + '</div>'
      : "",

    '</div>',
  ].join("\n");
}

/* ─── WATCH / NOT-RECOMMENDED card ─── */

function buildWatchCardHtml_(row, metrics, s) {
  var symbol     = escapeHtml_(String(row.symbol || "").trim());
  var name       = escapeHtml_(String(row.name || "").trim());
  var themes     = buildValuationThemeTagsHtml_(row.themes);
  var lastPrice  = fmtPrice_(row.lastPrice);
  var fairValue  = fmtPrice_(row.fairValue);
  var upsidePct  = fmtPct_(row.upsidePct);
  var confidence = fmtConfidence_(row.confidence);
  var plan       = escapeHtml_(String(row.limitUpPlan || "").trim());
  var stopLoss   = fmtPrice_(row.downsideRisk);

  var reasons = buildWatchReasons_(row, metrics);

  return [
    '<div style="background:' + s.cardBg + ';border:1px solid ' + s.cardBorder + ';border-top:none;padding:14px;margin-bottom:1px;">',

    /* Name + badge */
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">',
    '  <tr>',
    '    <td style="vertical-align:middle;">',
    '      <span style="font-size:17px;font-weight:700;color:' + s.labelColor + ';">' + symbol + '</span>',
    '      <span style="font-size:15px;font-weight:600;color:#334155;margin-left:6px;">' + name + '</span>',
    '    </td>',
    '    <td style="text-align:right;vertical-align:middle;white-space:nowrap;">',
    '      <span style="background:' + s.badgeBg + ';color:#fff;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;">' + escapeHtml_(s.label) + '</span>',
    '    </td>',
    '  </tr>',
    '  </table>',

    themes ? '<div style="margin-top:6px;">' + themes + '</div>' : "",

    /* Compact metrics */
    '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:10px;">',
    '  <tr>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:7px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:2px;">現價</div>',
    '      <div style="font-size:15px;font-weight:700;color:' + s.labelColor + ';">' + lastPrice + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:7px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:2px;">公平值</div>',
    '      <div style="font-size:15px;font-weight:700;color:' + s.labelColor + ';">' + fairValue + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:7px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:2px;">漲幅</div>',
    '      <div style="font-size:15px;font-weight:700;color:#78350f;">↑' + upsidePct + '</div>',
    '    </td>',
    '    <td style="width:5px;"></td>',
    '    <td style="background:' + s.priceBg + ';border-radius:6px;padding:7px 4px;text-align:center;">',
    '      <div style="font-size:10px;color:' + s.priceLabel + ';margin-bottom:2px;">信心</div>',
    '      <div style="font-size:15px;font-weight:700;color:' + s.labelColor + ';">' + confidence + '</div>',
    '    </td>',
    '  </tr>',
    '  </table>',

    /* Not-recommended reason */
    '  <div style="margin-top:10px;background:#fff8f1;border:1px solid #fcd34d;border-radius:6px;padding:10px 12px;">',
    '    <div style="font-size:11px;font-weight:700;color:#78350f;margin-bottom:4px;">⚠️ 不建議原因</div>',
    '    <div style="font-size:12px;color:#374151;line-height:1.7;">' + reasons + '</div>',
    '  </div>',

    /* If holding: show stop */
    stopLoss !== "—"
      ? '<div style="margin-top:8px;font-size:12px;color:#64748b;">若已持有 → 止損參考價：<strong style="color:#7f1d1d;">' + stopLoss + '</strong></div>'
      : "",

    /* Original plan note */
    plan
      ? '<div style="margin-top:8px;font-size:11px;color:#94a3b8;line-height:1.6;">' + plan + '</div>'
      : "",

    '</div>',
  ].join("\n");
}

/* ── reason builder for watch/sell ── */

function buildWatchReasons_(row, metrics) {
  var reasons = [];
  var upside = typeof row.upsidePct === "number" ? row.upsidePct : Number(row.upsidePct || 0);
  var conf   = typeof row.confidence === "number" ? row.confidence : Number(row.confidence || 0);

  if (!isNaN(upside)) {
    if (upside < 0)  reasons.push("目前估值偏高，上漲空間為負（-" + Math.abs(upside).toFixed(2) + "%）");
    else if (upside < 3) reasons.push("上漲空間極低（" + upside.toFixed(2) + "%），幾乎無獲利空間");
    else if (upside < 5) reasons.push("上漲空間偏低（" + upside.toFixed(2) + "%）");
  }

  if (!isNaN(conf)) {
    if (conf < 0.45) reasons.push("AI 信心不足（" + Math.round(conf * 100) + "%），不確定性高");
    else if (conf < 0.55) reasons.push("信心偏低（" + Math.round(conf * 100) + "%）");
  }

  if (metrics.rrRatio !== null) {
    if (metrics.rrRatio < 1.0) reasons.push("風險報酬比過低（×" + metrics.rrRatio.toFixed(1) + "），潛在損失大於潛在獲利");
    else if (metrics.rrRatio < 1.5) reasons.push("風險報酬比不理想（×" + metrics.rrRatio.toFixed(1) + "）");
  }

  if (reasons.length === 0) {
    reasons.push("綜合評估不確定因素偏多，觀察後再行決策");
  }

  return reasons.join("；");
}

/* ── helpers ── */

function computeValuationMetrics_(row) {
  var lp = typeof row.lastPrice    === "number" ? row.lastPrice    : Number(row.lastPrice    || 0);
  var sl = typeof row.downsideRisk === "number" ? row.downsideRisk : Number(row.downsideRisk || 0);
  var up = typeof row.upsidePct    === "number" ? row.upsidePct    : Number(row.upsidePct    || 0);

  if (isNaN(lp) || lp <= 0 || isNaN(sl) || sl <= 0 || sl >= lp) {
    return { riskPct: null, rrRatio: null };
  }

  var riskPct = (lp - sl) / lp * 100;
  var rrRatio = riskPct > 0 ? up / riskPct : null;

  return { riskPct: riskPct, rrRatio: rrRatio };
}

function buildValuationThemeTagsHtml_(themes) {
  var text = String(themes || "").trim();
  if (!text) return "";
  return text.split(",")
    .map(function(t) { return t.trim(); })
    .filter(Boolean)
    .map(function(t) {
      return '<span style="display:inline-block;font-size:10px;background:#e2e8f0;color:#475569;'
        + 'padding:2px 7px;border-radius:10px;margin:2px 3px 0 0;">' + escapeHtml_(t) + '</span>';
    })
    .join("");
}

function fmtPrice_(value) {
  if (value === null || value === undefined || value === "") return "—";
  var n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (isNaN(n)) return "—";
  var s = n.toFixed(n % 1 !== 0 ? 1 : 0);
  var parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function fmtPct_(value) {
  if (value === null || value === undefined || value === "") return "—";
  var n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return "—";
  return n.toFixed(2) + "%";
}

function fmtConfidence_(value) {
  if (value === null || value === undefined || value === "") return "—";
  var n = typeof value === "number" ? value : Number(String(value));
  if (isNaN(n)) return "—";
  var pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return pct + "%";
}

function normalizeValuationRating_(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, "_");
}
