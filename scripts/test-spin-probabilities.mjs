import assert from 'assert';
import { REWARDS_CATALOG } from '../lib/catalog-data.js';

// Exact function from app/api/spin/play/route.js
function selectRouletteReward() {
  const rand = Math.random() * 100;

  // 1. Coins (46.0% total):
  // 25 coins: 24.0% (rand < 24.0)
  // 50 coins: 13.0% (rand < 37.0)
  // 75 coins: 6.0%  (rand < 43.0)
  // 125 coins: 3.0% (rand < 46.0)
  if (rand < 24.0) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-25') || REWARDS_CATALOG[0];
  if (rand < 37.0) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-50') || REWARDS_CATALOG[0];
  if (rand < 43.0) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-75') || REWARDS_CATALOG[0];
  if (rand < 46.0) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-125') || REWARDS_CATALOG[0];

  // 2. UC - Updated probability (0.05% total):
  // 30 UC: 0.03% (rand < 46.03)
  // 60 UC: 0.02% (rand < 46.05)
  if (rand < 46.03) return REWARDS_CATALOG.find((r) => r.id === 'reward-uc-30') || REWARDS_CATALOG[0];
  if (rand < 46.05) return REWARDS_CATALOG.find((r) => r.id === 'reward-uc-60') || REWARDS_CATALOG[0];

  // 3. Common items & titles: 22.05% (rand < 68.10)
  if (rand < 68.10) {
    const pool = REWARDS_CATALOG.filter((r) => r.rarity === 'common' && r.category !== 'coins' && r.category !== 'uc');
    return pool[Math.floor(Math.random() * pool.length)] || REWARDS_CATALOG[0];
  }

  // 4. Uncommon items & titles: 13.0% (rand < 81.10)
  if (rand < 81.10) {
    const pool = REWARDS_CATALOG.filter((r) => r.rarity === 'uncommon' && r.category !== 'coins' && r.category !== 'uc');
    return pool[Math.floor(Math.random() * pool.length)] || REWARDS_CATALOG[0];
  }

  // 5. Rare items & titles (excluding UC): 8.2% (rand < 89.30)
  if (rand < 89.30) {
    const pool = REWARDS_CATALOG.filter((r) => r.rarity === 'rare' && r.category !== 'coins' && r.category !== 'uc');
    return pool[Math.floor(Math.random() * pool.length)] || REWARDS_CATALOG[0];
  }

  // 6. Epic items & titles (excluding UC): 5.5% (rand < 94.80)
  if (rand < 94.80) {
    const pool = REWARDS_CATALOG.filter((r) => r.rarity === 'epic' && r.category !== 'coins' && r.category !== 'uc');
    return pool[Math.floor(Math.random() * pool.length)] || REWARDS_CATALOG[0];
  }

  // 7. Mythic items & titles: 3.7% (rand < 98.50)
  if (rand < 98.50) {
    const pool = REWARDS_CATALOG.filter((r) => r.rarity === 'mythic' && r.category !== 'coins' && r.category !== 'uc');
    return pool[Math.floor(Math.random() * pool.length)] || REWARDS_CATALOG[0];
  }

  // 8. Legendary items & titles (including Santa): EXACTLY 1.5% (98.50 to 100.0)
  const legPool = REWARDS_CATALOG.filter(
    (r) => r.rarity === 'legendary' && r.category !== 'coins' && r.category !== 'uc' && !r.isVipExclusive
  );
  return legPool[Math.floor(Math.random() * legPool.length)] || REWARDS_CATALOG[0];
}

console.log('Running 100,000 spin Monte Carlo simulation...');
const N = 100000;
const stats = {
  coins25: 0,
  coins50: 0,
  coins75: 0,
  coins125: 0,
  totalCoins: 0,
  uc30: 0,
  uc60: 0,
  totalUc: 0,
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  mythic: 0,
  legendary: 0,
};

