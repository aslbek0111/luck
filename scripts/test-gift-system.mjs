import { mockStore } from '../lib/mock-store.js';
import { REWARDS_CATALOG } from '../lib/catalog-data.js';

console.log('--- STARTING PLAYER-TO-PLAYER GIFT SYSTEM TEST ---');

// 1. Initialize store & canonical accounts
mockStore.ensureCanonicalAccounts();
const users = mockStore.getUsers();

const snow = users.find(u => u.username === 'Snow24A');
const frost = users.find(u => u.username === 'Frost82B');

if (!snow || !frost) {
  console.error('FAIL: Test users Snow24A or Frost82B not found!');
  process.exit(1);
}

console.log(`Found sender: @${snow.username} (id: ${snow.id}), recipient: @${frost.username} (id: ${frost.id})`);

// Setup test conditions:
// Ensure snow has coins
snow.coins_balance = Math.max(snow.coins_balance || 0, 1000);
snow.points_balance = snow.coins_balance;
mockStore.updateUser(snow.id, { coins_balance: snow.coins_balance, points_balance: snow.points_balance });

// Ensure snow has an inventory item
const testReward = REWARDS_CATALOG.find(r => r.priceCoins && r.priceCoins > 0) || REWARDS_CATALOG[0];
const inventory = mockStore.getInventory();
if (!inventory[snow.id]) inventory[snow.id] = [];
const existingItem = inventory[snow.id].find(it => it.rewardId === testReward.id);
if (existingItem) {
  existingItem.quantity += 2;
} else {
  inventory[snow.id].push({
    id: `test-inv-${Date.now()}`,
    rewardId: testReward.id,
    quantity: 2,
    acquiredAt: new Date().toISOString(),
  });
}
mockStore.saveInventory(inventory);

const initialSnowQty = (mockStore.getInventory()[snow.id]?.find(i => i.rewardId === testReward.id)?.quantity) || 0;
const initialFrostQty = (mockStore.getInventory()[frost.id]?.find(i => i.rewardId === testReward.id)?.quantity) || 0;
const initialSnowCoins = snow.coins_balance;

console.log(`Initial status:
  Snow24A coins: ${initialSnowCoins}
  Snow24A '${testReward.name}' qty: ${initialSnowQty}
  Frost82B '${testReward.name}' qty: ${initialFrostQty}`);

// -------------------------------------------------------------
// TEST 1: Inventory transfer (Snow24A -> Frost82B)
// -------------------------------------------------------------
console.log('\n--- TEST 1: Inventory transfer ---');
const res1 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: testReward.id,
  quantity: 1,
  message: 'Тебе от меня новогодний подарок!',
  source: 'inventory',
});

if (!res1.success) {
  console.error('FAIL TEST 1: Inventory gift failed:', res1.error);
  process.exit(1);
}

const snowQtyAfter1 = (mockStore.getInventory()[snow.id]?.find(i => i.rewardId === testReward.id)?.quantity) || 0;
const frostQtyAfter1 = (mockStore.getInventory()[frost.id]?.find(i => i.rewardId === testReward.id)?.quantity) || 0;

if (snowQtyAfter1 !== initialSnowQty - 1) {
  console.error(`FAIL TEST 1: Snow qty should be ${initialSnowQty - 1}, got ${snowQtyAfter1}`);
  process.exit(1);
}
if (frostQtyAfter1 !== initialFrostQty + 1) {
  console.error(`FAIL TEST 1: Frost qty should be ${initialFrostQty + 1}, got ${frostQtyAfter1}`);
  process.exit(1);
}
console.log('PASS TEST 1: Inventory transferred successfully! Deducted 1 from sender, credited 1 to recipient.');

// -------------------------------------------------------------
// TEST 2: Shop Gifting with Coins (Snow24A -> Frost82B)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Shop Gifting with Coins ---');
const shopReward = REWARDS_CATALOG.find(r => r.priceCoins && r.priceCoins > 0 && r.id !== testReward.id) || testReward;
const expectedCost = shopReward.priceCoins || 100;

const initialFrostShopQty = (mockStore.getInventory()[frost.id]?.find(i => i.rewardId === shopReward.id)?.quantity) || 0;

const res2 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: shopReward.id,
  quantity: 1,
  message: 'Купил для тебя в магазине!',
  source: 'shop',
});

if (!res2.success) {
  console.error('FAIL TEST 2: Shop gift failed:', res2.error);
  process.exit(1);
}

const updatedSnow = mockStore.getUsers().find(u => u.id === snow.id);
const frostShopQtyAfter2 = (mockStore.getInventory()[frost.id]?.find(i => i.rewardId === shopReward.id)?.quantity) || 0;

