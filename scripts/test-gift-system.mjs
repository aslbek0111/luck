import assert from 'assert';
import { mockStore } from '../lib/mock-store.js';
import { REWARDS_CATALOG } from '../lib/catalog-data.js';

console.log('--- STARTING PLAYER-TO-PLAYER GIFT SYSTEM TEST (ISOLATED) ---');

mockStore.ensureCanonicalAccounts();

const now = Date.now();
const senderId = `test-sender-${now}`;
const recipId = `test-recip-${now}`;
const senderUsername = `tmp_sender_${now}`;
const recipUsername = `tmp_recip_${now}`;
const recipientUsername = recipUsername;

const testSender = {
  id: senderId,
  username: senderUsername,
  first_name: 'Test Sender',
  coins_balance: 2000,
  points_balance: 2000,
  is_blocked: false,
};

const testRecipient = {
  id: recipId,
  username: recipUsername,
  first_name: 'Test Recipient',
  coins_balance: 100,
  points_balance: 100,
  is_blocked: false,
};

mockStore.addUser(testSender);
mockStore.addUser(testRecipient);
mockStore.updateUser(senderId, { coins_balance: 2000, points_balance: 2000 });
mockStore.updateUser(recipId, { coins_balance: 100, points_balance: 100 });

const testReward = REWARDS_CATALOG.find((r) => r.priceCoins && r.priceCoins > 0 && !r.isTitle) || REWARDS_CATALOG[0];
const shopReward = REWARDS_CATALOG.find((r) => r.priceCoins && r.priceCoins > 0 && r.id !== testReward.id && !r.isTitle) || testReward;

// Seed sender inventory
const inv = mockStore.getInventory();
inv[senderId] = [
  {
    id: `test-inv-${now}`,
    rewardId: testReward.id,
    quantity: 2,
    acquiredAt: new Date().toISOString(),
  },
];
inv[recipId] = [];
mockStore.saveInventory(inv);

