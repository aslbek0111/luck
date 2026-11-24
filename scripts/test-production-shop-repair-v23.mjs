// ==============================================================================
// TEST: PRODUCTION SHOP & COIN REPAIR V23
// Validates exact pricing, SQL migration, safety rules, and balances.
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockStore } from '../lib/mock-store.js';
import { REWARDS_CATALOG, TITLES_LIST, toDbUuid } from '../lib/catalog-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 [TEST V23] STARTING SHOP PRICING & MIGRATION AUDIT...\n');

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Helper to create test user
function createTestUser(opts = {}) {
  const id = 'test-user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const user = {
    id,
    telegram_id: Math.floor(Math.random() * 1000000) + 100000,
    username: 'tester_' + Math.random().toString(36).substring(2, 6),
    coins_balance: opts.coins ?? 10000,
    points_balance: opts.coins ?? 10000,
    is_admin: opts.isAdmin ?? false,
    is_vip: opts.isVip ?? false,
    free_spins_balance: 5,
    inventory: [],
  };
  mockStore.addUser(user);
  return user;
}

// ------------------------------------------------------------------------------
// TEST SUITE 1: CANONICAL CATALOG PRICES VERIFICATION
// ------------------------------------------------------------------------------
console.log('--- 1. Canonical Catalog Prices Verification ---');

test('reward-pop-10 has priceCoins = 25 and value = 10 (value preserved!)', () => {
  const item = REWARDS_CATALOG.find((r) => r.id === 'reward-pop-10');
  assert(item, 'reward-pop-10 must exist');
  assert.strictEqual(item.priceCoins, 25, 'priceCoins must be 25');
  assert.strictEqual(item.value, 10, 'value must be preserved as 10 (popularity gain)');
});

test('reward-xmas-candy-cane has priceCoins = 50 and value = 30', () => {
  const item = REWARDS_CATALOG.find((r) => r.id === 'reward-xmas-candy-cane');
  assert(item, 'reward-xmas-candy-cane must exist');
  assert.strictEqual(item.priceCoins, 50, 'priceCoins must be 50');
  assert.strictEqual(item.value, 30, 'value must be 30');
});

test('title-balbibol has priceCoins = 150', () => {
  const item = TITLES_LIST.find((t) => t.id === 'title-balbibol' || t.slug === 'balbibol');
  assert(item, 'title-balbibol must exist');
  assert.strictEqual(item.priceCoins, 150, 'priceCoins must be 150');
});

test('title-overlord has priceCoins = 2800', () => {
  const item = TITLES_LIST.find((t) => t.id === 'title-overlord' || t.slug === 'overlord');
  assert(item, 'title-overlord must exist');
  assert.strictEqual(item.priceCoins, 2800, 'priceCoins must be 2800');
});

// ------------------------------------------------------------------------------
// TEST SUITE 2: PURCHASE EXACT DEDUCTION TESTS
// ------------------------------------------------------------------------------
console.log('\n--- 2. Purchase Deduction Precision Tests ---');

test('Item for 25 Coins (reward-pop-10) deducts exactly 25 Coins', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'reward-pop-10', 1);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 25, 'costCoins must be 25');
  assert.strictEqual(res.coinsBalance, 975, 'Balance must be 1000 - 25 = 975');
  assert.strictEqual(res.pointsBalance, 1000, 'pointsBalance must remain strictly untouched at 1000');
});

test('Two 25-Coin items cost exactly 50 Coins', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'reward-pop-10', 2);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 50, 'costCoins must be 50');
  assert.strictEqual(res.coinsBalance, 950, 'Balance must be 1000 - 50 = 950');
  assert.strictEqual(res.pointsBalance, 1000, 'pointsBalance must remain strictly untouched at 1000');
});

test('Purchase costing 60 Coins (3 x 20 Coins roses) deducts exactly 60 Coins', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'reward-rose-1', 3);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 60, 'costCoins must be 60');
  assert.strictEqual(res.coinsBalance, 940, 'Balance must be 1000 - 60 = 940');
  assert.strictEqual(res.pointsBalance, 1000, 'pointsBalance must remain untouched at 1000');
});

test('Failed purchase does not change coins_balance or points_balance', () => {
  const u = createTestUser({ coins: 10 });
  const res = mockStore.purchaseItem(u.id, 'reward-pop-10', 1); // 25 coins
  assert(!res.success, 'Purchase must fail');
  const userAfter = mockStore.getUserById(u.id);
  assert.strictEqual(userAfter.coins_balance, 10, 'coins_balance must remain unchanged');
  assert.strictEqual(userAfter.points_balance, 10, 'points_balance must remain unchanged');
});

