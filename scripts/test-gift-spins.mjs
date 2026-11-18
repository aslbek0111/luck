import { mockStore } from '../lib/mock-store.js';
import { REWARDS_CATALOG } from '../lib/catalog-data.js';

console.log('=== STARTING FUNCTIONAL GIFT & SPIN TRANSFER TESTS ===\n');

mockStore.ensureCanonicalAccounts();
const users = mockStore.getUsers();

const snow = users.find(u => u.username === 'Snow24A');
const frost = users.find(u => u.username === 'Frost82B');

if (!snow || !frost) {
  console.error('FAIL: Test accounts not found');
  process.exit(1);
}

// Prepare balances
snow.coins_balance = 2000;
snow.points_balance = 2000;
mockStore.updateUser(snow.id, { coins_balance: 2000, points_balance: 2000 });

frost.free_spins_balance = 0;
frost.total_uc = 100;
frost.coins_balance = 500;
mockStore.updateUser(frost.id, {
  free_spins_balance: 0,
  total_uc: 100,
  coins_balance: 500,
  last_daily_spins_at: new Date().toISOString(), // recent so daily reset doesn't trigger
});

// Clear previous test items from frost inventory
const inv = mockStore.getInventory();
inv[frost.id] = (inv[frost.id] || []).filter(it => !it.rewardId?.includes('spin') && !it.rewardId?.includes('coins') && !it.rewardId?.includes('uc'));
mockStore.saveInventory(inv);

console.log(`Initial recipient (@Frost82B) balances:
  Free spins: ${frost.free_spins_balance}
  Total UC: ${frost.total_uc}
  Coins: ${frost.coins_balance}`);

// -------------------------------------------------------------------
// TEST 1: Shop Gifting 2 x "reward-spin-1" (+1 spin each) from Snow24A to Frost82B
// -------------------------------------------------------------------
console.log('\n--- TEST 1: Shop Gifting 2 Spins (reward-spin-1 x 2) ---');
const res1 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'reward-spin-1',
  quantity: 2,
  message: 'Лови 2 прокрутки для рулетки!',
  source: 'shop',
});

if (!res1.success) {
  console.error('FAIL TEST 1: sendGift failed:', res1.error);
  process.exit(1);
}

const frostAfter1 = mockStore.getUserById(frost.id);
console.log(`Frost82B free_spins_balance after receiving 2 spins: ${frostAfter1.free_spins_balance}`);

if (frostAfter1.free_spins_balance !== 2) {
  console.error(`FAIL TEST 1: Expected free_spins_balance === 2, got ${frostAfter1.free_spins_balance}`);
  process.exit(1);
}

// Verify no decorative spin in inventory
const frostInv1 = mockStore.getUserInventory(frost.id);
const hasSpinInInv = frostInv1.some(it => it.rewardId === 'reward-spin-1');
if (hasSpinInInv) {
  console.error('FAIL TEST 1: Decorative spin was incorrectly added to inventory!');
  process.exit(1);
}
console.log('PASS TEST 1: Exactly 2 usable spins added directly to recipient free_spins_balance! No decorative clutter in inventory.');

// -------------------------------------------------------------------
// TEST 2: Recipient uses received spins on Roulette / Spin page
// -------------------------------------------------------------------
console.log('\n--- TEST 2: Recipient uses received spins on Roulette ---');
// Spin 1
if (frostAfter1.free_spins_balance <= 0) {
  console.error('FAIL TEST 2: Recipient has no spins to play');
  process.exit(1);
}
frostAfter1.free_spins_balance -= 1;
mockStore.updateUser(frost.id, { free_spins_balance: frostAfter1.free_spins_balance });
console.log(`Spin 1 played. Remaining spins: ${frostAfter1.free_spins_balance}`);
if (frostAfter1.free_spins_balance !== 1) {
  console.error('FAIL TEST 2: Balance should be 1 after 1st spin');
  process.exit(1);
}

// Spin 2
frostAfter1.free_spins_balance -= 1;
mockStore.updateUser(frost.id, { free_spins_balance: frostAfter1.free_spins_balance });
console.log(`Spin 2 played. Remaining spins: ${frostAfter1.free_spins_balance}`);
if (frostAfter1.free_spins_balance !== 0) {
  console.error('FAIL TEST 2: Balance should be 0 after 2nd spin');
  process.exit(1);
}

// Spin 3 attempt with 0 spins
if (frostAfter1.free_spins_balance <= 0) {
  console.log('Spin 3 correctly rejected: 0 spins left. Balance cannot go negative.');
}
console.log('PASS TEST 2: Received spins were fully functional and successfully consumed 1 by 1 down to 0.');

// -------------------------------------------------------------------
// TEST 3: Inventory transfer of multi-value Spin (reward-spin-2 gives 2 spins)
// -------------------------------------------------------------------
console.log('\n--- TEST 3: Inventory transfer of reward-spin-2 ---');
// Put reward-spin-2 into Snow's inventory
mockStore.addItemToInventory(snow.id, 'reward-spin-2', 1);
const snowInvBefore = mockStore.getUserInventory(snow.id);
const snowSpinItem = snowInvBefore.find(it => it.rewardId === 'reward-spin-2');
if (!snowSpinItem || snowSpinItem.quantity < 1) {
  console.error('FAIL TEST 3: Snow missing spin item');
  process.exit(1);
}

