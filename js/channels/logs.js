/* ============================================================
   CH07 — LOGS
   Paste or upload logs -> grouped, deduplicated failure analysis.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.logs = function (panel) {
  const $ = BAI.$;

  panel.innerHTML = BAI.panelHead('CH07', 'Log Analysis', 'logStatus') + `
    <label class="field-label">Paste logs, or upload a .log / .txt file</label>
    <textarea id="logIn" placeholder="10:42:13 ERROR ...">${BAI.escapeHtml(BAI.state.rawInput)}</textarea>
    <div class="row">
      <button class="btn primary" id="logRun">Analyze</button>
      <button class="btn" id="logFileBtn">Upload file</button>
      <button class="btn ghost" id="logClear">Clear</button>
      <input type="file" id="logFile" accept=".log,.txt" style="display:none">
    </div>
    <div id="logOut"></div>
  `;

  function run() {
    const raw = $('#logIn').value;
    if (!raw.trim()) { $('#logOut').innerHTML = ''; BAI.setStatus('logStatus', 'idle', 'idle'); return; }
    BAI.setInput(raw);
    const s = BAI.tools.logs.analyze(raw);
    BAI.setStatus('logStatus', s.errors > 0 ? 'err' : 'ok', `${s.errors} errors`);

    const maxWeight = Math.max(1, ...s.timeline.map(t => t.weight));

    $('#logOut').innerHTML = `
      <div class="log-stats">
        <div class="log-stat"><div class="lv">${s.linesAnalyzed.toLocaleString()}</div><div class="lk">Lines analyzed</div></div>
        <div class="log-stat err"><div class="lv">${s.errors.toLocaleString()}</div><div class="lk">Errors</div></div>
        <div class="log-stat warn"><div class="lv">${s.warnings.toLocaleString()}</div><div class="lk">Warnings</div></div>
        <div class="log-stat"><div class="lv">${s.uniqueFailures}</div><div class="lk">Unique failures</div></div>
      </div>

      ${s.topFailure ? `
      <div class="diag-section-label">Top failure</div>
      <div class="diag-text" style="margin-bottom:6px;">${BAI.escapeHtml(s.topFailure.message)}</div>
      <div class="hint" style="margin-bottom:16px;">
        Occurrences: <b style="color:var(--red)">${s.topFailure.count}</b>
        &nbsp;\u00b7&nbsp; First seen ${BAI.escapeHtml(s.topFailure.first || 'n/a')}
        &nbsp;\u00b7&nbsp; Last seen ${BAI.escapeHtml(s.topFailure.last || 'n/a')}
      </div>` : ''}

      ${s.timeline.length > 1 ? `
      <div class="diag-section-label">Timeline (error density)</div>
      <div class="timeline">
        ${s.timeline.map(t => `<div class="tbar ${t.weight / maxWeight > 0.6 ? 'hot' : ''}" style="height:${Math.max(6, t.weight / maxWeight * 100)}%" title="${BAI.escapeHtml(t.bucket)}"></div>`).join('')}
      </div>` : ''}

      <div class="diag-section-label">Grouped failures</div>
      ${s.failures.length ? s.failures.slice(0, 12).map(f => `
        <div class="failure-row">
          <div class="fr-bar" style="background:${f.level === 'error' ? 'var(--red)' : 'var(--accent)'}"></div>
          <div class="fr-body">
            <div class="fr-msg">${BAI.escapeHtml(f.message)}</div>
            <div class="fr-meta">first ${BAI.escapeHtml(f.first || 'n/a')} \u00b7 last ${BAI.escapeHtml(f.last || 'n/a')}</div>
          </div>
          <div class="fr-count">${f.count}\u00d7</div>
        </div>
      `).join('') : '<div class="hint">No errors or warnings detected in this log.</div>'}

      <div class="row" style="margin-top:8px;">
        <button class="btn primary" id="logDiagnose">Full Diagnose \u2192</button>
      </div>
    `;
    const btn = $('#logDiagnose');
    if (btn) btn.onclick = () => BAI.app.selectChannel('diagnose');
  }

  $('#logRun').onclick = run;
  $('#logClear').onclick = () => { $('#logIn').value = ''; BAI.setInput(''); run(); };
  $('#logFileBtn').onclick = () => $('#logFile').click();
  $('#logFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('#logIn').value = reader.result; run(); };
    reader.readAsText(file);
  });

  if (BAI.state.rawInput.trim()) run();
};
