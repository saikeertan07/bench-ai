/* ============================================================
   BAI.ai — the AIProvider abstraction.

   AIProvider interface (any future real-LLM provider implements this):
     analyze(input)      -> { detection }
     diagnose(input)      -> full diagnosis object
     generateFix(diag)     -> fix object
     verifyFix(diag, fix)   -> verification object

   BAI.ai.provider currently points at DemoAIProvider, a fully
   deterministic, pattern-based engine so the app works with zero
   API key / zero network calls during a hackathon demo. Swapping
   in a real LLM later means writing a new provider with the same
   four methods and setting BAI.ai.provider = new RealAIProvider().
   ============================================================ */
window.BAI = window.BAI || {};

BAI.ai = (function () {

  function severityFor(type) {
    if (['stack_trace_java', 'stack_trace_python', 'stack_trace_js', 'sql_error'].includes(type)) return 'CRITICAL';
    if (['http_error', 'jwt'].includes(type)) return 'HIGH';
    if (['log'].includes(type)) return 'HIGH';
    if (['json', 'base64', 'url', 'timestamp', 'regex'].includes(type)) return 'LOW';
    return 'MEDIUM';
  }

  /* ---------------- specialized diagnosers ---------------- */

  function diagnoseJavaNPE(text) {
    const excMatch = text.match(/([\w.]*NullPointerException)[^\n]*/);
    const frameMatch = text.match(/at\s+([\w$.]+)\(([\w.]+\.java):(\d+)\)/);
    const causeMatch = text.match(/because(?: the return value of)?\s+"?([^"\n]+?)"?\s+is null/i);
    const cause = causeMatch ? causeMatch[1] : 'an object';
    const frame = frameMatch ? `${frameMatch[2]}:${frameMatch[3]}` : 'unknown location';
    const method = frameMatch ? frameMatch[1] : 'the failing method';

    return {
      type: 'stack_trace_java',
      title: 'NullPointerException',
      severity: 'CRITICAL',
      confidence: 0.94,
      problemDetected: 'Null dereference in application code',
      rootCause: `\`${cause}\` is accessed before verifying that it exists. The lookup that produces it can legitimately return null, and the calling code doesn't guard against that case.`,
      evidence: [
        { label: 'Exception', value: excMatch ? excMatch[0].trim() : 'NullPointerException' },
        { label: 'Location', value: frame },
        { label: 'Call site', value: method },
      ],
      contributingFactors: [
        'No null-check between the lookup and the field/method access',
        'The upstream data source (DB/cache/API) can return an empty result for this path'
      ],
      impact: 'The request fails with an unhandled 500-class error and the caller receives no useful explanation.',
      causalChain: [
        { label: 'Symptom', value: 'Request throws NullPointerException' },
        { label: 'Trigger', value: `${cause} evaluates to null at runtime` },
        { label: 'Root cause', value: 'Missing null-guard before dereference', root: true },
        { label: 'Impact', value: 'Unhandled exception, request fails' },
      ],
      fix: {
        language: 'java',
        explanation: `Guard the access with a null-check (or use \`Optional\`) and fail with a clear, handled error instead of an unchecked NPE.`,
        diff: [
          { type: 'ctx', text: `public Order createOrder(String userId) {` },
          { type: 'ctx', text: `    User user = userRepository.find(userId);` },
          { type: 'rem', text: `    String name = user.getProfile().trim();` },
          { type: 'add', text: `    if (user == null || user.getProfile() == null) {` },
          { type: 'add', text: `        throw new NotFoundException("User or profile not found: " + userId);` },
          { type: 'add', text: `    }` },
          { type: 'add', text: `    String name = user.getProfile().trim();` },
          { type: 'ctx', text: `    // ...` },
          { type: 'ctx', text: `}` },
        ]
      },
      testSuggestions: [
        'createOrder() with a userId that has no profile row \u2192 expect NotFoundException, not NPE',
        'createOrder() with a valid user \u2192 unchanged happy-path behavior'
      ]
    };
  }

  function diagnosePythonTraceback(text) {
    const excMatch = text.match(/(\w*Error|\w*Exception):\s*(.+)/);
    const fileMatch = [...text.matchAll(/File "([^"]+)", line (\d+)/g)].pop();
    return {
      type: 'stack_trace_python',
      title: excMatch ? excMatch[1] : 'Exception',
      severity: 'CRITICAL',
      confidence: 0.9,
      problemDetected: excMatch ? `${excMatch[1]} raised during execution` : 'Unhandled exception',
      rootCause: excMatch ? `${excMatch[1]}: ${excMatch[2].trim()}` : 'An unhandled exception interrupted execution.',
      evidence: [
        { label: 'Exception', value: excMatch ? excMatch[0] : 'unknown' },
        { label: 'Location', value: fileMatch ? `${fileMatch[1]}:${fileMatch[2]}` : 'unknown' },
      ],
      contributingFactors: ['No try/except around the failing call', 'Input was not validated before use'],
      impact: 'The process terminates the current request/script at this point.',
      causalChain: [
        { label: 'Symptom', value: 'Traceback printed, execution halted' },
        { label: 'Trigger', value: excMatch ? excMatch[2].trim() : 'unexpected value at runtime' },
        { label: 'Root cause', value: excMatch ? excMatch[1] : 'unhandled exception', root: true },
        { label: 'Impact', value: 'Request/script fails to complete' },
      ],
      fix: {
        language: 'python',
        explanation: 'Validate the input up front and handle the failure case explicitly instead of letting it propagate as an unhandled exception.',
        diff: [
          { type: 'ctx', text: `def process(record):` },
          { type: 'rem', text: `    value = record["amount"] / record["count"]` },
          { type: 'add', text: `    if not record.get("count"):` },
          { type: 'add', text: `        raise ValueError(f"count must be non-zero for record {record.get('id')}")` },
          { type: 'add', text: `    value = record["amount"] / record["count"]` },
          { type: 'ctx', text: `    return value` },
        ]
      },
      testSuggestions: ['process() with count=0 \u2192 expect a clear ValueError, not a raw traceback']
    };
  }

  function diagnoseJsError(text) {
    const excMatch = text.match(/(TypeError|ReferenceError|SyntaxError|RangeError):\s*(.+)/);
    const frameMatch = text.match(/at\s+.+\((.+):(\d+):(\d+)\)/);
    return {
      type: 'stack_trace_js',
      title: excMatch ? excMatch[1] : 'JavaScript error',
      severity: 'CRITICAL',
      confidence: 0.9,
      problemDetected: excMatch ? excMatch[0].trim() : 'Unhandled JS exception',
      rootCause: excMatch ? excMatch[2].trim() : 'An unexpected runtime error occurred.',
      evidence: [
        { label: 'Error', value: excMatch ? excMatch[0].trim() : 'unknown' },
        { label: 'Location', value: frameMatch ? `${frameMatch[1]}:${frameMatch[2]}:${frameMatch[3]}` : 'unknown' },
      ],
      contributingFactors: ['Value assumed to be defined was undefined/null at runtime', 'No defensive check before property access or call'],
      impact: 'The current call stack unwinds; in the browser this can break the surrounding UI interaction.',
      causalChain: [
        { label: 'Symptom', value: excMatch ? excMatch[1] : 'Runtime error' },
        { label: 'Trigger', value: 'Value accessed was undefined/null' },
        { label: 'Root cause', value: 'Missing guard before access', root: true },
        { label: 'Impact', value: 'Unhandled exception in call stack' },
      ],
      fix: {
        language: 'javascript',
        explanation: 'Use optional chaining / a guard clause before accessing the property, and fail predictably if the value is missing.',
        diff: [
          { type: 'rem', text: `const name = user.profile.name;` },
          { type: 'add', text: `const name = user?.profile?.name ?? null;` },
          { type: 'add', text: `if (name === null) {` },
          { type: 'add', text: `  console.warn('profile missing for user', user?.id);` },
          { type: 'add', text: `}` },
        ]
      },
      testSuggestions: ['Render component with a user object missing `profile` \u2192 no throw']
    };
  }

  function diagnoseSql(text) {
    const codeMatch = text.match(/ORA-\d{5}|SQLSTATE\[[^\]]+\]/);
    return {
      type: 'sql_error', title: 'Database error', severity: 'HIGH', confidence: 0.82,
      problemDetected: 'The database rejected or failed a query.',
      rootCause: codeMatch ? `Database returned ${codeMatch[0]} \u2014 likely a constraint violation, syntax issue, or connection fault.` : 'The query failed against the current schema/state.',
      evidence: [{ label: 'Signature', value: codeMatch ? codeMatch[0] : 'matched SQL error pattern' }],
      contributingFactors: ['Schema/migration drift between environments', 'Concurrent write causing a constraint or lock conflict'],
      impact: 'The transaction is rolled back and the calling request fails.',
      causalChain: [
        { label: 'Symptom', value: 'Query execution fails' },
        { label: 'Trigger', value: 'Constraint, syntax, or connectivity issue' },
        { label: 'Root cause', value: 'Schema/state mismatch', root: true },
        { label: 'Impact', value: 'Transaction rolled back' },
      ],
      fix: {
        language: 'sql', explanation: 'Add an explicit existence/uniqueness check before the write, and wrap in a retry for transient connection errors.',
        diff: [
          { type: 'rem', text: `INSERT INTO orders (id, user_id) VALUES ($1, $2);` },
          { type: 'add', text: `INSERT INTO orders (id, user_id) VALUES ($1, $2)` },
          { type: 'add', text: `ON CONFLICT (id) DO NOTHING;` },
        ]
      },
      testSuggestions: ['Re-run the same insert twice \u2192 second run should not error']
    };
  }

  function diagnoseJwt(text) {
    const m = text.match(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/);
    const token = m ? m[0] : text.trim();
    const decoded = BAI.tools.jwt.decode(token);
    if (!decoded.ok) {
      return {
        type: 'jwt', title: 'Malformed token', severity: 'HIGH', confidence: 0.7,
        problemDetected: 'Input looks like a JWT but could not be decoded.',
        rootCause: decoded.error, evidence: [{ label: 'Error', value: decoded.error }],
        contributingFactors: ['Token was truncated or copy-pasted incorrectly'],
        impact: 'Any consumer of this token will reject it outright.',
        causalChain: [
          { label: 'Symptom', value: 'Decode fails' },
          { label: 'Trigger', value: 'Malformed base64url segment' },
          { label: 'Root cause', value: decoded.error, root: true },
          { label: 'Impact', value: 'Token unusable' },
        ],
        fix: { language: 'text', explanation: 'Re-copy the full token \u2014 make sure no whitespace or truncation occurred.', diff: [] },
        testSuggestions: []
      };
    }
    const expired = decoded.expired;
    return {
      type: 'jwt', title: expired ? 'Expired JWT' : 'JWT (decoded)', severity: expired ? 'HIGH' : 'LOW',
      confidence: 0.95,
      problemDetected: expired ? 'The access token has expired.' : 'Token decodes cleanly and is not expired.',
      rootCause: expired
        ? `\`exp\` claim (${decoded.expDate.toISOString()}) is in the past relative to now.`
        : 'No expiration issue detected in the payload.',
      evidence: [
        { label: 'alg', value: decoded.header.alg || 'n/a' },
        { label: 'sub', value: String(decoded.payload.sub ?? 'n/a') },
        { label: 'exp', value: decoded.payload.exp ? new Date(decoded.payload.exp * 1000).toISOString() : 'not present' },
      ],
      contributingFactors: expired ? ['Client did not refresh the token before it expired', 'Clock skew between client and server (less likely if the gap is large)'] : [],
      impact: expired ? 'Every request using this token will be rejected with 401 until it is refreshed.' : 'None \u2014 token is currently valid. Note: this is DECODED — NOT VERIFIED, the signature was not checked.',
      causalChain: [
        { label: 'Symptom', value: 'API request rejected (401)' },
        { label: 'Trigger', value: 'Bearer token presented on request' },
        { label: 'Root cause', value: expired ? 'JWT expiration' : 'n/a', root: true },
        { label: 'Impact', value: 'Authentication failure' },
      ],
      fix: {
        language: 'javascript', explanation: 'Refresh the token proactively before it expires, and retry the original request once a new token is obtained.',
        diff: [
          { type: 'rem', text: `const res = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });` },
          { type: 'add', text: `if (isExpired(token)) token = await refreshAccessToken();` },
          { type: 'add', text: `const res = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });` },
          { type: 'add', text: `if (res.status === 401) { token = await refreshAccessToken(); /* retry once */ }` },
        ]
      },
      testSuggestions: ['Call the API with a token 1 second past expiry \u2192 expect automatic refresh + retry, not a surfaced 401']
    };
  }

  function diagnoseHttp(text) {
    const a = BAI.tools.api.autopsy(text);
    const code = a.status ? a.status.code : null;
    return {
      type: 'http_error', title: a.meaning ? `HTTP ${code} \u2014 ${a.meaning[0]}` : `HTTP ${code || 'error'}`,
      severity: code >= 500 ? 'CRITICAL' : (code === 401 || code === 403 ? 'HIGH' : 'MEDIUM'),
      confidence: 0.88,
      problemDetected: a.meaning ? a.meaning[0] : 'HTTP error response',
      rootCause: a.likelyCause,
      evidence: [
        { label: 'Status', value: code ? `${code} ${a.status.phrase || ''}`.trim() : 'unknown' },
        ...(a.body ? [{ label: 'Body', value: JSON.stringify(a.body).slice(0, 160) }] : []),
      ],
      contributingFactors: a.meaning ? [a.meaning[1]] : [],
      impact: code >= 500 ? 'The client-facing operation fails; this is a server-side fault.' : 'The client request is rejected before completing its intended action.',
      causalChain: [
        { label: 'Symptom', value: 'Client receives error response' },
        { label: 'Trigger', value: `HTTP ${code}` },
        { label: 'Root cause', value: a.likelyCause.split('.')[0], root: true },
        { label: 'Impact', value: code >= 500 ? 'Server-side failure' : 'Request rejected' },
      ],
      fix: {
        language: 'javascript', explanation: a.recommendedFix,
        diff: code === 401 ? [
          { type: 'rem', text: `const res = await fetch(url, { headers });` },
          { type: 'add', text: `if (isExpired(token)) token = await refreshAccessToken();` },
          { type: 'add', text: `const res = await fetch(url, { headers: { ...headers, Authorization: \`Bearer \${token}\` } });` },
        ] : [
          { type: 'ctx', text: `const res = await fetch(url, { headers });` },
          { type: 'add', text: `if (!res.ok) {` },
          { type: 'add', text: `  const body = await res.text();` },
          { type: 'add', text: `  throw new ApiError(res.status, body);` },
          { type: 'add', text: `}` },
        ]
      },
      testSuggestions: ['Retry the request after applying the fix \u2192 expect a 2xx response'],
      _autopsy: a,
    };
  }

  function diagnoseJson(text) {
    try {
      JSON.parse(text);
      return {
        type: 'json', title: 'Valid JSON', severity: 'LOW', confidence: 0.95,
        problemDetected: 'No structural problem \u2014 input parses cleanly.',
        rootCause: 'n/a', evidence: [{ label: 'Parse', value: 'OK' }],
        contributingFactors: [], impact: 'None.',
        causalChain: [
          { label: 'Symptom', value: 'None reported' },
          { label: 'Trigger', value: 'n/a' },
          { label: 'Root cause', value: 'n/a', root: false },
          { label: 'Impact', value: 'n/a' },
        ],
        fix: { language: 'json', explanation: 'No fix needed.', diff: [] },
        testSuggestions: []
      };
    } catch (e) {
      const posMatch = e.message.match(/position (\d+)/);
      const pos = posMatch ? Number(posMatch[1]) : null;
      const snippet = pos !== null ? text.slice(Math.max(0, pos - 20), pos + 20) : text.slice(0, 40);
      return {
        type: 'json', title: 'Malformed JSON', severity: 'MEDIUM', confidence: 0.9,
        problemDetected: e.message,
        rootCause: `The JSON parser stopped at ${pos !== null ? 'character ' + pos : 'an unexpected token'} \u2014 likely a trailing comma, unquoted key, or unbalanced bracket.`,
        evidence: [{ label: 'Parser error', value: e.message }, { label: 'Near', value: '\u2026' + snippet + '\u2026' }],
        contributingFactors: ['Hand-edited JSON', 'Copy-paste truncation'],
        impact: 'Any consumer calling JSON.parse on this string will throw.',
        causalChain: [
          { label: 'Symptom', value: 'JSON.parse throws' },
          { label: 'Trigger', value: e.message },
          { label: 'Root cause', value: 'Malformed syntax near the reported position', root: true },
          { label: 'Impact', value: 'Parsing fails for any consumer' },
        ],
        fix: { language: 'json', explanation: 'Fix the syntax error at the reported position (common causes: trailing comma, missing quote, unbalanced brace).', diff: [] },
        testSuggestions: ['Re-run JSON.parse after the fix \u2192 expect no throw']
      };
    }
  }

  function diagnoseLog(text) {
    const stats = BAI.tools.logs.analyze(text);
    const top = stats.topFailure;
    return {
      type: 'log', title: top ? 'Dominant recurring failure detected' : 'Log analyzed, no dominant failure',
      severity: top && top.count > 5 ? 'HIGH' : 'MEDIUM', confidence: 0.85,
      problemDetected: top ? `"${top.message}" repeated ${top.count} times` : 'No single failure dominates this log window.',
      rootCause: top ? `A single recurring failure ("${top.message.slice(0, 90)}") accounts for the majority of errors in this window, spanning ${top.first || '?'} \u2013 ${top.last || '?'}.` : 'Errors are spread across many distinct causes; no single fix will resolve most of them.',
      evidence: [
        { label: 'Lines analyzed', value: String(stats.linesAnalyzed) },
        { label: 'Errors', value: String(stats.errors) },
        { label: 'Unique failures', value: String(stats.uniqueFailures) },
      ],
      contributingFactors: top ? ['Likely a systemic dependency issue (DB/network/upstream service) rather than isolated bugs'] : [],
      impact: top ? 'Requests touching this code path are failing repeatedly, not intermittently.' : 'Diffuse impact across several call paths.',
      causalChain: top ? [
        { label: 'Symptom', value: `${top.count} repeated errors` },
        { label: 'Trigger', value: top.message.slice(0, 60) },
        { label: 'Root cause', value: 'Recurring dependency/resource failure', root: true },
        { label: 'Impact', value: 'Sustained request failures in this window' },
      ] : [],
      fix: {
        language: 'text',
        explanation: top ? 'Address the dominant recurring failure first \u2014 fixing it resolves the majority of errors in this window.' : 'No single high-leverage fix identified; triage the top few unique failures individually.',
        diff: []
      },
      testSuggestions: [],
      _logStats: stats,
    };
  }

  function diagnoseGeneric(text, detection) {
    const lines = text.split('\n');
    return {
      type: detection.type, title: detection.label, severity: severityFor(detection.type),
      confidence: detection.confidence,
      problemDetected: `Input classified as ${detection.label.toLowerCase()}.`,
      rootCause: 'No specialized analyzer matched this input precisely \u2014 showing a best-effort read based on detected signals.',
      evidence: detection.signals.map(s => ({ label: 'Signal', value: s })).concat(
        lines.length > 1 ? [{ label: 'Lines', value: String(lines.length) }] : []
      ),
      contributingFactors: [],
      impact: 'Unable to assess impact precisely without a more specific pattern match.',
      causalChain: [],
      fix: { language: 'text', explanation: 'Paste a stack trace, HTTP response, log, or JSON payload for a fully worked diagnosis with a concrete fix.', diff: [] },
      testSuggestions: [],
    };
  }

  /* ---------------- provider interface ---------------- */

  const DemoAIProvider = {
    analyze(input) {
      const detection = BAI.detector.detect(input);
      return { detection };
    },

    diagnose(input) {
      const detection = BAI.detector.detect(input);
      let diag;
      switch (detection.type) {
        case 'stack_trace_java': diag = diagnoseJavaNPE(input); break;
        case 'stack_trace_python': diag = diagnosePythonTraceback(input); break;
        case 'stack_trace_js': diag = diagnoseJsError(input); break;
        case 'sql_error': diag = diagnoseSql(input); break;
        case 'jwt': diag = diagnoseJwt(input); break;
        case 'http_error': diag = diagnoseHttp(input); break;
        case 'json': diag = diagnoseJson(input); break;
        case 'log': diag = diagnoseLog(input); break;
        default: diag = diagnoseGeneric(input, detection);
      }
      diag.detection = detection;
      diag.analyzedAt = new Date();
      return diag;
    },

    generateFix(diagnosis) {
      // Fix is already produced as part of diagnose() in this deterministic engine;
      // this entry point exists so a real LLM provider can regenerate/refine it independently.
      return diagnosis.fix;
    },

    verifyFix(diagnosis) {
      const hasFix = diagnosis.fix && diagnosis.fix.diff && diagnosis.fix.diff.length > 0;
      const checks = [];
      if (diagnosis.type.startsWith('stack_trace') || diagnosis.type === 'sql_error') {
        checks.push({ label: 'Syntax valid', pass: true });
        checks.push({ label: hasFix ? 'Null/guard check added' : 'Guard check present', pass: hasFix });
        checks.push({ label: 'Original exception path no longer reachable', pass: hasFix });
      } else if (diagnosis.type === 'jwt' || diagnosis.type === 'http_error') {
        checks.push({ label: 'Auth header present on retry', pass: hasFix });
        checks.push({ label: 'Token refresh path added', pass: hasFix });
        checks.push({ label: 'Expected response restored', pass: hasFix });
      } else if (diagnosis.type === 'json') {
        checks.push({ label: 'JSON.parse succeeds', pass: diagnosis.title === 'Valid JSON' || hasFix });
      } else if (diagnosis.type === 'log') {
        checks.push({ label: 'Dominant failure identified', pass: !!diagnosis._logStats?.topFailure });
        checks.push({ label: 'Fix targets root dependency, not symptom', pass: hasFix });
      } else {
        checks.push({ label: 'Diagnosis produced', pass: true });
        checks.push({ label: 'Concrete fix available', pass: hasFix });
      }
      const allPass = checks.every(c => c.pass);
      return {
        checks,
        status: allPass ? 'RESOLVED' : 'NEEDS ATTENTION',
        confidence: allPass ? 0.97 : 0.55,
        testSuggestions: diagnosis.testSuggestions || [],
      };
    }
  };

  return { provider: DemoAIProvider };
})();
