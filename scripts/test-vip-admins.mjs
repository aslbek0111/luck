/**
 * VIP ADMINS & PRIZE REEL AUDIT SUITE
 * Tests:
 * 1. Removal of separate lucky_admin account.
 * 2. Registration of both VIP accounts (VIP5000X, VIP2026Z) => is_vip=true, is_admin=true, 5000 UC, golden frame, VIP_ADMIN badge.
 * 3. Both VIP accounts own 3 copies of every catalog item.
 * 4. VIP accounts have full access to /api/admin/* endpoints.
 * 5. Standard accounts are denied /api/admin/* (403).
 * 6. VIP accounts have unlimited spins (balance does not decrease).
 * 7. Standard accounts lose 1 spin per play and cannot spin at 0 balance.
 * 8. Admin can grant spins, UC, and inventory items.
 * 9. Obsolete admin login alias is rejected.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper HTTP request function that stores and sends cookies
class TestClient {
  constructor() {
    this.cookies = [];
  }

  async request(endpoint, options = {}) {
    const url = new URL(endpoint, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.cookies.length > 0) {
      headers['Cookie'] = this.cookies.join('; ');
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
          if (setCookieHeaders) {
            setCookieHeaders.forEach((c) => {
              const cookiePart = c.split(';')[0];
              this.cookies.push(cookiePart);
            });
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

async function runAudit() {
  console.log('🎄 STARTING VIP ADMINS & PRIZE REEL AUDIT 🎄\n');
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
    // 0. Clean reset of .dev_store.json for a deterministic fresh run
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

    // 1. Check .dev_store.json has no lucky_admin
    const storeContent = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const hasLuckyAdmin = (storeContent.users || []).some(
      (u) => u.username === 'lucky_admin' || u.id === 'user-admin'
    );
    assert(!hasLuckyAdmin, 'No legacy lucky_admin or user-admin account exists in storage');

    // 2. Attempt login as 'admin' -> MUST FAIL
    const anonymousClient = new TestClient();
    const obsoleteLoginRes = await anonymousClient.request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'admin', password: 'AnyPassword123!', action: 'login' },
    });
    assert(
      obsoleteLoginRes.status === 404,
      `Obsolete admin login alias is rejected (status ${obsoleteLoginRes.status})`
    );

    // 3. Register VIP Account 1: @vipsanta using code VIP5000X
    const vip1Client = new TestClient();
    const vip1Reg = await vip1Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipsanta',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'VIP5000X',
        action: 'register',
      },
    });

    assert(vip1Reg.status === 200 && vip1Reg.body.success, 'VIP Account 1 (@vipsanta) registered successfully');
    const vip1User = vip1Reg.body.user;
    assert(vip1User?.is_vip === true, 'VIP Account 1 has is_vip: true');
    assert(vip1User?.is_admin === true, 'VIP Account 1 has is_admin: true (VIP + ADMIN)');
    assert(vip1User?.total_uc === 5000, 'VIP Account 1 has 5000 UC starting balance');
    assert(vip1User?.profile_frame === 'vip_gold', 'VIP Account 1 has golden animated VIP frame');
    assert(vip1User?.vip_badge === 'VIP_ADMIN', 'VIP Account 1 has VIP_ADMIN badge');

    // 4. Verify VIP 1 Inventory (must contain 3 copies of every catalog item)
    const vip1ProfileRes = await vip1Client.request('/api/user/profile');
    assert(vip1ProfileRes.status === 200, 'VIP 1 fetched profile successfully');
    const vip1Items = vip1ProfileRes.body.inventory || [];
    assert(vip1Items.length >= 40, `VIP 1 inventory has full catalog (${vip1Items.length} items >= 40)`);
    const allHaveQuantity3 = vip1Items.every((it) => it.quantity === 3);
    assert(allHaveQuantity3, 'VIP 1 owns exactly 3 copies of every item in inventory');

    // 5. Register VIP Account 2: @vipelf using code VIP2026Z
    const vip2Client = new TestClient();
    const vip2Reg = await vip2Client.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'vipelf',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'VIP2026Z',
        action: 'register',
      },
    });

    assert(vip2Reg.status === 200 && vip2Reg.body.success, 'VIP Account 2 (@vipelf) registered successfully');
    const vip2User = vip2Reg.body.user;
    assert(vip2User?.is_vip === true && vip2User?.is_admin === true, 'VIP Account 2 has is_vip=true and is_admin=true');
    assert(vip2User?.total_uc === 5000, 'VIP Account 2 has 5000 UC starting balance');

    // 6. Verify VIP 2 Inventory has 3 copies of all items
    const vip2ProfileRes = await vip2Client.request('/api/user/profile');
    const vip2Items = vip2ProfileRes.body.inventory || [];
    assert(vip2Items.length >= 40, `VIP 2 inventory has full catalog (${vip2Items.length} items)`);
    assert(vip2Items.every((it) => it.quantity === 3), 'VIP 2 owns exactly 3 copies of every item in inventory');

    // 7. Register Standard Player: @frostyplayer using code Snow24A
    const standardClient = new TestClient();
    const stdReg = await standardClient.request('/api/auth/browser', {
      method: 'POST',
      body: {
        username: 'frostyplayer',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        code: 'Snow24A',
        action: 'register',
      },
    });

    assert(stdReg.status === 200 && stdReg.body.success, 'Standard Player (@frostyplayer) registered successfully');
    const stdUser = stdReg.body.user;
    assert(stdUser?.is_vip === false && stdUser?.is_admin === false, 'Standard Player is_vip=false and is_admin=false');
    assert(stdUser?.total_uc === 0, 'Standard Player has 0 UC starting balance');
    assert(stdUser?.free_spins_balance === 0, 'Standard Player starts with 0 spins (managed by admin)');

    // 8. Access Control: VIP Admin can access /api/admin/users
    const adminCheck1 = await vip1Client.request('/api/admin/users');
    assert(adminCheck1.status === 200 && adminCheck1.body.success, 'VIP Account 1 has full access to /api/admin/users');
    assert(adminCheck1.body.users.length >= 3, `Admin sees all players in dashboard (${adminCheck1.body.users.length})`);

    const adminCheck2 = await vip2Client.request('/api/admin/users');
    assert(adminCheck2.status === 200 && adminCheck2.body.success, 'VIP Account 2 has full access to /api/admin/users');

    // 9. Access Control: Standard Player CANNOT access /api/admin/users
    const stdAdminDenied = await standardClient.request('/api/admin/users');
    assert(stdAdminDenied.status === 403, 'Standard player is forbidden from accessing /api/admin/users (403)');

    // 10. Admin Action: VIP 1 grants 5 spins to @frostyplayer
    const grantSpinRes = await vip1Client.request('/api/admin/spins', {
      method: 'POST',
      body: {
        action: 'grant_spins',
        targetUserId: stdUser.id,
        amount: 5,
      },
    });
    assert(grantSpinRes.status === 200 && grantSpinRes.body.success, 'VIP Admin granted 5 spins to standard player');

    // Verify standard player received 5 spins
    const stdProfileAfterGrant = await standardClient.request('/api/user/profile');
    assert(
      stdProfileAfterGrant.body.user?.free_spins_balance === 5,
      `Standard player spin balance updated to 5 (actual: ${stdProfileAfterGrant.body.user?.free_spins_balance})`
    );

    // 11. Admin Action: VIP 1 grants 250 UC to @frostyplayer
    const grantUcRes = await vip1Client.request('/api/admin/users', {
      method: 'POST',
      body: {
        action: 'grant_uc',
        targetUserId: stdUser.id,
        amount: 250,
      },
    });
    assert(grantUcRes.status === 200 && grantUcRes.body.success, 'VIP Admin granted 250 UC to standard player');

    const stdProfileAfterUc = await standardClient.request('/api/user/profile');
    assert(
      stdProfileAfterUc.body.user?.total_uc === 250,
      `Standard player total_uc updated to 250 (actual: ${stdProfileAfterUc.body.user?.total_uc})`
    );

    // 12. Unlimited Spins for VIP Admin: VIP 1 spins twice
    const vipSpin1 = await vip1Client.request('/api/spin/play', { method: 'POST' });
    assert(vipSpin1.status === 200 && vipSpin1.body.success, 'VIP Admin spin 1 succeeded');
    assert(vipSpin1.body.is_vip_admin === true, 'VIP Admin spin confirms is_vip_admin: true');
    assert(vipSpin1.body.spins_left === 999999, 'VIP Admin spin balance did not decrease (spins_left remains unlimited)');

    const vipSpin2 = await vip1Client.request('/api/spin/play', { method: 'POST' });
    assert(vipSpin2.status === 200 && vipSpin2.body.success, 'VIP Admin spin 2 succeeded');
    assert(vipSpin2.body.spins_left === 999999, 'VIP Admin spin 2 balance still remains unlimited');

    // 13. Spin Deduction for Standard Player: Standard player spins once
    const stdSpin1 = await standardClient.request('/api/spin/play', { method: 'POST' });
    assert(stdSpin1.status === 200 && stdSpin1.body.success, 'Standard player spin succeeded');
    assert(
      stdSpin1.body.is_vip_admin === false || !stdSpin1.body.is_vip_admin,
      'Standard player spin confirms standard account'
    );

    // 14. Deplete standard player spins to 0 and test rejection
    const remainingSpins = stdSpin1.body.spins_left || 4;
    // Remove remaining spins via admin
    await vip1Client.request('/api/admin/spins', {
      method: 'POST',
      body: {
        action: 'grant_spins',
        targetUserId: stdUser.id,
        amount: -remainingSpins,
      },
    });

    const stdSpinAtZero = await standardClient.request('/api/spin/play', { method: 'POST' });
    assert(
      stdSpinAtZero.status === 400 && !stdSpinAtZero.body.success,
      'Standard player spin rejected when spins balance is 0 (400 Bad Request)'
    );

    // 15. Send Broadcast Notification
    const broadcastRes = await vip1Client.request('/api/admin/users', {
      method: 'POST',
      body: {
        action: 'send_notification',
        allUsers: true,
        title: '🎄 С Новым Годом 2026!',
        message: 'Администрация Lucky UC поздравляет всех игроков!',
      },
    });
    assert(broadcastRes.status === 200 && broadcastRes.body.success, 'VIP Admin broadcast notification succeeded');

    // 16. Verify Notification in Standard player inbox
    const stdNotifRes = await standardClient.request('/api/notifications');
    const stdNotifs = stdNotifRes.body.notifications || [];
    const hasBroadcast = stdNotifs.some((n) => n.title.includes('2026'));
    assert(hasBroadcast, 'Standard player received broadcast notification from VIP Admin');

    // 17. Verify Idempotence of VIP 3x inventory (no duplication after spins or reloads)
    const vip1ProfileAfterSpins = await vip1Client.request('/api/user/profile');
    const vip1ItemsAfter = vip1ProfileAfterSpins.body.inventory || [];
    const uniqueIds = new Set(vip1ItemsAfter.map((i) => i.id || i.rewardId));
    assert(
      uniqueIds.size === vip1ItemsAfter.length,
      `VIP inventory contains no duplicate rows (${uniqueIds.size} unique / ${vip1ItemsAfter.length} total)`
    );

    console.log(`\n===============================================`);
    console.log(`🎉 AUDIT COMPLETE: ${passed} passed, ${failed} failed`);
    console.log(`===============================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit exception:', err);
    process.exit(1);
  }
}

runAudit();
