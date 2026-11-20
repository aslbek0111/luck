import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { mockStore } from '../lib/mock-store.js';
import {
  toDbUuid,
  toSlugId,
  resolveReward,
  resolveTitle,
  ITEM_UUID_MAP,
  UUID_TO_SLUG_MAP,
  ITEM_SLUG_ALIASES,
} from '../lib/catalog-data.js';

console.log('========================================================================');
console.log('🧪 VERIFYING INVENTORY USE, SLUG LOOKUP & ATOMIC RPC SUITE');
console.log('========================================================================\n');

// 1. Verify Migration V15 SQL Syntax & Completeness
console.log('--- 1. MIGRATION V15 SYNTAX & COMPLETENESS ---');
const migrationPath = path.join(process.cwd(), 'database', 'migration_v15_audit_fixes.sql');
assert(fs.existsSync(migrationPath), 'migration_v15_audit_fixes.sql must exist');
const sql = fs.readFileSync(migrationPath, 'utf8');

assert(sql.includes('CREATE OR REPLACE FUNCTION public.send_player_gift_with_message_atomic'), 'Must replace send_player_gift_with_message_atomic');
assert(sql.includes('public.rewards_catalog WHERE id = p_reward_id'), 'Must reference public.rewards_catalog');
assert(!sql.includes('FROM rewards WHERE'), 'Must NOT reference legacy rewards table');
assert(sql.includes('CREATE OR REPLACE FUNCTION public.purchase_item_atomic'), 'Must replace purchase_item_atomic');
assert(sql.includes('LOWER(COALESCE(title_slug, \'\')) = LOWER(p_item_slug)'), 'purchase_item_atomic must match title_slug');
assert(!sql.includes('COALESCE(slug,'), 'Must NOT query nonexistent rewards_catalog.slug column');
assert(!sql.includes('v_reward.slug'), 'Must NOT access nonexistent v_reward.slug field');
assert(sql.includes('CREATE OR REPLACE FUNCTION public.use_inventory_item_atomic'), 'Must define use_inventory_item_atomic');
assert(sql.includes('CREATE OR REPLACE FUNCTION public.play_spin_atomic'), 'Must define play_spin_atomic');
assert(sql.includes('GRANT EXECUTE ON FUNCTION public.use_inventory_item_atomic'), 'Must grant execute on use_inventory_item_atomic');
console.log('  ✅ [PASS] migration_v15_audit_fixes.sql SQL checks passed');

// 2. Verify Aliases & 1:1 Bijection
console.log('\n--- 2. ALIASES & BIJECTIVE UUID MAPPING ---');
assert.strictEqual(Object.keys(ITEM_UUID_MAP).length, 49, 'ITEM_UUID_MAP must have exactly 49 canonical keys');
assert.strictEqual(Object.keys(UUID_TO_SLUG_MAP).length, 49, 'UUID_TO_SLUG_MAP must have exactly 49 reverse keys');

// Aliases test
assert.strictEqual(toDbUuid('reward-rose-1'), '10000000-0000-0000-0000-000000000007', 'Alias reward-rose-1 must resolve to 0007');
assert.strictEqual(toDbUuid('gift-rose'), '10000000-0000-0000-0000-000000000007', 'Alias gift-rose must resolve to 0007');
assert.strictEqual(toDbUuid('reward-rose-big-bouquet'), '10000000-0000-0000-0000-000000000009', 'Alias reward-rose-big-bouquet must resolve to 0009');
assert.strictEqual(toDbUuid('gift-box-miracle'), '10000000-0000-0000-0000-000000000045', 'Alias gift-box-miracle must resolve to 0045');

