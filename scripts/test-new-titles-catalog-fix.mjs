import assert from 'node:assert';
import {
  TITLES_LIST,
  REWARDS_CATALOG,
  ALL_REWARDS_AND_GIFTS,
  ITEM_UUID_MAP,
  UUID_TO_SLUG_MAP,
  toDbUuid,
  toSlugId,
  resolveReward,
  resolveTitle,
  isItemAvailableInShop,
  getShopTitles,
  getShopItems,
  getShopGifts,
} from '../lib/catalog-data.js';
import { mockStore } from '../lib/mock-store.js';
import fs from 'node:fs';

console.log('====================================================');
console.log('🧪 TESTING: FIX «Товар не найден в каталоге наград»');
console.log('====================================================\n');

const NEW_TITLES = [
  { id: 'title-terpilla', slug: 'terpilla', name: 'ТЕРПИЛЛА', rarity: 'rare', uuid: '10000000-0000-0000-0000-000000000071', price: 300 },
  { id: 'title-podsos', slug: 'podsos', name: 'ПОДСОС', rarity: 'rare', uuid: '10000000-0000-0000-0000-000000000072', price: 350 },
  { id: 'title-santa', slug: 'santa', name: 'САНТА', rarity: 'legendary', uuid: '10000000-0000-0000-0000-000000000073', price: 3000 },
  { id: 'title-femboy', slug: 'femboy', name: 'FEMBOY', rarity: 'epic', uuid: '10000000-0000-0000-0000-000000000074', price: 800 },
  { id: 'title-nefor', slug: 'nefor', name: 'NEFOR', rarity: 'rare', uuid: '10000000-0000-0000-0000-000000000075', price: 450 },
  { id: 'title-balbibol', slug: 'balbibol', name: 'BALBIBOL', rarity: 'uncommon', uuid: '10000000-0000-0000-0000-000000000076', price: 150 },
  { id: 'title-imperator', slug: 'imperator', name: 'ИМПЕРАТОР', rarity: 'pro-epic', uuid: '10000000-0000-0000-0000-000000000077', price: 2200 },
  { id: 'title-demiurge', slug: 'demiurge', name: 'ДЕМИУРГ', rarity: 'mythic', uuid: '10000000-0000-0000-0000-000000000078', price: 5500 },
];

// ------------------------------------------------------------------------------
// CHECK 1: Presence in rewards_catalog & TITLES_LIST
// ------------------------------------------------------------------------------
console.log('CHECK 1: Presence in rewards_catalog & TITLES_LIST...');
for (const t of NEW_TITLES) {
  const inTitlesList = TITLES_LIST.find((item) => item.id === t.id);
  assert(inTitlesList, `Title ${t.id} must be in TITLES_LIST`);
  assert.strictEqual(inTitlesList.uuid, t.uuid, `UUID mismatch for ${t.id}`);
  assert.strictEqual(inTitlesList.category, 'titles', `Category must be titles for ${t.id}`);
  assert.strictEqual(inTitlesList.is_active, true, `is_active must be true for ${t.id}`);
  assert.strictEqual(inTitlesList.isTitle, true, `isTitle must be true for ${t.id}`);
  assert.strictEqual(inTitlesList.rarity, t.rarity, `Rarity mismatch for ${t.id}`);
  assert.strictEqual(inTitlesList.priceCoins, t.price, `priceCoins mismatch for ${t.id}`);

  const inRewardsCatalog = REWARDS_CATALOG.find((item) => item.id === t.id || item.uuid === t.uuid);
  assert(inRewardsCatalog, `Title ${t.id} must be registered in REWARDS_CATALOG`);
  assert.strictEqual(inRewardsCatalog.uuid, t.uuid, `UUID mismatch in REWARDS_CATALOG for ${t.id}`);
  assert.strictEqual(inRewardsCatalog.is_active, true, `is_active must be true in REWARDS_CATALOG for ${t.id}`);
  console.log(`  ✓ ${t.name} (${t.id}): registered with UUID ${t.uuid}, rarity ${t.rarity}, price ${t.price} Coins`);
}

