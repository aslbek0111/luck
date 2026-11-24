/**
 * scripts/test-shop-and-coins-full-audit.mjs
 * Comprehensive regression test suite for Lucky UC:
 * Full Shop & Coin System Audit and Repair (Migration V22)
 */

import assert from 'assert';
import { mockStore } from '../lib/mock-store.js';
import {
  REWARDS_CATALOG,
  TITLES_LIST,
  getShopItems,
  getShopGifts,
  getShopTitles,
  resolveReward,
  resolveTitle,
  isItemAvailableInShop,
} from '../lib/catalog-data.js';

let totalTests = 0;
let passedTests = 0;

function testAssert(condition, message) {
  totalTests++;
  try {
    assert(condition, message);
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw err;
  }
}

console.log('================================================================');
console.log('🌟 LUCKY UC: FULL SHOP & COIN SYSTEM AUDIT TEST SUITE');
console.log('================================================================');

// Helper to create a fresh test user with synchronized balances
function createTestUser(opts = {}) {
  const uid = 'test-audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const initialCoins = opts.coins ?? 10000;
  const user = {
    id: uid,
    username: 'user_' + uid.substring(11),
    coins_balance: initialCoins,
    points_balance: initialCoins,
    total_uc: opts.uc ?? 0,
    free_spins_balance: opts.spins ?? 0,
    total_popularity: opts.pop ?? 0,
    is_admin: opts.isAdmin ?? false,
    is_vip: opts.isVip ?? false,
    is_blocked: opts.isBlocked ?? false,
    active_title_id: opts.activeTitleId ?? null,
    last_free_spin_at: opts.lastSpinAt ?? null,
  };
  mockStore.addUser(user);
  return user;
}

// ----------------------------------------------------------------
// TEST 1: PURCHASE OF EACH PRODUCT TYPE IN SHOP
// ----------------------------------------------------------------
console.log('\n--- TEST 1: Purchase of Each Product Type in Shop (Exact Price Deduction) ---');

const user1 = createTestUser({ coins: 20000 });
let currentBalance = 20000;

// 1.1 Popularity items
const popItems = ['reward-pop-10', 'reward-pop-25', 'reward-pop-50', 'reward-pop-100'];
for (const popId of popItems) {
  const meta = resolveReward(popId);
  testAssert(meta && meta.priceCoins > 0, `Popularity item ${popId} exists with price ${meta?.priceCoins} Coins`);
  const res = mockStore.purchaseItem(user1.id, popId, 1);
  testAssert(res.success === true, `Purchased ${popId} successfully`);
  testAssert(res.costCoins === meta.priceCoins, `${popId} deducted exactly ${meta.priceCoins} Coins (not ${meta.value}!)`);
  currentBalance -= meta.priceCoins;
  const u = mockStore.getUserById(user1.id);
  testAssert(u.coins_balance === currentBalance, `User coins_balance is ${currentBalance}`);
  testAssert(u.points_balance === currentBalance, `User points_balance is synced at ${currentBalance}`);
}

// 1.2 Roses
const roseItems = ['reward-rose-1', 'reward-rose-bouquet', 'reward-rose-big-bouquet'];
for (const roseId of roseItems) {
  const meta = resolveReward(roseId);
  testAssert(meta && meta.priceCoins > 0, `Rose item ${roseId} exists with price ${meta?.priceCoins} Coins`);
  const res = mockStore.purchaseItem(user1.id, roseId, 1);
  testAssert(res.success === true, `Purchased ${roseId} successfully`);
  testAssert(res.costCoins === meta.priceCoins, `${roseId} deducted exactly ${meta.priceCoins} Coins (not ${meta.value}!)`);
  currentBalance -= meta.priceCoins;
  const u = mockStore.getUserById(user1.id);
  testAssert(u.coins_balance === currentBalance, `User coins_balance is ${currentBalance}`);
  testAssert(u.points_balance === currentBalance, `User points_balance is synced at ${currentBalance}`);
}