test('NULL coins_balance rejects purchase safely', () => {
  const u = createTestUser({ coins: 1000 });
  const storedUser = mockStore.getUserById(u.id);
  storedUser.coins_balance = null;
  mockStore.saveUsers(mockStore.getUsers());
  const res = mockStore.purchaseItem(u.id, 'reward-pop-10', 1);
  assert(!res.success, 'Purchase with null balance must fail');
  assert(res.error.includes('Баланс Монет не инициализирован или поврежден'));
});

test('Item for 50 Coins (reward-xmas-candy-cane) deducts exactly 50 Coins', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'reward-xmas-candy-cane', 1);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 50, 'costCoins must be 50');
  assert.strictEqual(res.coinsBalance, 950, 'Balance must be 1000 - 50 = 950');
});

test('Title for 150 Coins (title-balbibol) deducts exactly 150 Coins', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'title-balbibol', 1);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 150, 'costCoins must be 150');
  assert.strictEqual(res.coinsBalance, 850, 'Balance must be 1000 - 150 = 850');
});

test('PRO-EPIC Title for 2800 Coins (title-overlord) deducts exactly 2800 Coins', () => {
  const u = createTestUser({ coins: 5000 });
  const res = mockStore.purchaseItem(u.id, 'title-overlord', 1);
  assert(res.success, 'Purchase must succeed: ' + res.error);
  assert.strictEqual(res.costCoins, 2800, 'costCoins must be 2800');
  assert.strictEqual(res.coinsBalance, 2200, 'Balance must be 5000 - 2800 = 2200');
});

// ------------------------------------------------------------------------------
// TEST SUITE 3: INSUFFICIENT BALANCE, REPEATS, QUANTITY
// ------------------------------------------------------------------------------
console.log('\n--- 3. Insufficient Balance, Repeated Purchases & Quantity Multiplier ---');

test('Insufficient balance rejects purchase safely without deducting', () => {
  const u = createTestUser({ coins: 20 });
  const res = mockStore.purchaseItem(u.id, 'reward-pop-10', 1); // costs 25
  assert(!res.success, 'Purchase must be rejected');
  assert(res.error.includes('Недостаточно Монет'), 'Error must mention insufficient coins');
  const userAfter = mockStore.getUsers().find((usr) => usr.id === u.id);
  assert.strictEqual(userAfter.coins_balance, 20, 'Coins balance must remain untouched at 20');
});

test('Repeated purchase of same item increments quantity and deducts cost each time', () => {
  const u = createTestUser({ coins: 1000 });
  const res1 = mockStore.purchaseItem(u.id, 'reward-rose-1', 1); // 20 coins
  assert(res1.success);
  assert.strictEqual(res1.coinsBalance, 980);

  const res2 = mockStore.purchaseItem(u.id, 'reward-rose-1', 1); // another 20 coins
  assert(res2.success);
  assert.strictEqual(res2.coinsBalance, 960);

  const inv = mockStore.getInventory()[u.id] || [];
  const rose = inv.find((it) => it.id === 'reward-rose-1' || it.rewardId === 'reward-rose-1');
  assert(rose, 'Rose must be in inventory');
  assert.strictEqual(rose.quantity, 2, 'Quantity must be 2');
});

test('quantity > 1 multiplies cost accurately (3x 50 coins = 150 coins)', () => {
  const u = createTestUser({ coins: 1000 });
  const res = mockStore.purchaseItem(u.id, 'reward-xmas-candy-cane', 3);
  assert(res.success);
  assert.strictEqual(res.costCoins, 150, '3 * 50 = 150 costCoins');
  assert.strictEqual(res.coinsBalance, 850, 'Balance must be 1000 - 150 = 850');

  const inv = mockStore.getInventory()[u.id] || [];
  const item = inv.find((it) => it.rewardId === 'reward-xmas-candy-cane' || it.id === 'reward-xmas-candy-cane');
  assert(item, 'Item must be in inventory');
  assert.strictEqual(item.quantity, 3, 'Inventory quantity must be 3');
});

// ------------------------------------------------------------------------------
// TEST SUITE 4: EXCLUSIONS (SPINS, UC, VIP)
// ------------------------------------------------------------------------------
console.log('\n--- 4. Exclusions (Spins, UC, VIP) ---');

test('Free spins (reward-spin-1, reward-spin-2) cannot be bought in shop', () => {
  const u = createTestUser({ coins: 10000 });
  const res1 = mockStore.purchaseItem(u.id, 'reward-spin-1', 1);
  assert(!res1.success, 'reward-spin-1 purchase must fail');

  const res2 = mockStore.purchaseItem(u.id, 'reward-spin-2', 1);
  assert(!res2.success, 'reward-spin-2 purchase must fail');
});

