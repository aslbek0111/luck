import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { mockStore } from '../lib/mock-store.js';

console.log('================================================================');
console.log('🎄 LUCKY UC: POPULARITY POINTS LEADERBOARD & DAILY SPINS AUDIT 🎄');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

// ----------------------------------------------------------------
// SECTION 1: STANDARD ACCOUNTS 0 UC / 0 COINS BALANCE AUDIT
// ----------------------------------------------------------------
console.log('--- 1. STANDARD ACCOUNTS BALANCE AUDIT ---');

test('Existing standard accounts have UC and Coins reset to 0, spins set to 2', () => {
  let users = mockStore.getUsers();
  if (!users.some((u) => !u.is_vip && !u.is_admin)) {
    mockStore.addUser({
      id: 'legacy-standard-1',
      username: 'legacy_player',
      first_name: 'Legacy',
      is_vip: false,
      is_admin: false,
      total_uc: 500,
      coins_balance: 1000,
      points_balance: 1000,
      free_spins_balance: 50,
    });
    mockStore.saveToFile();
  }
  mockStore.loadFromFile();
  users = mockStore.getUsers();
  const standardUsers = users.filter((u) => !u.is_vip && !u.is_admin);

  assert(standardUsers.length > 0, 'Expected at least one standard user in data store');

  for (const u of standardUsers) {
    assert.strictEqual(u.total_uc, 0, `Standard user @${u.username} total_uc should be 0, got ${u.total_uc}`);
    assert.strictEqual(u.coins_balance, 0, `Standard user @${u.username} coins_balance should be 0, got ${u.coins_balance}`);
    assert.strictEqual(u.points_balance, 0, `Standard user @${u.username} points_balance should be 0, got ${u.points_balance}`);
    assert(u.free_spins_balance >= 0 && u.free_spins_balance <= 2, `Standard user @${u.username} free spins should be 0..2, got ${u.free_spins_balance}`);
    assert(u.last_daily_spins_at, `Standard user @${u.username} missing last_daily_spins_at timestamp`);
  }
});

test('Newly registered standard account gets exactly 0 UC, 0 Coins, and 2 daily free spins', () => {
  const newStdUser = {
    id: 'test-std-' + Date.now(),
    username: 'newbie_player',
    first_name: 'Newbie',
    is_vip: false,
    is_admin: false,
    total_uc: 500, // attempt to assign starting UC
    coins_balance: 1000, // attempt to assign starting coins
    points_balance: 1000,
    free_spins_balance: 10,
  };

  const added = mockStore.addUser(newStdUser);
  assert.strictEqual(added.total_uc, 0, 'New standard account total_uc must be 0');
  assert.strictEqual(added.coins_balance, 0, 'New standard account coins_balance must be 0');
  assert.strictEqual(added.points_balance, 0, 'New standard account points_balance must be 0');
  assert.strictEqual(added.free_spins_balance, 2, 'New standard account free_spins_balance must be 2');
  assert(added.last_daily_spins_at, 'Missing last_daily_spins_at on new standard account');
  assert.strictEqual(added.total_popularity, 0, 'New standard account total_popularity must start at 0');
});

test('VIP accounts preserve their 5000 UC, unlimited spins (999999), and admin privileges', () => {
  let users = mockStore.getUsers();
  if (!users.some((u) => u.is_vip)) {
    mockStore.addUser({
      id: 'vip-user-seed-1',
      username: 'vip_seed_player',
      first_name: 'VIP Seed',
      is_vip: true,
      is_admin: true,
      total_uc: 5000,
      coins_balance: 1000,
      free_spins_balance: 999999,
    });
    mockStore.saveToFile();
  }
  mockStore.loadFromFile();
  users = mockStore.getUsers();
  const vipUsers = users.filter((u) => u.is_vip);
  assert(vipUsers.length > 0, 'Expected at least one VIP user in data store');

  for (const vip of vipUsers) {
    assert.strictEqual(vip.is_vip, true, `VIP flag should be true for @${vip.username}`);
    assert.strictEqual(vip.is_admin, true, `VIP should have full admin privileges for @${vip.username}`);
    assert.strictEqual(vip.free_spins_balance, 999999, `VIP should have 999999 free spins for @${vip.username}`);
    assert(vip.total_uc >= 5000, `VIP total_uc should be preserved (>= 5000) for @${vip.username}`);
  }
});