// 1.3 Souvenirs / Joke items
const jokeItems = ['reward-pacifier-bronze', 'reward-pacifier-silver', 'reward-pacifier-gold'];
for (const jokeId of jokeItems) {
  const meta = resolveReward(jokeId);
  testAssert(meta && meta.priceCoins > 0, `Joke item ${jokeId} exists with price ${meta?.priceCoins} Coins`);
  const res = mockStore.purchaseItem(user1.id, jokeId, 1);
  testAssert(res.success === true, `Purchased ${jokeId} successfully`);
  testAssert(res.costCoins === meta.priceCoins, `${jokeId} deducted exactly ${meta.priceCoins} Coins`);
  currentBalance -= meta.priceCoins;
  const u = mockStore.getUserById(user1.id);
  testAssert(u.coins_balance === currentBalance, `User coins_balance is ${currentBalance}`);
  testAssert(u.points_balance === currentBalance, `User points_balance is synced at ${currentBalance}`);
}

// 1.4 Christmas items
const xmasItems = ['reward-xmas-sticker', 'reward-xmas-snowflake-badge', 'reward-xmas-candy-cane'];
for (const xmasId of xmasItems) {
  const meta = resolveReward(xmasId);
  testAssert(meta && meta.priceCoins > 0, `Christmas item ${xmasId} exists with price ${meta?.priceCoins} Coins`);
  const res = mockStore.purchaseItem(user1.id, xmasId, 1);
  testAssert(res.success === true, `Purchased ${xmasId} successfully`);
  testAssert(res.costCoins === meta.priceCoins, `${xmasId} deducted exactly ${meta.priceCoins} Coins`);
  currentBalance -= meta.priceCoins;
  const u = mockStore.getUserById(user1.id);
  testAssert(u.coins_balance === currentBalance, `User coins_balance is ${currentBalance}`);
  testAssert(u.points_balance === currentBalance, `User points_balance is synced at ${currentBalance}`);
}

// 1.5 Titles (Common, Uncommon, Rare, Epic, Pro-Epic)
const shopTitles = getShopTitles();
testAssert(shopTitles.length >= 10, `At least 10 titles available in shop (found: ${shopTitles.length})`);
for (const t of shopTitles.slice(0, 5)) {
  const res = mockStore.purchaseItem(user1.id, t.id, 1);
  testAssert(res.success === true, `Purchased title ${t.name} (${t.id}) successfully`);
  testAssert(res.costCoins === t.priceCoins, `Title ${t.name} deducted exactly ${t.priceCoins} Coins`);
  currentBalance -= t.priceCoins;
  const u = mockStore.getUserById(user1.id);
  testAssert(u.coins_balance === currentBalance, `User coins_balance is ${currentBalance}`);
  testAssert(u.points_balance === currentBalance, `User points_balance is synced at ${currentBalance}`);
}

// 1.6 Pro-Epic titles specifically
const proEpicTitles = shopTitles.filter((t) => (t.rarity || '').toLowerCase() === 'pro-epic');
testAssert(proEpicTitles.length > 0, `Pro-Epic titles exist in shop catalog (${proEpicTitles.length})`);
for (const pt of proEpicTitles) {
  const res = mockStore.purchaseItem(user1.id, pt.id, 1);
  testAssert(res.success === true, `Purchased Pro-Epic title ${pt.name} (${pt.id})`);
  testAssert(res.costCoins === pt.priceCoins, `Pro-Epic title ${pt.name} cost exactly ${pt.priceCoins} Coins`);
  currentBalance -= pt.priceCoins;
}

// ----------------------------------------------------------------
// TEST 2: EXACT COIN DEDUCTION ACROSS ALL SHOP PRICES (10, 20, 25, 50, 75, etc.)
// ----------------------------------------------------------------
console.log('\n--- TEST 2: Price Validation Across Entire Shop Catalog ---');

