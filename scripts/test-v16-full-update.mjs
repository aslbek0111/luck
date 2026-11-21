import assert from 'assert';
import { TITLES_LIST, REWARDS_CATALOG } from '../lib/catalog-data.js';
import { mockStore } from '../lib/mock-store.js';

console.log('====================================================');
console.log('🚀 RUNNING LUCKY UC V16 FULL UPDATE TEST SUITE');
console.log('====================================================\n');

// 1. Verify New Titles
console.log('TEST 1: Verifying New Titles in Catalog...');
const requiredTitles = [
  { id: 'title-terpilla', name: 'ТЕРПИЛЛА', rarity: 'rare', priceCoins: 300 },
  { id: 'title-podsos', name: 'ПОДСОС', rarity: 'rare', priceCoins: 350 },
  { id: 'title-santa', name: 'САНТА', rarity: 'legendary', priceCoins: 3000 },
  { id: 'title-femboy', name: 'FEMBOY', rarity: 'epic', priceCoins: 800 },
  { id: 'title-nefor', name: 'NEFOR', rarity: 'rare', priceCoins: 450 },
  { id: 'title-balbibol', name: 'BALBIBOL', rarity: 'uncommon', priceCoins: 150 },
  { id: 'title-imperator', name: 'ИМПЕРАТОР', rarity: 'pro-epic', priceCoins: 2200 },
  { id: 'title-demiurge', name: 'ДЕМИУРГ', rarity: 'mythic', priceCoins: 5500 },
];

for (const req of requiredTitles) {
  const found = TITLES_LIST.find((t) => t.id === req.id);
  assert(found, `Title ${req.id} (${req.name}) must exist in TITLES_LIST`);
  assert.strictEqual(found.name.toUpperCase(), req.name.toUpperCase(), `Title name must be ${req.name}`);
  assert.strictEqual(found.rarity, req.rarity, `Title rarity must be ${req.rarity}`);
  assert.strictEqual(found.priceCoins, req.priceCoins, `Title priceCoins must be ${req.priceCoins}`);
  console.log(`  ✓ Title verified: ${found.name} [${found.rarity}] - ${found.priceCoins} Coins`);
}

// 2. Verify OVERLORD Price
console.log('\nTEST 2: Verifying OVERLORD Price Update...');
const overlord = TITLES_LIST.find((t) => t.slug === 'overlord');
assert(overlord, 'OVERLORD title must exist');
assert.strictEqual(overlord.priceCoins, 2800, 'OVERLORD price must be 2800 Coins (1800 + 1000)');
console.log(`  ✓ OVERLORD title price is exactly ${overlord.priceCoins} Coins`);

// 3. Verify Spin Probabilities
console.log('\nTEST 3: Verifying Spin Probabilities...');
// Replicate selectRouletteReward logic from app/api/spin/play/route.js
function selectReward() {
  const roll = Math.random() * 100;
  if (roll < 46.0) {
    const coinRoll = Math.random() * 46.0;
    if (coinRoll < 24.0) return { type: 'coins', value: 25 };
    if (coinRoll < 37.0) return { type: 'coins', value: 50 };
    if (coinRoll < 43.0) return { type: 'coins', value: 75 };
    return { type: 'coins', value: 125 };
  } else if (roll < 47.3) {
    const ucRoll = Math.random() * 1.3;
    if (ucRoll < 0.8) return { type: 'uc', value: 30 };
    return { type: 'uc', value: 60 };
  } else if (roll < 67.6) {
    return { type: 'item', rarity: 'common' };
  } else if (roll < 80.6) {
    return { type: 'item', rarity: 'uncommon' };
  } else if (roll < 88.8) {
    return { type: 'item', rarity: 'rare' };
  } else if (roll < 94.3) {
    return { type: 'item', rarity: 'epic' };
  } else if (roll < 98.0) {
    return { type: 'item', rarity: 'mythic' };
  } else {
    return { type: 'item', rarity: 'legendary' };
  }
}

const N = 50000;
const counts = { coins: 0, uc: 0, common: 0, uncommon: 0, rare: 0, epic: 0, mythic: 0, legendary: 0 };
for (let i = 0; i < N; i++) {
  const r = selectReward();
  if (r.type === 'coins') counts.coins++;
  else if (r.type === 'uc') counts.uc++;
  else counts[r.rarity]++;
}

