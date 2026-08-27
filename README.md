# BENCH AI

**Debug like you're on the bench.**
One instrument for understanding what broke, why it broke, and how to fix it.

BENCH AI is an evolution of the original BENCH instrument-panel prototype: same
dark industrial developer-tool identity (amber/teal, IBM Plex, LED-lit channel
rack, grid background), rebuilt around a single coherent workflow instead of
eight unrelated utilities.

---

## Running it

Because the app is split into multiple ES-classic script files, opening
`index.html` directly by double-clicking it will work in most browsers, but
some (depending on local security settings) restrict `fetch`/file access for
pages opened via `file://`. The safest way to run it is a tiny local static
server — no build step, no install:

```bash
cd bench-ai
python3 -m http.server 8000
# then open http://localhost:8000
```

or, if you have Node:

```bash
npx serve bench-ai
```

Then just open the printed local URL. No API key, no backend, no environment
variables required — the app boots straight into the Demo AI Engine.

---

## What was implemented

**All 8 channels, fully working:**

| Channel | What it does |
|---|---|
| **CH01 Capture** | Paste box with live auto-detection, paste-from-clipboard, drag-and-drop / file upload (`.log`, `.txt`, images), and four one-click examples. |
| **CH02 Diagnose** | Runs the Demo AI Engine over the captured input and renders a structured diagnostic card: severity, confidence, root cause, evidence, related signals. |
| **CH03 Root Cause** | Symptom → Trigger → Root Cause → Impact causal chain, plus a 4-box "what/why/contributing factors/impact" breakdown. |
| **CH04 Fix** | Generated fix as a syntax-colored diff (red removed / green added), with Copy and Apply actions. |
| **CH05 Verify** | Before/after, a pass/fail validation checklist, a RESOLVED / NEEDS ATTENTION verdict with confidence, and suggested test cases. |
| **CH06 API** | "API Autopsy" — paste a request/response/cURL/fetch snippet and get status, format, auth/JWT state (decoded, never claimed as verified), CORS signal, likely cause, and a recommended fix. |
| **CH07 Logs** | Paste or upload logs → line/error/warning counts, grouped & deduplicated recurring failures with first/last-seen timestamps, and a coarse error-density timeline. |
| **CH08 History** | Local-only session history (localStorage) — timestamp, detected type, short description, severity, resolved/open status. Click a row to reload that session. |

**Three priority demo flows** (per the brief) are all wired end-to-end:
1. Paste error → Detect → Diagnose → Root Cause → Fix → Verify
2. Paste API response → API Autopsy → JWT/auth detection → explanation → recommended fix
3. Upload/paste logs → grouped analysis → dominant failure → timeline

**Detection engine** (`js/detector.js`): pattern/heuristic classifier for JSON,
JWT, Base64, URL, Unix timestamps, HTTP responses, Java/Python/JS stack
traces, SQL errors, regex literals, logs, and generic source code — returns
`{ type, confidence, signals[] }`, shown live in Capture.

**AIProvider abstraction** (`js/ai-engine.js`): a real interface —
`analyze()`, `diagnose()`, `generateFix()`, `verifyFix()` — currently
implemented by `DemoAIProvider`, a fully deterministic, client-side engine.
Swapping in a real LLM later means writing a new object with the same four
methods and pointing `BAI.ai.provider` at it; every channel already calls
through the abstraction, not a concrete implementation.

**Demo Mode** (▶ button, top right): loads one of four hand-tuned scenarios
(JWT expiry, Java NullPointerException, HTTP 500, a generated multi-hour log
with a dominant recurring DB-timeout failure) and jumps straight to the
channel that shows it off best.

**Keyboard-first UX**: `Cmd/Ctrl+1`–`8` jump between channels, `Cmd/Ctrl+Enter`
analyzes the focused textarea, `?` opens the shortcuts overlay, `Esc` closes
overlays. See the `?` button in the top bar.