// ----------------------------------------------------------------
// SECTION 2: 24-HOUR DAILY FREE SPINS LOGIC AUDIT
// ----------------------------------------------------------------
console.log('\n--- 2. 24-HOUR DAILY FREE SPINS AUDIT ---');

test('Standard account receives 2 spins, spins consume 1 spin, blocked when 0', () => {
  const testUserId = 'test-spin-user-' + Date.now();
  const stdUser = mockStore.addUser({
    id: testUserId,
    username: 'spinner_test',
    first_name: 'Spinner',
    is_vip: false,
    is_admin: false,
  });

  assert.strictEqual(stdUser.free_spins_balance, 2, 'Initial balance must be 2 free spins');

  // Spin 1
  stdUser.free_spins_balance -= 1;
  mockStore.updateUser(stdUser.id, { free_spins_balance: stdUser.free_spins_balance });
  const afterSpin1 = mockStore.getUserById(stdUser.id);
  assert.strictEqual(afterSpin1.free_spins_balance, 1, 'After 1st spin, balance must be 1');

  // Spin 2
  afterSpin1.free_spins_balance -= 1;
  mockStore.updateUser(stdUser.id, { free_spins_balance: afterSpin1.free_spins_balance });
  const afterSpin2 = mockStore.getUserById(stdUser.id);
  assert.strictEqual(afterSpin2.free_spins_balance, 0, 'After 2nd spin, balance must be 0');

  // Attempting another spin while cooldown active
  const checkStatus = mockStore.checkAndGrantDailySpins(stdUser.id);
  assert.strictEqual(checkStatus.granted, false, 'Daily spins should NOT be granted yet (< 24 hours)');
  assert.strictEqual(checkStatus.freeSpins, 0, 'Free spins balance must remain 0 during cooldown');
  assert(checkStatus.secondsRemaining > 0 && checkStatus.secondsRemaining <= 86400, 'secondsRemaining must be between 1 and 86400');
});

test('Simulating 24 hours elapsed: system automatically grants 2 new free spins', () => {
  const testUserId = 'test-cooldown-' + Date.now();
  const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago

  const stdUser = mockStore.addUser({
    id: testUserId,
    username: 'cooldown_tester',
    first_name: 'Cooldown',
    is_vip: false,
    is_admin: false,
    free_spins_balance: 0,
    last_daily_spins_at: pastTime,
  });

  // Manually set last_daily_spins_at to past time
  stdUser.free_spins_balance = 0;
  stdUser.last_daily_spins_at = pastTime;
  mockStore.updateUser(testUserId, { free_spins_balance: 0, last_daily_spins_at: pastTime });

  // Call checkAndGrantDailySpins
  const grantResult = mockStore.checkAndGrantDailySpins(testUserId);
  assert.strictEqual(grantResult.success, true, 'Daily check must succeed');
  assert.strictEqual(grantResult.granted, true, 'Daily spins MUST be granted after 24 hours');
  assert.strictEqual(grantResult.freeSpins, 2, 'Free spins balance must be reset to exactly 2');

  const refreshed = mockStore.getUserById(testUserId);
  assert.strictEqual(refreshed.free_spins_balance, 2, 'Refreshed user must have 2 free spins');

  // Immediate subsequent check must not grant again (prevent duplicate claim)
  const doubleCheck = mockStore.checkAndGrantDailySpins(testUserId);
  assert.strictEqual(doubleCheck.granted, false, 'Should not grant duplicate daily spins');
  assert.strictEqual(doubleCheck.freeSpins, 2, 'Balance must remain 2');
  assert(doubleCheck.secondsRemaining > 86300, 'Timer should have restarted at ~24h');
});

// ----------------------------------------------------------------
// SECTION 3: REAL-TIME GLOBAL POPULARITY (PP) LEADERBOARD AUDIT
// ----------------------------------------------------------------
console.log('\n--- 3. REAL-TIME PP LEADERBOARD AUDIT ---');

