/* ============================================================
   CH08 — HISTORY
   Local-only debugging session history.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.history = function (panel) {
  const $ = BAI.$;
  const sessions = BAI.history.load();

  panel.innerHTML = BAI.panelHead('CH08', 'History', 'histStatus') + `
    <div class="row" style="margin-top:-4px;">
      <span class="privacy-badge">LOCAL-FIRST \u2014 stored only in this browser</span>
      ${sessions.length ? '<button class="btn ghost small" id="histClear" style="margin-left:auto;">Clear history</button>' : ''}
    </div>
    <div class="history-list" id="histList" style="margin-top:12px;"></div>
  `;
  BAI.setStatus('histStatus', 'ok', `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`);

  const list = $('#histList');
  if (!sessions.length) {
    list.innerHTML = `<div class="empty-state">No debugging sessions yet.<br>Run something through Capture \u2192 Diagnose to see it here.</div>`;
  } else {
    list.innerHTML = sessions.map(s => `
      <div class="history-row" data-id="${s.id}">
        <span class="history-time">${new Date(s.time).toTimeString().slice(0, 5)}</span>
        <span class="history-type">${BAI.escapeHtml(s.type)}</span>
        <span class="history-desc">${BAI.escapeHtml(s.description)}</span>
        <span class="history-status ${s.status === 'RESOLVED' ? 'resolved' : 'open'}">${s.status}</span>
      </div>
    `).join('');
  }

  list.addEventListener('click', e => {
    const row = e.target.closest('.history-row');
    if (!row) return;
    const s = sessions.find(x => x.id === row.dataset.id);
    if (!s) return;
    BAI.setInput(s.rawInput || '');
    BAI.app.selectChannel('diagnose');
  });

  const clearBtn = $('#histClear');
  if (clearBtn) clearBtn.onclick = () => {
    BAI.history.clear();
    BAI.app.selectChannel('history');
    BAI.toast('history cleared');
  };
};