const allShopItems = getShopItems();
testAssert(allShopItems.length > 0, `Catalog loaded ${allShopItems.length} items`);

// Group items by price point
const priceGroups = new Map();
for (const item of allShopItems) {
  const p = item.priceCoins;
  if (!priceGroups.has(p)) priceGroups.set(p, []);
  priceGroups.get(p).push(item);
}

console.log(`  Shop contains ${priceGroups.size} distinct price points: ${[...priceGroups.keys()].sort((a,b)=>a-b).join(', ')} Coins`);

for (const [price, items] of priceGroups.entries()) {
  const sampleItem = items[0];
  const testUser = createTestUser({ coins: price + 1000 });
  const purchaseRes = mockStore.purchaseItem(testUser.id, sampleItem.id, 1);
  testAssert(purchaseRes.success === true, `Sample item "${sampleItem.name}" priced at ${price} Coins bought successfully`);
  testAssert(purchaseRes.costCoins === price, `Item "${sampleItem.name}" price strictly equals ${price} Coins`);
  const updatedUser = mockStore.getUserById(testUser.id);
  testAssert(updatedUser.coins_balance === 1000, `Balance reduced from ${price + 1000} to 1000 (spent exactly ${price})`);
  testAssert(updatedUser.points_balance === 1000, `points_balance reduced from ${price + 1000} to 1000 in sync`);
}

// ----------------------------------------------------------------
// TEST 3: DUPLICATE SELLING (Server-side atomic pricing by rarity & single-copy protection)
// ----------------------------------------------------------------
console.log('\n--- TEST 3: Duplicate Items Selling Verification ---');

const sellerUser = createTestUser({ coins: 500 });
const inv = mockStore.getInventory();
inv[sellerUser.id] = [
  { id: 'inv-1', rewardId: 'reward-rose-1', quantity: 2 }, // Common (5–10)
  { id: 'inv-2', rewardId: 'title-balbibol', quantity: 3 }, // Uncommon (10–20)
  { id: 'inv-3', rewardId: 'title-terpilla', quantity: 2 }, // Rare (20–35)
  { id: 'inv-4', rewardId: 'title-femboy', quantity: 2 }, // Epic (40–55)
  { id: 'inv-5', rewardId: 'title-imperator', quantity: 2 }, // Pro-Epic (80–100)
  { id: 'inv-6', rewardId: 'reward-rose-big-bouquet', quantity: 2 }, // Mythic (150–200)
  { id: 'inv-7', rewardId: 'title-santa', quantity: 2 }, // Legendary (250–350)
  { id: 'inv-single', rewardId: 'reward-pop-10', quantity: 1 }, // Single copy (PROTECTED)
];
mockStore.saveInventory(inv);

// 3.1 Single copy protection
const singleSale = mockStore.sellDuplicate(sellerUser.id, 'reward-pop-10');
testAssert(singleSale.success === false, 'Selling single copy (x1) is strictly forbidden');
testAssert(singleSale.error.includes('Нельзя продать единственный экземпляр'), 'Returns correct single-copy protection error message');

// 3.2 Sell duplicate common (5-10 coins)
let prevBalance = 500;
const sellCommon = mockStore.sellDuplicate(sellerUser.id, 'reward-rose-1');
testAssert(sellCommon.success === true, 'Sold duplicate rose successfully');
testAssert(sellCommon.earnedCoins >= 5 && sellCommon.earnedCoins <= 10, `Common sold for ${sellCommon.earnedCoins} (within 5-10 Coins)`);
testAssert(sellCommon.remainingQuantity === 1, 'Remaining quantity is 1');
prevBalance += sellCommon.earnedCoins;
let checkUser = mockStore.getUserById(sellerUser.id);
testAssert(checkUser.coins_balance === prevBalance, `Coins balance credited correctly (+${sellCommon.earnedCoins} -> ${prevBalance})`);
testAssert(checkUser.points_balance === prevBalance, `Points balance synced at ${prevBalance}`);