test('UC (reward-uc-30, reward-uc-60) cannot be bought in shop', () => {
  const u = createTestUser({ coins: 10000 });
  const res = mockStore.purchaseItem(u.id, 'reward-uc-30', 1);
  assert(!res.success, 'reward-uc-30 purchase must fail');
});

test('VIP title cannot be bought in shop', () => {
  const u = createTestUser({ coins: 10000 });
  const res = mockStore.purchaseItem(u.id, 'title-vip', 1);
  assert(!res.success, 'VIP title purchase must fail');
});

// ------------------------------------------------------------------------------
// TEST SUITE 5: ADMIN PRIVILEGES
// ------------------------------------------------------------------------------
console.log('\n--- 5. Admin Privileges ---');

test('Admin buys any item for 0 coins, balance remains intact', () => {
  const admin = createTestUser({ coins: 999999, isAdmin: true });
  const res = mockStore.purchaseItem(admin.id, 'title-overlord', 1);
  assert(res.success, 'Admin purchase must succeed');
  assert.strictEqual(res.costCoins, 0, 'Admin cost must be 0');
  assert.strictEqual(res.coinsBalance, 999999, 'Admin balance must remain 999999');

  const inv = mockStore.getInventory()[admin.id] || [];
  const title = inv.find((it) => it.rewardId === 'title-overlord' || it.id === 'title-overlord' || String(it.id).includes('title-overlord'));
  assert(title, 'Title must be granted to admin');
});

// ------------------------------------------------------------------------------
// TEST SUITE 6: SQL MIGRATION V23 SYNTAX & SAFETY AUDIT
// ------------------------------------------------------------------------------
console.log('\n--- 6. SQL Migration V23 Content & Safety Audit ---');

const migrationV23Path = path.join(rootDir, 'database', 'migration_v23_production_shop_price_repair.sql');
const sql = fs.readFileSync(migrationV23Path, 'utf8');

test('Migration V23 contains ALTER TABLE ... ADD COLUMN IF NOT EXISTS price_coins', () => {
  assert(sql.includes('ADD COLUMN IF NOT EXISTS price_coins INTEGER'), 'Must add price_coins column');
});

test('Migration V23 does NOT alter or overwrite column "value"', () => {
  assert(!sql.includes('ALTER COLUMN value'), 'Must not alter value column');
  assert(!sql.includes('DROP COLUMN value'), 'Must not drop value column');
  assert(!sql.includes('SET value ='), 'Must not overwrite value column values');
});

test('Migration V23 purchase_item_atomic strictly uses price_coins and NO fallback to value', () => {
  assert(sql.includes('v_unit_cost := v_reward.price_coins;'), 'Must set v_unit_cost from price_coins');
  assert(!sql.includes('v_unit_cost := v_reward.value'), 'Must NEVER assign v_reward.value to v_unit_cost');
  assert(!sql.includes('v_unit_cost := 1'), 'Must NEVER hardcode v_unit_cost to 1');
});

test('Migration V23 purchase_item_atomic checks price_coins > 0 strictly', () => {
  assert(sql.includes('v_unit_cost := v_reward.price_coins;') && sql.includes('IF v_unit_cost IS NULL OR v_unit_cost <= 0 THEN'), 'Must check price_coins > 0');
});

test('Migration V23 revokes EXECUTE from PUBLIC and anon, grants ONLY to authenticated and service_role', () => {
  assert(
    sql.includes('REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC;') &&
    sql.includes('REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM anon;'),
    'Must revoke execute from PUBLIC and anon'
  );
  assert(
    sql.includes('GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated;') &&
    sql.includes('GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO service_role;'),
    'Must grant execute only to authenticated and service_role'
  );
  assert(!sql.includes('TO anon'), 'Must NOT grant execute to anon');
});

test('Migration V23 purchase_item_atomic blocks anonymous callers and checks auth.uid() = p_user_id', () => {
  assert(sql.includes("IF auth.role() = 'authenticated' THEN"), 'Must check if caller is authenticated');
  assert(sql.includes("IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN"), 'Must block non-matching auth.uid()');
  assert(sql.includes("ELSIF (auth.role() = 'service_role') OR ((auth.jwt() ->> 'role') = 'service_role') THEN"), 'Must allow service_role');
  assert(sql.includes("RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация для совершения покупок');"), 'Must deny anon');
});

test('Migration V23 has NO current_user = postgres authorization bypass', () => {
  assert(!sql.includes("current_user = 'postgres'"), "Must NOT contain current_user = 'postgres' bypass");
});

test('Migration V23 has ambiguity check preventing arbitrary catalog item resolution', () => {
  assert(sql.includes('IF v_match_count > 1 THEN'), 'Must check for multiple matches');
  assert(sql.includes('Неоднозначный идентификатор товара'), 'Must reject ambiguous slug');
});

