import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  const { CHRISTMAS_REWARDS, ITEM_UUID_MAP } = await import('../lib/catalog-data.js');
  const sql = fs.readFileSync(path.join(rootDir, 'database', 'migration_v21_restore_christmas_catalog.sql'), 'utf8');

  // Extract the VALUES block (handles DO UPDATE or DO NOTHING)
  const valuesMatch = sql.match(/VALUES\s*([\s\S]*?)\s*ON CONFLICT\s*\(id\)\s*DO (UPDATE|NOTHING)/i);
  if (!valuesMatch) {
    console.error('Could not find VALUES block in SQL');
    process.exit(1);
  }

  // Parse each row tuple (...)
  const rowRegex = /\(\s*'([0-9a-f-]+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(TRUE|FALSE)\s*,\s*(NULL|'[^']*')\s*,\s*'([^']+)'\s*,\s*(TRUE|FALSE)\s*\)/gi;

  const sqlRows = [];
  let match;
  while ((match = rowRegex.exec(valuesMatch[1])) !== null) {
    sqlRows.push({
      id: match[1],
      slug: match[2],
      name: match[3],
      category: match[4],
      rarity: match[5],
      icon_name: match[6],
      description: match[7],
      value: parseInt(match[8], 10),
      price_coins: parseInt(match[9], 10),
      price_points: parseInt(match[10], 10),
      is_title: match[11].toUpperCase() === 'TRUE',
      title_slug: match[12] === 'NULL' ? null : match[12].replace(/^'|'$/g, ''),
      conditions: match[13],
      is_active: match[14].toUpperCase() === 'TRUE'
    });
  }

  console.log(`Parsed SQL rows count: ${sqlRows.length} (expected 15)`);

  const report = [];
  let allPass = true;

  for (let i = 0; i < CHRISTMAS_REWARDS.length; i++) {
    const cat = CHRISTMAS_REWARDS[i];
    const expectedUuid = ITEM_UUID_MAP[cat.id];
    const sqlItem = sqlRows.find(r => r.id === expectedUuid);

    if (!sqlItem) {
      report.push({
        index: i + 1,
        id: cat.id,
        name: cat.name,
        uuid: expectedUuid,
        status: 'FAIL',
        error: 'Not found in SQL by UUID'
      });
      allPass = false;
      continue;
    }

    const checks = [
      ['UUID', sqlItem.id, expectedUuid],
      ['slug', sqlItem.slug, cat.id],
      ['name', sqlItem.name, cat.name],
      ['category', sqlItem.category, cat.category],
      ['rarity', sqlItem.rarity, cat.rarity],
      ['icon_name', sqlItem.icon_name, cat.icon],
      ['description', sqlItem.description, cat.description],
      ['value', sqlItem.value, cat.value],
      ['price_coins', sqlItem.price_coins, cat.priceCoins],
      ['price_points', sqlItem.price_points, cat.pricePoints],
      ['is_title', sqlItem.is_title, false],
      ['title_slug', sqlItem.title_slug, null],
      ['conditions', sqlItem.conditions, cat.conditions],
      ['is_active', sqlItem.is_active, true]
    ];

    const discrepancies = [];
    for (const [field, actual, expected] of checks) {
      if (actual !== expected) {
        discrepancies.push(`${field}: expected '${expected}', got '${actual}'`);
      }
    }

    if (discrepancies.length > 0) {
      allPass = false;
      report.push({
        index: i + 1,
        id: cat.id,
        name: cat.name,
        uuid: expectedUuid,
        status: 'FAIL',
        discrepancies
      });
    } else {
      report.push({
        index: i + 1,
        id: cat.id,
        name: cat.name,
        uuid: expectedUuid,
        status: 'PASS',
        fields: {
          category: sqlItem.category,
          rarity: sqlItem.rarity,
          icon_name: sqlItem.icon_name,
          value: sqlItem.value,
          price_coins: sqlItem.price_coins,
          price_points: sqlItem.price_points,
          conditions: sqlItem.conditions
        }
      });
    }
  }

  console.log('\n--- VERIFICATION REPORT ---');
  report.forEach(r => {
    if (r.status === 'PASS') {
      console.log(`[PASS] #${r.index} ${r.name} (${r.id}) -> UUID: ${r.uuid}`);
      console.log(`       icon: ${r.fields.icon_name} | value: ${r.fields.value} | price_coins: ${r.fields.price_coins} | price_points: ${r.fields.price_points}`);
      console.log(`       conditions: ${r.fields.conditions}`);
    } else {
      console.error(`[FAIL] #${r.index} ${r.name} (${r.id}) -> ${r.error || r.discrepancies.join(', ')}`);
    }
  });

  console.log(`\nFinal Result: ${allPass ? 'ALL 15 ITEMS PASS' : 'SOME ITEMS FAILED'}`);
  if (!allPass) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