// Now selling rose again must fail because only 1 remains
const sellCommonAgain = mockStore.sellDuplicate(sellerUser.id, 'reward-rose-1');
testAssert(sellCommonAgain.success === false, 'Cannot sell rose second time because quantity is now 1');

// 3.3 Sell duplicate uncommon (10-20 coins)
const sellUncommon = mockStore.sellDuplicate(sellerUser.id, 'title-balbibol');
testAssert(sellUncommon.success === true, 'Sold duplicate title-balbibol (x3 -> x2)');
testAssert(sellUncommon.earnedCoins >= 10 && sellUncommon.earnedCoins <= 20, `Uncommon sold for ${sellUncommon.earnedCoins} (within 10-20 Coins)`);
testAssert(sellUncommon.remainingQuantity === 2, 'Remaining quantity is 2 (still has duplicate)');

// 3.4 Sell duplicate pro-epic (80-100 coins)
const sellProEpic = mockStore.sellDuplicate(sellerUser.id, 'title-imperator');
testAssert(sellProEpic.success === true, 'Sold duplicate Pro-Epic title');
testAssert(sellProEpic.earnedCoins >= 80 && sellProEpic.earnedCoins <= 100, `Pro-Epic sold for ${sellProEpic.earnedCoins} (within 80-100 Coins)`);
testAssert(sellProEpic.remainingQuantity === 1, 'Remaining quantity is 1');

// 3.5 Sales history check
const salesHist = mockStore.getSalesHistory(sellerUser.id);
testAssert(salesHist.length === 3, `Sales history logged 3 sales records (found: ${salesHist.length})`);
testAssert(salesHist[0].userId === sellerUser.id, 'Sales history record contains correct user ID');

// ----------------------------------------------------------------
// TEST 4: SELL DUPLICATE -> SHOP PURCHASE (Interleaving Math)
// ----------------------------------------------------------------
console.log('\n--- TEST 4: Sell Duplicate -> Shop Purchase (Interleaving Math) ---');

const user4 = createTestUser({ coins: 15 });
const inv4 = mockStore.getInventory();
inv4[user4.id] = [{ id: 'inv-4-1', rewardId: 'title-imperator', quantity: 2 }];
mockStore.saveInventory(inv4);

// Balance 15: Not enough to buy reward-pop-10 (25 coins)
const failBuy4 = mockStore.purchaseItem(user4.id, 'reward-pop-10', 1);
testAssert(failBuy4.success === false, 'Cannot buy reward-pop-10 with 15 coins');

// Sell duplicate Pro-Epic (+80 to +100 Coins)
const sell4 = mockStore.sellDuplicate(user4.id, 'title-imperator');
testAssert(sell4.success === true, `Sold duplicate title, earned +${sell4.earnedCoins} coins`);
const balanceAfterSale = 15 + sell4.earnedCoins;
const u4AfterSale = mockStore.getUserById(user4.id);
testAssert(u4AfterSale.coins_balance === balanceAfterSale, `Balance is exactly 15 + ${sell4.earnedCoins} = ${balanceAfterSale}`);

// Now buy reward-pop-10 (25 coins)
const buy4 = mockStore.purchaseItem(user4.id, 'reward-pop-10', 1);
testAssert(buy4.success === true, 'Purchased reward-pop-10 successfully after selling duplicate');
testAssert(buy4.costCoins === 25, 'Deducted exactly 25 coins');
const expectedFinal4 = balanceAfterSale - 25;
const u4Final = mockStore.getUserById(user4.id);
testAssert(u4Final.coins_balance === expectedFinal4, `Final balance is exactly ${expectedFinal4}`);
testAssert(u4Final.points_balance === expectedFinal4, `Final points_balance is synced at ${expectedFinal4}`);