test('Migration V23 contains strict preflight checks for all expected UUIDs and prices', () => {
  assert(sql.includes('PREFLIGHT VALIDATION: CHECK ALL EXPECTED CATALOG IDS EXIST BEFORE UPDATING'), 'Must include preflight validation section');
  assert(sql.includes("RAISE EXCEPTION 'MIGRATION V23 PREFLIGHT ABORTED:"), 'Must raise exception on preflight failure');
});

test('Migration V23 ensures purchases_history columns compatibility with ALTER TABLE', () => {
  assert(sql.includes('ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS reward_id'), 'Must ensure reward_id');
  assert(sql.includes('ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS cost_coins'), 'Must ensure cost_coins');
  assert(sql.includes('ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS item_type'), 'Must ensure item_type');
});

test('Migration V23 sets exact prices for 25, 50, 150, 2800 items', () => {
  assert(sql.includes("SET price_coins = 25"), 'Must set 25 for 10 pop');
  assert(sql.includes("SET price_coins = 50"), 'Must set 50 for candy cane');
  assert(sql.includes("SET price_coins = 150"), 'Must set 150 for balbibol');
  assert(sql.includes("SET price_coins = 2800"), 'Must set 2800 for overlord');
});

// ------------------------------------------------------------------------------
// TEST SUITE 7: COMPLETE CATALOG UUID & PRICE PARITY
// ------------------------------------------------------------------------------
console.log('\n--- 7. Catalog UUID & Exact Price Parity with lib/catalog-data.js ---');

test('Every purchasable item in catalog has correct UUID and matching price in Migration V23', () => {
  const allCatalogItems = [...REWARDS_CATALOG, ...TITLES_LIST];
  let purchasableCount = 0;
  for (const item of allCatalogItems) {
    if (
      item.category === 'uc' || 
      item.category === 'coins' || 
      item.category === 'spins' || 
      item.id === 'title-vip' || 
      item.id.includes('spin') || 
      item.excludedFromShop
    ) {
      const dbUuid = toDbUuid(item.id);
      if (dbUuid) {
        assert(
          sql.includes(`WHERE id = '${dbUuid}';`) || sql.includes(`'${dbUuid}'`),
          `Excluded item ${item.name} (${item.id}) must be referenced for exclusion in migration V23`
        );
      }
      continue;
    }
    const expectedPrice = item.priceCoins;
    assert(typeof expectedPrice === 'number' && expectedPrice > 0, `Item ${item.id} must have priceCoins > 0`);
    const dbUuid = toDbUuid(item.id);
    assert(dbUuid, `Item ${item.id} must have a valid DB UUID`);
    
    // Check that migration V23 updates this exact UUID with this exact price
    const pattern = new RegExp(
      `SET\\s+price_coins\\s*=\\s*${expectedPrice},\\s*price_points\\s*=\\s*${expectedPrice},\\s*is_active\\s*=\\s*TRUE[\\s\\S]*?WHERE\\s+id\\s*=\\s*'${dbUuid}'`,
      'i'
    );
    assert(pattern.test(sql), `Migration V23 must contain exact update snippet for ${item.name} (${item.id}) with price ${expectedPrice} and UUID ${dbUuid}`);
    purchasableCount++;
  }
  console.log(`    (Verified ${purchasableCount} purchasable catalog items matched exact UUID & prices)`);
});

// ------------------------------------------------------------------------------
// TEST SUITE 8: ROLLBACK SCRIPT SAFETY AUDIT
// ------------------------------------------------------------------------------
console.log('\n--- 8. Rollback Script Safety Audit ---');

const rollbackPath = path.join(rootDir, 'database', 'rollback_v23_shop_repair.sql');
const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

test('Rollback contains ZERO "CASCADE" keywords (Never silently delete dependent objects)', () => {
  assert(!rollbackSql.toUpperCase().includes('CASCADE'), 'Rollback must NOT contain any CASCADE keywords');
});

test('Rollback inspects pg_depend before dropping columns', () => {
  assert(rollbackSql.includes('FROM pg_depend d'), 'Must inspect pg_depend');
  assert(rollbackSql.includes("RAISE EXCEPTION 'ROLLBACK V23 ABORTED: Column public.rewards_catalog.price_coins has % dependent database objects"), 'Must halt on dependencies');
});

test('Rollback verifies backup_v23_rewards_catalog existence, column count, and row count', () => {
  assert(rollbackSql.includes("table_name = 'backup_v23_rewards_catalog'"), 'Must check backup table existence');
  assert(rollbackSql.includes('v_col_count < 9'), 'Must verify pre-migration columns');
  assert(rollbackSql.includes('v_row_count < 40'), 'Must verify row count');
  assert(rollbackSql.includes('v_missing_core_ids > 0'), 'Must verify key expected reward IDs');
  assert(rollbackSql.includes('v_null_active_count > 0'), 'Must verify is_active integrity');
});

