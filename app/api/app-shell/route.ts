import appManifest from '@/public/app-manifest.json';
import { appShellContentSecurityPolicy } from '@/lib/securityHeaders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://top1.fit').replace(/\/$/, '');

/**
 * Serves the unified TOP1% gamified performance OS at `/` and SPA deep links
 * with a server-generated per-request CSP nonce, full SEO/OpenGraph metadata,
 * and an instant branded loading shell.
 */
export async function GET() {
  // Always mint a fresh cryptographic nonce server-side; never trust incoming headers.
  const nonce = crypto.randomUUID();
  const { css, js } = appManifest;
  const csp = appShellContentSecurityPolicy(nonce);

  const title = 'TOP1% · Scientific Gamified Fitness & Adaptive Coach';
  const description =
    'Science-backed performance percentiles, 19-muscle physiology, adaptive AI workout generation, and ranked strength tracking.';
  const ogImage = `${SITE_URL}/api/og`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="#0F0A18" />
    <link rel="canonical" href="${SITE_URL}/" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230F0A18'/%3E%3Ctext x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='900' font-size='26' fill='%2359B9F9'%3ET1%3C/text%3E%3C/svg%3E" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TOP1%" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; height: 100dvh; flex: 1; }
      .top1-boot {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: radial-gradient(circle at 50% 35%, rgba(89, 185, 249, 0.14), #0F0A18 65%);
      }
      .top1-boot-badge {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #59B9F9;
      }
      .top1-boot-sub {
        font-size: 12px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: rgba(250, 250, 250, 0.55);
      }
    </style>
    <link rel="preload" href="${css}" as="style" />
    <link rel="stylesheet" href="${css}" />
  </head>
  <body>
    <noscript>
      <main style="padding:32px;max-width:560px;margin:0 auto;color:#FAFAFA;">
        <h1>TOP1% · Scientific Gamified Fitness &amp; Adaptive Coach</h1>
        <p>${description}</p>
        <p>Enable JavaScript to launch the interactive TOP1% web app, or visit <a href="/about" style="color:#59B9F9;">About</a> and <a href="/privacy" style="color:#59B9F9;">Privacy</a>.</p>
      </main>
    </noscript>
    <div id="root">
      <div class="top1-boot" aria-busy="true">
        <div class="top1-boot-badge">TOP1%</div>
        <div class="top1-boot-sub">Loading Performance OS</div>
      </div>
    </div>
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
