/**
 * LUCKY UC - Complete Application Audit & Verification Suite
 * Verifies all bug fixes, shop prices, VIP protections, ban enforcement, and IP tracking.
 */

import { mockStore } from '../lib/mock-store.js';
import {
  REWARDS_CATALOG,
  TITLES_LIST,
  getShopItems,
  resolveReward,
  resolveTitle,
  toDbUuid,
  isItemAvailableInShop,
} from '../lib/catalog-data.js';
import { getClientIp, isValidIp } from '../lib/ip-utils.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
  passedTests++;
}

console.log('================================================================');
console.log('1. VERIFYING CATALOG DATA & SHOP PRICES');
console.log('================================================================');

// 1.1 Every item in REWARDS_CATALOG has non-null UUID
const nullUuids = REWARDS_CATALOG.filter((r) => !r.uuid);
assert(nullUuids.length === 0, `All ${REWARDS_CATALOG.length} catalog rewards must have valid UUIDs`);

// 1.2 Specific previously broken items have exact UUIDs
assert(toDbUuid('reward-rose-1') === '10000000-0000-0000-0000-000000000007', 'reward-rose-1 resolves to canonical UUID');
assert(toDbUuid('reward-rose-big-bouquet') === '10000000-0000-0000-0000-000000000009', 'reward-rose-big-bouquet resolves to canonical UUID');
assert(toDbUuid('reward-boxers-grandpa') === '10000000-0000-0000-0000-000000000022', 'reward-boxers-grandpa resolves to canonical UUID');
assert(toDbUuid('reward-boxers-andrey') === '10000000-0000-0000-0000-000000000023', 'reward-boxers-andrey resolves to canonical UUID');

// 1.3 Check prices: No item in shop costs 1 coin!
const shopItems = getShopItems();
const oneCoinItems = shopItems.filter((i) => i.priceCoins === 1 || i.pricePoints === 1);
assert(oneCoinItems.length === 0, `No items in shop cost 1 coin (Found: ${oneCoinItems.map((i) => i.id).join(', ')})`);

const roseItem = shopItems.find((i) => i.id === 'reward-rose-1');
assert(roseItem && roseItem.priceCoins === 20, 'reward-rose-1 costs exactly 20 coins in shop');

const spinItem = shopItems.find((i) => i.id === 'reward-spin-1');
assert(spinItem && spinItem.priceCoins === 75, 'reward-spin-1 costs exactly 75 coins in shop');

const spin2Item = shopItems.find((i) => i.id === 'reward-spin-2');
assert(spin2Item && spin2Item.priceCoins === 140, 'reward-spin-2 costs exactly 140 coins in shop');

console.log('\n================================================================');
console.log('2. VERIFYING IP DETECTION UTILITY');
console.log('================================================================');

assert(isValidIp('192.168.1.1'), '192.168.1.1 is valid IPv4');
assert(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), 'IPv6 address is valid');
assert(!isValidIp('not-an-ip; DROP TABLE'), 'SQL injection / invalid string rejected as IP');

// Test Cloudflare header priority
const reqCf = {
  headers: {
    'cf-connecting-ip': '203.0.113.195',
    'x-real-ip': '10.0.0.1',
    'x-forwarded-for': '198.51.100.1, 10.0.0.2',
  },
};
assert(getClientIp(reqCf) === '203.0.113.195', 'cf-connecting-ip has highest priority');

// Test X-Real-IP
const reqReal = {
  headers: {
    'x-real-ip': '198.51.100.22',
    'x-forwarded-for': '10.0.0.2',
  },
};
assert(getClientIp(reqReal) === '198.51.100.22', 'x-real-ip extracted correctly');

// Test X-Forwarded-For first IP
const reqXff = {
  headers: {
    'x-forwarded-for': '192.0.2.1, 10.0.0.1, 172.16.0.1',
  },
};
assert(getClientIp(reqXff) === '192.0.2.1', 'x-forwarded-for first hop extracted correctly');

console.log('\n================================================================');
console.log('3. VERIFYING PLAYER CONNECTION TRACKING & DEDUPLICATION');
console.log('================================================================');

