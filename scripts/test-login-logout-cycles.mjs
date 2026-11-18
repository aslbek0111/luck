/**
 * MULTI-CYCLE LOGIN / LOGOUT VERIFICATION SUITE
 */
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

class HttpClient {
  constructor() {
    this.cookie = '';
  }

  setCookieFromResponse(res) {
    const rawSetCookie = res.headers['set-cookie'];
    if (!rawSetCookie) return;
    const cookieHeaders = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    for (const h of cookieHeaders) {
      const parts = h.split(';').map((p) => p.trim());
      const [nameVal] = parts;
      const isExpired = parts.some(
        (p) => p.toLowerCase().includes('max-age=0') || p.toLowerCase().includes('expires=thu, 01 jan 1970')
      );
      if (nameVal.startsWith('lucky_session=')) {
        if (isExpired || nameVal === 'lucky_session=') {
          this.cookie = '';
        } else {
          this.cookie = nameVal;
        }
      }
    }
  }

  async request(endpoint, options = {}) {
    const url = new URL(endpoint, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.customCookie !== undefined) {
      if (options.customCookie) headers['Cookie'] = options.customCookie;
    } else if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    const body = options.body ? JSON.stringify(options.body) : null;

    return new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers,
        },
        (res) => {
          let data = '';
          this.setCookieFromResponse(res);

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch {
              json = data;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              rawSetCookie: res.headers['set-cookie'],
            });
          });
        }
      );

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