if (updatedSnow.coins_balance !== initialSnowCoins - expectedCost) {
  console.error(`FAIL TEST 2: Snow coins should be ${initialSnowCoins - expectedCost}, got ${updatedSnow.coins_balance}`);
  process.exit(1);
}
if (frostShopQtyAfter2 !== initialFrostShopQty + 1) {
  console.error(`FAIL TEST 2: Frost item qty should be ${initialFrostShopQty + 1}, got ${frostShopQtyAfter2}`);
  process.exit(1);
}
console.log(`PASS TEST 2: Shop gift succeeded! Deducted ${expectedCost} coins from sender, credited item to recipient.`);

// -------------------------------------------------------------
// TEST 3: Validation - Cannot send to self
// -------------------------------------------------------------
console.log('\n--- TEST 3: Prevent sending to self ---');
const res3 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: snow.username,
  rewardId: testReward.id,
  quantity: 1,
  source: 'inventory',
});
if (res3.success || !res3.error.includes('самому себе')) {
  console.error('FAIL TEST 3: Should prevent sending gift to self, got:', res3);
  process.exit(1);
}
console.log('PASS TEST 3: Self-gifting prevented correctly:', res3.error);

// -------------------------------------------------------------
// TEST 4: Validation - Cannot send unowned item from inventory
// -------------------------------------------------------------
console.log('\n--- TEST 4: Prevent unowned item transfer ---');
const res4 = mockStore.sendGift({
  senderId: snow.id,
  recipientUsername: frost.username,
  rewardId: 'completely-non-existent-item-uuid-12345',
  quantity: 1,
  source: 'inventory',
});
if (res4.success) {
  console.error('FAIL TEST 4: Should reject unowned item from inventory');
  process.exit(1);
}
console.log('PASS TEST 4: Unowned inventory item rejected correctly:', res4.error);

// -------------------------------------------------------------
// TEST 5: Verify Notification for Recipient
// -------------------------------------------------------------
console.log('\n--- TEST 5: Notification check ---');
const notifications = mockStore.getNotifications(frost.id);
const giftNotif = notifications.find(n => n.type === 'gift_received');
if (!giftNotif) {
  console.error('FAIL TEST 5: Recipient did not receive gift_received notification!');
  process.exit(1);
}
console.log(`PASS TEST 5: Notification received by recipient: "${giftNotif.title}" - "${giftNotif.message}"`);

// -------------------------------------------------------------
// TEST 6: Verify Gifts History in MockStore
// -------------------------------------------------------------
console.log('\n--- TEST 6: Gift History audit check ---');
const history = mockStore.getGiftsHistory();
const sentBySnow = history.filter(h => h.senderId === snow.id && h.recipientId === frost.id);
if (sentBySnow.length < 2) {
  console.error('FAIL TEST 6: Expected at least 2 gift entries in history, found:', sentBySnow.length);
  process.exit(1);
}
console.log(`PASS TEST 6: Found ${sentBySnow.length} gifts in history connecting Snow24A to Frost82B.`);

// -------------------------------------------------------------
// TEST 7: Verify all canonical roles (Standard, VIP, ADMIN) remain intact
// -------------------------------------------------------------
console.log('\n--- TEST 7: Role & Account Integrity Check ---');
const allUsers = mockStore.getUsers();
const admins = allUsers.filter(u => ['admin', 'adminvip', 'lucky_admin'].includes(u.username));
const vips = allUsers.filter(u => ['VIP5000X', 'VIP2026Z', 'VIP7777M', 'VIP9999K'].includes(u.username));
const standards = allUsers.filter(u => [
  'Snow24A', 'Frost82B', 'Winter39C', 'Gift51Dx', 'Santa73K',
  'Magic46P', 'Merry28Q', 'North64R', 'Star92Tm', 'Candy35V',
].includes(u.username));

console.log(`Total accounts: ${allUsers.length}`);
console.log(`Dedicated Admin accounts (${admins.length}):`, admins.map(a => a.username));
console.log(`VIP accounts (${vips.length}):`, vips.map(v => v.username));
console.log(`Standard accounts (${standards.length}):`, standards.map(s => s.username));

if (admins.length !== 3) {
  console.error(`FAIL TEST 7: Expected 3 Admins, got ${admins.length}`);
  process.exit(1);
}
for (const a of admins) {
  if (!a.is_admin) {
    console.error(`FAIL TEST 7: Admin ${a.username} missing is_admin: true!`);
    process.exit(1);
  }
}

if (vips.length !== 4) {
  console.error(`FAIL TEST 7: Expected 4 VIPs, got ${vips.length}`);
  process.exit(1);
}
for (const v of vips) {
  if (!v.is_vip) {
    console.error(`FAIL TEST 7: VIP ${v.username} missing is_vip: true!`);
    process.exit(1);
  }
}

if (standards.length !== 10) {
  console.error(`FAIL TEST 7: Expected 10 Standards, got ${standards.length}`);
  process.exit(1);
}
console.log('PASS TEST 7: All 17 canonical accounts remain intact with exact roles!');

console.log('\n🎉 ALL 7 TEST SUITES PASSED SUCCESSFULLY! 🎉\n');