const testUserId = 'test-track-user-' + Date.now();
const testUsername = 'audit_tester_' + Date.now();

// First connection
const log1 = mockStore.logUserConnection(testUserId, testUsername, '203.0.113.50', 'TestBrowser/1.0');
assert(log1.success && log1.action === 'inserted', 'First connection logged as inserted');

// Immediate second connection (same IP within 15 mins) -> deduplication
const log2 = mockStore.logUserConnection(testUserId, testUsername, '203.0.113.50', 'TestBrowser/1.0');
assert(log2.success && log2.action === 'updated', 'Duplicate connection within 15 mins updated count');
assert(log2.connection.connectionsCount >= 2, 'connectionsCount incremented');

// Query connection history
const history = mockStore.getConnectionHistory({ search: testUsername });
assert(history.success && history.connections.length > 0, 'Connection history successfully retrieved by search');
assert(history.connections[0].username === testUsername, 'Connection record matches username');

console.log('\n================================================================');
console.log('4. VERIFYING ADMIN VIP & SYSTEM ACCOUNT PROTECTION');
console.log('================================================================');

const adminUser = mockStore.getUserByUsername('admin');
assert(adminUser && adminUser.is_admin, 'Admin account exists and is admin');

const vipUser = mockStore.getUserByUsername('vip5000x');
assert(vipUser && vipUser.is_vip, 'VIP account exists and is VIP');

// 4.1 Cannot delete Admin
const deleteAdminRes = mockStore.adminDeleteUser(adminUser.id, adminUser.id);
assert(!deleteAdminRes.success && deleteAdminRes.error.includes('Запрещено'), 'Deleting Admin account is strictly forbidden');

// 4.2 Cannot delete VIP
const deleteVipRes = mockStore.adminDeleteUser(adminUser.id, vipUser.id);
assert(!deleteVipRes.success && deleteVipRes.error.includes('Запрещено'), 'Deleting VIP account is strictly forbidden');

// 4.3 Clean test account deletion
const dummyUser = {
  id: 'user-dummy-delete-test',
  username: 'dummy_delete_test',
  coins_balance: 100,
  points_balance: 100,
  total_uc: 0,
  is_admin: false,
  is_vip: false,
};
mockStore.addUser(dummyUser);
assert(mockStore.getUserById(dummyUser.id) !== null, 'Dummy user added for deletion test');

const deleteDummyRes = mockStore.adminDeleteUser(adminUser.id, dummyUser.id);
assert(deleteDummyRes.success, 'Standard account successfully deleted by admin');
assert(mockStore.getUserById(dummyUser.id) === null, 'Deleted account no longer exists in store');

console.log('\n================================================================');
console.log('5. VERIFYING SHOP PURCHASES: ALL TYPES, LIMITS & OVERFLOW');
console.log('================================================================');

// Test buyer account
const buyerUser = {
  id: 'user-audit-buyer-' + Date.now(),
  username: 'audit_buyer_' + Date.now(),
  coins_balance: 10000,
  points_balance: 5000,
  total_uc: 0,
  is_admin: false,
  is_vip: false,
  is_blocked: false,
};
mockStore.addUser(buyerUser);

// 5.1 Purchase Rose (20 coins)
const buyRose = mockStore.purchaseItem(buyerUser.id, 'reward-rose-1', 1);
assert(buyRose.success && buyRose.costCoins === 20, 'reward-rose-1 (Roses) costs 20 coins');

// 5.2 Purchase Popularity (25 coins)
const buyPop = mockStore.purchaseItem(buyerUser.id, 'reward-pop-10', 1);
assert(buyPop.success && buyPop.costCoins === 25, 'reward-pop-10 (Popularity) costs 25 coins');

// 5.3 Purchase Spins (75 coins)
const buySpins = mockStore.purchaseItem(buyerUser.id, 'reward-spin-1', 1);
assert(buySpins.success && buySpins.costCoins === 75, 'reward-spin-1 (Spins) costs 75 coins');

