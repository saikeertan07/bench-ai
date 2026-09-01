/* ============================================================
   BAI.tools.jwt — decode-only helpers.
   IMPORTANT: this never verifies a signature. Every consumer of
   this module must present results as "DECODED — NOT VERIFIED".
   ============================================================ */
window.BAI = window.BAI || {};
BAI.tools = BAI.tools || {};

BAI.tools.jwt = (function () {

  function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Returns { ok, header, payload, expired, expDate, error }
  function decode(token) {
    const parts = (token || '').trim().split('.');
    if (parts.length < 2) {
      return { ok: false, error: 'not a valid JWT (expected 3 dot-separated segments)' };
    }
    try {
      const header = JSON.parse(b64urlDecode(parts[0]));
      const payload = JSON.parse(b64urlDecode(parts[1]));
      let expired = null, expDate = null;
      if (payload.exp) {
        expDate = new Date(payload.exp * 1000);
        expired = expDate.getTime() < Date.now();
      }
      return { ok: true, header, payload, expired, expDate, signature: parts[2] || '' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { decode };
})();