// ------------------------------------------------------------------------------
// CHECK 2 & 3: UUIDs, title_slug, and slug consistency
// ------------------------------------------------------------------------------
console.log('\nCHECK 2 & 3: UUIDs, title_slug, and slug consistency...');
for (const t of NEW_TITLES) {
  assert.strictEqual(toDbUuid(t.id), t.uuid, `toDbUuid('${t.id}') must return '${t.uuid}'`);
  assert.strictEqual(toDbUuid(t.slug), t.uuid, `toDbUuid('${t.slug}') must return '${t.uuid}'`);
  assert.strictEqual(toDbUuid(t.uuid), t.uuid, `toDbUuid('${t.uuid}') must return '${t.uuid}'`);

  assert.strictEqual(toSlugId(t.uuid), t.id, `toSlugId('${t.uuid}') must return '${t.id}'`);
  assert.strictEqual(toSlugId(t.slug), t.id, `toSlugId('${t.slug}') must return '${t.id}'`);

  const meta = resolveTitle(t.id);
  assert.strictEqual(meta.titleSlug, t.slug, `titleSlug for ${t.id} must match clean slug '${t.slug}'`);
  assert.strictEqual(meta.title_slug, t.slug, `title_slug for ${t.id} must match clean slug '${t.slug}'`);
  console.log(`  ✓ ${t.name}: toDbUuid -> ${toDbUuid(t.slug)}, toSlugId -> ${toSlugId(t.uuid)}, slug -> ${meta.titleSlug}`);
}

// ------------------------------------------------------------------------------
// CHECK 4: Resolving across ID, UUID, slug, and Cyrillic/Latin names
// ------------------------------------------------------------------------------
console.log('\nCHECK 4: Resolving across ID, UUID, slug, and names...');
for (const t of NEW_TITLES) {
  const byId = resolveReward(t.id);
  assert(byId, `resolveReward failed for id: ${t.id}`);
  assert.strictEqual(byId.uuid, t.uuid);

  const bySlug = resolveReward(t.slug);
  assert(bySlug, `resolveReward failed for slug: ${t.slug}`);
  assert.strictEqual(bySlug.uuid, t.uuid);

  const byUuid = resolveReward(t.uuid);
  assert(byUuid, `resolveReward failed for uuid: ${t.uuid}`);
  assert.strictEqual(byUuid.id, t.id);

  const byName = resolveReward(t.name);
  assert(byName, `resolveReward failed for name: ${t.name}`);

  const byNameLower = resolveReward(t.name.toLowerCase());
  assert(byNameLower, `resolveReward failed for lower name: ${t.name}`);

  const titleMeta = resolveTitle(t.slug);
  assert(titleMeta, `resolveTitle failed for slug: ${t.slug}`);
  assert.strictEqual(titleMeta.uuid, t.uuid);
  console.log(`  ✓ ${t.name}: resolved successfully by ID, slug, UUID, and name`);
}

// ------------------------------------------------------------------------------
// CHECK 5: Shop availability, separation from Gifts, and Purchase execution
// ------------------------------------------------------------------------------
console.log('\nCHECK 5: Shop availability and purchase execution...');
for (const t of NEW_TITLES) {
  assert(isItemAvailableInShop(t.id), `${t.id} must be purchasable in shop`);
  assert(isItemAvailableInShop(t.uuid), `${t.uuid} must be purchasable in shop`);
  assert(isItemAvailableInShop(t.slug), `${t.slug} must be purchasable in shop`);
}

// Ensure VIP and UC are excluded
assert.strictEqual(isItemAvailableInShop('title-vip'), false, 'title-vip must NOT be available in shop');
assert.strictEqual(isItemAvailableInShop('reward-uc-30'), false, 'reward-uc-30 must NOT be available in shop');

