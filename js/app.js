/* ============================================================
   BAI.app — boot sequence, channel router, landing state,
   keyboard shortcuts, demo mode, help overlay.
   ============================================================ */
window.BAI = window.BAI || {};

BAI.CHANNELS = [
  { id: 'capture',   code: 'CH01', name: 'Capture' },
  { id: 'diagnose',  code: 'CH02', name: 'Diagnose' },
  { id: 'rootcause', code: 'CH03', name: 'Root Cause' },
  { id: 'fix',       code: 'CH04', name: 'Fix' },
  { id: 'verify',    code: 'CH05', name: 'Verify' },
  { id: 'api',       code: 'CH06', name: 'API' },
  { id: 'logs',      code: 'CH07', name: 'Logs' },
  { id: 'history',   code: 'CH08', name: 'History' },
];

/* ---------- shared render helpers used by every channel ---------- */
BAI.panelHead = function (tag, title, statusId) {
  return `
    <div class="panel-head">
      <div class="panel-title-wrap">
        <div class="panel-title">${title}</div>
        <div class="panel-tag">${tag}</div>
      </div>
      <div class="status idle" id="${statusId}"><span class="dot"></span><span class="label">idle</span></div>
    </div>`;
};

BAI.setStatus = function (elId, state, label) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = 'status ' + state;
  el.querySelector('.label').textContent = label;
};

BAI.emptyCaptureNotice = function () {
  return `
    <div class="empty-state">
      No input loaded yet.<br>
      Go to <b style="color:var(--accent)">CH01 Capture</b> and paste an error, log, or API response first.
    </div>
    <div class="row" style="justify-content:center;">
      <button class="btn primary" onclick="BAI.app.selectChannel('capture')">Go to Capture</button>
    </div>`;
};

/* Computes (and caches) the diagnosis for the current input so
   CH02\u2013CH05 all read the same analysis. */
BAI.ensureDiagnosis = function () {
  if (!BAI.state.diagnosis) {
    BAI.state.diagnosis = BAI.ai.provider.diagnose(BAI.state.rawInput);
  }
  return BAI.state.diagnosis;
};

BAI._historyRecorded = false;
BAI.recordHistoryOnce = function () {
  if (BAI._historyRecorded) return;
  const diag = BAI.state.diagnosis;
  if (!diag) return;
  diag.verification = diag.verification || BAI.ai.provider.verifyFix(diag);
  BAI.history.add(diag);
  BAI._historyRecorded = true;
};

/* ---------- rack / navigation ---------- */
BAI.app = (function () {
  let active = null;

  function badgeFor(id) {
    if (id === 'diagnose' && BAI.state.diagnosis && (BAI.state.diagnosis.severity === 'CRITICAL' || BAI.state.diagnosis.severity === 'HIGH')) return '!';
    return null;
  }

  function buildRack() {
    const rack = BAI.$('#rack');
    const rackMobile = BAI.$('#rackMobile');
    rack.innerHTML = '<div class="rack-label">Channels</div>';
    rackMobile.innerHTML = '';

    BAI.CHANNELS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'channel' + (c.id === active ? ' active' : '');
      b.dataset.id = c.id;
      const badge = badgeFor(c.id);
      b.innerHTML = `<span class="channel-id">${c.code}</span><span class="channel-led"></span><span>${c.name}</span>${badge ? `<span class="channel-badge">${badge}</span>` : ''}`;
      b.onclick = () => selectChannel(c.id);
      rack.appendChild(b);

      const chip = document.createElement('button');
      chip.className = 'chip' + (c.id === active ? ' active' : '');
      chip.innerHTML = `<span class="chip-led"></span>${c.code}`;
      chip.title = c.name;
      chip.onclick = () => selectChannel(c.id);
      rackMobile.appendChild(chip);
    });

    const footer = document.createElement('div');
    footer.className = 'rack-footer';
    footer.innerHTML = `<div class="rack-sys">
      AI ENGINE &nbsp;<span class="ok">DEMO</span><br>
      DETECTOR &nbsp;&nbsp;<span class="ok">READY</span><br>
      STORAGE &nbsp;&nbsp;&nbsp;<span class="ok">LOCAL</span>
    </div>`;
    rack.appendChild(footer);
  }

  function selectChannel(id) {
    active = id;
    BAI.state.view = id;
    BAI.$$('.channel').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    BAI.$$('.chip').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    const panel = BAI.$('#panel');
    panel.innerHTML = '';
    BAI.channels[id](panel);
    buildRack(); // refresh badges
  }

  function showLanding() {
    active = null;
    BAI.state.view = 'landing';
    BAI.$$('.channel').forEach(b => b.classList.remove('active'));
    BAI.$$('.chip').forEach(b => b.classList.remove('active'));
    const panel = BAI.$('#panel');
    panel.innerHTML = `
      <div class="landing">
        <div class="landing-mark">BENCH<span>&nbsp;AI</span></div>
        <div class="landing-tag">Intelligent developer debugging workstation</div>
        <div class="landing-tagline">Debug like you're on the bench.<br>One instrument for understanding what broke, why it broke, and how to fix it.</div>

        <div class="landing-input">
          <label class="field-label">Paste error / log / API response</label>
          <textarea id="landIn" placeholder="Paste anything here\u2026"></textarea>
          <div class="landing-actions">
            <button class="btn primary" id="landAnalyze">Analyze</button>
            <button class="btn" id="landUpload">Upload screenshot</button>
            <button class="btn" id="landDemo">Load demo</button>
          </div>
        </div>

        <div class="landing-sys">
          <span class="sys-item"><span class="dot"></span>AI ENGINE &nbsp;READY (DEMO)</span>
          <span class="sys-item"><span class="dot"></span>DETECTOR &nbsp;READY</span>
          <span class="sys-item"><span class="dot"></span>LOCAL STORAGE &nbsp;READY</span>
        </div>
        <div class="row" style="justify-content:center; margin-top:14px;">
          <span class="privacy-badge">LOCAL-FIRST \u2014 press ? for shortcuts</span>
        </div>
      </div>
      <input type="file" id="landFile" accept="image/*" style="display:none">
    `;
    BAI.$('#landAnalyze').onclick = () => {
      const text = BAI.$('#landIn').value;
      if (!text.trim()) { BAI.toast('paste something first'); return; }
      BAI.setInput(text);
      selectChannel('diagnose');
    };
    BAI.$('#landUpload').onclick = () => BAI.$('#landFile').click();
    BAI.$('#landFile').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      BAI.toast('image attached \u2014 add visible error text on the next screen');
      selectChannel('capture');
    });
    BAI.$('#landDemo').onclick = () => BAI.demoMode.open();
  }

  return { selectChannel, showLanding, buildRack };
})();

