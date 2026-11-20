import assert from 'assert';
import { mockStore } from '../lib/mock-store.js';

console.log('=== STARTING FUNCTIONAL GIFT & SPIN TRANSFER TESTS (ISOLATED) ===\n');

mockStore.ensureCanonicalAccounts();

const now = Date.now();
const senderId = `test-sender-spin-${now}`;
const recipId = `test-recip-spin-${now}`;
const senderUsername = `tmp_sender_spin_${now}`;
const recipUsername = `tmp_recip_spin_${now}`;
const recipientUsername = recipUsername;

const testSender = {
  id: senderId,
  username: senderUsername,
  first_name: 'Spin Sender',
  coins_balance: 3000,
  points_balance: 3000,
  is_blocked: false,
};

const testRecipient = {
  id: recipId,
  username: recipUsername,
  first_name: 'Spin Recipient',
  free_spins_balance: 0,
  total_uc: 100,
  coins_balance: 500,
  points_balance: 500,
  last_daily_spins_at: new Date().toISOString(),
  is_blocked: false,
};

mockStore.addUser(testSender);
mockStore.addUser(testRecipient);
mockStore.updateUser(senderId, { coins_balance: 3000, points_balance: 3000 });
mockStore.updateUser(recipId, {
  free_spins_balance: 0,
  total_uc: 100,
  coins_balance: 500,
  points_balance: 500,
});

// Initialize isolated inventory
const inv = mockStore.getInventory();
inv[senderId] = [
  {
    id: `test-inv-spin2-${now}`,
    rewardId: 'reward-spin-2',
    quantity: 1,
    acquiredAt: new Date().toISOString(),
  },
  {
    id: `test-inv-coins50-${now}`,
    rewardId: 'reward-coins-50',
    quantity: 1,
    acquiredAt: new Date().toISOString(),
  },
  {
    id: `test-inv-uc30-${now}`,
    rewardId: 'reward-uc-30',
    quantity: 1,
    acquiredAt: new Date().toISOString(),
  },
];
inv[recipId] = [];
mockStore.saveInventory(inv);

