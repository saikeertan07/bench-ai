/* ============================================================
   CH05 — VERIFY
   "Did the fix actually solve the problem?"
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.verify = function (panel) {
  const $ = BAI.$;

  if (!BAI.state.rawInput.trim()) {
    panel.innerHTML = BAI.panelHead('CH05', 'Verify', 'verStatus') + BAI.emptyCaptureNotice();
    BAI.setStatus('verStatus', 'idle', 'idle');
    return;
  }

  const diag = BAI.ensureDiagnosis();
  const verification = BAI.ai.provider.verifyFix(diag);
  diag.verification = verification;

  const resolved = verification.status === 'RESOLVED';
  BAI.setStatus('verStatus', resolved ? 'ok' : 'warn', resolved ? 'resolved' : 'needs attention');

  // record / update history now that the full flow has run once
  BAI.recordHistoryOnce();

  panel.innerHTML = BAI.panelHead('CH05', 'Verify', 'verStatus') + `
    <div class="rc-grid" style="margin-bottom:16px;">
      <div class="rc-box">
        <h4>Before</h4>
        <p style="color:var(--red)">${BAI.escapeHtml(diag.problemDetected)}</p>
      </div>
      <div class="rc-box">
        <h4>After</h4>
        <p style="color:${resolved ? 'var(--green)' : 'var(--accent)'}">${resolved ? 'Fix applied \u2014 guard/refresh path now handles this case.' : 'Fix drafted \u2014 apply and re-run to confirm.'}</p>
      </div>
    </div>

    <div class="diag-section-label">Validation</div>
    <div class="check-list">
      ${verification.checks.map(c => `
        <div class="check-item ${c.pass ? 'pass' : 'fail'}">
          <span class="check-icon">${c.pass ? '\u2713' : '\u2717'}</span>
          <span>${BAI.escapeHtml(c.label)}</span>
        </div>
      `).join('')}
    </div>

    <div class="verify-verdict ${resolved ? '' : 'unresolved'}">
      <span class="vv-status">STATUS &nbsp; ${verification.status}</span>
      <span class="vv-conf">CONFIDENCE <b style="color:${resolved ? 'var(--green)' : 'var(--red)'}">${Math.round(verification.confidence * 100)}%</b></span>
    </div>

    ${verification.testSuggestions && verification.testSuggestions.length ? `
    <div style="margin-top:18px;">
      <div class="diag-section-label">Suggested test cases</div>
      <div class="evidence-block">
        ${verification.testSuggestions.map(t => `<div>\u2022 ${BAI.escapeHtml(t)}</div>`).join('')}
      </div>
    </div>` : ''}

    <div class="row" style="margin-top:18px;">
      <button class="btn ghost" id="verBack">\u2190 Fix</button>
      <button class="btn" id="verHistory">View history \u2192</button>
    </div>
  `;

  $('#verBack').onclick = () => BAI.app.selectChannel('fix');
  $('#verHistory').onclick = () => BAI.app.selectChannel('history');
};