/* ---------- clock ---------- */
function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleTimeString('en-US', { hour12: false }) + '  UTC' +
    (d.getTimezoneOffset() <= 0 ? '+' : '-') + String(Math.abs(d.getTimezoneOffset() / 60)).padStart(2, '0');
}

/* ---------- demo mode ---------- */
BAI.demoMode = (function () {
  function open() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
      <div class="overlay-card">
        <h3>Demo Mode</h3>
        <div class="sub">Pick a scenario \u2014 loads real input and jumps to the right channel</div>
        <div class="demo-grid">
          ${BAI.demoData.demos.map(d => `
            <button class="demo-opt" data-id="${d.id}">
              <div class="do-title">${BAI.escapeHtml(d.title)}</div>
              <div class="do-desc">${BAI.escapeHtml(d.desc)}</div>
            </button>
          `).join('')}
        </div>
        <button class="btn ghost overlay-close" id="demoClose">Close</button>
      </div>`;
    overlay.style.display = 'flex';
    overlay.querySelectorAll('.demo-opt').forEach(b => {
      b.onclick = () => {
        const demo = BAI.demoData.demos.find(d => d.id === b.dataset.id);
        BAI.state.activeDemo = demo.id;
        BAI.setInput(demo.input);
        close();
        BAI.app.selectChannel(demo.channel);
      };
    });
    document.getElementById('demoClose').onclick = close;
  }
  function close() {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
  return { open, close };
})();

/* ---------- help / shortcuts overlay ---------- */
BAI.helpOverlay = (function () {
  const shortcuts = [
    ['Cmd/Ctrl + 1\u20138', 'Jump to channel CH01\u2013CH08'],
    ['Cmd/Ctrl + Enter', 'Analyze current input'],
    ['Esc', 'Close overlay'],
    ['?', 'Toggle this help'],
  ];
  function open() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
      <div class="overlay-card">
        <h3>Keyboard shortcuts</h3>
        <div class="sub">BENCH AI is keyboard-first</div>
        ${shortcuts.map(([k, d]) => `<div class="kbd-row"><span>${d}</span><kbd>${k}</kbd></div>`).join('')}
        <button class="btn ghost overlay-close" id="helpClose">Close</button>
      </div>`;
    overlay.style.display = 'flex';
    document.getElementById('helpClose').onclick = close;
  }
  function close() {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
  return { open, close, toggle: () => document.getElementById('overlay').style.display === 'flex' ? close() : open() };
})();

/* ---------- keyboard shortcuts ---------- */
document.addEventListener('keydown', e => {
  const overlayOpen = document.getElementById('overlay').style.display === 'flex';
  if (e.key === 'Escape') { BAI.demoMode.close(); BAI.helpOverlay.close(); return; }

  const typing = ['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName);

  if ((e.metaKey || e.ctrlKey) && /^[1-8]$/.test(e.key)) {
    e.preventDefault();
    BAI.app.selectChannel(BAI.CHANNELS[Number(e.key) - 1].id);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    const ta = document.activeElement;
    if (ta && ta.tagName === 'TEXTAREA' && ta.value.trim()) {
      BAI.setInput(ta.value);
      BAI.app.selectChannel('diagnose');
    }
    return;
  }
  if (e.key === '?' && !typing) {
    e.preventDefault();
    BAI.helpOverlay.toggle();
  }
});

/* ---------- boot ---------- */
function boot() {
  setInterval(tickClock, 1000); tickClock();
  document.getElementById('brand').onclick = () => BAI.app.showLanding();
  document.getElementById('helpBtn').onclick = () => BAI.helpOverlay.open();
  document.getElementById('demoBtn').onclick = () => BAI.demoMode.open();
  BAI.app.buildRack();
  BAI.app.showLanding();
  BAI.state.booted = true;
}
boot();