const testUserId = 'test-player-' + Date.now();
const testUser = {
  id: testUserId,
  username: 'testbuyer',
  coins_balance: 60000,
  points_balance: 60000,
  free_spins_balance: 10,
  is_approved: true,
  is_blocked: false,
};
mockStore.serverUsers = [testUser];
mockStore.serverInventory = { [testUserId]: [] };

// Test purchasing every title using item ID ('title-*')
console.log('\nTesting purchasing each title via mockStore.purchaseItem...');
for (const t of NEW_TITLES) {
  const coinsBefore = mockStore.getUserById(testUserId).coins_balance;
  const res = mockStore.purchaseItem(testUserId, t.id, 1);
  assert(res.success, `Purchase failed for ${t.id}: ${res.error}`);
  assert.strictEqual(res.costCoins, t.price, `Cost mismatch for ${t.id}: expected ${t.price}, got ${res.costCoins}`);
  const coinsAfter = mockStore.getUserById(testUserId).coins_balance;
  assert.strictEqual(coinsBefore - coinsAfter, t.price, `Coins balance deduction mismatch for ${t.id}`);

  const inv = mockStore.getUserInventory(testUserId);
  const found = inv.find((it) => it.rewardId === t.id);
  assert(found, `Purchased title ${t.id} must be in inventory`);
  console.log(`  ✓ Purchased ${t.name} (${t.id}) for ${res.costCoins} Coins. Balance: ${coinsAfter}`);
}

// Test purchasing by bare slug ('terpilla')
const slugBuyRes = mockStore.purchaseItem(testUserId, 'terpilla', 1);
assert(slugBuyRes.success, `Purchase by clean slug 'terpilla' failed: ${slugBuyRes.error}`);
console.log(`  ✓ Purchased 'terpilla' by clean slug without 'title-' prefix`);

// Test purchasing by UUID ('10000000-0000-0000-0000-000000000072' - podsos)
const uuidBuyRes = mockStore.purchaseItem(testUserId, '10000000-0000-0000-0000-000000000072', 1);
assert(uuidBuyRes.success, `Purchase by UUID failed: ${uuidBuyRes.error}`);
console.log(`  ✓ Purchased '10000000-0000-0000-0000-000000000072' directly by UUID`);

// ------------------------------------------------------------------------------
// CHECK 6: Equipping and unequipping titles
// ------------------------------------------------------------------------------
console.log('\nCHECK 6: Equipping and unequipping titles...');
for (const t of NEW_TITLES) {
  const equipRes = mockStore.equipTitle(testUserId, t.id);
  assert(equipRes, `equipTitle failed for ${t.id}`);
  assert.strictEqual(equipRes.active_title_id, t.id);
  assert.strictEqual(mockStore.getUserById(testUserId).active_title_id, t.id);

  const unequipRes = mockStore.unequipTitle(testUserId);
  assert(unequipRes, `unequipTitle failed`);
  assert.strictEqual(unequipRes.active_title_id, null);
  console.log(`  ✓ Equipped and unequipped ${t.name} (${t.id})`);
}

// ------------------------------------------------------------------------------
// CHECK 7: Selling duplicate copies of new titles
// ------------------------------------------------------------------------------
console.log('\nCHECK 7: Selling duplicates of new titles...');
// Add 2 extra copies of title-nefor
mockStore.addItemToInventory(testUserId, 'title-nefor', 2);
const sellRes = mockStore.sellDuplicate(testUserId, 'title-nefor');
assert(sellRes.success, `Sell duplicate failed for title-nefor: ${sellRes.error}`);
assert(sellRes.coins_earned >= 20 && sellRes.coins_earned <= 35, `Coins earned out of rare range: ${sellRes.coins_earned}`);
console.log(`  ✓ Sold duplicate copy of NEFOR for +${sellRes.coins_earned} Coins`);