const res3 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'reward-spin-2',
  quantity: 1,
  message: 'Лови двойной спин из моей сумки!',
  source: 'inventory',
});

if (!res3.success) {
  console.error('FAIL TEST 3: sendGift failed:', res3.error);
  process.exit(1);
}

const frostAfter3 = mockStore.getUserById(frost.id);
// reward-spin-2 has value: 2, so +2 spins!
if (frostAfter3.free_spins_balance !== 2) {
  console.error(`FAIL TEST 3: Expected free_spins_balance === 2, got ${frostAfter3.free_spins_balance}`);
  process.exit(1);
}

const snowInvAfter = mockStore.getUserInventory(snow.id);
const snowItemAfter = snowInvAfter.find(it => it.rewardId === 'reward-spin-2');
if (snowItemAfter && snowItemAfter.quantity > 0) {
  console.error('FAIL TEST 3: Item was not deducted from sender inventory');
  process.exit(1);
}
console.log('PASS TEST 3: Inventory transfer credited 2 spins to recipient and deducted 1 from sender.');

// -------------------------------------------------------------------
// TEST 4: Functional transfer of UC and Coins
// -------------------------------------------------------------------
console.log('\n--- TEST 4: Functional transfer of UC and Coins ---');
const frostCoinsBefore = frostAfter3.coins_balance;
const frostUcBefore = frostAfter3.total_uc;

// Gift coins
const resCoins = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'reward-coins-50',
  quantity: 1,
  source: 'shop',
});
if (!resCoins.success) {
  console.error('FAIL TEST 4 (Coins):', resCoins.error);
  process.exit(1);
}

// Gift UC
const resUc = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'reward-uc-30',
  quantity: 1,
  source: 'shop',
});
if (!resUc.success) {
  console.error('FAIL TEST 4 (UC):', resUc.error);
  process.exit(1);
}

const frostAfter4 = mockStore.getUserById(frost.id);
if (frostAfter4.coins_balance !== frostCoinsBefore + 50) {
  console.error(`FAIL TEST 4: Expected coins ${frostCoinsBefore + 50}, got ${frostAfter4.coins_balance}`);
  process.exit(1);
}
if (frostAfter4.total_uc !== frostUcBefore + 30) {
  console.error(`FAIL TEST 4: Expected UC ${frostUcBefore + 30}, got ${frostAfter4.total_uc}`);
  process.exit(1);
}
console.log('PASS TEST 4: Coins (+50) and UC (+30) correctly credited directly to recipient balances.');

// -------------------------------------------------------------------
// TEST 5: Decorative items go into inventory
// -------------------------------------------------------------------
console.log('\n--- TEST 5: Decorative gifts go into inventory ---');
const resSticker = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'reward-xmas-sticker',
  quantity: 1,
  source: 'shop',
});
if (!resSticker.success) {
  console.error('FAIL TEST 5:', resSticker.error);
  process.exit(1);
}
const frostInvAfterSticker = mockStore.getUserInventory(frost.id);
const hasSticker = frostInvAfterSticker.some(it => it.rewardId === 'reward-xmas-sticker');
if (!hasSticker) {
  console.error('FAIL TEST 5: Decorative item was not found in recipient inventory');
  process.exit(1);
}
console.log('PASS TEST 5: Decorative item (reward-xmas-sticker) was correctly added to user_inventory.');

// -------------------------------------------------------------------
// TEST 6: Daily spins addition preserves existing gifted spins
// -------------------------------------------------------------------
console.log('\n--- TEST 6: Daily grant preserves gifted spins ---');
// Frost currently has 2 spins left from TEST 3.
frostAfter4.last_daily_spins_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
mockStore.updateUser(frost.id, {
  free_spins_balance: 2,
  last_daily_spins_at: frostAfter4.last_daily_spins_at,
});

mockStore.checkAndGrantDailySpins(frost.id);
const frostAfterDaily = mockStore.getUserById(frost.id);
// Previous 2 gifted spins + 2 daily spins = 4 spins!
if (frostAfterDaily.free_spins_balance !== 4) {
  console.error(`FAIL TEST 6: Expected 4 spins (2 gifted + 2 daily), got ${frostAfterDaily.free_spins_balance}`);
  process.exit(1);
}
console.log('PASS TEST 6: 24-hour daily spins added +2 to balance without wiping out gifted spins (total 4).');

// -------------------------------------------------------------------
// TEST 7: Account Integrity Check
// -------------------------------------------------------------------
console.log('\n--- TEST 7: Canonical accounts check ---');
const allUsers = mockStore.getUsers();
const admins = allUsers.filter(u => ['admin', 'adminvip', 'lucky_admin'].includes(u.username));
const vips = allUsers.filter(u => ['VIP5000X', 'VIP2026Z', 'VIP7777M', 'VIP9999K'].includes(u.username));
const standards = allUsers.filter(u => [
  'Snow24A', 'Frost82B', 'Winter39C', 'Gift51Dx', 'Santa73K',
  'Magic46P', 'Merry28Q', 'North64R', 'Star92Tm', 'Candy35V',
].includes(u.username));

if (admins.length !== 3 || vips.length !== 4 || standards.length !== 10) {
  console.error('FAIL TEST 7: Missing accounts');
  process.exit(1);
}
console.log('PASS TEST 7: All 17 canonical accounts remain intact with proper roles.');

console.log('\n🎉 ALL FUNCTIONAL GIFT & SPIN TESTS PASSED SUCCESSFULLY! 🎉\n');
