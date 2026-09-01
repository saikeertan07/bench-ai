/* ============================================================
   BAI.tools.api — parses pasted HTTP requests/responses, cURL,
   or fetch/axios snippets into a normalized autopsy record.
   ============================================================ */
window.BAI = window.BAI || {};
BAI.tools = BAI.tools || {};

BAI.tools.api = (function () {

  const STATUS_MEANINGS = {
    400: ['Bad request', 'The request body or parameters are malformed or missing required fields.'],
    401: ['Unauthorized', 'The request has no valid authentication, or the credentials/token supplied were rejected.'],
    403: ['Forbidden', 'Authentication succeeded but the caller lacks permission for this resource.'],
    404: ['Not found', 'The requested resource or endpoint path does not exist.'],
    408: ['Request timeout', 'The server timed out waiting for the request.'],
    409: ['Conflict', 'The request conflicts with the current state of the resource (e.g. duplicate key).'],
    422: ['Unprocessable entity', 'The request was well-formed but failed validation.'],
    429: ['Too many requests', 'The client has been rate-limited.'],
    500: ['Internal server error', 'An unhandled exception occurred on the server while processing the request.'],
    502: ['Bad gateway', 'An upstream/proxy service returned an invalid response.'],
    503: ['Service unavailable', 'The server is temporarily unable to handle the request (overloaded or down for maintenance).'],
    504: ['Gateway timeout', 'An upstream service did not respond in time.'],
  };

  function extractStatus(text) {
    const m = text.match(/\b([1-5]\d{2})\b\s*([A-Za-z][A-Za-z \-]*)?/);
    return m ? { code: Number(m[1]), phrase: (m[2] || '').trim() } : null;
  }

  function extractJson(text) {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }

  function extractHeaders(text) {
    const headers = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z-]+)\s*:\s*(.+?)\s*$/);
      if (m && /^(Authorization|Content-Type|Accept|X-[\w-]+|WWW-Authenticate|Retry-After|Access-Control-[\w-]+)$/i.test(m[1])) {
        headers[m[1]] = m[2];
      }
    }
    return headers;
  }

  function findJwt(text) {
    const m = text.match(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/);
    return m ? m[0] : null;
  }

  function autopsy(text) {
    const status = extractStatus(text);
    const body = extractJson(text);
    const headers = extractHeaders(text);
    const jwtToken = findJwt(text);
    let jwtInfo = null;
    if (jwtToken) jwtInfo = BAI.tools.jwt.decode(jwtToken);

    const isCors = /Access-Control-Allow-Origin|CORS|has been blocked by CORS policy/i.test(text);
    const missingAuthHeader = !headers['Authorization'] && (status?.code === 401 || /unauthorized|invalid_token|no token/i.test(text));

    const meaning = status ? STATUS_MEANINGS[status.code] : null;

    let likelyCause = 'Unable to determine a specific cause from the input alone — more context (request headers, full response body) would help.';
    let recommendedFix = 'Inspect the full request/response pair and compare against the API documentation for this endpoint.';

    if (jwtInfo && jwtInfo.ok && jwtInfo.expired) {
      likelyCause = 'The bearer token attached to this request has expired.';
      recommendedFix = 'Refresh the access token (or re-authenticate) before retrying the request.';
    } else if (status?.code === 401 && missingAuthHeader) {
      likelyCause = 'No Authorization header was present, or the token supplied was rejected by the server.';
      recommendedFix = 'Attach a valid `Authorization: Bearer <token>` header and confirm the token has not expired or been revoked.';
    } else if (status?.code === 403) {
      likelyCause = 'The caller is authenticated but does not have permission to access this resource.';
      recommendedFix = 'Check the account/role scopes required by this endpoint and confirm the caller has been granted them.';
    } else if (status?.code === 429) {
      likelyCause = 'The client has exceeded the API rate limit for this window.';
      recommendedFix = 'Back off and retry with exponential backoff; respect any `Retry-After` header returned.';
    } else if (status?.code >= 500) {
      likelyCause = 'The upstream server failed while handling the request — this is a server-side fault, not a client error.';
      recommendedFix = 'Retry with backoff, and check server-side logs around this timestamp for the originating exception.';
    } else if (isCors) {
      likelyCause = 'The browser blocked the response because the server did not return a permitted `Access-Control-Allow-Origin` header.';
      recommendedFix = 'Add the calling origin to the API\u2019s CORS allow-list, or proxy the request through your own backend.';
    } else if (status?.code === 400 || status?.code === 422) {
      likelyCause = 'The request body failed validation on the server.';
      recommendedFix = 'Compare the request payload against the endpoint schema and fix any missing/invalid fields.';
    }

    return {
      status, meaning, body, headers, jwtToken, jwtInfo, isCors,
      likelyCause, recommendedFix,
      timestamp: new Date(),
    };
  }

  return { autopsy, STATUS_MEANINGS };
})();
