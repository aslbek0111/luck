import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = 3014;
const BASE_URL = `http://localhost:${PORT}`;

const STANDARD_ACCOUNTS = [
  'Snow24A',
  'Frost82B',
  'Winter39C',
  'Gift51Dx',
  'Santa73K',
  'Magic46P',
  'Merry28Q',
  'North64R',
  'Star92Tm',
  'Candy35V',
];

const VIP_ACCOUNTS = [
  'VIP5000X',
  'VIP2026Z',
  'VIP7777M',
  'VIP9999K',
];

const ALL_14_ACCOUNTS = [...STANDARD_ACCOUNTS, ...VIP_ACCOUNTS];

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
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
  console.log('🎄 STARTING 14 ACCOUNTS AUTHENTICATION VERIFICATION 🎄\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Spawn Next.js server on PORT
  const child = spawn('cmd', ['/c', 'npx', 'next', 'start', '-p', String(PORT)], {
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_STORE: 'true' },
  });

  child.stdout.on('data', (d) => {
    // quiet
  });
  child.stderr.on('data', (d) => {
    // quiet
  });

  console.log(`⏳ Waiting for server on port ${PORT}...`);
  let ready = false;
  for (let i = 0; i < 45; i++) {
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
    console.error('❌ Server failed to start on port ' + PORT);
    try { child.kill(); } catch {}
    process.exit(1);
  }

  console.log('🚀 Server is ready! Running tests...\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: First login for all 10 Standard Accounts
    // -------------------------------------------------------------
    console.log('--- 1. First Login for 10 Standard Accounts ---');
    for (const username of STANDARD_ACCOUNTS) {
      const testPassword = `StdPass_${username}!`;
      const res = await request('/api/auth/browser', {
        method: 'POST',
        body: { username, password: testPassword },
      });

      assert(res.status === 200, `First login ${username}: HTTP 200`);
      assert(res.data.success === true, `First login ${username}: success === true`);
      assert(res.data.user && res.data.user.username.toLowerCase() === username.toLowerCase(), `First login ${username}: username matches`);
      assert(res.data.user.is_vip === false, `First login ${username}: is_vip === false`);
      assert(res.data.user.is_admin === false, `First login ${username}: is_admin === false`);
      assert(res.data.user.total_uc === 0, `First login ${username}: total_uc === 0`);
      assert(res.data.user.password_hash === undefined, `First login ${username}: password_hash sanitized`);

      const cookie = extractCookie(res);
      assert(cookie.startsWith('lucky_session='), `First login ${username}: session cookie received`);

      // Verify /api/auth/me
      const meRes = await request('/api/auth/me', { headers: { Cookie: cookie } });
      assert(meRes.status === 200 && meRes.data.authenticated === true, `${username}: /api/auth/me verified`);

      // Logout
      await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    }

    // -------------------------------------------------------------
    // TEST 2: First login for all 4 VIP Accounts
    // -------------------------------------------------------------
    console.log('\n--- 2. First Login for 4 VIP Accounts ---');
    for (const username of VIP_ACCOUNTS) {
      const testPassword = `VipPass_${username}!`;
      const res = await request('/api/auth/browser', {
        method: 'POST',
        body: { username, password: testPassword },
      });

      assert(res.status === 200, `First login ${username}: HTTP 200`);
      assert(res.data.success === true, `First login ${username}: success === true`);
      assert(res.data.user && res.data.user.username.toLowerCase() === username.toLowerCase(), `First login ${username}: username matches`);
      assert(res.data.user.is_vip === true, `First login ${username}: is_vip === true`);
      assert(res.data.user.is_admin === true, `First login ${username}: is_admin === true`);
      assert(res.data.user.total_uc === 5000, `First login ${username}: total_uc === 5000`);
      assert(res.data.user.free_spins_balance >= 999999, `First login ${username}: unlimited free spins`);
      assert(res.data.user.profile_frame === 'vip_gold', `First login ${username}: profile_frame vip_gold`);
      assert(res.data.user.vip_badge === 'VIP_ADMIN', `First login ${username}: vip_badge VIP_ADMIN`);

      const cookie = extractCookie(res);
      assert(cookie.startsWith('lucky_session='), `First login ${username}: session cookie received`);

      // Verify /api/auth/me
      const meRes = await request('/api/auth/me', { headers: { Cookie: cookie } });
      assert(meRes.status === 200 && meRes.data.authenticated === true, `${username}: /api/auth/me verified`);

      // Logout
      await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    }

    // -------------------------------------------------------------
    // TEST 3: Repeat Login with Correct Password (All 14 Accounts)
    // -------------------------------------------------------------
    console.log('\n--- 3. Repeat Login with Correct Password (All 14 Accounts) ---');
    for (const username of ALL_14_ACCOUNTS) {
      const isVip = VIP_ACCOUNTS.includes(username);
      const testPassword = isVip ? `VipPass_${username}!` : `StdPass_${username}!`;

      const res = await request('/api/auth/browser', {
        method: 'POST',
        body: { username, password: testPassword },
      });

      assert(res.status === 200 && res.data.success === true, `Repeat login ${username}: success`);
      const cookie = extractCookie(res);
      assert(cookie.length > 0, `Repeat login ${username}: cookie valid`);

      // Logout
      await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    }

    // -------------------------------------------------------------
    // TEST 4: Repeat Login with WRONG Password (Must be Rejected 401)
    // -------------------------------------------------------------
    console.log('\n--- 4. Reject Wrong Password (401) ---');
    for (const username of ['Snow24A', 'Frost82B', 'VIP5000X', 'VIP9999K']) {
      const res = await request('/api/auth/browser', {
        method: 'POST',
        body: { username, password: 'IncorrectPassword999!' },
      });

      assert(res.status === 401, `Wrong password for ${username}: HTTP 401`);
      assert(res.data.error === 'Неверный пароль', `Wrong password for ${username}: error message`);
    }

    // -------------------------------------------------------------
    // TEST 5: Case-Insensitivity & Prefix Handling (@username)
    // -------------------------------------------------------------
    console.log('\n--- 5. Case-Insensitivity and @ prefix ---');
    const testCases = [
      { input: 'snow24a', pass: 'StdPass_Snow24A!' },
      { input: '@Snow24A', pass: 'StdPass_Snow24A!' },
      { input: 'vip5000x', pass: 'VipPass_VIP5000X!' },
      { input: '@VIP5000X', pass: 'VipPass_VIP5000X!' },
    ];
    for (const tc of testCases) {
      const res = await request('/api/auth/browser', {
        method: 'POST',
        body: { username: tc.input, password: tc.pass },
      });
      assert(res.status === 200 && res.data.success, `Login with "${tc.input}": HTTP 200`);
      const cookie = extractCookie(res);
      await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
    }

    // -------------------------------------------------------------
    // TEST 6: Validation (Empty nickname, empty password)
    // -------------------------------------------------------------
    console.log('\n--- 6. Input Validation ---');
    const emptyUserRes = await request('/api/auth/browser', {
      method: 'POST',
      body: { username: '', password: 'SomePassword' },
    });
    assert(emptyUserRes.status === 400, 'Empty username rejected with 400');

    const emptyPassRes = await request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'Snow24A', password: '' },
    });
    assert(emptyPassRes.status === 400, 'Empty password rejected with 400');

    console.log(`\n========================================`);
    console.log(`📊 RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    // Terminate Next.js child server
    try {
      process.kill(child.pid);
    } catch {}
    // Kill any remaining node processes on PORT if on Windows
    try {
      spawn('cmd', ['/c', `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${PORT}') do taskkill /f /pid %a`], { stdio: 'ignore' });
    } catch {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
