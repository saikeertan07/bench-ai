/**
 * Test Suite: Input Format Auto-Detection Engine
 */
const assert = require('assert');

function detectInputType(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const trimmed = text.trim();
  
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return 'jwt';
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch (e) {}
  }
  if (trimmed.startsWith('curl ') || trimmed.includes('HTTP/1.') || trimmed.includes('HTTP/2')) {
    return 'http';
  }
  if (trimmed.includes('Error:') || trimmed.includes('Exception in thread') || trimmed.includes('Traceback (most recent call last):')) {
    return 'stacktrace';
  }
  return 'raw_text';
}

console.log('--- Running BENCH AI Detector Tests ---');

// Test 1: JWT Detection
const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
assert.strictEqual(detectInputType(sampleJwt), 'jwt', 'JWT must be correctly identified');

// Test 2: JSON Log Detection
const sampleJson = '{"level":"error","msg":"database timeout","code":504}';
assert.strictEqual(detectInputType(sampleJson), 'json', 'JSON must be correctly identified');

// Test 3: Stack Trace Detection
const sampleStack = 'Traceback (most recent call last):\n  File "app.py", line 42, in <module>\nValueError: invalid literal';
assert.strictEqual(detectInputType(sampleStack), 'stacktrace', 'Stack trace must be correctly identified');

// Test 4: HTTP Request Detection
const sampleCurl = 'curl -X POST https://api.service.internal/v1/checkout -H "Authorization: Bearer token"';
assert.strictEqual(detectInputType(sampleCurl), 'http', 'cURL request must be correctly identified');

console.log('✓ All 4 detector heuristics passed successfully.');