test('Multi-Account PP Progression Scenario (User A vs User B): Exact Prompt Example', () => {
  const idA = 'user-player-a-' + Date.now();
  const idB = 'user-player-b-' + Date.now();

  const userA = mockStore.addUser({
    id: idA,
    username: 'playera',
    first_name: 'Player A',
    is_vip: false,
    is_admin: false,
    total_popularity: 0,
  });

  const userB = mockStore.addUser({
    id: idB,
    username: 'playerb',
    first_name: 'Player B',
    is_vip: false,
    is_admin: false,
    total_popularity: 0,
  });

  // Reset all existing players' PP to 0 to simulate empty/fresh server baseline
  const currentUsers = mockStore.getUsers();
  currentUsers.forEach((u) => {
    u.total_popularity = 0;
  });
  mockStore.saveUsers(currentUsers);

  // Step 1: Player A enters server and wins 100 PP
  const txA1 = mockStore.recordPopularityTransaction({
    userId: idA,
    amount: 100,
    source: 'spin',
    description: 'Win 100 PP from spin',
    referenceId: 'ref-a1-' + Date.now(),
  });
  assert.strictEqual(txA1.success, true);
  assert.strictEqual(txA1.total_popularity, 100);

  let lb1 = mockStore.getLeaderboard();
  let rankA1 = lb1.find((p) => p.id === idA)?.rank;
  let rankB1 = lb1.find((p) => p.id === idB)?.rank;

  assert.strictEqual(rankA1, 1, `Step 1: Player A (100 PP) must be Rank #1, got #${rankA1}`);
  assert(rankB1 > rankA1, 'Step 1: Player B (0 PP) must be behind Player A');

  // Step 2: Player B enters and wins 100 PP twice (total 200 PP)
  const txB1 = mockStore.recordPopularityTransaction({
    userId: idB,
    amount: 100,
    source: 'spin',
    description: 'Win 100 PP first time',
    referenceId: 'ref-b1-' + Date.now(),
  });
  assert.strictEqual(txB1.total_popularity, 100);

  const txB2 = mockStore.recordPopularityTransaction({
    userId: idB,
    amount: 100,
    source: 'spin',
    description: 'Win 100 PP second time',
    referenceId: 'ref-b2-' + Date.now(),
  });
  assert.strictEqual(txB2.total_popularity, 200, 'Player B total PP must be 200 after winning 100 PP twice');

  let lb2 = mockStore.getLeaderboard();
  let rankA2 = lb2.find((p) => p.id === idA)?.rank;
  let rankB2 = lb2.find((p) => p.id === idB)?.rank;

  assert.strictEqual(rankB2, 1, `Step 2: Player B (200 PP) must be Rank #1, got #${rankB2}`);
  assert.strictEqual(rankA2, 2, `Step 2: Player A (100 PP) must move down to Rank #2, got #${rankA2}`);

  // Step 3: Player A earns another 150 PP (total 250 PP)
  const txA2 = mockStore.recordPopularityTransaction({
    userId: idA,
    amount: 150,
    source: 'spin',
    description: 'Win 150 PP',
    referenceId: 'ref-a2-' + Date.now(),
  });
  assert.strictEqual(txA2.total_popularity, 250, 'Player A total PP must become 250 (100 + 150)');

  let lb3 = mockStore.getLeaderboard();
  let rankA3 = lb3.find((p) => p.id === idA)?.rank;
  let rankB3 = lb3.find((p) => p.id === idB)?.rank;

  assert.strictEqual(rankA3, 1, `Step 3: Player A (250 PP) must reclaim Rank #1, got #${rankA3}`);
  assert.strictEqual(rankB3, 2, `Step 3: Player B (200 PP) must move to Rank #2, got #${rankB3}`);
});

test('Tie-breaking rule: most recent achievement time wins when PP is equal', async () => {
  const idX = 'user-tie-x-' + Date.now();
  const idY = 'user-tie-y-' + (Date.now() + 1);

  mockStore.addUser({
    id: idX,
    username: 'tier_player_x',
    first_name: 'Tier X',
    is_vip: false,
    is_admin: false,
    total_popularity: 0,
  });

  mockStore.addUser({
    id: idY,
    username: 'tier_player_y',
    first_name: 'Tier Y',
    is_vip: false,
    is_admin: false,
    total_popularity: 0,
  });

  // User X earns 500 PP earlier
  mockStore.recordPopularityTransaction({
    userId: idX,
    amount: 500,
    source: 'spin',
    description: 'Earlier 500 PP',
    referenceId: 'tie-x-' + Date.now(),
  });

  // Manually backdate X's achievement time by 10 seconds
  const userX = mockStore.getUserById(idX);
  userX.popularity_updated_at = new Date(Date.now() - 10000).toISOString();
  mockStore.saveUsers(mockStore.getUsers());

  // User Y earns 500 PP more recently
  mockStore.recordPopularityTransaction({
    userId: idY,
    amount: 500,
    source: 'spin',
    description: 'Recent 500 PP',
    referenceId: 'tie-y-' + Date.now(),
  });

  const lb = mockStore.getLeaderboard();
  const rankX = lb.find((p) => p.id === idX)?.rank;
  const rankY = lb.find((p) => p.id === idY)?.rank;

  assert(
    rankY < rankX,
    `Secondary sort failed: Player Y reached 500 PP more recently than Player X, so rankY (${rankY}) must be < rankX (${rankX})`
  );
});

