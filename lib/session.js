import crypto from 'crypto';

async function getCookiesStore() {
  try {
    const nextHeaders = await import('next/headers');
    return await nextHeaders.cookies();
  } catch {
    try {
      const nextHeaders = await import('next/headers.js');
      return await nextHeaders.cookies();
    } catch {
      return null;
    }
  }
}

export const SESSION_COOKIE_NAME = 'lucky_session';
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

const DEFAULT_DEV_SECRET = 'lucky_uc_default_dev_session_secret_key_32bytes';
const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_DEV_SECRET;

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_DEV_SECRET)) {
  console.warn('⚠️ [SECURITY] SESSION_SECRET is not configured or using default in production. Set a random 32+ character string in Vercel environment variables.');
}

/**
 * Creates a signed session token containing user payload and expiration.
 */
export function createSessionToken(payload) {
  const data = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days expiration
  };
  const jsonStr = JSON.stringify(data);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Data)
    .digest('base64url');

  return `${base64Data}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [base64Data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Data)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return null; // Invalid signature (timing-safe check)
  }

  try {
    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr);
    if (data.exp && data.exp < Date.now()) {
      return null; // Expired
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Gets the current session user on the server (from cookies or Authorization header).
 * Resilient against multi-cookie collisions or stale empty cookies.
 */
export async function getSessionUser(request = null) {
  const candidateTokens = [];

  // 1. Try extracting from request cookies or header if provided
  if (request) {
    if (request.cookies) {
      if (typeof request.cookies.getAll === 'function') {
        const cookiesList = request.cookies.getAll(SESSION_COOKIE_NAME) || [];
        for (const c of cookiesList) {
          if (c && c.value && typeof c.value === 'string' && c.value.trim()) {
            candidateTokens.push(c.value.trim());
          }
        }
      } else if (typeof request.cookies.get === 'function') {
        const val = request.cookies.get(SESSION_COOKIE_NAME)?.value;
        if (val && typeof val === 'string' && val.trim()) {
          candidateTokens.push(val.trim());
        }
      }
    }

    if (request.headers) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearer = authHeader.substring(7).trim();
        if (bearer) candidateTokens.push(bearer);
      }

      const rawCookies = request.headers.get('cookie');
      if (rawCookies) {
        const regex = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`, 'g');
        let m;
        while ((m = regex.exec(rawCookies)) !== null) {
          try {
            const rawVal = decodeURIComponent(m[1]).trim();
            if (rawVal && !candidateTokens.includes(rawVal)) {
              candidateTokens.push(rawVal);
            }
          } catch {
            // Ignore malformed URI component
          }
        }
      }
    }
  }

  // 2. Fallback to Next.js cookie store
  try {
    const cookieStore = await getCookiesStore();
    if (cookieStore) {
      if (typeof cookieStore.getAll === 'function') {
        const list = cookieStore.getAll(SESSION_COOKIE_NAME) || [];
        for (const c of list) {
          if (c && c.value && typeof c.value === 'string' && c.value.trim() && !candidateTokens.includes(c.value.trim())) {
            candidateTokens.push(c.value.trim());
          }
        }
      } else if (typeof cookieStore.get === 'function') {
        const c = cookieStore.get(SESSION_COOKIE_NAME);
        if (c && c.value && typeof c.value === 'string' && c.value.trim() && !candidateTokens.includes(c.value.trim())) {
          candidateTokens.push(c.value.trim());
        }
      }
    }
  } catch {
    // Cookies not accessible in current context
  }

  if (candidateTokens.length === 0) return null;

  // Check each candidate token in order, return first valid session
  for (const token of candidateTokens) {
    const session = verifySessionToken(token);
    if (session && session.userId) {
      return session;
    }
  }

  return null;
}

/**
 * Sets session cookie in response or Server Action.
 */
export async function setSessionCookie(payload, response = null) {
  const token = createSessionToken(payload);

  // If a NextResponse was passed, set directly on response headers
  if (response && response.cookies && typeof response.cookies.set === 'function') {
    response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  }

  // Also set on Next.js cookie store for server actions/context
  try {
    const cookieStore = await getCookiesStore();
    if (cookieStore && typeof cookieStore.set === 'function') {
      cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    }
  } catch (err) {
    // Non-critical if in route handler where cookieStore.set is handled via response
  }

  return token;
}

/**
 * Clears the session cookie with exact matching RFC 6265 attributes (HttpOnly, SameSite, Path, Secure).
 * Note: Never call response.cookies.delete() as Next.js strips HttpOnly and SameSite flags.
 */
export async function clearSessionCookie(response = null) {
  const expiredOptions = {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  };

  if (response && response.cookies && typeof response.cookies.set === 'function') {
    response.cookies.set(SESSION_COOKIE_NAME, '', expiredOptions);
  }

  try {
    const cookieStore = await getCookiesStore();
    if (cookieStore && typeof cookieStore.set === 'function') {
      cookieStore.set(SESSION_COOKIE_NAME, '', expiredOptions);
    }
  } catch (err) {
    // Non-critical
  }
}
