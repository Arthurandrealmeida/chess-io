import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './src/rooms.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gz': 'application/gzip',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
const SAFE_ROOTS = new Set(['src', 'styles', 'data', 'assets', 'vendor']);
const SAFE_FILES = new Set(['index.html', 'estiloXadrez.css', 'CREDITS.md', 'LICENSE']);
export function createChessServer({ lan = false, maxClients = 100 } = {}) {
  const rooms = new RoomManager();
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end('Método não permitido');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/api/info') {
        const address = server.address(),
          port = typeof address === 'object' ? address.port : 3000;
        const lanUrls = lan
          ? Object.values(networkInterfaces())
              .flat()
              .filter((net) => net && net.family === 'IPv4' && !net.internal)
              .map((net) => `http://${net.address}:${port}`)
          : [];
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ lan, lanUrls }));
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!SAFE_FILES.has(relative) && !SAFE_ROOTS.has(relative.split('/')[0])) {
        response.writeHead(404);
        response.end('Não encontrado');
        return;
      }
      const filename = path.resolve(ROOT, relative);
      if (
        !filename.startsWith(ROOT + path.sep) ||
        relative.split('/').some((part) => part.startsWith('.'))
      ) {
        response.writeHead(404);
        response.end('Não encontrado');
        return;
      }
      const info = await stat(filename);
      if (!info.isFile()) {
        response.writeHead(404);
        response.end('Não encontrado');
        return;
      }
      response.setHeader(
        'Content-Type',
        MIME[path.extname(filename)] || 'application/octet-stream',
      );
      response.setHeader('Content-Length', info.size);
      response.setHeader(
        'Cache-Control',
        filename.endsWith('.wasm') ? 'public, max-age=86400' : 'no-cache',
      );
      if (request.method === 'HEAD') response.end();
      else createReadStream(filename).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Não encontrado');
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (request, socket, head) => {
    let allowed = request.url === '/ws' && wss.clients.size < maxClients;
    try {
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)
        allowed = false;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });
  wss.on('connection', (ws) => {
    const client = rooms.client((message) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    });
    let requests = [];
    ws.alive = true;
    ws.on('pong', () => {
      ws.alive = true;
    });
    ws.on('message', (buffer) => {
      const now = Date.now();
      requests = requests.filter((time) => now - time < 10_000);
      if (requests.length >= 40) {
        rooms.error(client, 'Muitos pedidos. Aguarde alguns segundos.');
        return;
      }
      requests.push(now);
      try {
        const message = JSON.parse(buffer.toString());
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error();
        rooms.handle(client, message);
      } catch {
        rooms.error(client, 'Pedido inválido.');
      }
    });
    ws.on('close', () => rooms.disconnect(client));
    ws.on('error', () => {});
  });
  const clockInterval = setInterval(() => rooms.tick(), 1000);
  clockInterval.unref();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate();
      else {
        ws.alive = false;
        ws.ping();
      }
    }
  }, 30_000);
  heartbeat.unref();
  server.on('close', () => {
    clearInterval(clockInterval);
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
  return { server, rooms, wss };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lan = process.argv.includes('--lan'),
    host = lan ? '0.0.0.0' : '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  const { server } = createChessServer({ lan });
  server.listen(port, host, () => {
    console.log(`chess.io: http://localhost:${port}`);
    if (lan)
      for (const info of Object.values(networkInterfaces()).flat())
        if (info?.family === 'IPv4' && !info.internal)
          console.log(`Na sua rede: http://${info.address}:${port}`);
  });
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `A porta ${port} já está em uso. Escolha outra com PORT=3001 npm start.`
        : error.message,
    );
    process.exitCode = 1;
  });
}