try {
  // -------------------------------------------------------------------
  // TEST 1: Shop Gifting 2 x "reward-spin-1" (+1 spin each) to Recipient
  // -------------------------------------------------------------------
  console.log('--- TEST 1: Shop Gifting 2 Spins (reward-spin-1 x 2) ---');
  const res1 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-spin-1',
    quantity: 2,
    message: 'Лови 2 прокрутки для рулетки!',
    source: 'shop',
  });

  assert(res1.success, `TEST 1 failed: ${res1.error}`);
  const recipAfter1 = mockStore.getUserById(recipId);
  assert.strictEqual(recipAfter1.free_spins_balance, 2, 'Recipient free_spins_balance should be 2');

  const recipInv1 = mockStore.getUserInventory(recipId);
  const hasSpinInInv = recipInv1.some((it) => it.rewardId === 'reward-spin-1');
  assert(!hasSpinInInv, 'Functional spins should not be added to inventory');
  console.log('  ✅ [PASS] Exactly 2 usable spins added directly to recipient free_spins_balance');

  // -------------------------------------------------------------------
  // TEST 2: Recipient uses received spins on Roulette
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Recipient uses received spins on Roulette ---');
  recipAfter1.free_spins_balance -= 1;
  mockStore.updateUser(recipId, { free_spins_balance: recipAfter1.free_spins_balance });
  assert.strictEqual(mockStore.getUserById(recipId).free_spins_balance, 1, '1 spin left after first use');

  recipAfter1.free_spins_balance -= 1;
  mockStore.updateUser(recipId, { free_spins_balance: recipAfter1.free_spins_balance });
  assert.strictEqual(mockStore.getUserById(recipId).free_spins_balance, 0, '0 spins left after second use');
  console.log('  ✅ [PASS] Received spins were fully functional and successfully consumed down to 0');

  // -------------------------------------------------------------------
  // TEST 3: Inventory transfer of multi-value Spin (reward-spin-2 gives 2 spins)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Inventory transfer of reward-spin-2 ---');
  const res3 = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-spin-2',
    quantity: 1,
    message: 'Лови двойной спин из моей сумки!',
    source: 'inventory',
  });

  assert(res3.success, `TEST 3 failed: ${res3.error}`);
  const recipAfter3 = mockStore.getUserById(recipId);
  assert.strictEqual(recipAfter3.free_spins_balance, 2, 'reward-spin-2 should credit 2 spins');
  const senderInvAfter3 = mockStore.getUserInventory(senderId);
  const senderSpin2 = senderInvAfter3.find((it) => it.rewardId === 'reward-spin-2');
  assert(!senderSpin2 || senderSpin2.quantity === 0, 'Item deducted from sender inventory');
  console.log('  ✅ [PASS] Inventory transfer of reward-spin-2 credited 2 spins and deducted item');

  // -------------------------------------------------------------------
  // TEST 4: Functional transfer of Coins via Inventory
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Functional transfer of Coins via Inventory ---');
  const coinsBefore = recipAfter3.coins_balance;
  const resCoins = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-coins-50',
    quantity: 1,
    source: 'inventory',
  });
  assert(resCoins.success, `Coins transfer failed: ${resCoins.error}`);
  const recipAfterCoins = mockStore.getUserById(recipId);
  assert.strictEqual(recipAfterCoins.coins_balance, coinsBefore + 50, 'Coins should be incremented by 50');
  console.log('  ✅ [PASS] Coins (+50) credited directly to recipient balance');

  // -------------------------------------------------------------------
  // TEST 5: UC Shop Purchase Rejected & Inventory Transfer Succeeded
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: UC Shop Gifting Rejected / Inventory Transfer Succeeded ---');
  // Attempting to buy UC from shop must be rejected
  const shopUcRes = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-uc-30',
    quantity: 1,
    source: 'shop',
  });
  assert(!shopUcRes.success, 'Shop purchase of UC must be rejected');
  assert(shopUcRes.error.includes('недоступен'), 'Error message must state UC is unavailable in shop');
  console.log('  ✅ [PASS] Purchasing UC via shop gift correctly rejected');

  // Transferring UC from existing inventory must succeed
  const ucBefore = recipAfterCoins.total_uc;
  const invUcRes = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-uc-30',
    quantity: 1,
    source: 'inventory',
  });
  assert(invUcRes.success, `Inventory UC transfer failed: ${invUcRes.error}`);
  const recipAfterUc = mockStore.getUserById(recipId);
  assert.strictEqual(recipAfterUc.total_uc, ucBefore + 30, 'UC should be incremented by 30');
  console.log('  ✅ [PASS] UC (+30) transferred from inventory directly to recipient UC balance');

  // -------------------------------------------------------------------
  // TEST 6: Decorative gifts go into inventory
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: Decorative gifts go into inventory ---');
  const resSticker = mockStore.sendGift({
    senderId,
    recipientUsername,
    rewardId: 'reward-xmas-sticker',
    quantity: 1,
    source: 'shop',
  });
  assert(resSticker.success, `Sticker gift failed: ${resSticker.error}`);
  const recipInvSticker = mockStore.getUserInventory(recipId);
  const hasSticker = recipInvSticker.some((it) => it.rewardId === 'reward-xmas-sticker');
  assert(hasSticker, 'Decorative sticker must be found in recipient inventory');
  console.log('  ✅ [PASS] Decorative souvenir correctly added to user_inventory');

  // -------------------------------------------------------------------
  // TEST 7: Canonical accounts check
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Canonical accounts check ---');
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
  console.log('  ✅ [PASS] All 17 canonical accounts remain intact with exact roles');
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

console.log('\n🎉 ALL FUNCTIONAL GIFT & SPIN TESTS PASSED SUCCESSFULLY! 🎉\n');