for (let i = 0; i < N; i++) {
  const r = selectRouletteReward();
  if (r.id === 'reward-coins-25') { stats.coins25++; stats.totalCoins++; }
  else if (r.id === 'reward-coins-50') { stats.coins50++; stats.totalCoins++; }
  else if (r.id === 'reward-coins-75') { stats.coins75++; stats.totalCoins++; }
  else if (r.id === 'reward-coins-125') { stats.coins125++; stats.totalCoins++; }
  else if (r.id === 'reward-uc-30') { stats.uc30++; stats.totalUc++; }
  else if (r.id === 'reward-uc-60') { stats.uc60++; stats.totalUc++; }
  else if (r.rarity === 'common') { stats.common++; }
  else if (r.rarity === 'uncommon') { stats.uncommon++; }
  else if (r.rarity === 'rare') { stats.rare++; }
  else if (r.rarity === 'epic' || r.rarity === 'pro-epic') { stats.epic++; }
  else if (r.rarity === 'mythic') { stats.mythic++; }
  else if (r.rarity === 'legendary') { stats.legendary++; }
}

const pct = (val) => (val / N * 100).toFixed(2) + '%';

console.log('Results:');
console.log(`  25 Coins:    ${pct(stats.coins25)} (Expected: 24.0%)`);
console.log(`  50 Coins:    ${pct(stats.coins50)} (Expected: 13.0%)`);
console.log(`  75 Coins:    ${pct(stats.coins75)} (Expected: 6.0%)`);
console.log(`  125 Coins:   ${pct(stats.coins125)} (Expected: 3.0%)`);
console.log(`  Total Coins: ${pct(stats.totalCoins)} (Expected: 46.0%)`);
console.log(`  30 UC:       ${pct(stats.uc30)} (Expected: 0.03%)`);
console.log(`  60 UC:       ${pct(stats.uc60)} (Expected: 0.02%)`);
console.log(`  Total UC:    ${pct(stats.totalUc)} (Expected: 0.05%)`);
console.log(`  Common:      ${pct(stats.common)} (Expected: 22.05%)`);
console.log(`  Uncommon:    ${pct(stats.uncommon)} (Expected: 13.0%)`);
console.log(`  Rare:        ${pct(stats.rare)} (Expected: 8.2%)`);
console.log(`  Epic:        ${pct(stats.epic)} (Expected: 5.5%)`);
console.log(`  Mythic:      ${pct(stats.mythic)} (Expected: 3.7%)`);
console.log(`  Legendary:   ${pct(stats.legendary)} (Expected: 1.5%)`);

// Assertions with statistical confidence margin
assert(Math.abs(stats.totalCoins / N * 100 - 46.0) < 0.6, 'Total Coins should be ~46.0%');
assert(Math.abs(stats.coins25 / N * 100 - 24.0) < 0.6, '25 Coins should be ~24.0%');
assert(Math.abs(stats.coins50 / N * 100 - 13.0) < 0.5, '50 Coins should be ~13.0%');
assert(Math.abs(stats.coins75 / N * 100 - 6.0) < 0.4, '75 Coins should be ~6.0%');
assert(Math.abs(stats.coins125 / N * 100 - 3.0) < 0.35, '125 Coins should be ~3.0%');
assert(Math.abs(stats.totalUc / N * 100 - 0.05) < 0.035, 'Total UC should be ~0.05%');
assert(Math.abs(stats.common / N * 100 - 22.05) < 0.6, 'Common should be ~22.05%');
assert(Math.abs(stats.uncommon / N * 100 - 13.0) < 0.5, 'Uncommon should be ~13.0%');
assert(Math.abs(stats.rare / N * 100 - 8.2) < 0.4, 'Rare should be ~8.2%');
assert(Math.abs(stats.epic / N * 100 - 5.5) < 0.35, 'Epic should be ~5.5%');
assert(Math.abs(stats.mythic / N * 100 - 3.7) < 0.3, 'Mythic should be ~3.7%');
assert(Math.abs(stats.legendary / N * 100 - 1.5) < 0.25, 'Legendary should be ~1.5%');

console.log('✓ All probability checks passed with high statistical accuracy!');

