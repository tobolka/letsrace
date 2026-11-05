/**
 * The address the normal database client expects, in front of the local PostgREST.
 * Production code calls /rest/v1/... and stays unchanged. Only this computer can connect.
 */
const http = require('node:http');

const port = Number(process.env.LOCAL_API_PORT ?? 54331);
const upstream = Number(process.env.LOCAL_POSTGREST_PORT ?? 54330);

http.createServer((request, response) => {
  if (!request.url?.startsWith('/rest/v1')) {
    response.writeHead(404).end();
    return;
  }
  const forward = http.request({
    host: '127.0.0.1', port: upstream, method: request.method,
    path: request.url.slice('/rest/v1'.length) || '/', headers: request.headers,
  }, answer => {
    response.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(response);
  });
  forward.on('error', error => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: `Local PostgREST: ${error.message}` }));
  });
  request.pipe(forward);
}).listen(port, '127.0.0.1');
