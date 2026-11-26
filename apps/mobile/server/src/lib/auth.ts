import crypto from 'node:crypto';

function getJwtSecret(): string {
  const configured = process.env.TOP1_JWT_SECRET || process.env.APEXLIFT_JWT_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    throw new Error('TOP1_JWT_SECRET (at least 16 chars) must be configured in production.');
  }
  return 'top1-local-dev-only-jwt-secret';
}
const ACCESS_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(key, 'hex');
  const b = Buffer.from(derived, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

interface JwtPayload {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

export function signAccessToken(userId: string, sessionId: string, ttlSeconds = ACCESS_TTL_SECONDS): {
  accessToken: string;
  accessTokenExpiresAt: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, sid: sessionId, iat: now, exp } satisfies JwtPayload)
  );
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest()
  );
  return {
    accessToken: `${header}.${payload}.${sig}`,
    accessTokenExpiresAt: exp * 1000,
  };
}

export function verifyAccessToken(token: string):
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: 'expired' | 'invalid' } {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };
  const [header, payloadB64, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payloadB64}`).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
    if (!parsed.sub || !parsed.sid || typeof parsed.exp !== 'number') {
      return { ok: false, reason: 'invalid' };
    }
    if (Date.now() >= parsed.exp * 1000) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function getRefreshExpiryIso(): string {
  return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString();
}
