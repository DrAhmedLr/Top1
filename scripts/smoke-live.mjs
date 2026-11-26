const base = process.env.TOP1_SMOKE_URL || 'https://top1.fit';
const checks = [
  ['/', 200],
  ['/classic', 200],
  ['/about', 200],
  ['/privacy', 200],
  ['/robots.txt', 200],
  ['/sitemap.xml', 200],
  ['/api/personal-workspace', 401],
  ['/api/profile', 401],
  ['/api/bodyweight', 401],
  ['/api/history?metric=pushups', 401],
  ['/api/program', 401],
  ['/api/training', 401],
  ['/api/goal-tracking', 401],
  ['/api/customer-journey', 401],
  ['/api/account/export', 401],
  ['/api/coach/decision', 401],
  ['/api/intelligence/body-map', 401],
  ['/api/cosmetics', 401],
  ['/api/nutrition', 401],
  ['/api/mobile/overview', 401],
  ['/api/mobile/posts', 401],
  ['/api/mobile/presets', 401],
  ['/api/mobile/social', 401],
  ['/api/mobile/gamification', 401],
  ['/api/cron/self-optimize', 401],
];

let failed = false;
for (const [path, status] of checks) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== status) {
      throw new Error(`Expected ${status}, got ${response.status}`);
    }
    if ((path === '/' || path === '/classic') && !response.headers.has('Content-Security-Policy')) {
      throw new Error('CSP absent');
    }
    console.log(`${path}: ${response.status}`);
  } catch (error) {
    failed = true;
    console.error(`${path}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
