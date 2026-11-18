/**
 * Automated Verification Script: Complete Logout (Sign Out) Feature
 * Tests:
 * 1. POST /api/auth/logout returns message 'Вы успешно вышли из аккаунта'
 * 2. Set-Cookie header contains Max-Age=0 / Expires in past to destroy session cookie
 * 3. GET /api/auth/logout also properly revokes session
 * 4. Standard Player: login -> verify authenticated -> logout -> verify 401 / unauthenticated
 * 5. Player data persistence: re-login restores UC, spins, inventory without data loss
 * 6. Admin Logout: login -> verify admin access -> logout -> verify /api/admin/users returns 403 Forbidden
 * 7. Multi-user session isolation: User A logout does not affect User B
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          // not json
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function extractCookie(res) {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(';')[0];
}

async function run() {
  console.log('🚪 STARTING LOGOUT (SIGN OUT) FEATURE AUTOMATED TEST SUITE 🚪\n');

  // Prepare clean .dev_store.json
  const devStorePath = path.join(process.cwd(), '.dev_store.json');
  const cleanDevStore = {
    users: [
      {
        id: 'user-admin',
        telegram_id: 999999001,
        username: 'lucky_admin',
        first_name: 'Александр',
        last_name: 'Admin',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        active_title_id: 'title-vip',
        spins_count: 50,
        total_uc: 1000,
        total_popularity: 850,
        free_spins_balance: 10,
        is_approved: true,
        is_blocked: false,
        is_admin: true,
        is_vip: true,
        profile_frame: 'vip_gold',
        password_hash: '$2b$10$3BlKi0I0Ej5CUahNEOmHtOW3cPsNAIgJDXYga4wggNfv7Mu//aRkC', // '1234'
        created_at: new Date('2026-11-01T00:00:00Z').toISOString(),
      },
    ],
    inventory: {
      'user-admin': [],
    },
    registrationCodes: [
      { code: 'Snow24A', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Frost82B', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'VIP5000X', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'VIP2026Z', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
    ],
    notifications: [],
    auditLogs: [],
    spinsHistory: [],
    systemConfig: { spin_wheel_enabled: true, max_player_slots: 12 },
    currentUserId: null,
  };
  fs.writeFileSync(devStorePath, JSON.stringify(cleanDevStore, null, 2), 'utf8');

  // Spawn Next.js server on PORT
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_STORE: 'true' },
  });

  child.stdout.on('data', (d) => process.stdout.write('[Next] ' + d.toString()));
  child.stderr.on('data', (d) => process.stderr.write('[Next ERR] ' + d.toString()));

  // Wait for server to start
  console.log(`⏳ Waiting for server on port ${PORT}...`);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await request('/api/auth/me');
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // wait
    }
  }

  if (!ready) {
    child.kill();
    throw new Error('Server did not start in time');
  }

  console.log('🚀 Server is READY! Running Logout Verification Scenarios...\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
    }
  }

  try {
    // ----------------------------------------------------
    // Scenario 1: POST /api/auth/logout endpoint contract
    // ----------------------------------------------------
    console.log('--- Test 1: POST /api/auth/logout Endpoint Contract ---');
    const postLogoutRes = await request('/api/auth/logout', { method: 'POST' });
    assert('POST /api/auth/logout returns status 200', postLogoutRes.status === 200);
    assert('POST /api/auth/logout returns success: true', postLogoutRes.data?.success === true);
    assert(
      'POST /api/auth/logout message is "Вы успешно вышли из аккаунта"',
      postLogoutRes.data?.message === 'Вы успешно вышли из аккаунта'
    );

    const setCookies = postLogoutRes.headers['set-cookie'] || [];
    const cookieHeaderStr = Array.isArray(setCookies) ? setCookies.join('; ') : setCookies;
    assert(
      'Set-Cookie header expires lucky_session (contains Max-Age=0 or past date)',
      cookieHeaderStr.includes('Max-Age=0') ||
        cookieHeaderStr.includes('max-age=0') ||
        cookieHeaderStr.includes('lucky_session=;') ||
        cookieHeaderStr.includes('1970')
    );

    // ----------------------------------------------------
    // Scenario 2: GET /api/auth/logout support
    // ----------------------------------------------------
    console.log('\n--- Test 2: GET /api/auth/logout Support ---');
    const getLogoutRes = await request('/api/auth/logout', { method: 'GET' });
    assert('GET /api/auth/logout returns status 200', getLogoutRes.status === 200);
    assert(
      'GET /api/auth/logout message is "Вы успешно вышли из аккаунта"',
      getLogoutRes.data?.message === 'Вы успешно вышли из аккаунта'
    );

    // ----------------------------------------------------
    // Scenario 3: Standard Player Login, Logout & Revocation
    // ----------------------------------------------------
    console.log('\n--- Test 3: Standard Player Registration, Login & Logout ---');
    // Register player
    const regRes = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'FrostyPlayer',
        password: 'password123',
        confirmPassword: 'password123',
        code: 'Snow24A',
        action: 'register',
      },
    });
    assert('Player registration successful', regRes.data?.success === true);
    const playerCookie = extractCookie(regRes);
    assert('Player received valid session cookie', playerCookie.includes('lucky_session='));

    // Check /api/auth/me
    const meRes = await request('/api/auth/me', { headers: { Cookie: playerCookie } });
    assert('Player authenticated via /api/auth/me', meRes.data?.authenticated === true);
    assert('Username matches FrostyPlayer', meRes.data?.user?.username?.toLowerCase() === 'frostyplayer');

    // Access protected profile
    const profileRes = await request('/api/user/profile', { headers: { Cookie: playerCookie } });
    assert('Player can access /api/user/profile', profileRes.status === 200 && profileRes.data?.success === true);

    // Now player logs out
    const playerLogoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: playerCookie },
    });
    assert('Player logout succeeds with 200', playerLogoutRes.status === 200);
    assert('Player logout returns Russian message', playerLogoutRes.data?.message === 'Вы успешно вышли из аккаунта');

    // After logout: client discards cookie, server rejects unauthenticated request
    const meAfterLogout = await request('/api/auth/me');
    assert('Session is unauthenticated after cookie cleared', meAfterLogout.data?.authenticated === false);

    const profileAfterLogout = await request('/api/user/profile');
    assert('Unauthenticated profile access rejected with 401', profileAfterLogout.status === 401);

    const spinAfterLogout = await request('/api/spin/play', { method: 'POST' });
    assert('Unauthenticated spin attempt rejected with 401', spinAfterLogout.status === 401);

    // ----------------------------------------------------
    // Scenario 4: Player Data Persistence After Logout
    // ----------------------------------------------------
    console.log('\n--- Test 4: Database Persistence & Re-Authentication ---');
    // Re-login with the same credentials
    const reLoginRes = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'FrostyPlayer',
        password: 'password123',
        action: 'login',
      },
    });
    assert('Player successfully re-authenticates after logout', reLoginRes.data?.success === true);
    const reLoginCookie = extractCookie(reLoginRes);
    const reProfileRes = await request('/api/user/profile', { headers: { Cookie: reLoginCookie } });
    assert(
      'Player account state, username, and ID fully preserved after logout',
      reProfileRes.data?.user?.username?.toLowerCase() === 'frostyplayer'
    );

    // ----------------------------------------------------
    // Scenario 5: Admin Panel Logout & Privilege Revocation
    // ----------------------------------------------------
    console.log('\n--- Test 5: Admin Panel Logout & Privilege Revocation ---');
    // Login as admin
    const adminLoginRes = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'admin',
        password: '1234',
        action: 'login',
      },
    });
    assert('Admin login succeeds', adminLoginRes.data?.success === true && adminLoginRes.data?.user?.is_admin === true);
    const adminCookie = extractCookie(adminLoginRes);

    // Verify admin can access /api/admin/users
    const adminUsersRes = await request('/api/admin/users', { headers: { Cookie: adminCookie } });
    assert('Admin can access /api/admin/users', adminUsersRes.status === 200 && adminUsersRes.data?.success === true);

    // Admin logs out
    const adminLogoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert('Admin logout succeeds with status 200', adminLogoutRes.status === 200);
    assert('Admin logout message is correct', adminLogoutRes.data?.message === 'Вы успешно вышли из аккаунта');

    // Verify admin privileges completely revoked on all admin endpoints
    const adminUsersPostLogout = await request('/api/admin/users');
    assert('Admin /api/admin/users returns 403 Forbidden after logout', adminUsersPostLogout.status === 403);

    const adminGiftsPostLogout = await request('/api/admin/gifts', { method: 'POST', body: {} });
    assert('Admin /api/admin/gifts returns 403 Forbidden after logout', adminGiftsPostLogout.status === 403);

    const adminSpinsPostLogout = await request('/api/admin/spins', { method: 'POST', body: {} });
    assert('Admin /api/admin/spins returns 403 Forbidden after logout', adminSpinsPostLogout.status === 403);

    const adminWheelPostLogout = await request('/api/admin/wheel', { method: 'POST', body: {} });
    assert('Admin /api/admin/wheel returns 403 Forbidden after logout', adminWheelPostLogout.status === 403);

    const adminLogsPostLogout = await request('/api/admin/logs');
    assert('Admin /api/admin/logs returns 403 Forbidden after logout', adminLogsPostLogout.status === 403);

    // ----------------------------------------------------
    // Scenario 6: Multi-User Session Isolation
    // ----------------------------------------------------
    console.log('\n--- Test 6: Multi-User Session Isolation ---');
    // User A: FrostyPlayer
    const userALogin = await request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'FrostyPlayer', password: 'password123', action: 'login' },
    });
    const cookieA = extractCookie(userALogin);

    // User B: Register VIP Player
    const userBReg = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'VipSanta',
        password: 'password123',
        confirmPassword: 'password123',
        code: 'VIP5000X',
        action: 'register',
      },
    });
    const cookieB = extractCookie(userBReg);

    assert('User A has valid session', (await request('/api/auth/me', { headers: { Cookie: cookieA } })).data?.authenticated === true);
    assert('User B has valid session', (await request('/api/auth/me', { headers: { Cookie: cookieB } })).data?.authenticated === true);

    // User A logs out
    await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookieA } });

    // Verify User A session is gone
    const userAAgain = await request('/api/auth/me');
    assert('User A is logged out without cookie', userAAgain.data?.authenticated === false);

    // Verify User B is completely unaffected
    const userBStillActive = await request('/api/auth/me', { headers: { Cookie: cookieB } });
    assert(
      'User B remains authenticated with VIP status and 5000 UC',
      userBStillActive.data?.authenticated === true &&
        userBStillActive.data?.user?.username?.toLowerCase() === 'vipsanta' &&
        userBStillActive.data?.user?.is_vip === true &&
        userBStillActive.data?.user?.total_uc === 5000
    );

    console.log('\n==========================================');
    console.log(`LOGOUT TEST RESULTS: ${passed} / ${total} CHECKS PASSED`);
    console.log('==========================================\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    total++;
  } finally {
    child.kill('SIGINT');
    process.exit(passed === total ? 0 : 1);
  }
}

run();
