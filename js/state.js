/* ============================================================
   BAI.state — single shared store for the whole workstation.
   Classic scripts (no bundler) so everything hangs off window.BAI.
   ============================================================ */
window.BAI = window.BAI || {};

BAI.state = {
  booted: false,
  rawInput: '',
  inputMeta: null,      // { fileName, kind: 'text'|'image' } when loaded from upload
  detection: null,      // { type, label, confidence, signals[] }
  diagnosis: null,      // full AI diagnosis object, see ai-engine.js
  activeDemo: null,      // id of loaded demo scenario, if any
  view: 'landing',       // 'landing' | channel id
};

/* ---------- tiny helpers shared across modules ---------- */
BAI.$  = (sel, el = document) => el.querySelector(sel);
BAI.$$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

BAI.escapeHtml = function (s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
};

BAI.toast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(BAI.toast._h);
  BAI.toast._h = setTimeout(() => t.classList.remove('show'), 1300);
};

BAI.copyText = function (str) {
  navigator.clipboard?.writeText(str).then(() => BAI.toast('copied to clipboard'))
    .catch(() => BAI.toast('copy failed'));
};

/* ---------- pub/sub so channels can react when state changes ---------- */
BAI._listeners = {};
BAI.on = function (evt, fn) {
  (BAI._listeners[evt] = BAI._listeners[evt] || []).push(fn);
};
BAI.emit = function (evt, payload) {
  (BAI._listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
};

/* ---------- set current input, resets downstream analysis ---------- */
BAI.setInput = function (text, meta) {
  BAI.state.rawInput = text || '';
  BAI.state.inputMeta = meta || null;
  BAI.state.detection = null;
  BAI.state.diagnosis = null;
  BAI.state.fixApplied = false;
  BAI._historyRecorded = false;
  BAI.emit('input-changed');
};
