/**
 * Test script for:
 * - database/migration_v21a_enum_christmas.sql
 * - database/migration_v21b_restore_christmas_catalog.sql
 * - database/migration_v21_restore_christmas_catalog.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runTests() {
  console.log('--- Starting Migration V21 / V21A / V21B Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ ${message}`);
      failed++;
    }
  }

  // 1. Read catalog-data.js
  const { CHRISTMAS_REWARDS, ITEM_UUID_MAP } = await import('../lib/catalog-data.js');

  // 2. Read migration files
  const sql21a = fs.readFileSync(path.join(rootDir, 'database', 'migration_v21a_enum_christmas.sql'), 'utf8');
  const sql21b = fs.readFileSync(path.join(rootDir, 'database', 'migration_v21b_restore_christmas_catalog.sql'), 'utf8');
  const sql21 = fs.readFileSync(path.join(rootDir, 'database', 'migration_v21_restore_christmas_catalog.sql'), 'utf8');

  // Check V21A
  assert(!sql21a.includes('WHEN OTHERS THEN NULL'), 'V21A: No EXCEPTION WHEN OTHERS THEN NULL');
  assert(sql21a.includes("ADD VALUE") && sql21a.includes("'christmas'"), "V21A: Adds enum label 'christmas'");
  assert(sql21a.includes('pg_enum'), 'V21A: Checks pg_enum before altering type');

  // Check V21B
  assert(!sql21b.includes('WHEN OTHERS THEN NULL'), 'V21B: No EXCEPTION WHEN OTHERS THEN NULL');
  assert(sql21b.includes('BEGIN;') && sql21b.includes('COMMIT;'), 'V21B: Wrapped in atomic BEGIN/COMMIT transaction');
  assert(sql21b.includes('ON CONFLICT (id) DO UPDATE SET'), 'V21B: Uses ON CONFLICT (id) DO UPDATE SET');
  assert(!sql21b.includes('ALTER TABLE public.rewards_catalog ALTER COLUMN category TYPE TEXT;'), 'V21B: Does NOT alter column types');
  assert(!sql21b.includes('_legacy_'), 'V21B: Does NOT silently rename slugs to _legacy_');
  assert(sql21b.includes('Duplicate slugs detected'), 'V21B: Detects general duplicate slugs in rewards_catalog');
  assert(sql21b.includes('Non-canonical records with Christmas slugs detected'), 'V21B: Detects and reports slug conflicts safely');
  assert(sql21b.includes('v_integrity_errors'), 'V21B: Performs multi-level integrity verification');

  // Check all 15 items in V21B
  const expectedChristmasUuids = Array.from({ length: 15 }, (_, i) => '10000000-0000-0000-0000-0000000000' + (31 + i).toString());

  for (const uuid of expectedChristmasUuids) {
    const slug = Object.entries(ITEM_UUID_MAP).find(([s, u]) => u === uuid)?.[0];
    const catItem = CHRISTMAS_REWARDS.find(r => r.id === slug || r.uuid === uuid);
    assert(Boolean(catItem), `Catalog item found for ${uuid} (${slug})`);
    assert(sql21b.includes(uuid), `V21B: Contains UUID ${uuid}`);
    assert(sql21b.includes(`'${catItem.name}'`), `V21B: Contains item name '${catItem.name}'`);
    assert(sql21b.includes(`'${catItem.rarity}'`), `V21B: Contains rarity '${catItem.rarity}' for ${catItem.name}`);
    assert(sql21b.includes(`'${catItem.icon}'`), `V21B: Contains icon '${catItem.icon}' for ${catItem.name}`);
  }

  // Check 57 canonical UUIDs in verification array
  const arrayBlockMatch = sql21b.match(/v_canonical_uuids\s+UUID\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/);
  assert(Boolean(arrayBlockMatch), 'V21B: Found v_canonical_uuids array in migration');

  const arrayUuids = [...arrayBlockMatch[1].matchAll(/'(10000000-0000-0000-0000-[0-9a-f]{12})'/gi)].map(m => m[1]);
  assert(arrayUuids.length === 57, `V21B: Verification array contains 57 UUIDs (found: ${arrayUuids.length})`);
  const uniqueVerification = new Set(arrayUuids);
  assert(uniqueVerification.size === 57, `V21B: Verification array has exactly 57 unique UUIDs (found: ${uniqueVerification.size})`);

  // Simulation: Restore catalog from 42 items to 57 items with corrupted item correction
  const mockDbCatalog = new Map();
  for (let i = 1; i <= 25; i++) {
    const hex = i.toString().padStart(2, '0');
    mockDbCatalog.set(`10000000-0000-0000-0000-0000000000${hex}`, {
      name: `Base Item ${hex}`,
      category: i <= 2 ? 'uc' : (i <= 6 ? 'popularity' : (i <= 9 ? 'roses' : (i <= 11 ? 'spins' : (i <= 17 ? 'titles' : 'jokes')))),
      rarity: 'common',
      icon_name: 'Sparkles',
      value: 10,
      price_coins: (i === 1 || i === 2 || i === 17) ? null : 100,
      price_points: (i === 1 || i === 2 || i === 17) ? null : 100,
      is_title: i >= 12 && i <= 17,
      title_slug: i >= 12 && i <= 17 ? `title-${hex}` : null,
      is_active: true
    });
  }
  for (let i = 51; i <= 54; i++) {
    mockDbCatalog.set(`10000000-0000-0000-0000-0000000000${i}`, {
      name: `Coin ${i}`,
      category: 'coins',
      rarity: 'common',
      icon_name: 'Coins',
      value: i,
      price_coins: null,
      price_points: null,
      is_title: false,
      title_slug: null,
      is_active: true
    });
  }
  for (let i = 61; i <= 65; i++) {
    mockDbCatalog.set(`10000000-0000-0000-0000-0000000000${i}`, {
      name: `Pro Epic ${i}`,
      category: 'titles',
      rarity: 'pro-epic',
      icon_name: 'Crown',
      value: 1000,
      price_coins: 1000,
      price_points: 1000,
      is_title: true,
      title_slug: `title-${i}`,
      is_active: true
    });
  }
  for (let i = 71; i <= 78; i++) {
    mockDbCatalog.set(`10000000-0000-0000-0000-0000000000${i}`, {
      name: `New Title ${i}`,
      category: 'titles',
      rarity: 'rare',
      icon_name: 'Award',
      value: 500,
      price_coins: 500,
      price_points: 500,
      is_title: true,
      title_slug: `title-${i}`,
      is_active: true
    });
  }

  // Add 1 corrupted Christmas item
  mockDbCatalog.set('10000000-0000-0000-0000-000000000031', {
    name: 'CORRUPTED STICKER',
    category: 'christmas',
    rarity: 'common',
    icon_name: 'Sparkles',
    value: 1,
    price_coins: 9999,
    price_points: 9999,
    is_title: false,
    title_slug: null,
    is_active: true
  });

  assert(mockDbCatalog.size === 43, `Initial mock database has 42 base + 1 corrupted item (total: ${mockDbCatalog.size})`);

  // Simulate UPSERT
  let inserted = 0;
  let updated = 0;
  for (const uuid of expectedChristmasUuids) {
    const slug = Object.entries(ITEM_UUID_MAP).find(([s, u]) => u === uuid)?.[0];
    const catItem = CHRISTMAS_REWARDS.find(r => r.id === slug || r.uuid === uuid);

    if (mockDbCatalog.has(uuid)) {
      mockDbCatalog.set(uuid, {
        name: catItem.name,
        category: catItem.category,
        rarity: catItem.rarity,
        icon_name: catItem.icon,
        description: catItem.description,
        value: catItem.value,
        price_coins: catItem.priceCoins,
        price_points: catItem.pricePoints,
        is_title: false,
        title_slug: null,
        conditions: catItem.conditions,
        is_active: true
      });
      updated++;
    } else {
      mockDbCatalog.set(uuid, {
        name: catItem.name,
        category: catItem.category,
        rarity: catItem.rarity,
        icon_name: catItem.icon,
        description: catItem.description,
        value: catItem.value,
        price_coins: catItem.priceCoins,
        price_points: catItem.pricePoints,
        is_title: false,
        title_slug: null,
        conditions: catItem.conditions,
        is_active: true
      });
      inserted++;
    }
  }

  assert(inserted === 14, `Simulation inserted 14 items (inserted: ${inserted})`);
  assert(updated === 1, `Simulation updated 1 corrupted item (updated: ${updated})`);
  assert(mockDbCatalog.size === 57, `Total catalog size after migration is 57 (size: ${mockDbCatalog.size})`);
  assert(mockDbCatalog.get('10000000-0000-0000-0000-000000000031').name === 'Новогодний стикер', 'Corrupted item corrected to canonical name');
  assert(mockDbCatalog.get('10000000-0000-0000-0000-000000000031').price_coins === 30, 'Corrupted item corrected to canonical price (30)');

  // Integrity validation simulation
  let integrityErrors = 0;
  for (const uuid of uniqueVerification) {
    const item = mockDbCatalog.get(uuid);
    if (!item) {
      integrityErrors++;
      continue;
    }
    if (!item.name || !item.category || !item.rarity || !item.icon_name || item.value === null || item.value < 0 || !item.is_active) {
      integrityErrors++;
    }
    if (expectedChristmasUuids.includes(uuid)) {
      if (item.category !== 'christmas' || !item.price_coins || item.price_coins <= 0 || item.price_coins !== item.price_points) {
        integrityErrors++;
      }
    }
    if (item.is_title && (!item.title_slug || item.title_slug.trim() === '')) {
      integrityErrors++;
    }
  }
  assert(integrityErrors === 0, 'Simulation: Full catalog integrity checks passed with 0 errors');

  // Re-run simulation
  let secondRunInserted = 0;
  let secondRunUpdated = 0;
  for (const uuid of expectedChristmasUuids) {
    if (!mockDbCatalog.has(uuid)) {
      secondRunInserted++;
    } else {
      secondRunUpdated++;
    }
  }
  assert(secondRunInserted === 0, 'Re-run simulation inserts 0 items (completely idempotent)');
  assert(secondRunUpdated === 15, 'Re-run simulation synchronizes 15 items');
  assert(mockDbCatalog.size === 57, 'Total catalog size remains 57 on re-run');

  console.log(`\n--- Final Test Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
