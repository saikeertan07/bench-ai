/* ============================================================
   CH04 — FIX
   Shows the generated fix as a code-editor-style diff.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.fix = function (panel) {
  const $ = BAI.$;

  if (!BAI.state.rawInput.trim()) {
    panel.innerHTML = BAI.panelHead('CH04', 'Fix', 'fixStatus') + BAI.emptyCaptureNotice();
    BAI.setStatus('fixStatus', 'idle', 'idle');
    return;
  }

  const diag = BAI.ensureDiagnosis();
  const fix = BAI.ai.provider.generateFix(diag);
  BAI.setStatus('fixStatus', fix.diff && fix.diff.length ? 'ok' : 'idle', fix.diff && fix.diff.length ? 'fix ready' : 'no fix needed');

  const hasDiff = fix.diff && fix.diff.length > 0;

  panel.innerHTML = BAI.panelHead('CH04', 'Fix', 'fixStatus') + `
    <div class="diag-section-label">Explanation</div>
    <div class="diag-text" style="margin-bottom:16px;">${BAI.escapeHtml(fix.explanation)}</div>

    ${hasDiff ? `
    <div class="diag-section-label">Suggested change</div>
    <div class="code-block">
      <div class="code-block-head">
        <span>${BAI.escapeHtml(fix.language || 'diff')}</span>
        <span>SHOW DIFF</span>
      </div>
      <pre>${fix.diff.map(l => {
        const cls = l.type === 'rem' ? 'rem' : (l.type === 'add' ? 'add' : 'ctx');
        const marker = l.type === 'rem' ? '-' : (l.type === 'add' ? '+' : '\u00b7');
        return `<span class="diff-line ${cls}"><span class="diff-marker">${marker}</span>${BAI.escapeHtml(l.text)}</span>`;
      }).join('\n')}</pre>
    </div>
    <div class="row">
      <button class="btn primary" id="fixCopy">Copy fix</button>
      <button class="btn" id="fixApply">Apply fix</button>
      <button class="btn ghost" id="fixNext">Verify \u2192</button>
    </div>
    ` : `
    <div class="hint">No structural fix to generate for this input type.</div>
    <div class="row"><button class="btn ghost" id="fixNext">Verify \u2192</button></div>
    `}
  `;

  if ($('#fixCopy')) {
    $('#fixCopy').onclick = () => {
      const code = fix.diff.filter(l => l.type !== 'rem').map(l => l.text).join('\n');
      BAI.copyText(code);
    };
  }
  if ($('#fixApply')) {
    $('#fixApply').onclick = () => {
      BAI.state.fixApplied = true;
      BAI.toast('fix applied (local session only)');
      $('#fixApply').textContent = 'Applied \u2713';
      $('#fixApply').disabled = true;
    };
  }
  $('#fixNext').onclick = () => BAI.app.selectChannel('verify');
};