**Security**: no `eval()`, no unsanitized `innerHTML` of user content (every
user-provided string is passed through `escapeHtml()` before insertion), and
decoded JWTs are always labeled **DECODED — NOT VERIFIED** — the app never
claims a token is authentic because it only decodes, never checks the
signature.

---

## Mock/Demo AI vs. real AI

**Everything in this build is the Demo AI Engine** — deterministic,
pattern-based, and runs entirely in the browser with no network calls. It is
intentionally *not* faking an external API call (no fabricated latency,
fabricated streaming, etc. beyond a short UI-pacing animation in Diagnose).

The architecture is ready for a real LLM:

```js
// js/ai-engine.js
BAI.ai.provider = DemoAIProvider; // swap this for a real provider

// A real provider just needs the same 4 methods:
const RealAIProvider = {
  async analyze(input) { /* call your LLM, return { detection } */ },
  async diagnose(input) { /* return the same diagnosis shape DemoAIProvider does */ },
  async generateFix(diagnosis) { /* return { language, explanation, diff } */ },
  async verifyFix(diagnosis) { /* return { checks, status, confidence, testSuggestions } */ },
};
```

Every channel calls `BAI.ai.provider.<method>()`, never `DemoAIProvider`
directly, so this swap requires no changes to any channel file. Note: the
current channel code calls these methods synchronously; if a real provider
returns Promises, each `BAI.ai.provider.x(...)` call site would need an
`await` (channels would need to switch to `async` render functions) — this
is the one integration seam to touch.

---

## Project structure

```
bench-ai/
├── index.html
├── css/
│   ├── base.css          reset, design tokens, form controls, buttons
│   ├── instrument.css     rack/panel layout + every new component
│   └── responsive.css     mobile breakpoints
├── js/
│   ├── state.js            shared store + pub/sub + escapeHtml/toast/copy
│   ├── detector.js          smart auto-detection engine
│   ├── ai-engine.js          AIProvider interface + DemoAIProvider
│   ├── history.js            localStorage session history (CH08 backend)
│   ├── demo-data.js           the 4 Demo Mode scenarios
│   ├── tools/
│   │   ├── jwt.js              decode-only JWT helper (never verifies)
│   │   ├── api.js               request/response parsing for CH06
│   │   └── logs.js               log parsing/grouping for CH07
│   ├── channels/
│   │   ├── capture.js  diagnose.js  rootcause.js  fix.js
│   │   ├── verify.js   api.js       logs.js       history.js
│   └── app.js            boot, channel router, landing screen,
│                          keyboard shortcuts, demo mode, help overlay
└── README.md
```

Deviated slightly from the originally sketched structure: `analyzer.js` was
folded into `ai-engine.js` (the diagnosis routing *is* the analyzer), and
`json.js` wasn't broken out separately since JSON diagnosis lives inline in
`ai-engine.js` next to the other type-specific diagnosers — splitting it out
would have meant passing the same context through an extra file for no
real gain.

---

## Best 60–90 second hackathon demo flow

1. **Land on the home screen (5s)** — point out `AI ENGINE READY`, `DETECTOR
   READY`, `LOCAL STORAGE READY`. Say the one-liner: *"One instrument for
   understanding what broke, why it broke, and how to fix it."*
2. **Click ▶ Demo Mode → "NullPointerException (Java)" (30s)** — lands on
   Diagnose. Point at the severity chip, confidence, root cause, and evidence
   block. Click through **Root Cause** (causal chain) → **Fix** (red/green
   diff) → **Verify** (checklist + RESOLVED verdict). This is Flow 1 end to
   end.
3. **Click ▶ Demo Mode → "JWT Authentication Failure" (20s)** — lands on API
   Autopsy. Point at `TOKEN: EXPIRED`, likely cause, and recommended fix.
   This is Flow 2.
4. **Click ▶ Demo Mode → "Large Log" (15s)** — lands on Logs. Point at the
   stat tiles, the dominant failure with occurrence count, and the timeline
   bars. This is Flow 3.
5. **Close with CH08 History (5s)** — show that everything just run is
   sitting there, local-only, reopenable with one click.