// ------------------------------------------------------------------------------
// CHECK 8: Verifying SQL migration files (v16 and v17)
// ------------------------------------------------------------------------------
console.log('\nCHECK 8: Verifying SQL migration files v16 & v17...');
const v16Sql = fs.readFileSync('database/migration_v16_lucky_uc_full_update.sql', 'utf8');
const v17Sql = fs.readFileSync('database/migration_v17_fix_new_titles_catalog.sql', 'utf8');

for (const t of NEW_TITLES) {
  assert(v16Sql.includes(t.uuid), `v16 missing UUID for ${t.name}`);
  assert(v17Sql.includes(t.uuid), `v17 missing UUID for ${t.name}`);
  assert(v16Sql.includes(t.slug), `v16 missing slug for ${t.name}`);
  assert(v17Sql.includes(t.slug), `v17 missing slug for ${t.name}`);
}

assert(v16Sql.includes('CREATE OR REPLACE FUNCTION public.purchase_item_atomic'), 'v16 must contain purchase_item_atomic');
assert(v17Sql.includes('CREATE OR REPLACE FUNCTION public.purchase_item_atomic'), 'v17 must contain purchase_item_atomic');
assert(v16Sql.includes('v_stripped_slug := REGEXP_REPLACE'), 'v16 must strip prefixes in purchase_item_atomic');
assert(v17Sql.includes('v_stripped_slug := REGEXP_REPLACE'), 'v17 must strip prefixes in purchase_item_atomic');
assert(v17Sql.includes('is_active = EXCLUDED.is_active'), 'v17 must set is_active on conflict');

// Test purchasing a regular item (non-title gift/souvenir)
const cupBuyRes = mockStore.purchaseItem(testUserId, 'reward-cup', 1);
assert(cupBuyRes.success, `Purchase of regular item 'reward-cup' failed: ${cupBuyRes.error}`);
console.log(`  ✓ Purchased regular item 'reward-cup'`);

// Test repeat purchase of the same title (increasing quantity)
const repeatTitleRes = mockStore.purchaseItem(testUserId, 'title-santa', 1);
assert(repeatTitleRes.success, `Repeat purchase of title-santa failed: ${repeatTitleRes.error}`);
const santaInInv = mockStore.getUserInventory(testUserId).find((it) => it.rewardId === 'title-santa');
assert(santaInInv && santaInInv.quantity >= 2, `Expected santa quantity to be at least 2, got ${santaInInv?.quantity}`);
console.log(`  ✓ Repeat purchase of title-santa incremented quantity to ${santaInInv.quantity}`);

// Test repeat purchase of regular item (increasing quantity)
const repeatCupRes = mockStore.purchaseItem(testUserId, 'reward-cup', 2);
assert(repeatCupRes.success, `Repeat purchase of reward-cup failed: ${repeatCupRes.error}`);
const cupInInv = mockStore.getUserInventory(testUserId).find((it) => it.rewardId === 'reward-cup');
assert(cupInInv && cupInInv.quantity >= 3, `Expected cup quantity to be at least 3, got ${cupInInv?.quantity}`);
console.log(`  ✓ Repeat purchase of regular item incremented quantity to ${cupInInv.quantity}`);

console.log('  ✓ migration_v16_lucky_uc_full_update.sql contains all 8 titles and updated RPC');
console.log('  ✓ migration_v17_fix_new_titles_catalog.sql contains all 8 titles and updated RPC');
assert(!v16Sql.includes('v_inv_record'), 'migration_v16 must not contain v_inv_record');
assert(!v17Sql.includes('v_inv_record'), 'migration_v17 must not contain v_inv_record');
assert(v16Sql.includes('v_final_quantity'), 'migration_v16 must use v_final_quantity');
assert(v17Sql.includes('v_final_quantity'), 'migration_v17 must use v_final_quantity');
console.log('  ✓ Both SQL migrations completely free of unassigned v_inv_record error');

console.log('\n====================================================');
console.log('🎉 ALL TESTS PASSED: 0 ERRORS DETECTED!');
console.log('====================================================');

