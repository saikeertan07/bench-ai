/* ============================================================
   CH01 — CAPTURE
   Paste/upload anything; runs the detector; hands off to Diagnose.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.channels = BAI.channels || {};

BAI.channels.capture = function (panel) {
  const $ = BAI.$;
  const examples = [
    { label: 'Java NPE', text: BAI.demoData.demos.find(d => d.id === 'npe-java').input },
    { label: 'JWT / 401', text: BAI.demoData.demos.find(d => d.id === 'jwt-auth').input },
    { label: 'HTTP 500', text: BAI.demoData.demos.find(d => d.id === 'http-500').input },
    { label: 'Malformed JSON', text: '{\n  "user": "sam",\n  "roles": ["admin", "editor",]\n}' },
  ];

  panel.innerHTML = BAI.panelHead('CH01', 'Capture', 'captureStatus') + `
    <label class="field-label">Paste an error, stack trace, log, API response, code, or JSON</label>
    <textarea id="capIn" placeholder="Paste anything here\u2026">${BAI.escapeHtml(BAI.state.rawInput)}</textarea>

    <div class="row">
      <button class="btn primary" id="capAnalyze">Analyze \u2192</button>
      <button class="btn" id="capPaste">Paste from clipboard</button>
      <button class="btn ghost" id="capClear">Clear</button>
    </div>

    <div class="dropzone" id="capDrop">
      Drop a .log / .txt / image file here, or click to choose one
      <input type="file" id="capFile" accept=".log,.txt,image/*">
    </div>

    <label class="field-label" style="margin-top:16px;">Try an example</label>
    <div class="example-chips" id="capExamples">
      ${examples.map((e, i) => `<button class="example-chip" data-i="${i}">${BAI.escapeHtml(e.label)}</button>`).join('')}
    </div>

    <div id="capDetectWrap" style="margin-top:6px;"></div>
  `;

  function renderDetection() {
    const wrap = $('#capDetectWrap');
    const raw = $('#capIn').value;
    if (!raw.trim()) { wrap.innerHTML = ''; BAI.setStatus('captureStatus', 'idle', 'idle'); return; }
    const d = BAI.detector.detect(raw);
    const confident = d.confidence >= 0.85;
    wrap.innerHTML = `
      <div class="detect-banner ${confident ? 'confident' : ''}">
        <span class="dtype">${d.label.toUpperCase()} DETECTED</span>
        <span class="dconf">confidence ${Math.round(d.confidence * 100)}%</span>
        <span class="dsignals">${d.signals.map(BAI.escapeHtml).join(' \u00b7 ')}</span>
      </div>`;
    BAI.setStatus('captureStatus', confident ? 'ok' : 'warn', d.label.toLowerCase());
  }

  $('#capIn').addEventListener('input', renderDetection);
  renderDetection();

  $('#capAnalyze').onclick = () => {
    const raw = $('#capIn').value;
    if (!raw.trim()) { BAI.toast('paste something first'); return; }
    BAI.setInput(raw);
    BAI.app.selectChannel('diagnose');
  };

  $('#capPaste').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('#capIn').value = text;
      renderDetection();
    } catch (e) { BAI.toast('clipboard access denied'); }
  };

  $('#capClear').onclick = () => {
    $('#capIn').value = '';
    BAI.setInput('');
    renderDetection();
  };

  $('#capExamples').addEventListener('click', e => {
    const b = e.target.closest('.example-chip');
    if (!b) return;
    $('#capIn').value = examples[Number(b.dataset.i)].text;
    renderDetection();
  });

  // file upload / drag-drop
  const drop = $('#capDrop');
  const fileInput = $('#capFile');
  drop.onclick = () => fileInput.click();
  ['dragover', 'dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, e => {
      e.preventDefault();
      drop.classList.toggle('drag', evt === 'dragover');
    });
  });
  drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        BAI.state.inputMeta = { fileName: file.name, kind: 'image', dataUrl: reader.result };
        $('#capIn').value = `[Screenshot uploaded: ${file.name}]\n\nNote: this prototype's Demo AI Engine reads text input. For a screenshot, describe or paste the visible error text below for a full diagnosis, or use OCR upstream in a production build.`;
        renderDetection();
        BAI.toast('image attached \u2014 add visible error text to analyze it');
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        $('#capIn').value = reader.result;
        renderDetection();
        BAI.toast('file loaded');
      };
      reader.readAsText(file);
    }
  }
};
