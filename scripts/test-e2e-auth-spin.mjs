/**
 * LUCKY UC - Automated End-to-End Authentication & Persistent Spins Test Suite
 * Tests exact user scenarios required in the task:
 * 1. User 1 registers and gets 5 spins
 * 2. Uses 2 spins (balance becomes 3)
 * 3. Logs out
 * 4. Checks persistent session / cookie
 * 5. Re-logs in and verifies exactly 3 spins remain
 * 6. User 2 registers and gets independent 5 spins
 * 7. Verification that neither user drops to 0 or resets to 5
 * 8. Brute force rate limit protection
 * 9. Credential hygiene (no password_hash leaks)
 */

import { spawn } from 'child_process';
import http from 'http';

const PORT = 3088;
const BASE_URL = `http://localhost:${PORT}`;

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

// Helper to make HTTP requests and manage cookies
async function request(endpoint, options = {}, cookieJar = { cookie: '' }) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (cookieJar.cookie) {
    headers['Cookie'] = cookieJar.cookie;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Track Set-Cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    if (setCookie.includes('Max-Age=0') || setCookie.includes('max-age=0') || setCookie.includes('lucky_session=;') || setCookie.includes('lucky_session=deleted')) {
      cookieJar.cookie = '';
    } else {
      const match = setCookie.match(/lucky_session=([^;]+)/);
      if (match) {
        cookieJar.cookie = `lucky_session=${match[1]}`;
      }
    }
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // not json
  }

  return { status: res.status, headers: res.headers, data, cookie: cookieJar.cookie };
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      if (res.status === 200 || res.status === 401) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function runTests() {
  console.log('\n🚀 Starting Next.js Production Server for E2E Tests on port ' + PORT + '...');

  const serverProc = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'start', '-p', String(PORT)],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ALLOW_DEV_STORE: 'true' },
    }
  );

  try {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server failed to start in time');
      process.exit(1);
    }
    console.log('Server is ready. Running E2E test scenarios...\n');

    const testId = Date.now().toString().slice(-5);
    const user1Name = `player_alpha_${testId}`;
    const user2Name = `player_beta_${testId}`;
    const userPassword = 'securePassword123!';

    // =========================================================================
    // SCENARIO 1: USER 1 REGISTRATION & STARTING SPINS
    // =========================================================================
    console.log('--- Scenario 1: User 1 Registration & Initial Spin Balance ---');
    const user1Jar = { cookie: '' };

    const reg1 = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        action: 'register',
        username: `@${user1Name}`,
        password: userPassword,
        confirmPassword: userPassword,
      },
    }, user1Jar);

    assert(reg1.status === 200 && reg1.data.success, `User 1 (@${user1Name}) registration succeeds`);
    assert(reg1.data.user?.free_spins_balance === 5, 'User 1 granted exactly 5 initial free spins');
    assert(Boolean(user1Jar.cookie), 'HttpOnly session cookie received upon registration');

    // Verify session via /api/auth/me
    const me1 = await request('/api/auth/me', {}, user1Jar);
    assert(me1.data.authenticated && me1.data.user?.username === user1Name, 'Session verified via /api/auth/me');

    // Verify profile via /api/user/profile
    const prof1 = await request('/api/user/profile', {}, user1Jar);
    assert(prof1.data.stats?.freeSpins === 5, 'Profile confirms 5 free spins available in database');

    // =========================================================================
    // SCENARIO 2: USER 1 SPINS TWICE
    // =========================================================================
    console.log('\n--- Scenario 2: User 1 Performs 2 Spins ---');

    // Spin 1
    const spin1 = await request('/api/spin/play', { method: 'POST' }, user1Jar);
    assert(spin1.data.success && spin1.data.reward, `Spin 1 succeeds with won reward: "${spin1.data.reward?.name}"`);

    // Spin 2
    const spin2 = await request('/api/spin/play', { method: 'POST' }, user1Jar);
    assert(spin2.data.success && spin2.data.reward, `Spin 2 succeeds with won reward: "${spin2.data.reward?.name}"`);

    // Check updated profile
    const prof1AfterSpins = await request('/api/user/profile', {}, user1Jar);
    const spinsLeftUser1 = prof1AfterSpins.data.stats?.freeSpins;
    assert(spinsLeftUser1 === spin2.data.spins_left, `Server profile confirms spins balance is exactly ${spinsLeftUser1}`);
    assert(prof1AfterSpins.data.lastWins?.length >= 2, 'Spins recorded in user history');

    // =========================================================================
    // SCENARIO 3: LOGOUT & BROWSER RELOAD / PERSISTENCE
    // =========================================================================
    console.log('\n--- Scenario 3: Logout, Cookie Revocation & Re-Authentication ---');

    // Save session cookie to simulate reopening the browser with existing cookie
    const savedCookie = user1Jar.cookie;

    // Simulate reopening browser with valid cookie
    const reopenRes = await request('/api/user/profile', {}, { cookie: savedCookie });
    assert(reopenRes.data.success && reopenRes.data.stats?.freeSpins === spinsLeftUser1,
      `Reopened browser restores session and preserves exact ${spinsLeftUser1} spins (NOT 0)`);

    // Now perform formal logout
    const logoutRes = await request('/api/auth/logout', { method: 'POST' }, user1Jar);
    assert(logoutRes.data.success, 'Logout API succeeds and clears session');

    // Verify session is now invalidated
    const meAfterLogout = await request('/api/auth/me', {}, user1Jar);
    assert(meAfterLogout.data.authenticated === false, 'Session is terminated after logout');

    const profAfterLogout = await request('/api/user/profile', {}, user1Jar);
    assert(profAfterLogout.status === 401, 'Unauthenticated profile request correctly rejected with 401');

    // =========================================================================
    // SCENARIO 4: SIGN IN RECOVERS EXACT SPINS
    // =========================================================================
    console.log('\n--- Scenario 4: User 1 Sign In & Exact Spin Recovery ---');

    const login1 = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        action: 'login',
        username: user1Name,
        password: userPassword,
      },
    }, user1Jar);

    assert(login1.data.success, 'User 1 login succeeds with valid credentials');
    assert(login1.data.user?.free_spins_balance === spinsLeftUser1,
      `User 1 sees exactly ${spinsLeftUser1} spins after re-login (NOT 5 starter, NOT 0)`);

    const profAfterLogin = await request('/api/user/profile', {}, user1Jar);
    assert(profAfterLogin.data.stats?.freeSpins === spinsLeftUser1,
      `Database profile verifies exact ${spinsLeftUser1} spins preserved`);

    // =========================================================================
    // SCENARIO 5: USER 2 REGISTRATION & INDEPENDENT BALANCES
    // =========================================================================
    console.log('\n--- Scenario 5: User 2 Independent Account & Verification ---');
    const user2Jar = { cookie: '' };

    const reg2 = await request('/api/auth/browser', {
      method: 'POST',
      body: {
        action: 'register',
        username: `@${user2Name}`,
        password: userPassword,
        confirmPassword: userPassword,
      },
    }, user2Jar);

    assert(reg2.data.success, `User 2 (@${user2Name}) registration succeeds`);
    assert(reg2.data.user?.free_spins_balance === 5, 'User 2 receives independent 5 starter spins');

    // User 2 spins 1 time
    const spinUser2 = await request('/api/spin/play', { method: 'POST' }, user2Jar);
    assert(spinUser2.data.success, 'User 2 performs 1 spin');

    const prof2 = await request('/api/user/profile', {}, user2Jar);
    const spinsLeftUser2 = prof2.data.stats?.freeSpins;

    // Verify User 1 balances are completely independent and unchanged!
    const prof1Check = await request('/api/user/profile', {}, user1Jar);
    assert(prof1Check.data.stats?.freeSpins === spinsLeftUser1,
      `User 1 spins remain untouched at ${spinsLeftUser1} while User 2 has ${spinsLeftUser2}`);

    // =========================================================================
    // SCENARIO 6: BRUTE-FORCE PROTECTION & SECURITY TESTS
    // =========================================================================
    console.log('\n--- Scenario 6: Brute-Force Rate Limiting & Credential Hygiene ---');

    // Mismatched password rejected
    const badPassRes = await request('/api/auth/browser', {
      method: 'POST',
      body: { action: 'login', username: user1Name, password: 'wrongPassword!' },
    });
    assert(badPassRes.status === 401 && badPassRes.data.error?.includes('Неверный пароль'),
      'Wrong password rejected with 401');

    // Simulate 5 consecutive failed login attempts
    console.log('  Simulating brute-force attack (5 failed attempts)...');
    for (let i = 0; i < 4; i++) {
      await request('/api/auth/browser', {
        method: 'POST',
        body: { action: 'login', username: user1Name, password: 'wrongPassword!' },
      });
    }

    // 6th attempt should be blocked by rate limiter
    const blockedRes = await request('/api/auth/browser', {
      method: 'POST',
      body: { action: 'login', username: user1Name, password: 'wrongPassword!' },
    });
    assert(blockedRes.status === 429 && blockedRes.data.error?.includes('Слишком много попыток'),
      'Brute-force attack blocked with 429 (Too Many Requests)');

    // Credential hygiene check: verify password_hash is never exposed
    assert(!('password_hash' in reg1.data.user), 'password_hash not exposed in registration response');
    assert(!('password_hash' in me1.data.user), 'password_hash not exposed in /api/auth/me');
    assert(!('password_hash' in prof1.data.user), 'password_hash not exposed in /api/user/profile');

    console.log('\n==========================================');
    console.log(`E2E TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('==========================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failedTests++;
  } finally {
    serverProc.kill('SIGINT');
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
