import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isServerSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);
export const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Safely inspects Supabase server credentials WITHOUT exposing secrets or keys in logs.
 * Decodes the public JWT payload header/claims to determine if the key is genuine service_role or anon.
 */
export function getSupabaseDiagnostics() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const inspectKey = (key) => {
    if (!key || typeof key !== 'string') return { exists: false, role: 'none', length: 0 };
    const trimmed = key.trim();
    if (!trimmed) return { exists: false, role: 'none', length: 0 };
    try {
      const parts = trimmed.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return {
          exists: true,
          role: payload.role || 'unknown',
          length: trimmed.length,
          ref: payload.ref || null,
        };
      }
    } catch {}
    return { exists: true, role: 'non-jwt', length: trimmed.length };
  };

  const serviceKeyInfo = inspectKey(serviceKey);
  const anonKeyInfo = inspectKey(anonKey);

  return {
    isConfigured: Boolean(url && (serviceKey || anonKey)),
    hasServiceRoleKey: serviceKeyInfo.exists,
    serviceRoleKeyRole: serviceKeyInfo.role, // 'service_role' | 'anon' | 'none'
    isUsingServiceRole: serviceKeyInfo.exists && serviceKeyInfo.role === 'service_role',
    hasAnonKey: anonKeyInfo.exists,
    urlConfigured: Boolean(url),
    environment: process.env.NODE_ENV || 'development',
  };
}

if (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ [SECURITY] SUPABASE_SERVICE_ROLE_KEY is not configured in production. Direct database updates on tables with RLS (like public.users) will be blocked.');
}

export const supabaseServer = isServerSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
