import appManifest from '@/public/app-manifest.json';
import { appShellContentSecurityPolicy } from '@/lib/securityHeaders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves the unified TOP1% gamified mobile-first Expo Web app at `/`
 * with an isolated dark-mode root and per-request CSP nonce (supporting Rive WASM).
 * Static assets (`/_expo`, `/assets`, `/media`) are served directly by Vercel's Edge CDN.
 */
export async function GET(request: Request) {
  const rawNonce = request.headers.get('x-nonce');
  const nonce = rawNonce && /^[a-zA-Z0-9-]+$/.test(rawNonce) ? rawNonce : crypto.randomUUID();
  const { css, js } = appManifest;
  const csp = appShellContentSecurityPolicy(nonce);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
    <title>TOP1% · Scientific Gamified Fitness & Adaptive Coach</title>
    <meta name="description" content="TOP1% gamified mobile performance OS: science & consensus-backed percentiles, 19-muscle physiology, probability-of-reach adaptive coaching, and ranked workouts." />
    <meta name="theme-color" content="#0F0A18" />
    <style id="expo-reset">
      html, body {
        height: 100%;
        height: 100dvh;
        min-height: -webkit-fill-available;
        margin: 0;
        padding: 0;
        background-color: #0F0A18;
        color: #FAFAFA;
        overscroll-behavior: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        touch-action: manipulation;
      }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; height: 100dvh; flex: 1; }
    </style>
    <link rel="preload" href="${css}" as="style" />
    <link rel="stylesheet" href="${css}" />
  </head>
  <body>
    <noscript>Enable JavaScript to run the TOP1% interactive experience.</noscript>
    <div id="root"></div>
    <script src="${js}" nonce="${nonce}" defer></script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': csp,
      'Cache-Control': 'private, no-store',
    },
  });
}
