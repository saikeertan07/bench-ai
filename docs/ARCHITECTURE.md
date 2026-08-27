# BENCH AI — Architecture & Systems Specification

## Industrial Instrument Design
BENCH AI models software debugging on physical test bench equipment (oscilloscopes, logic analyzers, spectrum monitors).

### 8-Channel Industrial Rack
1. **CH01 Capture**: Ingest layer with real-time heuristic type detection (stack traces, JSON structured logs, JWT tokens, cURL requests, SQL queries).
2. **CH02 Diagnose**: Diagnostic inference engine generating severity rating (CRITICAL, WARN, INFO), confidence metrics, and evidence pointers.
3. **CH03 Root Cause**: Deep causal path analysis tracing upstream dependencies and trigger conditions.
4. **CH04 Fix**: Immediate patch generation, code diffs, configuration updates, and remediation shell commands.
5. **CH05 Verify**: Post-fix validation test cases, invariant checks, and regression prevention assertions.
6. **CH06 API Inspector**: Structured HTTP request/response dissection, header validation, and payload decomposition.
7. **CH07 Log Stream**: High-throughput log viewer with regex filtering, loglevel grouping, and timestamp alignment.
8. **CH08 History**: Session playback, persistent state inspection, and incident export.

### Technical Principles
- Zero external backend dependencies for base diagnostics.
- Centralized reactive state store (`js/state.js`) decoupling channels from UI rendering.
- Deterministic demo reasoning engine (`js/ai-engine.js`) simulating multi-model analysis.
