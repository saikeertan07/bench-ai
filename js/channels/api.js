/* ============================================================
   CH06 — API
   Paste a request/response/cURL/fetch snippet -> API Autopsy.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.api = function (panel) {
  const $ = BAI.$;

  panel.innerHTML = BAI.panelHead('CH06', 'API Autopsy', 'apiStatus') + `
    <label class="field-label">Paste request, response, headers, status code, cURL, or fetch/axios code</label>
    <textarea id="apiIn" placeholder="HTTP/1.1 401 Unauthorized\n{ \"error\": \"invalid_token\" }">${BAI.escapeHtml(BAI.state.rawInput)}</textarea>
    <div class="row">
      <button class="btn primary" id="apiRun">Run Autopsy</button>
      <button class="btn ghost" id="apiClear">Clear</button>
    </div>
    <div id="apiOut"></div>
  `;

  function run() {
    const raw = $('#apiIn').value;
    if (!raw.trim()) {
      $('#apiOut').innerHTML = '';
      BAI.setStatus('apiStatus', 'idle', 'idle');
      return;
    }
    BAI.setInput(raw);
    const a = BAI.tools.api.autopsy(raw);
    const code = a.status ? a.status.code : null;
    const hot = code && code >= 400;
    BAI.setStatus('apiStatus', hot ? 'err' : 'ok', code ? String(code) : 'analyzed');

    $('#apiOut').innerHTML = `
      <div class="diag-section-label" style="margin-top:16px;">API Autopsy</div>
      <div class="autopsy-grid">
        <div class="ak">Status</div><div class="av ${hot ? 'hot' : 'good'}">${code ? `${code} ${a.status.phrase || (a.meaning ? a.meaning[0] : '')}` : 'not detected'}</div>
        <div class="ak">Format</div><div class="av">${a.body ? 'JSON' : 'unstructured / none detected'}</div>
        <div class="ak">Auth</div><div class="av ${a.jwtToken ? 'info' : ''}">${a.jwtToken ? 'JWT detected' : 'none detected'}</div>
        ${a.jwtInfo && a.jwtInfo.ok ? `<div class="ak">Token</div><div class="av ${a.jwtInfo.expired ? 'hot' : 'good'}">${a.jwtInfo.expired ? 'EXPIRED' : 'VALID (DECODED \u2014 NOT VERIFIED)'}</div>` : ''}
        <div class="ak">CORS</div><div class="av ${a.isCors ? 'hot' : ''}">${a.isCors ? 'blocked by CORS policy' : 'no CORS signal'}</div>
        <div class="ak">Timestamp</div><div class="av">${a.timestamp.toDateString()}</div>
      </div>

      <div class="diag-section-label">Likely cause</div>
      <div class="diag-text" style="margin-bottom:14px;">${BAI.escapeHtml(a.likelyCause)}</div>

      <div class="diag-section-label">Recommended fix</div>
      <div class="diag-text">${BAI.escapeHtml(a.recommendedFix)}</div>

      <div class="row" style="margin-top:16px;">
        <button class="btn primary" id="apiDiagnose">Full Diagnose \u2192</button>
      </div>
    `;
    const btn = $('#apiDiagnose');
    if (btn) btn.onclick = () => BAI.app.selectChannel('diagnose');
  }

  $('#apiRun').onclick = run;
  $('#apiClear').onclick = () => { $('#apiIn').value = ''; BAI.setInput(''); run(); };

  if (BAI.state.rawInput.trim()) run();
};
