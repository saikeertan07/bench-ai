/* ============================================================
   BAI.tools.logs — parses raw multi-line log text into stats,
   grouped/deduplicated failures, and a coarse timeline.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.tools = BAI.tools || {};

BAI.tools.logs = (function () {

  const TS_RE = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?|\d{2}:\d{2}:\d{2})/;

  function levelOf(line) {
    if (/\b(FATAL|CRITICAL)\b/.test(line)) return 'error';
    if (/\b(ERROR|ERR|Exception|Traceback)\b/i.test(line)) return 'error';
    if (/\b(WARN|WARNING)\b/i.test(line)) return 'warn';
    if (/\b(INFO|DEBUG|TRACE)\b/.test(line)) return 'info';
    return 'other';
  }

  // Normalize a message so near-duplicate errors (differing only by id/number) group together.
  function normalize(msg) {
    return msg
      .replace(/\b\d{2,}\b/g, '#')
      .replace(/0x[0-9a-f]+/gi, '#')
      .replace(/[a-f0-9-]{8,}/gi, '#')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
  }

  function analyze(text) {
    const lines = (text || '').split('\n').filter(l => l.trim().length > 0);
    let errors = 0, warnings = 0, infos = 0;
    const groups = {}; // normalizedMsg -> { message, count, first, last, level }
    const hourBuckets = {};

    for (const line of lines) {
      const level = levelOf(line);
      if (level === 'error') errors++;
      else if (level === 'warn') warnings++;
      else if (level === 'info') infos++;

      const tsMatch = line.match(TS_RE);
      const ts = tsMatch ? tsMatch[1] : null;

      if (level === 'error' || level === 'warn') {
        const key = normalize(line);
        if (!groups[key]) {
          groups[key] = { message: line.trim().slice(0, 160), count: 0, first: ts, last: ts, level };
        }
        groups[key].count++;
        groups[key].last = ts || groups[key].last;
      }

      if (ts) {
        const hourKey = ts.slice(0, ts.includes('T') ? 13 : 2); // coarse bucket
        hourBuckets[hourKey] = (hourBuckets[hourKey] || 0) + (level === 'error' ? 1 : 0.15);
      }
    }

    const failures = Object.values(groups).sort((a, b) => b.count - a.count);
    const timeline = Object.keys(hourBuckets).sort().map(k => ({ bucket: k, weight: hourBuckets[k] }));

    let firstSeen = null, lastSeen = null;
    for (const l of lines) {
      const m = l.match(TS_RE);
      if (m) { if (!firstSeen) firstSeen = m[1]; lastSeen = m[1]; }
    }

    return {
      linesAnalyzed: lines.length,
      errors, warnings, infos,
      uniqueFailures: failures.length,
      failures,
      timeline,
      firstSeen, lastSeen,
      topFailure: failures[0] || null,
    };
  }

  return { analyze };
})();
