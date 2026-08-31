/* ============================================================
   BAI.detector — smart auto-detection engine (CH01 Capture).
   Pure pattern/heuristic based, runs entirely client-side.
   Returns { type, label, confidence, signals: [] }
   ============================================================ */
window.BAI = window.BAI || {};

BAI.detector = (function () {

  function isJwtShape(s) {
    const t = s.trim();
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(t) && t.length > 20;
  }

  function looksLikeJson(s) {
    const t = s.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return false;
    try { JSON.parse(t); return true; } catch (e) { return false; }
  }

  function detect(raw) {
    const text = (raw || '').trim();
    const signals = [];
    if (!text) return { type: 'empty', label: 'No input', confidence: 0, signals: [] };

    const candidates = [];

    // JWT
    if (isJwtShape(text)) {
      candidates.push({ type: 'jwt', label: 'JWT', confidence: 0.97,
        signals: ['three dot-separated base64url segments'] });
    }

    // JSON — valid, or structurally JSON-shaped but broken (still worth routing to the JSON analyzer)
    if (looksLikeJson(text)) {
      candidates.push({ type: 'json', label: 'JSON', confidence: 0.95,
        signals: ['parses as valid JSON'] });
    } else {
      const t = text.trim();
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        candidates.push({ type: 'json', label: 'JSON (malformed)', confidence: 0.72,
          signals: ['starts/ends like a JSON object or array but fails to parse'] });
      }
    }

    // HTTP status / response
    const httpStatus = text.match(/\b(HTTP\/\d(?:\.\d)?\s+)?\b([1-5]\d{2})\b\s*(Unauthorized|Forbidden|Not Found|Internal Server Error|Bad Request|Bad Gateway|Service Unavailable|Gateway Timeout|OK|Created|No Content|Too Many Requests)?/i);
    const looksHttp = /\b(status|statusCode|HTTP)\b/i.test(text) && /\b[1-5]\d{2}\b/.test(text);
    if (httpStatus && (httpStatus[3] || looksHttp)) {
      candidates.push({ type: 'http_error', label: 'HTTP response', confidence: 0.9,
        signals: [`status code ${httpStatus[2]}${httpStatus[3] ? ' ' + httpStatus[3] : ''} present`] });
    }

    // Stack traces — Java
    if (/\bat [\w$.]+\([\w.]+\.java:\d+\)/.test(text) || /Exception\b.*\n\s*at /s.test(text)) {
      candidates.push({ type: 'stack_trace_java', label: 'Java stack trace', confidence: 0.94,
        signals: ['`at package.Class.method(File.java:line)` frames detected'] });
    }
    // Python traceback
    if (/Traceback \(most recent call last\)/.test(text)) {
      candidates.push({ type: 'stack_trace_python', label: 'Python traceback', confidence: 0.96,
        signals: ['"Traceback (most recent call last)" header found'] });
    }
    // JS / Node error
    if (/\bat .+\(.+:\d+:\d+\)/.test(text) && /(TypeError|ReferenceError|SyntaxError|RangeError):/.test(text)) {
      candidates.push({ type: 'stack_trace_js', label: 'JavaScript stack trace', confidence: 0.93,
        signals: ['`TypeError/ReferenceError:` header with `at file:line:col` frames'] });
    }
    // SQL error
    if (/\b(SQLSTATE|SQL Error|syntax error at or near|ORA-\d{5}|MySQL server has gone away|deadlock detected)\b/i.test(text)) {
      candidates.push({ type: 'sql_error', label: 'SQL error', confidence: 0.88,
        signals: ['database error signature matched'] });
    }

    // Log file (many timestamped lines)
    const tsLineCount = (text.match(/^\s*(\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2})/gm) || []).length;
    const lineCount = text.split('\n').length;
    if (lineCount > 4 && tsLineCount >= Math.max(3, lineCount * 0.3)) {
      candidates.push({ type: 'log', label: 'Log file', confidence: Math.min(0.97, 0.6 + tsLineCount / lineCount * 0.4),
        signals: [`${tsLineCount} timestamped lines out of ${lineCount}`] });
    }

    // Base64 blob (long, no whitespace, base64 alphabet)
    const t2 = text.replace(/\s+/g, '');
    if (t2.length > 24 && /^[A-Za-z0-9+/=]+$/.test(t2) && !/^\d+$/.test(t2)) {
      candidates.push({ type: 'base64', label: 'Base64', confidence: 0.7,
        signals: ['base64 alphabet only, length ' + t2.length] });
    }

    // Unix timestamp
    if (/^\d{10}(\d{3})?$/.test(text)) {
      candidates.push({ type: 'timestamp', label: 'Unix timestamp', confidence: 0.75,
        signals: ['numeric, 10 or 13 digits'] });
    }

    // URL
    if (/^https?:\/\/\S+$/.test(text)) {
      candidates.push({ type: 'url', label: 'URL', confidence: 0.85, signals: ['starts with http(s)://'] });
    }

    // Regex literal
    if (/^\/.*\/[gimsuy]*$/.test(text)) {
      candidates.push({ type: 'regex', label: 'Regular expression', confidence: 0.6, signals: ['delimited /pattern/flags form'] });
    }

    // Source code (heuristic: braces/semicolons/keywords, multiple lines, not caught above)
    const codeKeywords = /\b(function|const|let|var|class|def|import|return|public|private|void|SELECT|package)\b/;
    if (lineCount > 1 && codeKeywords.test(text) && !candidates.some(c => c.type.startsWith('stack_trace'))) {
      candidates.push({ type: 'code', label: 'Source code', confidence: 0.65,
        signals: ['language keywords + multi-line structure'] });
    }

    if (candidates.length === 0) {
      candidates.push({ type: 'plain_text', label: 'Plain text', confidence: 0.4, signals: ['no structured pattern matched'] });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    best.alternates = candidates.slice(1, 3);
    return best;
  }

  return { detect };
})();
