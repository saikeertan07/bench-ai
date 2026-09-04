/* ============================================================
   CH02 — DIAGNOSE
   Runs the Demo AI Engine over the captured input and renders
   an engineering-diagnostic readout (not a chat reply).
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.diagnose = function (panel) {
  const $ = BAI.$;

  if (!BAI.state.rawInput.trim()) {
    panel.innerHTML = BAI.panelHead('CH02', 'Diagnose', 'diagStatus') + BAI.emptyCaptureNotice();
    BAI.setStatus('diagStatus', 'idle', 'idle');
    return;
  }

  panel.innerHTML = BAI.panelHead('CH02', 'Diagnose', 'diagStatus') + `
    <div class="scan-veil" id="diagScan"><span class="spinner"></span><span class="sv-label">running Demo AI Engine\u2026</span></div>
    <div id="diagResult"></div>
  `;
  BAI.setStatus('diagStatus', 'busy', 'analyzing');

  // Small artificial delay so the scan animation reads as "work happening" \u2014
  // this is a UI pace, not a fake network call (see AIProvider abstraction).
  setTimeout(() => {
    // Guard: the user may have navigated to another channel before this fires.
    if (BAI.state.view !== 'diagnose') return;
    const diag = BAI.ensureDiagnosis();
    $('#diagScan')?.remove();
    const result = $('#diagResult');
    if (!result) return;
    result.innerHTML = renderDiagCard(diag);
    BAI.setStatus('diagStatus', diag.severity === 'CRITICAL' || diag.severity === 'HIGH' ? 'err' : 'ok', diag.severity.toLowerCase());
  }, 500);

  function renderDiagCard(diag) {
    const sevClass = 'sev-' + diag.severity.toLowerCase();
    return `
      <div class="diag-card">
        <div class="diag-card-head">
          <span class="sev-chip ${sevClass}">${diag.severity}</span>
          <span class="diag-title">${BAI.escapeHtml(diag.title)}</span>
          <span class="diag-conf">CONFIDENCE <b>${Math.round(diag.confidence * 100)}%</b></span>
        </div>
        <div class="diag-body">
          <div>
            <div class="diag-section-label">Problem detected</div>
            <div class="diag-text">${BAI.escapeHtml(diag.problemDetected)}</div>
          </div>
          <div>
            <div class="diag-section-label">Root cause</div>
            <div class="diag-text">${BAI.escapeHtml(diag.rootCause)}</div>
          </div>
          <div>
            <div class="diag-section-label">Evidence</div>
            <div class="evidence-block">
              ${diag.evidence.map(e => `<div><span style="color:var(--text-faint)">${BAI.escapeHtml(e.label)}:</span> <span class="evidence-line">${BAI.escapeHtml(e.value)}</span></div>`).join('')}
            </div>
          </div>
          ${diag.contributingFactors && diag.contributingFactors.length ? `
          <div>
            <div class="diag-section-label">Related signals</div>
            <div class="signal-list">
              ${diag.contributingFactors.map(f => `<span class="signal-chip">${BAI.escapeHtml(f)}</span>`).join('')}
            </div>
          </div>` : ''}
          <div class="row" style="margin-top:2px;">
            <button class="btn primary" id="diagNext">Root Cause \u2192</button>
            <button class="btn" id="diagFixNow">Skip to Fix</button>
          </div>
        </div>
      </div>
    `;
  }

  panel.addEventListener('click', e => {
    if (e.target.id === 'diagNext') BAI.app.selectChannel('rootcause');
    if (e.target.id === 'diagFixNow') BAI.app.selectChannel('fix');
  });
};
