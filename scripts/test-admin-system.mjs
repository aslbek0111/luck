import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';

const PORT = 3020;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const ADMIN_CREDENTIALS = [
  { username: 'admin', password: 'Adm#9xK!2026_Sec' },
  { username: 'adminvip', password: 'VipAdm#7qZ!2026_Mst' },
  { username: 'lucky_admin', password: 'LckAdm#8wR!2026_Prm' },
];

const VIP_CREDENTIALS = [
  { username: 'VIP5000X', password: 'VipPass_VIP5000X!' },
  { username: 'VIP2026Z', password: 'VipPass_VIP2026Z!' },
  { username: 'VIP7777M', password: 'VipPass_VIP7777M!' },
  { username: 'VIP9999K', password: 'VipPass_VIP9999K!' },
];

function rawRequest(endpoint, { method = 'GET', body = null, cookie = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      const setCookies = res.headers['set-cookie'] || [];
      const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, cookie: cookieStr, json, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await rawRequest('/api/feed');
      if (res.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Server did not start in time');
}

async function runTests() {
  console.log(`Starting Next.js on port ${PORT}...`);
  const server = spawn('cmd', ['/c', `npx next start -p ${PORT}`], {
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_STORE: 'true' },
    stdio: 'ignore'
  });

  try {
    await waitForServer();
    console.log(`Server is ready on ${BASE_URL}!\n`);

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
      return async () => {
        try {
          await fn();
          console.log(` PASS: ${name}`);
          passed++;
        } catch (err) {
          console.error(` FAIL: ${name}`, err.message);
          failed++;
        }
      };
    }

    const tests = [];

    // --- TEST EACH ADMIN ACCOUNT ---
    for (const cred of ADMIN_CREDENTIALS) {
      tests.push(test(`ADMIN [${cred.username}] - Rejects wrong password`, async () => {
        const res = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: cred.username, password: 'WrongPassword999!' }
        });
        assert.strictEqual(res.status, 401, 'Should return 401 for wrong password');
        assert.strictEqual(res.json.success, false);
      }));

      tests.push(test(`ADMIN [${cred.username}] - Successful login via Nickname + Password only`, async () => {
        const res = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: cred.username, password: cred.password }
        });
        assert.strictEqual(res.status, 200, 'Should return 200 on correct login');
        assert.strictEqual(res.json.success, true);
        assert.strictEqual(res.json.user.username.toLowerCase(), cred.username.toLowerCase());
        assert.strictEqual(res.json.user.is_admin, true, 'User must have is_admin: true');
        assert.strictEqual(res.json.user.is_vip, false, 'ADMIN must not be VIP');
        assert.ok(res.cookie.includes('lucky_session'), 'Must receive lucky_session cookie');
      }));

      tests.push(test(`ADMIN [${cred.username}] - Profile API returns role and unlimited balances`, async () => {
        const loginRes = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: cred.username, password: cred.password }
        });
        const profileRes = await rawRequest('/api/user/profile', {
          cookie: loginRes.cookie
        });
        assert.strictEqual(profileRes.status, 200);
        assert.strictEqual(profileRes.json.user.is_admin, true);
        assert.strictEqual(profileRes.json.user.is_vip, false);
        assert.strictEqual(profileRes.json.stats.coinsBalance >= 999999, true, 'Unlimited coins balance');
        assert.strictEqual(profileRes.json.stats.pointsBalance >= 999999, true, 'Unlimited points balance');
        assert.strictEqual(profileRes.json.stats.freeSpins >= 999999, true, 'Unlimited spins balance');
        assert.strictEqual(profileRes.json.stats.totalUc >= 5000, true, 'Admin UC >= 5000');
      }));

      tests.push(test(`ADMIN [${cred.username}] - Admin Dashboard Access /api/admin/users`, async () => {
        const loginRes = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: cred.username, password: cred.password }
        });
        const res = await rawRequest('/api/admin/users', { cookie: loginRes.cookie });
        assert.strictEqual(res.status, 200, 'Admin can access /api/admin/users');
        assert.strictEqual(res.json.success, true);
        assert.strictEqual(Array.isArray(res.json.users), true);
        assert.ok(res.json.users.length >= 14, 'Should list registered users');
      }));

      tests.push(test(`ADMIN [${cred.username}] - Admin Functions /api/admin/spins & /api/admin/logs`, async () => {
        const loginRes = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: cred.username, password: cred.password }
        });
        // Test /api/admin/spins GET
        const spinsRes = await rawRequest('/api/admin/spins', { cookie: loginRes.cookie });
        assert.strictEqual(spinsRes.status, 200);
        assert.strictEqual(spinsRes.json.success, true);

        // Test /api/admin/wheel GET
        const wheelRes = await rawRequest('/api/admin/wheel', { cookie: loginRes.cookie });
        assert.strictEqual(wheelRes.status, 200);
        assert.strictEqual(wheelRes.json.success, true);

        // Test /api/admin/logs GET
        const logsRes = await rawRequest('/api/admin/logs', { cookie: loginRes.cookie });
        assert.strictEqual(logsRes.status, 200);
        assert.strictEqual(logsRes.json.success, true);
      }));
    }

    // --- TEST STANDARD ACCOUNT ACCESS DENIAL ---
    tests.push(test('STANDARD account (Snow24A) - Denied Admin Dashboard access (403)', async () => {
      const loginRes = await rawRequest('/api/auth/browser', {
        method: 'POST',
        body: { username: 'Snow24A', password: 'StdPass_Snow24A!' }
      });
      // In case password was not set, try default or set it
      let cookie = loginRes.cookie;
      if (loginRes.status !== 200) {
        const firstLogin = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: 'Snow24A', password: 'TestStandardPass123!' }
        });
        cookie = firstLogin.cookie;
      }
      assert.ok(cookie, 'Must have standard session cookie');

      const adminRes = await rawRequest('/api/admin/users', { cookie });
      assert.strictEqual(adminRes.status, 403, 'Standard user must receive 403 Forbidden on admin endpoint');
    }));

    // --- TEST VIP ACCOUNTS PRESERVATION ---
    for (const vcred of VIP_CREDENTIALS) {
      tests.push(test(`VIP [${vcred.username}] - Preserved VIP status and credentials`, async () => {
        const loginRes = await rawRequest('/api/auth/browser', {
          method: 'POST',
          body: { username: vcred.username, password: vcred.password }
        });
        assert.strictEqual(loginRes.status, 200);
        assert.strictEqual(loginRes.json.user.is_vip, true, 'VIP status preserved');
        assert.strictEqual(loginRes.json.user.total_uc >= 5000, true);
      }));
    }

    for (const t of tests) {
      await t();
    }

    console.log(`\n========================================`);
    console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } finally {
    server.kill();
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