async function runCyclesSuite() {
  console.log('🎄 STARTING RECURRING LOGIN / LOGOUT MULTI-CYCLE AUDIT 🎄\n');
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

  try {
    const storePath = path.resolve(process.cwd(), '.dev_store.json');
    const freshCodes = [
      { code: 'Snow24A', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Frost82B', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Winter39C', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Gift51Dx', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Santa73K', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Magic46P', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Merry28Q', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'North64R', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Star92Tm', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'Candy35V', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'VIP5000X', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'VIP2026Z', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
    ];
    fs.writeFileSync(
      storePath,
      JSON.stringify(
        {
          users: [],
          inventory: {},
          events: [],
          giftsHistory: [],
          registrationCodes: freshCodes,
          notifications: [],
          auditLogs: [],
          spinsHistory: [],
          systemConfig: { spin_wheel_enabled: true, max_player_slots: 12 },
        },
        null,
        2
      )
    );

    console.log('--- Phase 1: Initial Registrations ---');

    // Register VIP 1
    const vip1Client = new HttpClient();
    const regVip1 = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipsanta',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'VIP5000X',
        action: 'register',
      },
    });
    assert(regVip1.status === 200 && regVip1.body.success, 'VIP 1 (@vipsanta) registered');
    assert(Boolean(vip1Client.cookie), 'VIP 1 received session cookie');

    // Register VIP 2
    const vip2Client = new HttpClient();
    const regVip2 = await vip2Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipelf',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'VIP2026Z',
        action: 'register',
      },
    });
    assert(regVip2.status === 200 && regVip2.body.success, 'VIP 2 (@vipelf) registered');

    // Register Standard Player
    const standardClient = new HttpClient();
    const regStd = await standardClient.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'frostyplayer',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'Snow24A',
        action: 'register',
      },
    });
    assert(regStd.status === 200 && regStd.body.success, 'Standard Player (@frostyplayer) registered');

    console.log('\n--- Phase 2: Multi-Cycle Login/Logout for VIP 1 (@vipsanta) ---');
    const client1 = new HttpClient();

    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n  [VIP 1 - Cycle ${cycle}/3]`);

      // A. Login
      const loginRes = await client1.request('/api/auth/browser', {
        method: 'POST',
        body: { username: 'vipsanta', password: 'Password123!', action: 'login' },
      });
      assert(loginRes.status === 200 && loginRes.body.success, `Cycle ${cycle}: Login succeeds (status 200)`);
      assert(Boolean(client1.cookie), `Cycle ${cycle}: Session cookie received`);
      const setCookieStr = Array.isArray(loginRes.rawSetCookie) ? loginRes.rawSetCookie.join('; ') : loginRes.rawSetCookie || '';
      assert(setCookieStr.toLowerCase().includes('httponly'), `Cycle ${cycle}: Session cookie has HttpOnly`);
      assert(setCookieStr.toLowerCase().includes('samesite=lax'), `Cycle ${cycle}: Session cookie has SameSite=lax`);

      // B. Verify authenticated via /api/auth/me
      const meRes = await client1.request('/api/auth/me');
      assert(meRes.status === 200 && meRes.body.authenticated, `Cycle ${cycle}: /api/auth/me returns authenticated: true`);
      assert(meRes.body.user?.username === 'vipsanta', `Cycle ${cycle}: Correct user returned (@vipsanta)`);
      assert(meRes.body.user?.is_vip === true && meRes.body.user?.is_admin === true, `Cycle ${cycle}: VIP + Admin flags preserved`);
      assert(meRes.body.user?.total_uc === 5000, `Cycle ${cycle}: 5000 UC balance intact`);

      // C. Verify profile and inventory intact
      const profRes = await client1.request('/api/user/profile');
      assert(profRes.status === 200 && profRes.body.success, `Cycle ${cycle}: /api/user/profile returns 200`);
      assert(profRes.body.inventory?.length >= 40, `Cycle ${cycle}: VIP inventory catalog intact (${profRes.body.inventory?.length} items)`);

      // D. Logout
      const logoutRes = await client1.request('/api/auth/logout', { method: 'POST' });
      assert(logoutRes.status === 200 && logoutRes.body.success, `Cycle ${cycle}: /api/auth/logout succeeds`);
      const logoutCookieStr = Array.isArray(logoutRes.rawSetCookie) ? logoutRes.rawSetCookie.join('; ') : logoutRes.rawSetCookie || '';
      assert(
        logoutCookieStr.toLowerCase().includes('expires=thu, 01 jan 1970') ||
        logoutCookieStr.toLowerCase().includes('max-age=0'),
        `Cycle ${cycle}: Logout header expires cookie with past date or Max-Age=0`
      );
      assert(logoutCookieStr.toLowerCase().includes('httponly'), `Cycle ${cycle}: Logout deletion header preserves HttpOnly`);
      assert(logoutCookieStr.toLowerCase().includes('samesite=lax'), `Cycle ${cycle}: Logout deletion header preserves SameSite=lax`);

      // E. Verify unauthenticated after logout
      const meAfterLogout = await client1.request('/api/auth/me');
      assert(meAfterLogout.status === 200 && !meAfterLogout.body.authenticated, `Cycle ${cycle}: /api/auth/me returns authenticated: false after logout`);

      const profAfterLogout = await client1.request('/api/user/profile');
      assert(profAfterLogout.status === 401, `Cycle ${cycle}: /api/user/profile returns 401 after logout`);
    }

    console.log('\n--- Phase 3: Multi-Cycle Login/Logout for VIP 2 (@vipelf) ---');
    const client2 = new HttpClient();

    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n  [VIP 2 - Cycle ${cycle}/3]`);

      const loginRes = await client2.request('/api/auth/browser', {
        method: 'POST',
        body: { username: 'vipelf', password: 'Password123!', action: 'login' },
      });
      assert(loginRes.status === 200 && loginRes.body.success, `VIP 2 Cycle ${cycle}: Login succeeds`);

      const meRes = await client2.request('/api/auth/me');
      assert(meRes.body.user?.username === 'vipelf', `VIP 2 Cycle ${cycle}: /api/auth/me returns @vipelf`);
      assert(meRes.body.user?.is_vip === true && meRes.body.user?.is_admin === true, `VIP 2 Cycle ${cycle}: VIP + Admin flags intact`);

      const logoutRes = await client2.request('/api/auth/logout', { method: 'POST' });
      assert(logoutRes.status === 200, `VIP 2 Cycle ${cycle}: Logout succeeds`);

      const meAfter = await client2.request('/api/auth/me');
      assert(!meAfter.body.authenticated, `VIP 2 Cycle ${cycle}: Unauthenticated after logout`);
    }

    console.log('\n--- Phase 4: Multi-Cycle Login/Logout for Standard Player (@frostyplayer) ---');
    const clientStd = new HttpClient();

    const adminClient = new HttpClient();
    await adminClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', password: 'Password123!', action: 'login' },
    });
    const usersListRes = await adminClient.request('/api/admin/users');
    const frostyId = usersListRes.body.users?.find((u) => u.username === 'frostyplayer')?.id;
    await adminClient.request('/api/admin/spins', {
      method: 'POST',
      body: { action: 'grant_spins', targetUserId: frostyId, amount: 10 },
    });
    await adminClient.request('/api/auth/logout', { method: 'POST' });

    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n  [Standard - Cycle ${cycle}/3]`);

      const loginRes = await clientStd.request('/api/auth/browser', {
        method: 'POST',
        body: { username: 'frostyplayer', password: 'Password123!', action: 'login' },
      });
      assert(loginRes.status === 200 && loginRes.body.success, `Standard Cycle ${cycle}: Login succeeds`);

      const meRes = await clientStd.request('/api/auth/me');
      assert(meRes.body.user?.username === 'frostyplayer', `Standard Cycle ${cycle}: /api/auth/me returns @frostyplayer`);
      assert(meRes.body.user?.is_vip === false && meRes.body.user?.is_admin === false, `Standard Cycle ${cycle}: Standard role intact`);
      assert(meRes.body.user?.free_spins_balance === 10, `Standard Cycle ${cycle}: 10 spins balance intact`);

      const logoutRes = await clientStd.request('/api/auth/logout', { method: 'POST' });
      assert(logoutRes.status === 200, `Standard Cycle ${cycle}: Logout succeeds`);

      const meAfter = await clientStd.request('/api/auth/me');
      assert(!meAfter.body.authenticated, `Standard Cycle ${cycle}: Unauthenticated after logout`);
    }

    console.log('\n--- Phase 5: Multi-Cookie and Header Resilience ---');
    const edgeClient = new HttpClient();
    const edgeLogin = await edgeClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', password: 'Password123!', action: 'login' },
    });
    const validCookieStr = edgeClient.cookie;

    // Test 1: Empty cookie before valid cookie (lucky_session=; lucky_session=<valid>)
    const multiCookieHeader1 = `lucky_session=; ${validCookieStr}`;
    const resMulti1 = await edgeClient.request('/api/auth/me', { customCookie: multiCookieHeader1 });
    assert(
      resMulti1.status === 200 && resMulti1.body.authenticated && resMulti1.body.user?.username === 'vipsanta',
      'getSessionUser resolves valid session when empty cookie precedes valid cookie'
    );

    // Test 2: Valid cookie before empty cookie (lucky_session=<valid>; lucky_session=)
    const multiCookieHeader2 = `${validCookieStr}; lucky_session=`;
    const resMulti2 = await edgeClient.request('/api/auth/me', { customCookie: multiCookieHeader2 });
    assert(
      resMulti2.status === 200 && resMulti2.body.authenticated && resMulti2.body.user?.username === 'vipsanta',
      'getSessionUser resolves valid session when valid cookie precedes empty cookie'
    );

    // Test 3: Cache-Control header on auth endpoints
    const cacheMe = resMulti1.headers['cache-control'] || '';
    assert(cacheMe.includes('no-store'), '/api/auth/me returns Cache-Control: no-store');

    const cacheLogin = edgeLogin.headers['cache-control'] || '';
    assert(cacheLogin.includes('no-store'), '/api/auth/browser returns Cache-Control: no-store');

    const logoutEdge = await edgeClient.request('/api/auth/logout', { method: 'POST' });
    const cacheLogout = logoutEdge.headers['cache-control'] || '';
    assert(cacheLogout.includes('no-store'), '/api/auth/logout returns Cache-Control: no-store');

    const profCheck = await edgeClient.request('/api/user/profile');
    const cacheProf = profCheck.headers['cache-control'] || '';
    assert(cacheProf.includes('no-store'), '/api/user/profile returns Cache-Control: no-store');

    console.log('\n========================================');
    console.log('🏁 RECURRING LOGIN AUDIT SUMMARY');
    console.log(`Total Passed: ${passed}`);
    console.log(`Total Failed: ${failed}`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit suite exception:', err);
    process.exit(1);
  }
}

runCyclesSuite();
