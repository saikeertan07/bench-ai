/**
 * Test Suite: AI Diagnostic Confidence & Severity Scoring
 */
const assert = require('assert');

function calculateDiagnosticConfidence(signalCount, hasStackTrace, hasLogContext) {
  let score = 0.5;
  if (signalCount > 0) score += Math.min(signalCount * 0.1, 0.3);
  if (hasStackTrace) score += 0.15;
  if (hasLogContext) score += 0.05;
  return Math.min(score, 1.0);
}

console.log('--- Running BENCH AI Engine Tests ---');

const conf1 = calculateDiagnosticConfidence(2, true, true);
assert.strictEqual(conf1 >= 0.85, true, 'High-signal input should produce >= 85% confidence');

const conf2 = calculateDiagnosticConfidence(0, false, false);
assert.strictEqual(conf2, 0.5, 'Zero-signal input should default to baseline 50% confidence');

console.log('✓ Diagnostic confidence algorithms passed successfully.');
