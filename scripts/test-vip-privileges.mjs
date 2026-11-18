import assert from 'node:assert';
import http from 'node:http';
import { mockStore, VIP_ACCOUNTS, STANDARD_ACCOUNTS } from '../lib/mock-store.js';
import { resolveTitle, REWARDS_CATALOG, TITLES_LIST } from '../lib/catalog-data.js';

console.log('=== VERIFYING VIP PRIVILEGES IN MOCK STORE ===');

for (const vipName of VIP_ACCOUNTS) {
  const user = mockStore.getUserByUsername(vipName);
  assert.ok(user, 'VIP account ' + vipName + ' must exist');
  assert.strictEqual(user.is_vip, true, vipName + ' must have is_vip = true');
  assert.strictEqual(user.is_admin, true, vipName + ' must have is_admin = true');
  assert.strictEqual(user.profile_frame, 'vip_gold', vipName + ' must have profile_frame = vip_gold');
  assert.strictEqual(user.vip_badge, 'VIP_ADMIN', vipName + ' must have vip_badge = VIP_ADMIN');
  assert.strictEqual(user.active_title_id, 'title-vip', vipName + ' must have active_title_id = title-vip');
  assert.ok(user.total_uc >= 5000, vipName + ' must have total_uc >= 5000 (has ' + user.total_uc + ')');
  assert.ok(user.free_spins_balance >= 999999, vipName + ' must have free_spins_balance >= 999999');
  assert.ok(user.coins_balance >= 1000, vipName + ' must have coins_balance >= 1000');

  const inv = mockStore.getUserInventory(user.id);
  assert.ok(inv.length >= 49, vipName + ' must have complete inventory (has ' + inv.length + ')');
  const vipTitleItem = inv.find((i) => i.rewardId === 'title-vip');
  assert.ok(vipTitleItem, vipName + ' must have title-vip in inventory');
  assert.ok(vipTitleItem.quantity >= 3, vipName + ' must have >= 3 copies of title-vip');

  const resolved = resolveTitle(user.active_title_id);
  assert.ok(resolved, 'Active title must resolve');
  assert.strictEqual(resolved.name, 'VIP');
  assert.strictEqual(resolved.rarity, 'legendary');

  console.log('✓ ' + vipName + ': VIP+Admin, Gold Frame, VIP_ADMIN Badge, VIP Title, 5000 UC, Infinite Spins, 49 Items');
}

console.log('\n=== VERIFYING STANDARD ACCOUNTS ARE NOT VIP ===');
for (const stdName of STANDARD_ACCOUNTS) {
  const user = mockStore.getUserByUsername(stdName);
  assert.ok(user, 'Standard account ' + stdName + ' must exist');
  assert.strictEqual(user.is_vip, false, stdName + ' must not be VIP');
  assert.strictEqual(user.is_admin, false, stdName + ' must not be Admin');
  assert.strictEqual(user.profile_frame, 'default');
  console.log('✓ ' + stdName + ': Standard player');
}

console.log('\nALL IN-MEMORY VIP PRIVILEGE CHECKS PASSED!');

// HTTP END-TO-END TESTS
import { spawn } from 'node:child_process';

const PORT = 3016;
const BASE_URL = 'http://127.0.0.1:' + PORT;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const url = BASE_URL + path;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  const cookie = res.headers.get('set-cookie');
  return { status: res.status, headers: res.headers, json, cookie };
}

