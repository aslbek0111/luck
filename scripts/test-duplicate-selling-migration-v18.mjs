import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockStore } from '../lib/mock-store.js';
import { resolveReward, resolveTitle } from '../lib/catalog-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🧪 TESTING: V18 SELL_DUPLICATE_ATOMIC MIGRATION & LOGIC');
console.log('====================================================\n');

// 1. Verify migration_v18_fix_sell_duplicate_atomic.sql exists and contains required clauses
const v18Path = path.join(rootDir, 'database', 'migration_v18_fix_sell_duplicate_atomic.sql');
if (!fs.existsSync(v18Path)) {
  console.error('❌ migration_v18_fix_sell_duplicate_atomic.sql not found!');
  process.exit(1);
}
const sqlContent = fs.readFileSync(v18Path, 'utf8');

console.log('CHECK 1: Verifying SQL migration clauses...');
const requiredClauses = [
  'CREATE TABLE IF NOT EXISTS public.sales_history',
  'CREATE OR REPLACE FUNCTION public.sell_duplicate_atomic(\n    p_reward_identifier TEXT,\n    p_user_id UUID\n)',
  'GRANT EXECUTE ON FUNCTION public.sell_duplicate_atomic(TEXT, UUID) TO authenticated, service_role, anon;',
  'NOTIFY pgrst, \'reload schema\';',
  'FOR UPDATE',
  'v_inv.quantity <= 1',
];

if (sqlContent.includes('public.sell_duplicate_atomic(\n    p_user_id UUID,\n    p_reward_identifier TEXT\n)')) {
  console.error('❌ SQL should NOT create reverse signature sell_duplicate_atomic(uuid, text)!');
  process.exit(1);
}
if (sqlContent.includes('public.sell_duplicate_atomic(p_user_id, p_reward_identifier)')) {
  console.error('❌ SQL should NOT call sell_duplicate_atomic(uuid, text)!');
  process.exit(1);
}

for (const clause of requiredClauses) {
  if (!sqlContent.includes(clause)) {
    console.error(`❌ Missing expected clause in SQL:\n${clause}`);
    process.exit(1);
  }
}
console.log('  ✓ All required SQL clauses, signatures, overloads, and schema reload present.\n');

// 2. Check Route parameter names
console.log('CHECK 2: Verifying API route parameter consistency...');
const routePath = path.join(rootDir, 'app', 'api', 'inventory', 'sell', 'route.js');
const routeContent = fs.readFileSync(routePath, 'utf8');

if (!routeContent.includes('p_user_id') || !routeContent.includes('p_reward_identifier')) {
  console.error('❌ Route does not pass p_user_id and p_reward_identifier!');
  process.exit(1);
}
console.log('  ✓ Route passes { p_user_id, p_reward_identifier } matching SQL signatures exactly.\n');

// 3. Test duplicate selling in mockStore for each rarity
console.log('CHECK 3: Verifying rarity pricing tiers for duplicate selling...');
const rarityRanges = {
  common: [5, 10],
  uncommon: [10, 20],
  rare: [20, 35],
  epic: [40, 55],
  'pro-epic': [80, 100],
  mythic: [150, 200],
  legendary: [250, 350],
};

const users = mockStore.getUsers();
const testUser = users[0];

// Test items for each rarity
const testItems = [
  { rarity: 'common', id: 'reward-rose-1', name: '1 Роза' },
  { rarity: 'uncommon', id: '10000000-0000-0000-0000-000000000076', name: 'BALBIBOL' },
  { rarity: 'rare', id: '10000000-0000-0000-0000-000000000071', name: 'ТЕРПИЛЛА' },
  { rarity: 'epic', id: '10000000-0000-0000-0000-000000000074', name: 'FEMBOY' },
  { rarity: 'pro-epic', id: '10000000-0000-0000-0000-000000000077', name: 'ИМПЕРАТОР' },
  { rarity: 'mythic', id: '10000000-0000-0000-0000-000000000078', name: 'ДЕМИУРГ' },
  { rarity: 'legendary', id: '10000000-0000-0000-0000-000000000073', name: 'САНТА' },
];

for (const item of testItems) {
  // Clear any existing copies and set exactly 2 copies
  const allInv = mockStore.getInventory();
  if (!allInv[testUser.id]) allInv[testUser.id] = [];
  const meta = resolveReward(item.id) || resolveTitle(item.id);
  allInv[testUser.id] = allInv[testUser.id].filter(
    (it) => it.rewardId !== item.id && (!meta || (it.rewardId !== meta.id && it.rewardId !== meta.uuid))
  );
  mockStore.saveInventory(allInv);
  mockStore.addItemToInventory(testUser.id, item.id, 2);

  const res = mockStore.sellDuplicate(testUser.id, item.id);
  if (!res.success) {
    console.error(`❌ Failed selling duplicate for ${item.name} (${item.rarity}):`, res.error);
    process.exit(1);
  }

  const [min, max] = rarityRanges[item.rarity];
  const earned = res.coins_earned || res.earnedCoins;
  if (earned < min || earned > max) {
    console.error(`❌ Earned coins ${earned} outside range [${min}, ${max}] for ${item.rarity}`);
    process.exit(1);
  }

  if (res.remaining_quantity !== 1) {
    console.error(`❌ Expected remaining_quantity 1, got ${res.remaining_quantity}`);
    process.exit(1);
  }

  console.log(`  ✓ ${item.name} (${item.rarity}): earned ${earned} Coins (range ${min}–${max}). Remaining: ${res.remaining_quantity}`);

  // Selling last copy must fail
  const singleRes = mockStore.sellDuplicate(testUser.id, item.id);
  if (singleRes.success) {
    console.error(`❌ Sold single copy of ${item.name} when quantity was 1! Must be disallowed.`);
    process.exit(1);
  }
  console.log(`    ↳ Protected single copy: ${singleRes.error}`);
}

console.log('\n====================================================');
console.log('🎉 ALL V18 TESTS PASSED SUCCESSFULLY!');
console.log('====================================================');