// ----------------------------------------------------------------
// TEST 5: SHOP PURCHASE -> SELL DUPLICATE
// ----------------------------------------------------------------
console.log('\n--- TEST 5: Shop Purchase -> Sell Duplicate ---');

const user5 = createTestUser({ coins: 100 });
// Buy 2 x reward-rose-1 (20 coins each = 40 coins)
const buy5 = mockStore.purchaseItem(user5.id, 'reward-rose-1', 2);
testAssert(buy5.success === true, 'Purchased 2 x reward-rose-1');
testAssert(buy5.costCoins === 40, 'Deducted 40 coins');
const u5AfterBuy = mockStore.getUserById(user5.id);
testAssert(u5AfterBuy.coins_balance === 60, 'Balance is 60 coins');

// Inventory now has quantity 2! Sell 1 duplicate copy
const sell5 = mockStore.sellDuplicate(user5.id, 'reward-rose-1');
testAssert(sell5.success === true, 'Sold 1 newly purchased duplicate rose');
const u5Final = mockStore.getUserById(user5.id);
testAssert(u5Final.coins_balance === 60 + sell5.earnedCoins, `Balance is 60 + ${sell5.earnedCoins} = ${u5Final.coins_balance}`);
testAssert(u5Final.points_balance === u5Final.coins_balance, 'points_balance synced with coins_balance');

// ----------------------------------------------------------------
// TEST 6: RAPID SEQUENCE OF PURCHASES AND SALES
// ----------------------------------------------------------------
console.log('\n--- TEST 6: Rapid Sequence of Purchases and Sales (Balance Integrity) ---');

const user6 = createTestUser({ coins: 1000 });
let expectedCoins = 1000;

// Operations sequence:
// 1. Buy 3 x Rose-1 (3 x 20 = 60) -> balance 940
const op1 = mockStore.purchaseItem(user6.id, 'reward-rose-1', 3);
expectedCoins -= 60;
testAssert(op1.costCoins === 60 && mockStore.getUserById(user6.id).coins_balance === expectedCoins, 'Step 1: Bought 3 roses');

// 2. Sell 1 Rose-1 duplicate -> balance 940 + earned
const op2 = mockStore.sellDuplicate(user6.id, 'reward-rose-1');
expectedCoins += op2.earnedCoins;
testAssert(mockStore.getUserById(user6.id).coins_balance === expectedCoins, 'Step 2: Sold 1 rose duplicate');

// 3. Buy 1 x Pop-10 (25) -> balance expected - 25
const op3 = mockStore.purchaseItem(user6.id, 'reward-pop-10', 1);
expectedCoins -= 25;
testAssert(op3.costCoins === 25 && mockStore.getUserById(user6.id).coins_balance === expectedCoins, 'Step 3: Bought 1 pop-10');

// 4. Sell 1 more Rose-1 duplicate (was 2 remaining, now 1) -> balance expected + earned
const op4 = mockStore.sellDuplicate(user6.id, 'reward-rose-1');
expectedCoins += op4.earnedCoins;
testAssert(mockStore.getUserById(user6.id).coins_balance === expectedCoins, 'Step 4: Sold second rose duplicate');

// 5. Verify final balance & synchronization
const u6Final = mockStore.getUserById(user6.id);
testAssert(u6Final.coins_balance === expectedCoins, `Final coins_balance matches exact math (${expectedCoins})`);
testAssert(u6Final.points_balance === expectedCoins, `Final points_balance is 100% in sync (${expectedCoins})`);

// ----------------------------------------------------------------
// TEST 7: EDGE CASES & VALIDATIONS
// ----------------------------------------------------------------
console.log('\n--- TEST 7: Edge Cases & Protection Validations ---');

const user7 = createTestUser({ coins: 0 });

