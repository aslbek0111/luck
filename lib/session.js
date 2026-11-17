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
 */
export async function getSessionUser(request = null) {
  let token = null;

  // 1. Try extracting from request cookies or header if provided
  if (request) {
    if (request.cookies && typeof request.cookies.get === 'function') {
      token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    }

    if (!token && request.headers) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token) {
        const rawCookies = request.headers.get('cookie');
        if (rawCookies) {
          const match = rawCookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
          if (match) {
            token = decodeURIComponent(match[1]);
          }
        }
      }
    }
  }

  // 2. Fallback to Next.js cookies()
  if (!token) {
    try {
      const cookieStore = await getCookiesStore();
      const cookie = cookieStore?.get(SESSION_COOKIE_NAME);
      token = cookie?.value;
    } catch {
      // Cookies not accessible in current context
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
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
    if (cookieStore) {
      cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    }
  } catch (err) {
    // Non-critical if in route handler where cookieStore.set is handled via response
  }

  return token;
}

/**
 * Clears the session cookie.
 */
export async function clearSessionCookie(response = null) {
  if (response && response.cookies && typeof response.cookies.set === 'function') {
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    });
  }

  try {
    const cookieStore = await getCookiesStore();
    if (cookieStore) {
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
  } catch (err) {
    // Non-critical
  }
}