// 5.4 Purchase Title (250 coins)
const buyTitle = mockStore.purchaseItem(buyerUser.id, 'title-sosun', 1);
assert(buyTitle.success && buyTitle.costCoins === 250, 'title-sosun (Titles) costs 250 coins');

// 5.5 Purchase Joke item (200 coins)
const buyJoke = mockStore.purchaseItem(buyerUser.id, 'reward-pacifier-bronze', 1);
assert(buyJoke.success && buyJoke.costCoins === 200, 'reward-pacifier-bronze (Jokes) costs 200 coins');

// 5.6 Purchase Christmas item (30 coins)
const buyXmas = mockStore.purchaseItem(buyerUser.id, 'reward-xmas-sticker', 1);
assert(buyXmas.success && buyXmas.costCoins === 30, 'reward-xmas-sticker (Christmas) costs 30 coins');

// 5.7 Invariant: points_balance remains 100% UNTOUCHED
const buyerAfterAll = mockStore.getUserById(buyerUser.id);
assert(buyerAfterAll.points_balance === 5000, 'points_balance (PP) remained strictly untouched (5000)');
const totalSpent = 20 + 25 + 75 + 250 + 200 + 30; // 600
assert(buyerAfterAll.coins_balance === 10000 - totalSpent, `Coins deducted by exactly ${totalSpent} (from 10000 to ${10000 - totalSpent})`);

// 5.8 Quantity bounds: quantity < 1 or > 100 rejected
const buyInvalidZero = mockStore.purchaseItem(buyerUser.id, 'reward-rose-1', 0);
assert(!buyInvalidZero.success && buyInvalidZero.error.includes('Недопустимое количество'), 'quantity = 0 is rejected');

const buyInvalidNeg = mockStore.purchaseItem(buyerUser.id, 'reward-rose-1', -5);
assert(!buyInvalidNeg.success && buyInvalidNeg.error.includes('Недопустимое количество'), 'quantity = -5 is rejected');

const buyInvalidOver100 = mockStore.purchaseItem(buyerUser.id, 'reward-rose-1', 101);
assert(!buyInvalidOver100.success && buyInvalidOver100.error.includes('Недопустимое количество'), 'quantity = 101 is rejected');

// 5.9 Missing item rejection
const buyNonExistent = mockStore.purchaseItem(buyerUser.id, 'reward-nonexistent-ghost-item', 1);
assert(!buyNonExistent.success && buyNonExistent.error.includes('не найден'), 'Non-existent item is rejected');

// 5.10 Insufficient balance rejection
const brokeUser = {
  id: 'broke-user-' + Date.now(),
  username: 'broke_' + Date.now(),
  coins_balance: 10,
  points_balance: 1000,
  total_uc: 0,
  is_admin: false,
  is_vip: false,
};
mockStore.addUser(brokeUser);
const buyExpensive = mockStore.purchaseItem(brokeUser.id, 'title-sosun', 1); // 250 coins
assert(!buyExpensive.success && buyExpensive.error.includes('Недостаточно Монет'), 'Purchase rejected on insufficient coins');
assert(mockStore.getUserById(brokeUser.id).coins_balance === 10, 'Coins balance untouched after failed purchase');
mockStore.adminDeleteUser(adminUser.id, brokeUser.id);

// 5.11 Admin buys for 0 coins, coins balance untouched
const adminCoinsBefore = adminUser.coins_balance;
const adminBuyRes = mockStore.purchaseItem(adminUser.id, 'reward-rose-big-bouquet', 1);
assert(adminBuyRes.success && adminBuyRes.costCoins === 0, 'Admin charged 0 coins');
assert(mockStore.getUserById(adminUser.id).coins_balance === adminCoinsBefore, 'Admin coins_balance untouched after purchase');

// 5.12 Excluded items rejection (UC VIP)
const buyUcRes = mockStore.purchaseItem(buyerUser.id, 'reward-uc-30', 1);
assert(!buyUcRes.success, 'reward-uc-30 is excluded from shop purchase');

console.log('\n================================================================');
console.log('6. VERIFYING BAN ENFORCEMENT ON GAME ACTIONS');
console.log('================================================================');

