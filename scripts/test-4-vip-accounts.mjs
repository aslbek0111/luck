/**
 * 4 VIP ACCOUNTS & 14-SLOT SYSTEM VERIFICATION SUITE
 * Tests:
 * 1. Simplified registration of 4 distinct VIP accounts using codes VIP5000X, VIP2026Z, VIP7777M, VIP9999K.
 * 2. Identical VIP + Admin settings: is_vip=true, is_admin=true, 5000 UC, golden frame, VIP_ADMIN badge.
 * 3. Inventory seeding: Exactly 3 copies of every catalog item for all 4 VIP accounts.
 * 4. Registration of 10 standard players using remaining codes.
 * 5. Rejection of 15th registration (14 slots cap).
 * 6. Single-use code protection across all 14 codes.
 * 7. Admin access verified for all 4 VIP accounts; forbidden for standard players (403).
 * 8. Unlimited spins for all 4 VIP accounts (balance does not decrement).
 * 9. Passwordless recovery key re-login persistence for VIP and standard players.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

class HttpClient {
  constructor() {
    this.cookie = null;
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
          const setCookieHeaders = res.headers['set-cookie'];
          if (setCookieHeaders && setCookieHeaders.length > 0) {
            this.rawSetCookie = setCookieHeaders;
            for (const c of setCookieHeaders) {
              const part = c.split(';')[0];
              if (part.startsWith('lucky_session=')) {
                const val = part.split('=')[1];
                if (val && val.length > 0) {
                  this.cookie = part;
                } else if (val === '') {
                  this.cookie = null;
                }
              }
            }
          }

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
              rawSetCookie: this.rawSetCookie,
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

async function runTest() {
  console.log('🎄 STARTING 4 VIP ACCOUNTS & 14-SLOT SYSTEM AUDIT 🎄\n');
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
    // 0. Deterministic clean setup of .dev_store.json with 10 standard + 4 VIP codes
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
      { code: 'VIP7777M', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
      { code: 'VIP9999K', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
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
          systemConfig: { spin_wheel_enabled: true, max_player_slots: 14 },
        },
        null,
        2
      )
    );

    const vipAccounts = [
      { username: 'vipsanta', code: 'VIP5000X', client: new HttpClient(), label: 'VIP 1' },
      { username: 'vipelf', code: 'VIP2026Z', client: new HttpClient(), label: 'VIP 2' },
      { username: 'vipdeer', code: 'VIP7777M', client: new HttpClient(), label: 'VIP 3' },
      { username: 'vipsnowman', code: 'VIP9999K', client: new HttpClient(), label: 'VIP 4' },
    ];

    console.log('--- Phase 1: Simple Registration for All 4 VIP Accounts ---');
    for (const vip of vipAccounts) {
      console.log(`\n  Registering ${vip.label} (@${vip.username}) with code ${vip.code}...`);
      const regRes = await vip.client.request('/api/auth/browser', {
        method: 'POST',
        body: { username: vip.username, code: vip.code, action: 'register' },
      });
      assert(regRes.status === 200 && regRes.body.success, `${vip.label} registered without password`);
      assert(Boolean(regRes.body.recoveryKey), `${vip.label} received Secret Recovery Key`);
      assert(regRes.body.recoveryKey.startsWith('LUCKY-REC-'), `${vip.label} recovery key format valid (${regRes.body.recoveryKey})`);
      vip.recoveryKey = regRes.body.recoveryKey;

      assert(Boolean(vip.client.cookie), `${vip.label} automatically logged in with session cookie`);

      // Verify profile and identical VIP permissions
      const meRes = await vip.client.request('/api/auth/me');
      assert(meRes.status === 200 && meRes.body.authenticated, `${vip.label} authenticated via /api/auth/me`);
      assert(meRes.body.user?.is_vip === true, `${vip.label} is_vip === true`);
      assert(meRes.body.user?.is_admin === true, `${vip.label} is_admin === true`);
      assert(meRes.body.user?.total_uc === 5000, `${vip.label} total_uc === 5000`);
      assert(meRes.body.user?.profile_frame === 'vip_gold', `${vip.label} profile_frame === 'vip_gold'`);
      assert(meRes.body.user?.vip_badge === 'VIP_ADMIN', `${vip.label} vip_badge === 'VIP_ADMIN'`);

      // Verify inventory has 3 copies of every catalog item
      const profRes = await vip.client.request('/api/user/profile');
      assert(profRes.status === 200 && profRes.body.inventory?.length >= 40, `${vip.label} inventory catalog complete (${profRes.body.inventory?.length} items)`);
      const allThreeCopies = profRes.body.inventory?.every((it) => it.quantity === 3);
      assert(allThreeCopies, `${vip.label} owns exactly 3 copies of every catalog item`);

      // Verify /api/admin/* access
      const adminUsersRes = await vip.client.request('/api/admin/users');
      assert(adminUsersRes.status === 200 && adminUsersRes.body.success, `${vip.label} has full access to /api/admin/users`);

      // Verify unlimited spins
      const spinRes1 = await vip.client.request('/api/spin/play', { method: 'POST' });
      assert(spinRes1.status === 200 && spinRes1.body.success, `${vip.label} spin 1 succeeded`);
      assert(spinRes1.body.is_vip_admin === true, `${vip.label} confirmed as VIP Admin on spin reel`);
      assert(spinRes1.body.spins_left >= 999999, `${vip.label} spin balance remains unlimited`);
    }

    console.log('\n--- Phase 2: Register All 10 Standard Players (Slots 5 to 14) ---');
    const standardCodes = [
      'Snow24A', 'Frost82B', 'Winter39C', 'Gift51Dx', 'Santa73K',
      'Magic46P', 'Merry28Q', 'North64R', 'Star92Tm', 'Candy35V'
    ];

    const standardPlayers = [];
    for (let i = 0; i < standardCodes.length; i++) {
      const code = standardCodes[i];
      const username = `player_${i + 1}`;
      const client = new HttpClient();
      const reg = await client.request('/api/auth/browser', {
        method: 'POST',
        body: { username, code, action: 'register' },
      });
      assert(reg.status === 200 && reg.body.success, `Standard player ${username} registered with code ${code}`);
      assert(reg.body.user?.is_vip === false, `${username} is_vip === false`);
      assert(reg.body.user?.is_admin === false, `${username} is_admin === false`);
      assert(reg.body.user?.total_uc === 0, `${username} total_uc === 0`);
      assert(reg.body.user?.free_spins_balance === 0, `${username} free_spins_balance === 0`);

      // Verify standard player is forbidden from admin panel
      const adminAttempt = await client.request('/api/admin/users');
      assert(adminAttempt.status === 403, `${username} forbidden from /api/admin/users (403)`);

      standardPlayers.push({ username, code, recoveryKey: reg.body.recoveryKey, client });
    }

    console.log('\n--- Phase 3: Total Accounts & 15th Slot Cap Check ---');
    // Check admin dashboard sees all 14 players (4 VIP + 10 Standard)
    const adminCheck = await vipAccounts[0].client.request('/api/admin/users');
    assert(adminCheck.body.users?.length === 14, `Total registered players in system is exactly 14 (actual: ${adminCheck.body.users?.length})`);

    // Verify 15th registration attempt is rejected
    const client15 = new HttpClient();
    const reg15 = await client15.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'intruder15', code: 'Snow24A', action: 'register' },
    });
    assert(reg15.status === 400, `15th registration is rejected (status ${reg15.status})`);

    console.log('\n--- Phase 4: Code Reuse Protection ---');
    for (const vip of vipAccounts) {
      const reuseAttempt = await client15.request('/api/auth/browser', {
        method: 'POST',
        body: { username: `fake_${vip.username}`, code: vip.code, action: 'register' },
      });
      assert(reuseAttempt.status === 400, `Reusing ${vip.label} code (${vip.code}) is rejected (400)`);
    }

    console.log('\n--- Phase 5: VIP Admin Player Management ---');
    // VIP 3 (@vipdeer) grants 10 spins and VIP 4 grants 300 UC to player_1
    const p1 = standardPlayers[0];
    const p1UserId = adminCheck.body.users.find((u) => u.username === p1.username)?.id;

    const grantSpins = await vipAccounts[2].client.request('/api/admin/spins', {
      method: 'POST',
      body: { action: 'grant_spins', targetUserId: p1UserId, amount: 10 },
    });
    assert(grantSpins.status === 200 && grantSpins.body.success, 'VIP 3 successfully granted 10 spins to standard player');

    const grantUc = await vipAccounts[3].client.request('/api/admin/users', {
      method: 'POST',
      body: { action: 'grant_uc', targetUserId: p1UserId, amount: 300 },
    });
    assert(grantUc.status === 200 && grantUc.body.success, 'VIP 4 successfully granted 300 UC to standard player');

    // Standard player plays a spin using granted spin
    const p1Spin = await p1.client.request('/api/spin/play', { method: 'POST' });
    assert(p1Spin.status === 200 && p1Spin.body.success, 'Standard player spin succeeded with granted spins');
    assert(p1Spin.body.spins_left === 9, 'Standard player spin decremented balance to 9');

    console.log('\n--- Phase 6: Passwordless Re-Authentication for All VIP Accounts ---');
    for (const vip of vipAccounts) {
      // Logout
      const logoutRes = await vip.client.request('/api/auth/logout', { method: 'POST' });
      assert(logoutRes.status === 200 && logoutRes.body.success, `${vip.label} logged out`);

      // Unauthenticated check
      const unauthCheck = await vip.client.request('/api/auth/me');
      assert(!unauthCheck.body.authenticated, `${vip.label} unauthenticated after logout`);

      // Reject login with registration code
      const codeLoginAttempt = await vip.client.request('/api/auth/browser', {
        method: 'POST',
        body: { username: vip.username, recoveryKey: vip.code, action: 'login' },
      });
      assert(codeLoginAttempt.status === 400, `${vip.label} login with registration code rejected (400)`);

      // Login with Secret Recovery Key
      const loginRes = await vip.client.request('/api/auth/browser', {
        method: 'POST',
        body: { username: vip.username, recoveryKey: vip.recoveryKey, action: 'login' },
      });
      assert(loginRes.status === 200 && loginRes.body.success, `${vip.label} re-login with recovery key succeeded`);

      // Re-authenticated check
      const reauthCheck = await vip.client.request('/api/auth/me');
      assert(reauthCheck.body.authenticated && reauthCheck.body.user?.username === vip.username, `${vip.label} re-authenticated as @${vip.username}`);
      assert(reauthCheck.body.user?.is_vip === true && reauthCheck.body.user?.is_admin === true, `${vip.label} VIP + Admin flags fully intact`);
      assert(reauthCheck.body.user?.total_uc >= 5000, `${vip.label} 5000+ UC balance intact (${reauthCheck.body.user?.total_uc})`);
    }

    console.log('\n=================================================');
    console.log('🏁 4 VIP ACCOUNTS & 14-SLOT AUDIT SUMMARY');
    console.log(`Total Passed: ${passed}`);
    console.log(`Total Failed: ${failed}`);
    console.log('=================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during audit:', err);
    process.exit(1);
  }
}

runTest();