// 7.1 Balance 0 -> cannot purchase
const e1 = mockStore.purchaseItem(user7.id, 'reward-rose-1', 1);
testAssert(e1.success === false, 'Balance 0: cannot purchase 20 coins item');
testAssert(mockStore.getUserById(user7.id).coins_balance === 0, 'Balance remains 0');

// 7.2 Balance 24, Item costs 25 -> rejected, balance stays 24
mockStore.updateCoinsBalance(user7.id, 24);
const e2 = mockStore.purchaseItem(user7.id, 'reward-pop-10', 1);
testAssert(e2.success === false, 'Balance 24: cannot purchase 25 coins item');
testAssert(mockStore.getUserById(user7.id).coins_balance === 24, 'Balance remains exactly 24');

// 7.3 Balance 25, Item costs 25 -> success, balance reaches 0
mockStore.updateCoinsBalance(user7.id, 25);
const e3 = mockStore.purchaseItem(user7.id, 'reward-pop-10', 1);
testAssert(e3.success === true, 'Balance 25: successfully purchased 25 coins item');
testAssert(mockStore.getUserById(user7.id).coins_balance === 0, 'Balance becomes exactly 0');
testAssert(mockStore.getUserById(user7.id).points_balance === 0, 'points_balance becomes exactly 0');

// 7.4 Invalid quantities
const invQuantities = [0, -1, -50, 101, NaN, 'abc'];
for (const badQ of invQuantities) {
  const badRes = mockStore.purchaseItem(user7.id, 'reward-rose-1', badQ);
  testAssert(badRes.success === false, `Quantity "${badQ}" is rejected`);
}

// 7.5 Sell non-existent item
const nonExistentSale = mockStore.sellDuplicate(user7.id, 'item-does-not-exist');
testAssert(nonExistentSale.success === false, 'Selling non-existent item is rejected');

// 7.6 Excluded items: UC items, VIP titles
const ucTry = mockStore.purchaseItem(user7.id, 'reward-uc-30', 1);
testAssert(ucTry.success === false, 'reward-uc-30 is excluded from shop');
const vipTry = mockStore.purchaseItem(user7.id, 'title-vip', 1);
testAssert(vipTry.success === false, 'title-vip is excluded from shop');

// 7.7 Free Spin shop items removal: cannot buy reward-spin-1 or reward-spin-2
const spin1Try = mockStore.purchaseItem(user7.id, 'reward-spin-1', 1);
testAssert(spin1Try.success === false, 'Purchasing reward-spin-1 in shop is strictly forbidden');
const spin2Try = mockStore.purchaseItem(user7.id, 'reward-spin-2', 1);
testAssert(spin2Try.success === false, 'Purchasing reward-spin-2 in shop is strictly forbidden');

// ----------------------------------------------------------------
// TEST 8: STRICT SYNCHRONIZATION OF COINS_BALANCE AND POINTS_BALANCE
// ----------------------------------------------------------------
console.log('\n--- TEST 8: Strict 1:1 Coins and Points Balance Sync Verification ---');

const syncUser = createTestUser({ coins: 500 });
testAssert(syncUser.coins_balance === syncUser.points_balance, 'Initial state: coins_balance === points_balance');

// Deduced via purchase
mockStore.purchaseItem(syncUser.id, 'reward-rose-1', 1); // 20 coins
const s1 = mockStore.getUserById(syncUser.id);
testAssert(s1.coins_balance === 480 && s1.points_balance === 480, 'After purchase: both balances are 480');

// Credited via duplicate selling
const syncInv = mockStore.getInventory();
syncInv[syncUser.id] = [{ id: 'sync-1', rewardId: 'reward-pacifier-bronze', quantity: 2 }];
mockStore.saveInventory(syncInv);
const sSale = mockStore.sellDuplicate(syncUser.id, 'reward-pacifier-bronze');
const s2 = mockStore.getUserById(syncUser.id);
testAssert(s2.coins_balance === 480 + sSale.earnedCoins, `After sell: coins_balance is ${s2.coins_balance}`);
testAssert(s2.points_balance === s2.coins_balance, `After sell: points_balance strictly matches coins_balance (${s2.points_balance})`);