// Block buyer
mockStore.updateUser(buyerUser.id, { is_blocked: true });
const blockedBuyer = mockStore.getUserById(buyerUser.id);
assert(blockedBuyer.is_blocked === true, 'Buyer user is now blocked');

// Blocked user cannot purchase in shop
const blockedBuyRes = mockStore.purchaseItem(buyerUser.id, 'reward-rose-1', 1);
assert(!blockedBuyRes.success && blockedBuyRes.error.includes('заблокирован'), 'Blocked user cannot buy in shop');

// Blocked user cannot claim daily spins
const blockedDailyRes = mockStore.checkAndGrantDailySpins(buyerUser.id);
assert(!blockedDailyRes.success && blockedDailyRes.error.includes('заблокирован'), 'Blocked user cannot claim daily spins');

// Clean up test user
mockStore.adminDeleteUser(adminUser.id, buyerUser.id);

console.log('\n================================================================');
console.log('7. VERIFYING ACCOUNT PURGE & CURRENCY RESET WITH VIP PRESERVATION');
console.log('================================================================');

// Ensure rubix0 and xronix7 purged if created
mockStore.addUser({
  id: 'user-rubix0-test',
  username: 'rubix0',
  coins_balance: 500,
  points_balance: 500,
  total_uc: 500,
  is_admin: false,
  is_vip: false,
});
mockStore.addUser({
  id: 'user-xronix7-test',
  username: 'xronix7',
  coins_balance: 700,
  points_balance: 700,
  total_uc: 700,
  is_admin: false,
  is_vip: false,
});

const purgeRes = mockStore.purgeTargetAccounts(['rubix0', 'xronix7']);
assert(purgeRes.success, 'purgeTargetAccounts executed');

const rubix = mockStore.getUserByUsername('rubix0');
assert(rubix.points_balance === 0 && rubix.total_uc === 0, 'rubix0 balances completely wiped to 0');
const xronix = mockStore.getUserByUsername('xronix7');
assert(xronix.points_balance === 0 && xronix.total_uc === 0, 'xronix7 balances completely wiped to 0');

// Clean them up from test store
mockStore.adminDeleteUser(adminUser.id, rubix.id);
mockStore.adminDeleteUser(adminUser.id, xronix.id);

// Add standard player with coins and PP/UC
const stdUser = {
  id: 'standard-user-reset-test-' + Date.now(),
  username: 'std_test_' + Date.now(),
  coins_balance: 750,
  points_balance: 500,
  total_uc: 120,
  is_admin: false,
  is_vip: false,
};
mockStore.addUser(stdUser);

// Run currency reset
const resetRes = mockStore.resetPlayerCurrencies();
assert(resetRes.success, 'resetPlayerCurrencies executed');

// Verify standard user: PP and UC zeroed, but coins preserved!
const reloadedStd = mockStore.getUserById(stdUser.id);
assert(reloadedStd.points_balance === 0, 'Standard user PP (points_balance) is reset to 0');
assert(reloadedStd.total_uc === 0, 'Standard user UC (total_uc) is reset to 0');
assert(reloadedStd.coins_balance === 750, 'Standard user Coins (coins_balance) are PRESERVED at 750');

// Verify VIP & Admin were untouched
const reloadedVip = mockStore.getUserByUsername('vip5000x');
assert(reloadedVip.total_uc === 5000, 'VIP total_uc remains 5000 (UNTOUCHED)');
assert(reloadedVip.coins_balance >= 1000, 'VIP coins_balance remains >= 1000 (UNTOUCHED)');

const reloadedAdmin = mockStore.getUserByUsername('admin');
assert(reloadedAdmin.total_uc >= 5000, 'Admin total_uc remains >= 5000 (UNTOUCHED)');
assert(reloadedAdmin.coins_balance === 999999, 'Admin coins_balance remains 999999 (UNTOUCHED)');

// Clean up standard user
mockStore.adminDeleteUser(adminUser.id, stdUser.id);

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED PERFECTLY!`);
console.log('================================================================');
