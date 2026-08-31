/* ============================================================
   BAI.demoData — canned inputs for the DEMO MODE overlay.
   These are the inputs Demo AI Engine has hand-tuned, deterministic
   analyses for, so the flow looks great with zero setup.
   ============================================================ */
window.BAI = window.BAI || {};

BAI.demoData = {
  demos: [
    {
      id: 'jwt-auth',
      title: 'JWT Authentication Failure',
      desc: 'A 401 response with an expired bearer token \u2014 shows CH02 Diagnose \u2192 CH06 API Autopsy.',
      channel: 'api',
      input:
`POST /api/v1/orders HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfODgxIiwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNzU2MTIxODM0LCJleHAiOjE3NTYxMjU0MzR9.5f2m9c6k1a3q8w0e7r4t2y9u6i1o3p5s

HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "invalid_token",
  "message": "The access token expired"
}`
    },
    {
      id: 'npe-java',
      title: 'NullPointerException (Java)',
      desc: 'A realistic backend stack trace \u2014 shows CH02 Diagnose \u2192 CH03 Root Cause \u2192 CH04 Fix \u2192 CH05 Verify.',
      channel: 'diagnose',
      input:
`java.lang.NullPointerException: Cannot invoke "String.trim()" because the return value of "com.bench.model.User.getProfile()" is null
	at com.bench.service.OrderService.createOrder(OrderService.java:42)
	at com.bench.controller.OrderController.postOrder(OrderController.java:27)
	at com.bench.controller.OrderController$$FastClassBySpringCGLIB$$1a2b3c4d.invoke(<generated>)
	at org.springframework.web.method.support.InvocableHandlerMethod.invoke(InvocableHandlerMethod.java:205)`
    },
    {
      id: 'http-500',
      title: 'API Failure (HTTP 500)',
      desc: 'A backend 500 response \u2014 shows CH06 API Autopsy and root cause reasoning.',
      channel: 'api',
      input:
`GET /api/v1/inventory/sync HTTP/1.1
Accept: application/json

HTTP/1.1 500 Internal Server Error
Content-Type: application/json
X-Request-Id: req_7f19ac

{
  "error": "internal_error",
  "message": "connection to inventory-db timed out after 30000ms"
}`
    },
    {
      id: 'large-log',
      title: 'Large Log \u2014 Repeated DB Timeouts',
      desc: 'A generated multi-hour log with dominant failure grouping \u2014 shows CH07 Logs.',
      channel: 'logs',
      input: (function generateLog() {
        const lines = [];
        const start = new Date();
        start.setHours(10, 40, 0, 0);
        let t = new Date(start);
        function stamp(d) { return d.toTimeString().slice(0, 8); }
        function push(sec, text) { t = new Date(t.getTime() + sec * 1000); lines.push(`${stamp(t)} ${text}`); }

        push(2, 'INFO  OrderService: order req_1188 accepted');
        push(1, 'INFO  PaymentService: charge succeeded for order req_1188');
        for (let i = 0; i < 14; i++) {
          push(30 + Math.floor(Math.random() * 40), `ERROR InventoryClient: Database connection timeout after 30000ms (conn_pool=8/8, host=inventory-db-primary)`);
          if (i % 3 === 0) push(2, 'WARN  InventoryClient: retrying request, attempt ' + (i + 1));
          if (i % 4 === 0) push(5, 'INFO  HealthCheck: /healthz 200 OK');
        }
        push(4, 'ERROR AuthService: JWT signature verification failed for token prefix eyJhbGciOi');
        push(3, 'INFO  OrderService: order req_1204 accepted');
        push(2, 'ERROR InventoryClient: Database connection timeout after 30000ms (conn_pool=8/8, host=inventory-db-primary)');
        push(1, 'WARN  RateLimiter: client 10.0.4.12 approaching quota (91/100)');
        push(3, 'ERROR InventoryClient: Database connection timeout after 30000ms (conn_pool=8/8, host=inventory-db-primary)');
        push(2, 'INFO  PaymentService: charge succeeded for order req_1204');
        push(6, 'ERROR InventoryClient: Database connection timeout after 30000ms (conn_pool=8/8, host=inventory-db-primary)');
        return lines.join('\n');
      })()
    }
  ]
};
