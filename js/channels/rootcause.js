/* ============================================================
   CH03 — ROOT CAUSE
   Structured causal chain: Symptom -> Trigger -> Root Cause -> Impact
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.rootcause = function (panel) {
  const $ = BAI.$;

  if (!BAI.state.rawInput.trim()) {
    panel.innerHTML = BAI.panelHead('CH03', 'Root Cause', 'rcStatus') + BAI.emptyCaptureNotice();
    BAI.setStatus('rcStatus', 'idle', 'idle');
    return;
  }

  const diag = BAI.ensureDiagnosis();
  BAI.setStatus('rcStatus', 'ok', 'analyzed');

  const chain = diag.causalChain && diag.causalChain.length ? diag.causalChain : [
    { label: 'Symptom', value: diag.problemDetected },
    { label: 'Root cause', value: diag.rootCause, root: true },
  ];

  panel.innerHTML = BAI.panelHead('CH03', 'Root Cause', 'rcStatus') + `
    <div class="chain">
      ${chain.map((node, i) => `
        ${i > 0 ? '<div class="chain-arrow">\u2193</div>' : ''}
        <div class="chain-node${node.root ? ' root' : ''}">
          <div class="ck">${BAI.escapeHtml(node.label)}</div>
          <div class="cv">${BAI.escapeHtml(node.value)}</div>
        </div>
      `).join('')}
    </div>

    <div class="rc-grid">
      <div class="rc-box">
        <h4>What happened</h4>
        <p>${BAI.escapeHtml(diag.problemDetected)}</p>
      </div>
      <div class="rc-box">
        <h4>Why it happened</h4>
        <p>${BAI.escapeHtml(diag.rootCause)}</p>
      </div>
      <div class="rc-box">
        <h4>Contributing factors</h4>
        ${diag.contributingFactors && diag.contributingFactors.length
          ? `<ul>${diag.contributingFactors.map(f => `<li>${BAI.escapeHtml(f)}</li>`).join('')}</ul>`
          : `<p style="color:var(--text-faint)">None identified</p>`}
      </div>
      <div class="rc-box">
        <h4>Impact</h4>
        <p>${BAI.escapeHtml(diag.impact)}</p>
      </div>
    </div>

    <div class="row">
      <button class="btn primary" id="rcNext">Fix \u2192</button>
      <button class="btn ghost" id="rcBack">\u2190 Diagnose</button>
    </div>
  `;

  $('#rcNext').onclick = () => BAI.app.selectChannel('fix');
  $('#rcBack').onclick = () => BAI.app.selectChannel('diagnose');
};
