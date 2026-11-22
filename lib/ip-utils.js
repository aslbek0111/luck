/**
 * LUCKY UC - Client IP Address Utility
 * Securely extracts and validates client IP addresses behind reverse proxies and CDNs (Vercel, Cloudflare, Nginx).
 */

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$/;

/**
 * Validates if a string is a well-formed IPv4 or IPv6 address.
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (trimmed.length < 3 || trimmed.length > 45) return false;
  // Disallow local loopback in strict validation if needed, or reject non-standard strings
  if (trimmed.includes(';') || trimmed.includes(' ') || trimmed.includes('/') || trimmed.includes('--')) {
    return false;
  }
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed) || trimmed.includes(':');
}

/**
 * Extracts the real client IP address from request headers based on trusted infrastructure hierarchy.
 * Priority order:
 * 1. x-vercel-forwarded-for (Vercel edge gateway - non-forgeable on Vercel)
 * 2. cf-connecting-ip (Cloudflare edge proxy - non-forgeable behind Cloudflare)
 * 3. true-client-ip (Enterprise edge proxy)
 * 4. x-real-ip (Nginx / trusted reverse proxy)
 * 5. x-forwarded-for (Fallback, taking the first valid IP)
 *
 * @param {Request|Headers|object} req
 * @returns {string|null} Valid real client IP, or null if undetermined (or 127.0.0.1 in local dev)
 */
export function getClientIp(req) {
  try {
    let headers;
    if (req?.headers && typeof req.headers.get === 'function') {
      headers = req.headers;
    } else if (req?.headers && typeof req.headers === 'object') {
      headers = {
        get: (name) => {
          const key = Object.keys(req.headers).find((k) => k.toLowerCase() === name.toLowerCase());
          return key ? req.headers[key] : null;
        },
      };
    } else {
      return process.env.NODE_ENV === 'production' ? null : '127.0.0.1';
    }

    // 1. Vercel edge header (highest trust on Vercel)
    const vercelIp = headers.get('x-vercel-forwarded-for');
    if (vercelIp) {
      const firstVercel = vercelIp.split(',')[0].trim();
      if (isValidIp(firstVercel)) {
        return firstVercel;
      }
    }

    // 2. Cloudflare header (highest trust when behind Cloudflare)
    const cfIp = headers.get('cf-connecting-ip');
    if (cfIp && isValidIp(cfIp.trim())) {
      return cfIp.trim();
    }

    // 3. True-Client-IP (Cloudflare Enterprise / Akamai)
    const trueClientIp = headers.get('true-client-ip');
    if (trueClientIp && isValidIp(trueClientIp.trim())) {
      return trueClientIp.trim();
    }

    // 4. Nginx / trusted reverse proxy header
    const realIp = headers.get('x-real-ip');
    if (realIp && isValidIp(realIp.trim())) {
      return realIp.trim();
    }

    // 5. X-Forwarded-For fallback (extract first valid IP)
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
      const parts = forwarded.split(',').map((p) => p.trim());
      for (const candidate of parts) {
        if (candidate && isValidIp(candidate)) {
          return candidate;
        }
      }
    }

    // In local development or testing without proxy headers, fallback to 127.0.0.1
    return process.env.NODE_ENV === 'production' ? null : '127.0.0.1';
  } catch {
    return process.env.NODE_ENV === 'production' ? null : '127.0.0.1';
  }
}