test('Rollback drops only V23-added columns without CASCADE and preserves pre-existing columns', () => {
  assert(rollbackSql.includes('ALTER TABLE public.rewards_catalog DROP COLUMN price_coins;'), 'Must drop price_coins with RESTRICT');
  assert(rollbackSql.includes('ALTER TABLE public.rewards_catalog DROP COLUMN price_points;'), 'Must drop price_points with RESTRICT');
  assert(!rollbackSql.includes('DROP COLUMN description'), 'Must not drop description');
  assert(!rollbackSql.includes('DROP COLUMN conditions'), 'Must not drop conditions');
  assert(!rollbackSql.includes('DROP COLUMN value'), 'Must not drop value');
  assert(!rollbackSql.includes('DROP COLUMN is_active'), 'Must not drop is_active');
});

test('Rollback does NOT reference non-existent backup columns (b.price_coins, b.price_points)', () => {
  assert(!rollbackSql.includes('b.price_coins'), 'Must not reference non-existent b.price_coins');
  assert(!rollbackSql.includes('b.price_points'), 'Must not reference non-existent b.price_points');
});

test('Rollback NEVER touches or overwrites public.users live balances from backup snapshots', () => {
  assert(!rollbackSql.includes('FROM public.backup_v23_users'), 'Must NEVER restore users from backup_v23_users');
  assert(!rollbackSql.includes('FROM backup_v23_users'), 'Must not query FROM backup_v23_users');
  assert(!rollbackSql.includes('coins_balance = b.coins_balance'), 'Must NEVER overwrite user coins_balance from snapshot');
  assert(!rollbackSql.includes('points_balance = b.points_balance'), 'Must NEVER overwrite user points_balance from snapshot');
});

test('Rollback restored RPC has NO current_user = postgres bypass', () => {
  assert(!rollbackSql.includes("current_user = 'postgres'"), "Restored RPC must NOT contain current_user = 'postgres'");
});

test('Rollback dynamically restores exact captured pre-V23 purchase_item_atomic without guessing', () => {
  assert(rollbackSql.includes('EXECUTE v_captured_rpc_def;'), 'Must execute exact captured production RPC');
  assert(rollbackSql.includes('pre_v23_captured_rpc_definitions'), 'Must query pre_v23_captured_rpc_definitions');
  assert(rollbackSql.includes('No captured definition for purchase_item_atomic found'), 'Must abort if captured RPC missing');
});

test('Rollback reapplies secure access permissions after restoring RPC', () => {
  assert(rollbackSql.includes('REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC;'), 'Must revoke execute from PUBLIC');
  assert(rollbackSql.includes('REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM anon;'), 'Must revoke execute from anon');
  assert(rollbackSql.includes('GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated;'), 'Must grant execute to authenticated');
  assert(rollbackSql.includes('GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO service_role;'), 'Must grant execute to service_role');
});

test('Rollback verifies backup_run_id parity across all metadata rows', () => {
  assert(rollbackSql.includes('backup_run_id'), 'Rollback must check backup_run_id');
  assert(rollbackSql.includes('v_rewards_run_id <> v_users_run_id OR v_rewards_run_id <> v_inventory_run_id'), 'Rollback must verify all snapshots share the same backup_run_id');
});

test('Rollback verifies exact bidirectional catalog UUID parity', () => {
  assert(rollbackSql.includes('v_uuid_diff > 0'), 'Rollback must verify catalog UUID parity');
  assert(rollbackSql.includes('Live rewards_catalog UUID set differs from backup_v23_rewards_catalog'), 'Rollback must abort if UUID set differs');
});

test('Rollback requires complete metadata for rewards_catalog, users, and user_inventory with status VERIFIED', () => {
  assert(rollbackSql.includes("table_name = 'backup_v23_metadata'"), 'Rollback must verify backup_v23_metadata existence');
  assert(rollbackSql.includes("backup_table = 'backup_v23_rewards_catalog'"), 'Rollback must check metadata for backup_v23_rewards_catalog');
  assert(rollbackSql.includes("backup_table = 'backup_v23_users'"), 'Rollback must check metadata for backup_v23_users');
  assert(rollbackSql.includes("backup_table = 'backup_v23_user_inventory'"), 'Rollback must check metadata for backup_v23_user_inventory');
  assert(rollbackSql.includes("status = 'VERIFIED'"), 'Rollback must require status = VERIFIED');
  assert(rollbackSql.includes('backup_row_count = source_row_count'), 'Rollback must verify backup_row_count = source_row_count in metadata');
  assert(rollbackSql.includes('checksum IS NOT NULL'), 'Rollback must require non-null checksum in metadata');
});