test('Idempotency & Duplicate Prevention: identical referenceId is rejected from double-crediting', () => {
  const idTest = 'user-dup-test-' + Date.now();
  mockStore.addUser({
    id: idTest,
    username: 'dup_guard_player',
    first_name: 'DupGuard',
    is_vip: false,
    is_admin: false,
    total_popularity: 0,
  });

  const refId = 'fixed-unique-tx-' + Date.now();

  // First execution
  const res1 = mockStore.recordPopularityTransaction({
    userId: idTest,
    amount: 100,
    source: 'spin',
    description: 'Credit 100 PP',
    referenceId: refId,
  });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.total_popularity, 100);

  // Duplicate execution with exact same referenceId
  const res2 = mockStore.recordPopularityTransaction({
    userId: idTest,
    amount: 100,
    source: 'spin',
    description: 'Duplicate attempt of 100 PP',
    referenceId: refId,
  });

  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.alreadyProcessed, true, 'Must indicate alreadyProcessed: true');
  assert.strictEqual(res2.total_popularity, 100, 'Total PP must remain 100, not double-credited to 200');

  const finalUser = mockStore.getUserById(idTest);
  assert.strictEqual(finalUser.total_popularity, 100, 'Final user balance must be 100');
});

test('Persistence Verification: leaderboard and balances survive data reload', () => {
  mockStore.saveToFile();
  // Force reload
  mockStore.loadFromFile();

  const lb = mockStore.getLeaderboard();
  assert(lb.length > 0, 'Leaderboard must contain users after reload');
  assert.strictEqual(lb[0].rank, 1, 'Top user must have rank 1');

  // Verify rank ordering is strictly descending by total_popularity
  for (let i = 0; i < lb.length - 1; i++) {
    const currentPP = lb[i].total_popularity;
    const nextPP = lb[i + 1].total_popularity;
    assert(
      currentPP >= nextPP,
      `Leaderboard ordering violation: rank #${lb[i].rank} (${currentPP} PP) < rank #${lb[i + 1].rank} (${nextPP} PP)`
    );
  }
});

// ----------------------------------------------------------------
// SECTION 4: DATABASE MIGRATION V10 INTEGRITY AUDIT
// ----------------------------------------------------------------
console.log('\n--- 4. MIGRATION V10 INTEGRITY AUDIT ---');

test('migration_v10_leaderboard_daily_spins.sql contains all required SQL statements', () => {
  const sqlPath = path.join(process.cwd(), 'database', 'migration_v10_leaderboard_daily_spins.sql');
  assert(fs.existsSync(sqlPath), 'migration_v10_leaderboard_daily_spins.sql must exist');

  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert(sql.includes('public.popularity_transactions'), 'Missing popularity_transactions table in SQL');
  assert(sql.includes('reference_id TEXT UNIQUE'), 'Missing reference_id UNIQUE constraint in SQL');
  assert(sql.includes('record_popularity_transaction_atomic'), 'Missing record_popularity_transaction_atomic RPC');
  assert(sql.includes('check_and_grant_daily_spins_atomic'), 'Missing check_and_grant_daily_spins_atomic RPC');
  assert(sql.includes('UPDATE public.users'), 'Missing UPDATE public.users standard account reset');
  assert(sql.includes('ALTER PUBLICATION supabase_realtime'), 'Missing supabase_realtime publication setup');
  assert(sql.includes('last_daily_spins_at'), 'Missing last_daily_spins_at column in SQL');
  assert(sql.includes('popularity_updated_at'), 'Missing popularity_updated_at column in SQL');
});

console.log('================================================================');
console.log(`🎉 ALL ${passedTests} OF ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================\n');