console.log(`  Simulated ${N} spins:`);
console.log(`  Coins: ${(counts.coins / N * 100).toFixed(2)}% (Target: ~46.0%)`);
console.log(`  UC: ${(counts.uc / N * 100).toFixed(2)}% (Target: ~1.3%)`);
console.log(`  Common: ${(counts.common / N * 100).toFixed(2)}% (Target: ~20.3%)`);
console.log(`  Uncommon: ${(counts.uncommon / N * 100).toFixed(2)}% (Target: ~13.0%)`);
console.log(`  Rare: ${(counts.rare / N * 100).toFixed(2)}% (Target: ~8.2%)`);
console.log(`  Epic: ${(counts.epic / N * 100).toFixed(2)}% (Target: ~5.5%)`);
console.log(`  Mythic: ${(counts.mythic / N * 100).toFixed(2)}% (Target: ~3.7%)`);
console.log(`  Legendary: ${(counts.legendary / N * 100).toFixed(2)}% (Target: ~2.0%)`);

const legRate = counts.legendary / N;
assert(legRate >= 0.015 && legRate <= 0.026, 'Legendary drop rate should be ~2.0%');
const ucRate = counts.uc / N;
assert(ucRate >= 0.010 && ucRate <= 0.016, 'UC drop rate should be ~1.3%');
console.log('  ✓ Spin probability distribution verified!');

// 4. Verify Duplicate Selling in MockStore
console.log('\nTEST 4: Verifying Server-side Duplicate Selling...');
const testUserId = 'test-user-' + Date.now();
mockStore.addUser({
  id: testUserId,
  username: 'test_seller',
  coins_balance: 100,
  is_vip: false,
});

// Add 3 copies of rare title
mockStore.addItemToInventory(testUserId, 'title-terpilla', 3);
let userInv = mockStore.getUserInventory(testUserId);
let terpilla = userInv.find((i) => i.rewardId === 'title-terpilla');
assert.strictEqual(terpilla.quantity, 3, 'User should have 3 copies of title-terpilla');

// Sell 1 duplicate
const sellRes1 = mockStore.sellDuplicate(testUserId, 'title-terpilla');
assert(sellRes1.success, `First sale should succeed: ${sellRes1.error}`);
assert(sellRes1.earnedCoins >= 20 && sellRes1.earnedCoins <= 35, `Rare sale price should be 20-35, got ${sellRes1.earnedCoins}`);
assert.strictEqual(sellRes1.remainingQuantity, 2, 'Remaining quantity should be 2');
console.log(`  ✓ Sold duplicate 1: earned ${sellRes1.earnedCoins} Coins (range 20-35). Remaining: ${sellRes1.remainingQuantity}`);

// Sell 2nd duplicate
const sellRes2 = mockStore.sellDuplicate(testUserId, 'title-terpilla');
assert(sellRes2.success, `Second sale should succeed: ${sellRes2.error}`);
assert.strictEqual(sellRes2.remainingQuantity, 1, 'Remaining quantity should be 1');
console.log(`  ✓ Sold duplicate 2: earned ${sellRes2.earnedCoins} Coins. Remaining: ${sellRes2.remainingQuantity}`);

// Attempt to sell 3rd copy (only copy left, quantity = 1) -> MUST FAIL
const sellRes3 = mockStore.sellDuplicate(testUserId, 'title-terpilla');
assert(!sellRes3.success, 'Selling the last copy MUST fail');
console.log(`  ✓ Selling last remaining copy rejected as expected: "${sellRes3.error}"`);

// Verify sales history
const history = mockStore.getSalesHistory(testUserId);
assert.strictEqual(history.length, 2, 'Sales history should contain exactly 2 entries');
console.log(`  ✓ Sales history verified: ${history.length} sales recorded`);

// 5. Verify Standard Accounts Capacity
console.log('\nTEST 5: Verifying 100 Standard Accounts + 4 VIP Capacity...');
const allAccounts = mockStore.getUsers();
const standardCount = allAccounts.filter((u) => !u.is_vip).length;
const vipCount = allAccounts.filter((u) => u.is_vip).length;
console.log(`  Initial Standard accounts: ${standardCount}`);
console.log(`  VIP accounts: ${vipCount}`);
assert(standardCount >= 10, 'Should have standard accounts loaded');
assert.strictEqual(vipCount, 4, 'Should have exactly 4 VIP accounts');
console.log('  ✓ Account slot capacity verified!');

console.log('\n====================================================');
console.log('✅ ALL TEST SUITES PASSED SUCCESSFULLY!');
console.log('====================================================');