test('Rollback uses BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ', () => {
  assert(/BEGIN\s+TRANSACTION\s+ISOLATION\s+LEVEL\s+REPEATABLE\s+READ;/i.test(rollbackSql), 'Rollback must use REPEATABLE READ snapshot isolation');
});

test('Rollback verifies cryptographic checksum of backup_v23_rewards_catalog against metadata', () => {
  assert(rollbackSql.includes('v_computed_checksum <> v_metadata_checksum'), 'Rollback must compare computed checksum with metadata checksum');
  assert(rollbackSql.includes('ORDER BY id::TEXT'), 'Rollback checksum computation must use stable primary-key ordering');
});

// ------------------------------------------------------------------------------
// TEST SUITE 9: PRE-REPAIR BACKUP SCRIPT SAFETY AUDIT
// ------------------------------------------------------------------------------
console.log('\n--- 9. Pre-Repair Backup Script Safety Audit ---');

const backupPath = path.join(rootDir, 'database', 'backup_v23_before_shop_repair.sql');
const backupSql = fs.readFileSync(backupPath, 'utf8');

test('Backup contains ZERO "DROP TABLE", ZERO "CASCADE", ZERO "TRUNCATE" (Never overwrites or deletes)', () => {
  assert(!backupSql.toUpperCase().includes('DROP TABLE'), 'Backup must NOT contain DROP TABLE');
  assert(!backupSql.toUpperCase().includes('CASCADE'), 'Backup must NOT contain CASCADE');
  assert(!backupSql.toUpperCase().includes('TRUNCATE'), 'Backup must NOT contain TRUNCATE');
});

test('Backup immediately aborts if any backup_v23_* table or metadata table already exists', () => {
  assert(backupSql.includes("'backup_v23_metadata'"), 'Must check for existing backup_v23_metadata');
  assert(backupSql.includes("'backup_v23_rewards_catalog'"), 'Must check for existing backup_v23_rewards_catalog');
  assert(backupSql.includes("'backup_v23_users'"), 'Must check for existing backup_v23_users');
  assert(backupSql.includes("'backup_v23_user_inventory'"), 'Must check for existing backup_v23_user_inventory');
  assert(backupSql.includes("'backup_v23_purchases_history'"), 'Must check for existing backup_v23_purchases_history');
  assert(backupSql.includes("RAISE EXCEPTION 'BACKUP V23 ABORTED: Table public.% already exists"), 'Must raise clear exception on pre-existing backup');
});

test('Backup verifies all required source tables exist before taking snapshot', () => {
  assert(backupSql.includes("table_name = 'rewards_catalog'"), 'Must check rewards_catalog source exists');
  assert(backupSql.includes("table_name = 'users'"), 'Must check users source exists');
  assert(backupSql.includes("table_name = 'user_inventory'"), 'Must check user_inventory source exists');
  assert(backupSql.includes("table_name = 'purchases_history'"), 'Must check if purchases_history exists');
  assert(backupSql.includes("RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.rewards_catalog does not exist.'"), 'Must fail if rewards_catalog missing');
  assert(backupSql.includes("RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.users does not exist.'"), 'Must fail if users missing');
  assert(backupSql.includes("RAISE EXCEPTION 'BACKUP V23 ABORTED: Required source table public.user_inventory does not exist.'"), 'Must fail if user_inventory missing');
});

test('Backup uses BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ for consistent snapshot', () => {
  assert(/BEGIN\s+TRANSACTION\s+ISOLATION\s+LEVEL\s+REPEATABLE\s+READ;/i.test(backupSql), 'Backup must use REPEATABLE READ snapshot isolation');
});

test('Backup uses bidirectional EXCEPT set difference checks for rewards_catalog integrity', () => {
  assert(backupSql.includes('EXCEPT'), 'Backup must use EXCEPT set difference');
  assert(backupSql.includes('v_diff_src_bak > 0 OR v_diff_bak_src > 0'), 'Backup must abort if set differences detected in either direction');
});

test('Backup computes deterministic cryptographic MD5 checksum with stable ORDER BY id::TEXT', () => {
  assert(backupSql.includes('ORDER BY id::TEXT'), 'Backup must compute hash with deterministic ORDER BY id::TEXT');
  assert(backupSql.includes('v_src_rewards_checksum <> v_bak_rewards_checksum'), 'Backup must abort on checksum mismatch');
});

test('Backup records source and backup row counts, verifying 100% exact parity before commit', () => {
  assert(backupSql.includes('v_src_rewards <> v_bak_rewards'), 'Must verify rewards_catalog row parity');
  assert(backupSql.includes('v_src_users <> v_bak_users'), 'Must verify users row parity');
  assert(backupSql.includes('v_src_inventory <> v_bak_inventory'), 'Must verify user_inventory row parity');
  assert(backupSql.includes('v_src_purchases <> v_bak_purchases'), 'Must verify purchases_history row parity when table exists');
});

