/**
 * Admin Password Setup Utility (Production Ready)
 * Generates secure bcrypt hash for production admin password.
 * Usage:
 *   node scripts/set-admin-password.mjs "YourSuperStrongPasswordHere"
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password || password.length < 8) {
  console.log(`
========================================================================
🔐 LUCKY UC - PRODUCTION ADMIN PASSWORD GENERATOR
========================================================================
Error: Please provide a strong password with at least 8 characters.

Usage:
  node scripts/set-admin-password.mjs "MySecureChristmasAdmin2026!"

========================================================================
`);
  process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log(`
========================================================================
🔐 LUCKY UC - PRODUCTION ADMIN CREDENTIALS CONFIGURED
========================================================================
Username: lucky_admin
Password: ${password}
Bcrypt Hash:
${hash}

------------------------------------------------------------------------
Option 1: Set in Vercel Environment Variables:
------------------------------------------------------------------------
ADMIN_USERNAME=lucky_admin
ADMIN_PASSWORD_HASH=${hash}
# Or plain password (will be securely verified):
ADMIN_PASSWORD=${password}

------------------------------------------------------------------------
Option 2: Execute in Supabase SQL Editor:
------------------------------------------------------------------------
UPDATE public.users 
SET password_hash = '${hash}', is_admin = TRUE, updated_at = NOW()
WHERE username = 'lucky_admin';

-- If admin user does not exist yet:
INSERT INTO public.users (
  id, username, first_name, last_name, avatar_url,
  password_hash, is_admin, is_approved, is_blocked, is_vip, profile_frame
) VALUES (
  uuid_generate_v4(), 'lucky_admin', 'Admin', 'Platform',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  '${hash}', TRUE, TRUE, FALSE, TRUE, 'vip_gold'
) ON CONFLICT (LOWER(username)) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_admin = TRUE;

========================================================================
✅ Keep these credentials safe!
========================================================================
`);