// ----------------------------------------------------------------
// TEST 9: STANDARD LUCKY SPIN CONTINUES TO OPERATE (Game Reel & Daily Timer)
// ----------------------------------------------------------------
console.log('\n--- TEST 9: Standard Lucky Spin Wheel & Timer Intact ---');

const spinUser = createTestUser({ coins: 300, spins: 2, uc: 0 });
testAssert(spinUser.free_spins_balance === 2, 'User has 2 free spins for standard reel');

// Check spin prizes in REWARDS_CATALOG (Coins prizes, UC prizes, items)
const spinCoinsPrizes = REWARDS_CATALOG.filter((r) => r.category === 'coins');
const spinUcPrizes = REWARDS_CATALOG.filter((r) => r.category === 'uc');
testAssert(spinCoinsPrizes.length >= 4, `Spin wheel has ${spinCoinsPrizes.length} coins prizes (25, 50, 75, 125)`);
testAssert(spinUcPrizes.length >= 2, `Spin wheel has ${spinUcPrizes.length} UC prizes (30 UC, 60 UC)`);

// Daily timer check via mockStore.checkAndGrantDailySpins
const freshUser = createTestUser({ coins: 300, spins: 0 });
freshUser.last_daily_spins_at = null;
mockStore.updateUser(freshUser.id, { last_daily_spins_at: null, free_spins_balance: 0 });

const grantRes = mockStore.checkAndGrantDailySpins(freshUser.id);
testAssert(grantRes.granted === true, 'Daily free spins granted for new user');
testAssert(grantRes.freeSpins === 2, 'Granted exactly 2 daily free spins');

// Immediate second attempt must be on 24h cooldown
const grantRes2 = mockStore.checkAndGrantDailySpins(freshUser.id);
testAssert(grantRes2.granted === false, 'Immediate second daily spin claim is on 24-hour cooldown');
testAssert(grantRes2.nextDailySpinsAt !== null, 'Provides nextDailySpinsAt timestamp');

// User coins balance remains untouched after spin mechanics
const spinUserAfter = mockStore.getUserById(freshUser.id);
testAssert(spinUserAfter.coins_balance === 300, 'Coins balance was not damaged by Lucky Spin');
testAssert(spinUserAfter.points_balance === 300, 'Points balance remains synced at 300');

// ----------------------------------------------------------------
// TEST 10: ADMIN PRIVILEGES ON PURCHASES (Cost 0 Coins, Audit Logged)
// ----------------------------------------------------------------
console.log('\n--- TEST 10: Admin Free Purchases & Audit Logging ---');

const adminUser = createTestUser({ isAdmin: true });
const initialAdminCoins = mockStore.getUserById(adminUser.id).coins_balance;
const adminBuy = mockStore.purchaseItem(adminUser.id, 'title-sosun', 1); // 250 coins title
testAssert(adminBuy.success === true, 'Admin successfully purchased 250 coins title');
testAssert(adminBuy.costCoins === 0, 'Admin was charged 0 coins');
testAssert(adminBuy.isAdmin === true, 'Response flags isAdmin: true');

const adminAfter = mockStore.getUserById(adminUser.id);
testAssert(adminAfter.coins_balance === initialAdminCoins, `Admin coins_balance remained untouched at ${initialAdminCoins}`);
testAssert(adminAfter.points_balance === initialAdminCoins, `Admin points_balance remained untouched at ${initialAdminCoins}`);

const purHistory = mockStore.getPurchasesHistory(adminUser.id);
testAssert(purHistory.length > 0, 'Admin purchase recorded in purchases history');
testAssert(purHistory[0].isAdminPurchase === true, 'Purchase record logged as admin purchase (cost: 0)');

// ----------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------
console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100%)!`);
console.log('================================================================');