test('Backup creates and populates public.backup_v23_metadata with backup_run_id, status VERIFIED, and checksum', () => {
  assert(backupSql.includes('CREATE TABLE public.backup_v23_metadata'), 'Must create backup_v23_metadata table');
  assert(backupSql.includes('backup_run_id UUID NOT NULL,'), 'Metadata table must contain backup_run_id column');
  assert(backupSql.includes('checksum TEXT'), 'Metadata table must contain checksum column');
  assert(backupSql.includes('v_backup_run_id UUID := gen_random_uuid();'), 'Must generate v_backup_run_id');
  assert(backupSql.includes("'rewards_catalog',"), 'Must insert rewards_catalog metadata');
  assert(backupSql.includes("'backup_v23_rewards_catalog',"), 'Must insert backup_v23_rewards_catalog metadata');
  assert(backupSql.includes('v_src_rewards_checksum,'), 'Must insert checksum');
  assert(backupSql.includes("'VERIFIED'"), 'Must mark as VERIFIED');
});

test('Backup explicitly revokes ALL permissions on all backup and metadata tables from PUBLIC, anon, and authenticated', () => {
  assert(backupSql.includes('REVOKE ALL ON TABLE public.backup_v23_metadata FROM PUBLIC, anon, authenticated;'), 'Must revoke metadata table permissions');
  assert(backupSql.includes('REVOKE ALL ON SEQUENCE public.backup_v23_metadata_id_seq FROM PUBLIC, anon, authenticated;'), 'Must revoke metadata sequence permissions');
  assert(backupSql.includes('REVOKE ALL ON TABLE public.backup_v23_rewards_catalog FROM PUBLIC, anon, authenticated;'), 'Must revoke rewards_catalog backup permissions');
  assert(backupSql.includes('REVOKE ALL ON TABLE public.backup_v23_users FROM PUBLIC, anon, authenticated;'), 'Must revoke users backup permissions');
  assert(backupSql.includes('REVOKE ALL ON TABLE public.backup_v23_user_inventory FROM PUBLIC, anon, authenticated;'), 'Must revoke user_inventory backup permissions');
  assert(backupSql.includes('REVOKE ALL ON TABLE public.backup_v23_purchases_history FROM PUBLIC, anon, authenticated'), 'Must revoke purchases_history backup permissions');
});

test('Backup is wrapped in a single atomic transaction (COMMIT at end)', () => {
  assert(backupSql.trim().endsWith('COMMIT;'), 'Backup must end with COMMIT;');
});

test('Backup documents data-only snapshot semantics and user balance non-restoration policy', () => {
  assert(backupSql.includes('DATA-ONLY snapshots'), 'Must document that CREATE TABLE AS SELECT creates data-only snapshots');
  assert(backupSql.includes('does NOT copy indexes'), 'Must document lack of indexes/constraints/triggers');
  assert(backupSql.includes('The V23 rollback script is strictly prohibited from overwriting'), 'Must document rollback safety policy');
});

// ------------------------------------------------------------------------------
// TEST SUITE 10: MIGRATION PREFLIGHT & INTEGRITY AUDIT
// ------------------------------------------------------------------------------
console.log('\n--- 10. Migration Preflight & Compatibility Audit ---');

test('Migration V23 checks all expected 57 reward IDs exist in public.rewards_catalog before applying updates', () => {
  assert(sql.includes('-- 1.2 PREFLIGHT VALIDATION: CHECK ALL EXPECTED CATALOG IDS EXIST BEFORE UPDATING'), 'Migration must contain Section 1.2 Preflight Validation');
  assert(sql.includes("RAISE EXCEPTION 'MIGRATION V23 PREFLIGHT ABORTED: Missing required reward"), 'Migration must abort if any expected reward ID is missing before updating');
});

test('Migration V23 preserves existing purchases_history with ADD COLUMN IF NOT EXISTS', () => {
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.purchases_history'), 'Must use CREATE TABLE IF NOT EXISTS');
  assert(sql.includes('ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS reward_id'), 'Must use ADD COLUMN IF NOT EXISTS');
});

test('Migration V23 does NOT alter or overwrite points_balance, user balances, or inventory', () => {
  assert(!sql.includes('UPDATE public.users SET points_balance'), 'Must NOT overwrite points_balance in migration script');
  assert(!sql.includes('UPDATE public.users SET coins_balance =') || sql.includes('UPDATE public.users \n    SET \n        coins_balance = v_new_coins'), 'Must only update coins_balance inside purchase_item_atomic RPC');
});