// Reverse mapping must be canonical
assert.strictEqual(toSlugId('10000000-0000-0000-0000-000000000045'), 'reward-xmas-miracle-box', 'Reverse of 0045 must be reward-xmas-miracle-box');
assert.strictEqual(toSlugId('10000000-0000-0000-0000-000000000007'), 'reward-rose-single', 'Reverse of 0007 must be reward-rose-single');
assert.strictEqual(toSlugId('10000000-0000-0000-0000-000000000009'), 'reward-rose-large', 'Reverse of 0009 must be reward-rose-large');
console.log('  ✅ [PASS] Bijective mappings and aliases resolved cleanly');

// 3. Test use_inventory_item functionality
console.log('\n--- 3. USE INVENTORY ITEM EXECUTION ---');
mockStore.ensureCanonicalAccounts();
const user = mockStore.getUsers().find((u) => u.username === 'Snow24A');
assert(user, 'User Snow24A must exist');

// Reset user inventory for test
const inv = mockStore.getInventory();
inv[user.id] = [
  { id: 'inv-spin-1', rewardId: 'reward-spin-1', quantity: 3 },
  { id: 'inv-coins-50', rewardId: 'reward-coins-50', quantity: 2 },
  { id: 'inv-uc-30', rewardId: 'reward-uc-30', quantity: 1 },
  { id: 'inv-sticker', rewardId: 'reward-xmas-sticker', quantity: 2 },
  { id: 'inv-title-korol', rewardId: 'title-korol', quantity: 1 },
];
mockStore.saveInventory(inv);

user.free_spins_balance = 5;
user.coins_balance = 1000;
user.total_uc = 200;
mockStore.updateUser(user.id, {
  free_spins_balance: 5,
  coins_balance: 1000,
  total_uc: 200,
});

// A) Use spins item
const spinRes = mockStore.useInventoryItem(user.id, 'reward-spin-1', 1);
assert(spinRes.success, 'Using reward-spin-1 must succeed');
assert.strictEqual(spinRes.remainingQuantity, 2, 'Remaining quantity should be 2');
assert.strictEqual(spinRes.user.free_spins_balance, 6, 'free_spins_balance should be incremented from 5 to 6');
console.log('  ✅ [PASS] Consuming spin item adds free spins and decrements inventory');

// B) Use coins item
const coinsRes = mockStore.useInventoryItem(user.id, 'reward-coins-50', 1);
assert(coinsRes.success, 'Using reward-coins-50 must succeed');
assert.strictEqual(coinsRes.remainingQuantity, 1, 'Remaining quantity should be 1');
assert.strictEqual(coinsRes.user.coins_balance, 1050, 'coins_balance should be incremented from 1000 to 1050');
console.log('  ✅ [PASS] Consuming coins item adds coins and decrements inventory');

// C) Use UC item
const ucRes = mockStore.useInventoryItem(user.id, 'reward-uc-30', 1);
assert(ucRes.success, 'Using reward-uc-30 must succeed');
assert.strictEqual(ucRes.remainingQuantity, 0, 'Remaining quantity should be 0');
assert.strictEqual(ucRes.user.total_uc, 230, 'total_uc should be incremented from 200 to 230');
console.log('  ✅ [PASS] Consuming UC item adds total_uc and removes consumed item');

// D) Consuming Title must fail
const titleRes = mockStore.useInventoryItem(user.id, 'title-korol', 1);
assert(!titleRes.success, 'Using title as consumable must fail');
assert(titleRes.error.includes('Титулы экипируются'), 'Error message must explain titles are equipped');
console.log('  ✅ [PASS] Consuming title correctly rejected');

// E) Consuming item user does not have must fail
const missingRes = mockStore.useInventoryItem(user.id, 'reward-xmas-miracle-box', 1);
assert(!missingRes.success, 'Using unowned item must fail');
assert(missingRes.error.includes('Недостаточно предметов'), 'Error message must state insufficient items');
console.log('  ✅ [PASS] Consuming unowned item correctly rejected');

console.log('\n========================================================================');
console.log('🎉 ALL INVENTORY USE AND ATOMIC RPC CHECKS PASSED SUCCESSFULLY!');
console.log('========================================================================\n');
