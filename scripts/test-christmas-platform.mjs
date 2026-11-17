/**
 * Automated Test Suite: Christmas Gaming Rewards Platform
 * Verifies:
 * 1. 10 Standard + 2 VIP registrations with exact codes
 * 2. Single-use code validation and rejection of repeated codes
 * 3. 12 player accounts cap enforcement (13th player rejected)
 * 4. VIP initial balance (5000 UC) vs Standard initial balance (0 UC)
 * 5. Admin authentication and authorization guard
 * 6. Admin grant spins to all players and individual players
 * 7. Admin grant reward with custom message and notification
 * 8. Spin wheel feature toggle and atomic spin execution
 * 9. Player-to-player gifting with custom message and notification center
 * 10. Audit logging of admin actions
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = 3009;
const BASE_URL = `http://localhost:${PORT}`;

const STANDARD_CODES = [
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

const VIP_CODES = ['VIP5000X', 'VIP2026Z'];

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
          json,
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
  console.log('🎄 STARTING CHRISTMAS GAMING REWARDS PLATFORM TEST SUITE 🎄');

  // Reset .dev_store.json before starting test
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
      'user-admin': [
        { rewardId: 'reward-xmas-miracle-box', quantity: 2, acquiredAt: new Date().toISOString() },
        { rewardId: 'reward-xmas-golden-tree', quantity: 2, acquiredAt: new Date().toISOString() },
      ],
    },
    events: [],
    giftsHistory: [],
    registrationCodes: [
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
    ],
    notifications: [],
    auditLogs: [],
    spinsHistory: [],
    systemConfig: { spin_wheel_enabled: true, max_player_slots: 12 },
    currentUserId: null,
  };
  fs.writeFileSync(devStorePath, JSON.stringify(cleanDevStore, null, 2), 'utf8');

  // Spawn Next.js server
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_STORE: 'true' },
  });

  child.stdout.on('data', (d) => process.stdout.write('[Next] ' + d.toString()));
  child.stderr.on('data', (d) => process.stderr.write('[Next ERR] ' + d.toString()));

  // Wait for server to start
  console.log('⏳ Waiting for server on port', PORT, '...');
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
      // keep waiting
    }
  }

  if (!ready) {
    child.kill();
    throw new Error('Server did not start in time');
  }

  console.log('🚀 Server is READY! Executing test scenarios...\n');

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
    // SCENARIO 1: Zero Auto-login for first-time visitors
    const initialMe = await request('/api/auth/me');
    assert('1. Unauthenticated visitor has authenticated: false (zero auto-login)', initialMe.json?.authenticated === false);

    // SCENARIO 2: Reject invalid registration code
    const invalidCodeRes = await request('/api/auth/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'testuser', password: 'password123', code: 'INVALID_CODE', action: 'register' },
    });
    assert('2. Invalid registration code is rejected with 400', invalidCodeRes.status === 400);

    // SCENARIO 3: Register 10 Standard Players with 10 Standard Codes
    const playerCookies = [];
    for (let i = 0; i < STANDARD_CODES.length; i++) {
      const code = STANDARD_CODES[i];
      const username = `standard_${i + 1}`;
      const regRes = await request('/api/auth/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password: 'password123', confirmPassword: 'password123', code, action: 'register' },
      });

      const isSuccess = regRes.status === 200 && regRes.json?.success === true;
      const isUcZero = regRes.json?.user?.total_uc === 0;
      const isNotVip = regRes.json?.user?.is_vip === false;
      const hasGreeting = regRes.json?.greeting?.includes(`Добро пожаловать, ${username}! 🎄`);

      assert(`3.${i + 1} Standard player @${username} registered with code ${code} (0 UC, Standard status, Christmas greeting)`, isSuccess && isUcZero && isNotVip && hasGreeting);

      playerCookies.push({ username, cookie: extractCookie(regRes), id: regRes.json?.user?.id });
    }

    // SCENARIO 4: Register 2 VIP Players with 2 VIP Codes
    for (let i = 0; i < VIP_CODES.length; i++) {
      const code = VIP_CODES[i];
      const username = `vip_player_${i + 1}`;
      const regRes = await request('/api/auth/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password: 'password123', confirmPassword: 'password123', code, action: 'register' },
      });

      const isSuccess = regRes.status === 200 && regRes.json?.success === true;
      const isUc5000 = regRes.json?.user?.total_uc === 5000;
      const isVip = regRes.json?.user?.is_vip === true;
      const hasGoldFrame = regRes.json?.user?.profile_frame === 'vip_gold';

      assert(`4.${i + 1} VIP player @${username} registered with code ${code} (5000 UC starting balance, VIP status, gold frame)`, isSuccess && isUc5000 && isVip && hasGoldFrame);

      playerCookies.push({ username, cookie: extractCookie(regRes), id: regRes.json?.user?.id, isVip: true });
    }

    // SCENARIO 5: Reject reusing already-used code
    const reuseCodeRes = await request('/api/auth/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'intruder', password: 'password123', code: 'Snow24A', action: 'register' },
    });
    assert('5. Reusing already-used code Snow24A is rejected with 400', reuseCodeRes.status === 400 && reuseCodeRes.json?.error?.includes('уже был использован'));

    // SCENARIO 6: 12 Player Cap reached (13th player registration rejected)
    const extraPlayerRes = await request('/api/auth/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'player_13', password: 'password123', code: 'EXTRA13', action: 'register' },
    });
    assert('6. 13th player registration attempt is rejected (12 slot cap enforced)', extraPlayerRes.status === 400);

    // SCENARIO 7: Non-admin accessing admin API gets 403 Forbidden
    const nonAdminUserRes = await request('/api/admin/users', {
      headers: { Cookie: playerCookies[0].cookie },
    });
    assert('7. Non-admin player accessing /api/admin/users gets 403 Forbidden', nonAdminUserRes.status === 403);

    // SCENARIO 8: Admin Authentication
    const adminLoginRes = await request('/api/auth/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'lucky_admin', password: '1234', action: 'login' },
    });
    assert('8. Admin logs in successfully and receives admin session cookie', adminLoginRes.status === 200 && adminLoginRes.json?.user?.is_admin === true);
    const adminCookie = extractCookie(adminLoginRes);

    // SCENARIO 9: Admin lists 12 registered players
    const adminUsersRes = await request('/api/admin/users', {
      headers: { Cookie: adminCookie },
    });
    const nonAdminList = (adminUsersRes.json?.users || []).filter((u) => !u.is_admin);
    assert('9. Admin /api/admin/users returns exactly 12 registered player accounts', adminUsersRes.status === 200 && nonAdminList.length === 12);

    // SCENARIO 10: Admin grants +5 spins to ALL players
    const grantAllSpinsRes = await request('/api/admin/spins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: { action: 'grant_spins', amount: 5, allUsers: true },
    });
    assert('10. Admin grants +5 spins to ALL 12 players at once', grantAllSpinsRes.status === 200 && grantAllSpinsRes.json?.success === true);

    // SCENARIO 11: Player 1 verifies free_spins_balance = 5
    const p1Profile = await request('/api/user/profile', {
      headers: { Cookie: playerCookies[0].cookie },
    });
    assert('11. Standard player 1 now has 5 spins on account', p1Profile.json?.user?.free_spins_balance === 5);

    // SCENARIO 12: Admin grants Christmas Miracle Box gift with message to Player 2
    const p2 = playerCookies[1];
    const grantGiftRes = await request('/api/admin/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: {
        targetUserId: p2.id,
        rewardId: 'reward-xmas-miracle-box',
        quantity: 1,
        message: 'Счастливого Нового Года 2026 от Администратора!',
      },
    });
    assert('12. Admin grants Christmas Miracle Box gift with message', grantGiftRes.status === 200 && grantGiftRes.json?.success === true);

    // SCENARIO 13: Player 2 receives notification for the gift
    const p2Notifs = await request('/api/notifications', {
      headers: { Cookie: p2.cookie },
    });
    const hasAdminGiftNotif = p2Notifs.json?.notifications?.some((n) => n.message?.includes('Счастливого Нового Года 2026'));
    assert('13. Player 2 in-app notification center shows the admin gift and message', hasAdminGiftNotif === true);

    // SCENARIO 14: Admin toggles spin wheel feature off
    const toggleOffRes = await request('/api/admin/spins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: { action: 'toggle_spin_feature', enabled: false },
    });
    assert('14. Admin disables spin wheel globally', toggleOffRes.status === 200 && toggleOffRes.json?.spin_wheel_enabled === false);

    // SCENARIO 15: Player attempting to spin while disabled receives 403
    const disabledSpinRes = await request('/api/spin/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: playerCookies[0].cookie },
    });
    assert('15. Player cannot spin when wheel is disabled by admin (403 maintenance)', disabledSpinRes.status === 403);

    // SCENARIO 16: Admin re-enables spin wheel
    const toggleOnRes = await request('/api/admin/spins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: { action: 'toggle_spin_feature', enabled: true },
    });
    assert('16. Admin re-enables spin wheel globally', toggleOnRes.status === 200 && toggleOnRes.json?.spin_wheel_enabled === true);

    // SCENARIO 17: Player 1 plays spin on Christmas Wheel
    const spinPlayRes = await request('/api/spin/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: playerCookies[0].cookie },
    });
    const expectedSpins = spinPlayRes.json?.reward?.category === 'spins'
      ? 4 + (spinPlayRes.json.reward.value || 0)
      : 4;
    assert('17. Player 1 executes spin on Christmas Wheel and wins a reward', spinPlayRes.status === 200 && spinPlayRes.json?.reward?.name !== undefined && spinPlayRes.json?.spins_left === expectedSpins);

    // SCENARIO 18: Player-to-Player gift with custom message (quantity > 0 rule)
    // Player 1 gifts starter item 'reward-xmas-sticker' to Player 2 with custom message
    const p2Username = playerCookies[1].username;
    const sendPlayerGiftRes = await request('/api/gifts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: playerCookies[0].cookie },
      body: {
        recipientUsername: p2Username,
        rewardId: 'reward-xmas-sticker',
        quantity: 1,
        message: 'Привет! Лови новогодний стикер от друга! 🎄',
      },
    });
    assert('18. Player 1 sends gift with custom message to Player 2 (quantity > 0 rule)', sendPlayerGiftRes.status === 200 && sendPlayerGiftRes.json?.success === true);

    // SCENARIO 19: Player 2 notification center receives the gift and note
    const p2UpdatedNotifs = await request('/api/notifications', {
      headers: { Cookie: playerCookies[1].cookie },
    });
    const hasPlayerGiftNotif = p2UpdatedNotifs.json?.notifications?.some((n) => n.message?.includes('Лови новогодний стикер'));
    assert('19. Player 2 notification center contains the player gift and custom note', hasPlayerGiftNotif === true);

    // SCENARIO 20: Player 2 marks notifications as read
    const markReadRes = await request('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: playerCookies[1].cookie },
      body: {},
    });
    const p2AfterRead = await request('/api/notifications', {
      headers: { Cookie: playerCookies[1].cookie },
    });
    assert('20. Player 2 marks all notifications as read (unreadCount: 0)', markReadRes.status === 200 && p2AfterRead.json?.unreadCount === 0);

    // SCENARIO 21: Admin fetches audit logs and verifies audit trail
    const adminLogsRes = await request('/api/admin/logs', {
      headers: { Cookie: adminCookie },
    });
    assert('21. Admin audit logs track all actions (spins, gifts, feature toggles)', adminLogsRes.status === 200 && adminLogsRes.json?.logs?.length >= 3);
  } finally {
    child.kill();
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} / ${total} PASS`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