// ------------------------------------------------------------------------------
// TEST SUITE 11: PRE-MIGRATION RPC CAPTURE & ROLLBACK COHESION
// ------------------------------------------------------------------------------
console.log('\n--- 11. Pre-Migration RPC Capture & Rollback Cohesion ---');

const captureSqlPath = path.join(rootDir, 'database', 'capture_production_functiondef.sql');
const captureSql = fs.readFileSync(captureSqlPath, 'utf8');

test('capture_production_functiondef.sql exists and provides read-only inspection query', () => {
  assert(fs.existsSync(captureSqlPath), 'Capture SQL file must exist');
  assert(captureSql.includes('pg_get_functiondef(p.oid)'), 'Must query pg_get_functiondef');
  assert(captureSql.includes("p.proname IN ('purchase_item_atomic', 'sell_duplicate_atomic')"), 'Must target purchase_item_atomic and sell_duplicate_atomic');
});

test('capture_production_functiondef.sql uses p.pronamespace and contains zero p.namespacename', () => {
  assert(captureSql.includes('JOIN pg_namespace n ON n.oid = p.pronamespace'), 'Must use p.pronamespace');
  assert(!captureSql.includes('p.namespacename'), 'Must NOT contain p.namespacename');
});

test('capture_production_functiondef.sql clearly separates read-only diagnostic SELECT from database-modifying capture script', () => {
  assert(captureSql.includes('PART 1: 100% READ-ONLY DIAGNOSTIC INSPECTION (DOES NOT MODIFY DATABASE)'), 'Must contain clearly labeled read-only Part 1');
  assert(captureSql.includes('PART 2: OPTIONAL PERSISTENT CAPTURE SCRIPT (MODIFIES DATABASE: DDL & DML)'), 'Must contain clearly labeled modifying Part 2');
  assert(captureSql.includes('CREATE TABLE IF NOT EXISTS public.pre_v23_captured_rpc_definitions'), 'Must create pre_v23_captured_rpc_definitions table');
  assert(captureSql.includes('REVOKE ALL ON TABLE public.pre_v23_captured_rpc_definitions FROM PUBLIC, anon, authenticated;'), 'Must revoke privileges from untrusted roles');
});

test('capture_production_functiondef.sql detects capture mismatch and fails visibly without overwriting', () => {
  assert(captureSql.includes('CAPTURE MISMATCH DETECTED'), 'Must detect mismatch between existing capture and live definition');
  assert(captureSql.includes('The original capture was NOT overwritten.'), 'Must preserve original capture');
  assert(!captureSql.includes('UPDATE public.pre_v23_captured_rpc_definitions'), 'Must never update capture records');
});

test('Backup and Rollback scripts both include conditions column in checksum and integrity checks', () => {
  assert(backupSql.includes("COALESCE(conditions, '')"), 'Backup script must include conditions in cryptographic checksum');
  assert(backupSql.includes('conditions'), 'Backup script EXCEPT checks must include conditions');
  assert(rollbackSql.includes("COALESCE(conditions, '')"), 'Rollback script must include conditions in cryptographic checksum');
  assert(rollbackSql.includes("'conditions'"), 'Rollback script must verify conditions in column check list');
  assert(rollbackSql.includes('pre_v23_captured_rpc_definitions'), 'Rollback script must notice presence of captured production RPC');
});

// ------------------------------------------------------------------------------
// TEST SUITE 12: FRONTEND APP/SHOP/PAGE.JSX HARDENING
// ------------------------------------------------------------------------------
console.log('\n--- 12. Frontend Shop Page Hardening ---');

const shopPagePath = path.join(rootDir, 'app', 'shop', 'page.jsx');
const shopPageContent = fs.readFileSync(shopPagePath, 'utf8');

test('Shop page has NO dangerous fallback to 100 coins', () => {
  assert(!shopPageContent.includes('|| 100'), 'Shop page must not fallback to 100 via || 100');
  assert(!shopPageContent.includes('pricePoints ?? 100'), 'Shop page must not fallback to 100 via pricePoints ?? 100');
  assert(!shopPageContent.includes('priceCoins ?? 100'), 'Shop page must not fallback to 100 via priceCoins ?? 100');
});

test('Shop page protects purchase handler against double-clicks and passes isLoading to ConfirmModal', () => {
  assert(shopPageContent.includes('if (!selectedItemForPurchase || isProcessingPurchase) return;'), 'handleExecutePurchase must guard with isProcessingPurchase');
  assert(shopPageContent.includes('isLoading={isProcessingPurchase}'), 'ConfirmModal must receive isLoading prop');
});

console.log(`\n🎉 ALL ${testsPassed} V23 TESTS PASSED SUCCESSFULLY!`);




