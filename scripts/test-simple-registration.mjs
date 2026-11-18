/**
 * SIMPLE REGISTRATION & PASSWORDLESS RECOVERY KEY VERIFICATION SUITE
 * Tests:
 * 1. Simple registration with ONLY nickname + registration code (no passwords).
 * 2. Generation and returning of secure Account Recovery Key (LUCKY-REC-XXXX-XXXX).
 * 3. Automatic login and persistent session creation upon registration.
 * 4. Dual VIP accounts automatic VIP + Admin assignment (5000 UC, unlimited spins, 3x inventory).
 * 5. All 12 registration codes (2 VIP + 10 Standard) working exactly once.
 * 6. Rejection of duplicate code reuse.
 * 7. Rejection of duplicate nicknames.
 * 8. Rejection of 13th registration (max 12 slots cap).
 * 9. Rejection of logging in with only nickname.
 * 10. Rejection of logging in using registration codes.
 * 11. Successful login using the Secret Recovery Key.
 * 12. Repeated multi-cycle login/logout with Recovery Key.
 * 13. Admin access for both VIP accounts and 403 Forbidden for Standard accounts.
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

async function runSimpleRegSuite() {
  console.log('🎄 STARTING SIMPLE REGISTRATION & PASSWORDLESS AUDIT 🎄\n');
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
    // 0. Clean reset of .dev_store.json with the 12 registration codes
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

    // ===============================================================
    // 1. SIMPLE REGISTRATION FOR VIP 1 (@vipsanta) WITHOUT PASSWORD
    // ===============================================================
    console.log('--- 1. Simple Registration for VIP 1 (@vipsanta) ---');
    const vip1Client = new HttpClient();
    const regVip1 = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipsanta',
        code: 'VIP5000X',
        action: 'register',
        // Notice: NO PASSWORD OR CONFIRM_PASSWORD SENT!
      },
    });

    assert(regVip1.status === 200 && regVip1.body.success, 'VIP 1 registered without password');
    assert(Boolean(regVip1.body.recoveryKey), 'VIP 1 received generated recoveryKey');
    const vip1RecoveryKey = regVip1.body.recoveryKey;
    assert(
      typeof vip1RecoveryKey === 'string' && vip1RecoveryKey.startsWith('LUCKY-REC-'),
      `Recovery key format valid (${vip1RecoveryKey})`
    );
    assert(Boolean(vip1Client.cookie), 'VIP 1 automatically logged in with session cookie');

    // Verify VIP 1 permissions & inventory
    const vip1Me = await vip1Client.request('/api/auth/me');
    assert(vip1Me.status === 200 && vip1Me.body.authenticated, 'VIP 1 authenticated immediately');
    assert(vip1Me.body.user?.is_vip === true, 'VIP 1 is_vip = true');
    assert(vip1Me.body.user?.is_admin === true, 'VIP 1 is_admin = true');
    assert(vip1Me.body.user?.total_uc === 5000, 'VIP 1 granted 5000 UC starting balance');
    assert(vip1Me.body.user?.profile_frame === 'vip_gold', 'VIP 1 has golden profile frame');
    assert(vip1Me.body.user?.free_spins_balance === 999999, 'VIP 1 has unlimited spins');

    const vip1Prof = await vip1Client.request('/api/user/profile');
    assert(vip1Prof.body.inventory?.length >= 40, `VIP 1 owns all catalog items (${vip1Prof.body.inventory?.length})`);
    assert(vip1Prof.body.inventory?.every((it) => it.quantity === 3), 'VIP 1 owns 3 copies of every catalog item');

    // ===============================================================
    // 2. SIMPLE REGISTRATION FOR VIP 2 (@vipelf) WITHOUT PASSWORD
    // ===============================================================
    console.log('\n--- 2. Simple Registration for VIP 2 (@vipelf) ---');
    const vip2Client = new HttpClient();
    const regVip2 = await vip2Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipelf',
        code: 'VIP2026Z',
        action: 'register',
      },
    });
    assert(regVip2.status === 200 && regVip2.body.success, 'VIP 2 registered without password');
    const vip2RecoveryKey = regVip2.body.recoveryKey;
    assert(Boolean(vip2RecoveryKey), 'VIP 2 received recoveryKey');
    const vip2Me = await vip2Client.request('/api/auth/me');
    assert(vip2Me.body.user?.is_vip === true && vip2Me.body.user?.is_admin === true, 'VIP 2 has VIP + Admin privileges');
    assert(vip2Me.body.user?.total_uc === 5000, 'VIP 2 has 5000 UC');

    // ===============================================================
    // 3. REGISTER REMAINING 10 STANDARD PLAYERS
    // ===============================================================
    console.log('\n--- 3. Register 10 Standard Players (All 12 Slots Used) ---');
    const standardCodes = [
      'Snow24A', 'Frost82B', 'Winter39C', 'Gift51Dx', 'Santa73K',
      'Magic46P', 'Merry28Q', 'North64R', 'Star92Tm', 'Candy35V'
    ];
    const stdRecoveryKeys = {};

    for (let i = 0; i < standardCodes.length; i++) {
      const code = standardCodes[i];
      const username = `player_${i + 1}`;
      const client = new HttpClient();
      const regRes = await client.request('/api/auth/browser', {
        method: 'POST',
        body: { username, code, action: 'register' },
      });
      assert(regRes.status === 200 && regRes.body.success, `Standard player ${username} registered with code ${code}`);
      stdRecoveryKeys[username] = regRes.body.recoveryKey;
      assert(Boolean(regRes.body.recoveryKey), `${username} received recoveryKey`);

      const me = await client.request('/api/auth/me');
      assert(me.body.user?.is_vip === false && me.body.user?.is_admin === false, `${username} is standard (not VIP/Admin)`);
      assert(me.body.user?.total_uc === 0, `${username} starts with 0 UC`);
      assert(me.body.user?.free_spins_balance === 0, `${username} starts with 0 spins`);
    }

    // ===============================================================
    // 4. TEST ATTEMPTING TO REUSE USED CODES
    // ===============================================================
    console.log('\n--- 4. Code Reuse Protection ---');
    const rogueClient = new HttpClient();
    const reuseVipRes = await rogueClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'intruder1', code: 'VIP5000X', action: 'register' },
    });
    assert(reuseVipRes.status === 400 && !reuseVipRes.body.success, 'Reusing used VIP code is rejected (400)');

    const reuseStdRes = await rogueClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'intruder2', code: 'Snow24A', action: 'register' },
    });
    assert(reuseStdRes.status === 400 && !reuseStdRes.body.success, 'Reusing used Standard code is rejected (400)');

    // ===============================================================
    // 5. TEST DUPLICATE NICKNAME
    // ===============================================================
    console.log('\n--- 5. Duplicate Nickname Protection ---');
    const dupRes = await rogueClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'VipSanta', code: 'ExtraCode99', action: 'register' },
    });
    assert(dupRes.status === 400 && !dupRes.body.success, 'Duplicate nickname rejected (case-insensitive)');

    // ===============================================================
    // 6. TEST 13TH REGISTRATION CAP
    // ===============================================================
    console.log('\n--- 6. 13th Registration Cap ---');
    const reg13Res = await rogueClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'player_13', code: 'ExtraCode99', action: 'register' },
    });
    assert(reg13Res.status === 400 && !reg13Res.body.success, '13th registration attempt rejected (all 12 slots occupied)');

    // ===============================================================
    // 7. PASSWORDLESS LOGIN / RECOVERY KEY SECURITY
    // ===============================================================
    console.log('\n--- 7. Passwordless Recovery Key Login Security ---');
    // Logout VIP 1
    await vip1Client.request('/api/auth/logout', { method: 'POST' });
    const meLoggedOut = await vip1Client.request('/api/auth/me');
    assert(!meLoggedOut.body.authenticated, 'VIP 1 successfully logged out');

    // A. Login with ONLY nickname (no key) -> MUST FAIL (400)
    const noKeyLogin = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', action: 'login' },
    });
    assert(noKeyLogin.status === 400, 'Login with ONLY nickname is rejected (400)');

    // B. Attempting to log in using registration code -> MUST BE BLOCKED (400)
    const codeLogin = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', recoveryKey: 'VIP5000X', action: 'login' },
    });
    assert(codeLogin.status === 400, 'Attempting to log in using registration code is rejected (400)');
    assert(
      codeLogin.body.error?.includes('Код регистрации нельзя использовать для входа'),
      'Clear error message explaining registration codes cannot authenticate'
    );

    // C. Attempting to log in with wrong recovery key -> MUST FAIL (401)
    const wrongKeyLogin = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', recoveryKey: 'LUCKY-REC-WRONG-KEY0', action: 'login' },
    });
    assert(wrongKeyLogin.status === 401, 'Login with wrong recovery key rejected (401)');

    // D. Login using the actual valid Recovery Key -> MUST SUCCEED (200)
    const validKeyLogin = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'vipsanta', recoveryKey: vip1RecoveryKey, action: 'login' },
    });
    assert(validKeyLogin.status === 200 && validKeyLogin.body.success, 'Login with Secret Recovery Key succeeds (status 200)');
    assert(Boolean(vip1Client.cookie), 'Session cookie established on recovery login');

    const meAfterRecovery = await vip1Client.request('/api/auth/me');
    assert(meAfterRecovery.body.authenticated, 'VIP 1 authenticated with recovery key');
    assert(meAfterRecovery.body.user?.username === 'vipsanta', 'Authenticated as correct user');
    assert(meAfterRecovery.body.user?.is_vip === true && meAfterRecovery.body.user?.is_admin === true, 'VIP + Admin role intact');
    assert(meAfterRecovery.body.user?.total_uc === 5000, '5000 UC balance completely intact');

    // ===============================================================
    // 8. MULTI-CYCLE REPEATED LOGIN / LOGOUT WITH RECOVERY KEY
    // ===============================================================
    console.log('\n--- 8. Multi-Cycle Repeated Recovery Key Logins ---');
    for (let c = 1; c <= 3; c++) {
      await vip1Client.request('/api/auth/logout', { method: 'POST' });
      const checkOut = await vip1Client.request('/api/auth/me');
      assert(!checkOut.body.authenticated, `Cycle ${c}: Successfully logged out`);

      const reLogin = await vip1Client.request('/api/auth/browser', {
        method: 'POST',
        body: { username: 'vipsanta', recoveryKey: vip1RecoveryKey, action: 'login' },
      });
      assert(reLogin.status === 200 && reLogin.body.success, `Cycle ${c}: Re-login with recovery key succeeds`);

      const checkIn = await vip1Client.request('/api/auth/me');
      assert(checkIn.body.authenticated && checkIn.body.user?.username === 'vipsanta', `Cycle ${c}: Authenticated`);
    }

    // ===============================================================
    // 9. STANDARD PLAYER RECOVERY KEY LOGIN
    // ===============================================================
    console.log('\n--- 9. Standard Player Recovery Key Login ---');
    const stdClient = new HttpClient();
    const p1Key = stdRecoveryKeys['player_1'];

    // Login player_1
    const stdLogin = await stdClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'player_1', recoveryKey: p1Key, action: 'login' },
    });
    assert(stdLogin.status === 200 && stdLogin.body.success, 'player_1 logged in with recovery key');
    const stdMe = await stdClient.request('/api/auth/me');
    assert(stdMe.body.user?.username === 'player_1', 'Authenticated as player_1');
    assert(stdMe.body.user?.total_uc === 0, 'player_1 total_uc = 0');

    // Standard player cannot access admin
    const stdAdminAccess = await stdClient.request('/api/admin/users');
    assert(stdAdminAccess.status === 403, 'Standard player is forbidden from /api/admin/users (403)');

    // VIP 1 can access admin
    const vipAdminAccess = await vip1Client.request('/api/admin/users');
    assert(vipAdminAccess.status === 200 && vipAdminAccess.body.success, 'VIP 1 has full access to /api/admin/users (200)');
    assert(vipAdminAccess.body.users?.length === 12, 'Admin sees all 12 players in dashboard');

    console.log('\n=================================================');
    console.log('🏁 SIMPLE REGISTRATION & RECOVERY AUDIT SUMMARY');
    console.log(`Total Passed: ${passed}`);
    console.log(`Total Failed: ${failed}`);
    console.log('=================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit suite exception:', err);
    process.exit(1);
  }
}

runSimpleRegSuite();