try {
  // -------------------------------------------------------------
  // TEST 1: Inventory transfer
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Inventory transfer ---');
  const res1 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: testReward.id,
    quantity: 1,
    message: 'Тебе от меня новогодний подарок!',
    source: 'inventory',
  });

  assert(res1.success, `TEST 1 failed: ${res1.error}`);
  const senderQtyAfter1 = mockStore.getUserInventory(senderId).find((i) => i.rewardId === testReward.id)?.quantity || 0;
  const recipQtyAfter1 = mockStore.getUserInventory(recipId).find((i) => i.rewardId === testReward.id)?.quantity || 0;
  assert.strictEqual(senderQtyAfter1, 1, 'Sender should have 1 item left');
  assert.strictEqual(recipQtyAfter1, 1, 'Recipient should have 1 item');
  console.log('  ✅ [PASS] TEST 1: Inventory transferred successfully');

  // -------------------------------------------------------------
  // TEST 2: Shop Gifting with Coins
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Shop Gifting with Coins ---');
  const expectedCost = shopReward.priceCoins || 100;
  const initialCoins = mockStore.getUserById(senderId).coins_balance;

  const res2 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: shopReward.id,
    quantity: 1,
    message: 'Купил для тебя в магазине!',
    source: 'shop',
  });

  assert(res2.success, `TEST 2 failed: ${res2.error}`);
  const updatedSender = mockStore.getUserById(senderId);
  const recipShopQty = mockStore.getUserInventory(recipId).find((i) => i.rewardId === shopReward.id)?.quantity || 0;
  assert.strictEqual(updatedSender.coins_balance, initialCoins - expectedCost, 'Coins deducted correctly');
  assert.strictEqual(recipShopQty, 1, 'Recipient received shop item');
  console.log('  ✅ [PASS] TEST 2: Shop gift purchased and transferred successfully');

  // -------------------------------------------------------------
  // TEST 3: Validation - Cannot send to self
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Prevent sending to self ---');
  const res3 = mockStore.sendGift({
    senderId,
    recipientUsername: senderUsername,
    rewardId: testReward.id,
    quantity: 1,
    source: 'inventory',
  });
  assert(!res3.success, 'Should prevent sending gift to self');
  assert(res3.error.includes('самому себе'), 'Error message must state cannot send to self');
  console.log('  ✅ [PASS] TEST 3: Self-gifting prevented correctly');

  // -------------------------------------------------------------
  // TEST 4: Validation - Cannot send unowned item from inventory
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Prevent unowned item transfer ---');
  const res4 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'completely-non-existent-item-uuid-12345',
    quantity: 1,
    source: 'inventory',
  });
  assert(!res4.success, 'Should reject unowned item from inventory');
  console.log('  ✅ [PASS] TEST 4: Unowned inventory item rejected correctly');

  // -------------------------------------------------------------
  // TEST 5: Message length > 500 characters rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Message length validation (> 500 chars) ---');
  const longMessage = 'A'.repeat(501);
  const res5 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: testReward.id,
    quantity: 1,
    message: longMessage,
    source: 'inventory',
  });
  assert(!res5.success, 'Should reject gift message > 500 characters');
  assert(res5.error.includes('500'), 'Error message should mention 500 characters limit');
  console.log('  ✅ [PASS] TEST 5: Oversized gift message rejected');

  // -------------------------------------------------------------
  // TEST 6: Prevent gifting to blocked recipient
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Prevent sending to blocked recipient ---');
  mockStore.updateUser(recipId, { is_blocked: true });
  const res6 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: testReward.id,
    quantity: 1,
    source: 'inventory',
  });
  assert(!res6.success, 'Should reject gift to blocked recipient');
  assert(res6.error.includes('заблокирован'), 'Error message must mention recipient is blocked');
  console.log('  ✅ [PASS] TEST 6: Blocked recipient rejected');

  // -------------------------------------------------------------
  // TEST 7: Notification check
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Notification check ---');
  const notifs = mockStore.getNotifications(recipId);
  assert(notifs.some((n) => n.type === 'gift_received'), 'Recipient must have gift_received notification');
  console.log('  ✅ [PASS] TEST 7: Recipient received gift notifications');

  // -------------------------------------------------------------
  // TEST 8: Gift history check
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Gift History check ---');
  const history = mockStore.getGiftsHistory();
  const sentByTest = history.filter((h) => h.senderId === senderId && h.recipientId === recipId);
  assert(sentByTest.length >= 2, `Expected at least 2 gift entries for test users, found ${sentByTest.length}`);
  console.log('  ✅ [PASS] TEST 8: Gift history recorded accurately');

  // -------------------------------------------------------------
  // TEST 9: Role & Account Integrity Check (17 canonical accounts untouched)
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Canonical Accounts Integrity Check ---');
  const allUsers = mockStore.getUsers();
  const admins = allUsers.filter((u) => ['admin', 'adminvip', 'lucky_admin'].includes(u.username));
  const vips = allUsers.filter((u) => ['VIP5000X', 'VIP2026Z', 'VIP7777M', 'VIP9999K'].includes(u.username));
  const standards = allUsers.filter((u) =>
    [
      'Snow24A', 'Frost82B', 'Winter39C', 'Gift51Dx', 'Santa73K',
      'Magic46P', 'Merry28Q', 'North64R', 'Star92Tm', 'Candy35V',
    ].includes(u.username)
  );

  assert.strictEqual(admins.length, 3, 'Must have 3 dedicated admins');
  assert.strictEqual(vips.length, 4, 'Must have 4 VIP accounts');
  assert.strictEqual(standards.length, 10, 'Must have 10 standard accounts');
  console.log('  ✅ [PASS] TEST 9: All 17 canonical accounts remain intact with exact roles!');
} finally {
  // Cleanup test users and test state
  const remainingUsers = mockStore.getUsers().filter((u) => u.id !== senderId && u.id !== recipId);
  mockStore.saveUsers(remainingUsers);
  const remainingInv = mockStore.getInventory();
  delete remainingInv[senderId];
  delete remainingInv[recipId];
  mockStore.saveInventory(remainingInv);
  mockStore.saveToFile();
  console.log('  🧹 [CLEANUP] Temporary test users cleaned up cleanly');
}

console.log('\n🎉 ALL PLAYER-TO-PLAYER GIFT SUITES PASSED SUCCESSFULLY! 🎉\n');
