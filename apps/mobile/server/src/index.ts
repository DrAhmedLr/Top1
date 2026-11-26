import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { appRouter } from './routers/index.js';

const PORT = Number(process.env.PORT ?? 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST_DIR = path.resolve(__dirname, '../../app/dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.riv': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

function resolveAllowedCorsOrigin(originHeader?: string): string {
  if (!originHeader) return 'http://localhost:8081';
  const configured = (process.env.TOP1_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    configured.includes(originHeader) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHeader) ||
    originHeader === 'https://top1.fit' ||
    originHeader === 'capacitor://localhost'
  ) {
    return originHeader;
  }
  return 'https://top1.fit';
}

function tryServeStaticWeb(urlPath: string, res: import('node:http').ServerResponse): boolean {
  if (!fs.existsSync(WEB_DIST_DIR)) return false;
  let cleanPath: string;
  try {
    cleanPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  } catch {
    res.statusCode = 400;
    res.end('Bad Request');
    return true;
  }
  const candidate = path.resolve(WEB_DIST_DIR, cleanPath.replace(/^\/+/, ''));

  // Prevent directory traversal outside WEB_DIST_DIR
  if (candidate !== WEB_DIST_DIR && !candidate.startsWith(WEB_DIST_DIR + path.sep)) return false;

  const targetFile =
    fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(WEB_DIST_DIR, 'index.html');

  if (!fs.existsSync(targetFile)) return false;

  const ext = path.extname(targetFile).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
  res.statusCode = 200;
  fs.createReadStream(targetFile).pipe(res);
  return true;
}

async function main() {
  const { db } = await createDatabase();
  await seedDatabase(db);

  const server = createHTTPServer({
    basePath: '/api/trpc/',
    router: appRouter,
    createContext({ req }) {
      return {
        db,
        authorizationHeader:
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      };
    },
    responseMeta() {
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          Vary: 'Origin',
        },
      };
    },
    middleware(req, res, next) {
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      res.setHeader('Access-Control-Allow-Origin', resolveAllowedCorsOrigin(origin));
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Vary', 'Origin');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = req.url ?? '/';

      if (url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, service: 'top1-api' }));
        return;
      }

      if (url.startsWith('/api/trpc')) {
        next();
        return;
      }

      // Serve exported Expo web app if available so http://localhost:4000 works out of the box
      if (req.method === 'GET' && tryServeStaticWeb(url, res)) {
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(
        `<!doctype html><html><body style="font-family:system-ui;background:#0F0A18;color:#FAFAFA;padding:40px">` +
          `<h1>TOP1% API Server</h1>` +
          `<p>tRPC endpoint is live at <code>/api/trpc</code> and health check at <code>/health</code>.</p>` +
          `<p>Open the Expo web app at <a style="color:#59B9F9" href="http://localhost:8081">http://localhost:8081</a>.</p>` +
          `</body></html>`
      );
    },
  });

  server.listen(PORT, () => {
    console.log(`[TOP1 Server] API & Web running on http://localhost:${PORT} (tRPC: /api/trpc)`);
  });
}

main().catch((err) => {
  console.error('[TOP1 Server] Fatal startup error:', err);
  process.exit(1);
});
