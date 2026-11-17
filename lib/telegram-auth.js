import crypto from 'crypto';

/**
 * Validates Telegram WebApp initData string using HMAC-SHA256.
 *
 * @param {string} initData - Raw initData string from Telegram.WebApp.initData
 * @param {string} botToken - Telegram Bot Token
 * @returns {{ isValid: boolean, user?: object, error?: string }}
 */
export function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    return { isValid: false, error: 'initData is empty' };
  }

  // In production, botToken is strictly required with zero bypass
  if (!botToken) {
    if (process.env.NODE_ENV === 'production') {
      return { isValid: false, error: 'TELEGRAM_BOT_TOKEN is not configured on server' };
    }
    // Dev-only fallback for local testing without bot token
    try {
      const params = new URLSearchParams(initData);
      const userJson = params.get('user');
      const user = userJson ? JSON.parse(userJson) : null;
      return { isValid: true, user, isDevBypass: true };
    } catch (err) {
      return { isValid: false, error: 'Invalid user format: ' + err.message };
    }
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash || typeof hash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hash)) {
      return { isValid: false, error: 'Hash missing or invalid format in initData' };
    }

    // Check auth_date freshness (maximum 24 hours, rejecting future skew > 120s)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || (now - authDate) > 86400 || (authDate - now) > 120) {
      return { isValid: false, error: 'initData timestamp expired or invalid' };
    }

    // Sort parameters alphabetically excluding 'hash'
    const dataCheckArr = [];
    const entries = Array.from(params.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [key, value] of entries) {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${value}`);
      }
    }

    const dataCheckString = dataCheckArr.join('\n');

    // Secret key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculated hash = HMAC_SHA256(dataCheckString, secretKey)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const calculatedHashBuf = Buffer.from(calculatedHash, 'hex');
    const providedHashBuf = Buffer.from(hash, 'hex');

    if (
      calculatedHashBuf.length !== providedHashBuf.length ||
      !crypto.timingSafeEqual(calculatedHashBuf, providedHashBuf)
    ) {
      return { isValid: false, error: 'Hash signature mismatch' };
    }

    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : null;

    if (!user || !user.id) {
      return { isValid: false, error: 'Valid user object missing in initData' };
    }

    return { isValid: true, user };
  } catch (err) {
    return { isValid: false, error: 'Verification failed: ' + err.message };
  }
}
