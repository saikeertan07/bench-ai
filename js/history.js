/* ============================================================
   BAI.history — local-only session history (CH08).
   No backend: everything lives in localStorage.
   ============================================================ */
window.BAI = window.BAI || {};

BAI.history = (function () {
  const KEY = 'bench_ai_history_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function save(sessions) {
    try { localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 100))); }
    catch (e) { /* storage unavailable — fail silently, history just won't persist */ }
  }

  function add(diagnosis) {
    const sessions = load();
    const status = diagnosis.title && diagnosis.title.toLowerCase().includes('valid') ? 'RESOLVED'
      : (diagnosis.verification?.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN');
    sessions.unshift({
      id: 'sess_' + Date.now().toString(36),
      time: new Date().toISOString(),
      type: diagnosis.detection?.label || diagnosis.type,
      description: diagnosis.problemDetected || diagnosis.title,
      severity: diagnosis.severity,
      status,
      rawInput: BAI.state.rawInput,
    });
    save(sessions);
    return sessions;
  }

  function updateStatus(id, status) {
    const sessions = load();
    const s = sessions.find(x => x.id === id);
    if (s) { s.status = status; save(sessions); }
    return sessions;
  }

  function clear() { save([]); }

  return { load, save, add, updateStatus, clear };
})();