async function runE2E() {
  console.log('\n=== STARTING NEXT.JS SERVER FOR VIP E2E TESTS ===');
  const server = spawn('cmd', ['/c', 'npx', 'next', 'start', '-p', String(PORT)], {
    env: { ...process.env, PORT: String(PORT), ALLOW_DEV_STORE: 'true' },
    stdio: 'ignore',
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(BASE_URL + '/api/auth/me');
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await wait(1000);
    }

    if (!ready) {
      throw new Error('Next.js server failed to start within 40 seconds');
    }
    console.log('✓ Server ready on port ' + PORT);

    // 1. VIP Login & Profile Test
    console.log('\n=== 1. TESTING VIP AUTH & PROFILE ===');
    const vipLogin = await request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'VIP5000X', password: 'VipPass_VIP5000X!' },
    });
    assert.strictEqual(vipLogin.status, 200, 'VIP login should return 200 OK');
    assert.strictEqual(vipLogin.json.success, true);
    assert.strictEqual(vipLogin.json.user.is_vip, true);
    assert.strictEqual(vipLogin.json.user.is_admin, true);
    const vipCookie = vipLogin.cookie ? vipLogin.cookie.split(';')[0] : '';
    assert.ok(vipCookie, 'Should receive session cookie');
    console.log('✓ VIP5000X logged in successfully with pure Nickname + Password');

    const vipProfile = await request('/api/user/profile', {
      headers: { Cookie: vipCookie },
    });
    assert.strictEqual(vipProfile.status, 200);
    assert.strictEqual(vipProfile.json.success, true);
    assert.strictEqual(vipProfile.json.user.is_vip, true);
    assert.strictEqual(vipProfile.json.user.is_admin, true);
    assert.strictEqual(vipProfile.json.user.profile_frame, 'vip_gold');
    assert.strictEqual(vipProfile.json.user.vip_badge, 'VIP_ADMIN');
    assert.strictEqual(vipProfile.json.activeTitle.name, 'VIP');
    assert.strictEqual(vipProfile.json.activeTitle.tier, 'Легендарный');
    assert.ok(vipProfile.json.stats.totalUc >= 5000, 'VIP UC >= 5000');
    assert.strictEqual(vipProfile.json.stats.freeSpins, 999999, 'VIP free spins should be 999999');
    assert.ok(vipProfile.json.inventory.length >= 49, 'VIP inventory >= 49 items');
    console.log('✓ VIP Profile verified: VIP Title, Gold Frame, VIP_ADMIN Badge, 5000 UC, 999999 spins');

    // 2. VIP Infinite Spins Test
    console.log('\n=== 2. TESTING VIP INFINITE SPINS ===');
    const spin1 = await request('/api/spin/play', {
      method: 'POST',
      headers: { Cookie: vipCookie },
    });
    assert.strictEqual(spin1.status, 200, 'VIP spin should succeed');
    assert.strictEqual(spin1.json.success, true);
    assert.strictEqual(spin1.json.spins_left, 999999, 'VIP spins balance should remain 999999');
    assert.strictEqual(spin1.json.is_vip_admin, true, 'User should have is_vip_admin = true');
    console.log('✓ VIP Spin executed successfully without decrementing free spins balance');

    // 3. VIP Admin Panel Access Test
    console.log('\n=== 3. TESTING VIP ADMIN ACCESS ===');
    const adminUsers = await request('/api/admin/users', {
      headers: { Cookie: vipCookie },
    });
    assert.strictEqual(adminUsers.status, 200, 'VIP user must have access to /api/admin/users');
    assert.strictEqual(adminUsers.json.success, true);
    console.log('✓ VIP Admin access verified (200 OK)');

    // 4. Standard Account Comparison Test
    console.log('\n=== 4. TESTING STANDARD ACCOUNT HAS NO VIP ACCESS ===');
    const stdLogin = await request('/api/auth/browser', {
      method: 'POST',
      body: { username: 'Snow24A', password: 'StdPass_Snow24A!' },
    });
    assert.strictEqual(stdLogin.status, 200);
    assert.strictEqual(stdLogin.json.user.is_vip, false);
    assert.strictEqual(stdLogin.json.user.is_admin, false);
    const stdCookie = stdLogin.cookie ? stdLogin.cookie.split(';')[0] : '';

    const stdAdmin = await request('/api/admin/users', {
      headers: { Cookie: stdCookie },
    });
    assert.strictEqual(stdAdmin.status, 403, 'Standard user must get 403 Forbidden on admin endpoint');
    console.log('✓ Standard account correctly denied admin access (403 Forbidden)');

    console.log('\n======================================================');
    console.log('🎉 ALL VIP PRIVILEGES RESTORED AND FULLY VERIFIED! 🎉');
    console.log('======================================================');
  } finally {
    try {
      server.kill();
      // On windows kill child processes on port
      const killer = spawn('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :' + PORT + '\') do taskkill /F /PID %a'], { stdio: 'ignore', shell: true });
      await wait(1500);
    } catch {}
  }
}

runE2E().catch((err) => {
  console.error('E2E TEST ERROR:', err);
  process.exit(1);
});
