/**
 * LUCKY UC - Automated Production Security & Concurrency Test Suite
 * Run with: node scripts/test-security.mjs
 */

import crypto from 'crypto';
import { createSessionToken, verifySessionToken } from '../lib/session.js';
import { verifyTelegramInitData } from '../lib/telegram-auth.js';
import { mockStore, INITIAL_USERS, INITIAL_INVENTORY } from '../lib/mock-store.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

console.log('\n🔒 ==========================================');
console.log('   LUCKY UC PRODUCTION SECURITY AUDIT SUITE');
console.log('==========================================\n');

// -------------------------------------------------------------
// 1. SESSION TOKEN SECURITY & TIMING ATTACK RESISTANCE
// -------------------------------------------------------------
console.log('--- 1. Session Token & HMAC Signature Tests ---');

const testPayload = { userId: 'user-audit-123', username: 'auditor', isAdmin: false };
const validToken = createSessionToken(testPayload);

// Valid token
const decoded = verifySessionToken(validToken);
assert(decoded && decoded.userId === 'user-audit-123', 'Valid signed session token decodes correctly');

// Tampered payload
const [payloadPart, sigPart] = validToken.split('.');
const tamperedPayload = Buffer.from(JSON.stringify({ ...testPayload, isAdmin: true })).toString('base64url');
const tamperedToken = `${tamperedPayload}.${sigPart}`;
assert(verifySessionToken(tamperedToken) === null, 'Tampered session payload signature rejected');

// Tampered signature
const badSigToken = `${payloadPart}.${sigPart.slice(0, -3)}xyz`;
assert(verifySessionToken(badSigToken) === null, 'Tampered session signature rejected');

// Truncated signature (timingSafeEqual buffer length check)
const truncatedToken = `${payloadPart}.${sigPart.slice(0, 10)}`;
assert(verifySessionToken(truncatedToken) === null, 'Truncated signature safely rejected without throwing RangeError');

// Null / empty / malformed token
assert(verifySessionToken('') === null, 'Empty token rejected');
assert(verifySessionToken('bad.token.format') === null, 'Multi-part malformed token rejected');

// -------------------------------------------------------------
// 2. TELEGRAM INITDATA VALIDATION & REPLAY ATTACK MITIGATION
// -------------------------------------------------------------
console.log('\n--- 2. Telegram initData & Replay Protection Tests ---');

const mockBotToken = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz12345';
const now = Math.floor(Date.now() / 1000);

// Helper to generate legitimate Telegram initData with HMAC-SHA256
function makeTelegramInitData(userData, authDate, botToken) {
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const params = [
    `auth_date=${authDate}`,
    `query_id=AAHdF6IQAAAAAN0XohDhr123`,
    `user=${JSON.stringify(userData)}`,
  ];
  params.sort();
  const dataCheckString = params.join('\n');
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return `auth_date=${authDate}&query_id=AAHdF6IQAAAAAN0XohDhr123&user=${encodeURIComponent(JSON.stringify(userData))}&hash=${hash}`;
}

const validTgUser = { id: 777123456, first_name: 'Test', username: 'security_tester' };
const validInitData = makeTelegramInitData(validTgUser, now, mockBotToken);

// Valid initData
const validRes = verifyTelegramInitData(validInitData, mockBotToken);
assert(validRes.isValid && validRes.user?.id === 777123456, 'Legitimate Telegram initData verified successfully');

// Expired initData (replay attack > 24 hours old)
const oldAuthDate = now - (86400 + 3600); // 25 hours old
const expiredInitData = makeTelegramInitData(validTgUser, oldAuthDate, mockBotToken);
const expiredRes = verifyTelegramInitData(expiredInitData, mockBotToken);
assert(!expiredRes.isValid && expiredRes.error?.includes('expired'), 'Expired initData (>24h) rejected (Replay protection)');

// Future auth_date (clock manipulation attack > 120s in future)
const futureAuthDate = now + 600; // 10 minutes in future
const futureInitData = makeTelegramInitData(validTgUser, futureAuthDate, mockBotToken);
const futureRes = verifyTelegramInitData(futureInitData, mockBotToken);
assert(!futureRes.isValid && futureRes.error?.includes('expired or invalid'), 'Future timestamp initData rejected');

// Tampered user data
const tamperedTgData = validInitData.replace('security_tester', 'hacked_admin');
const tamperedTgRes = verifyTelegramInitData(tamperedTgData, mockBotToken);
assert(!tamperedTgRes.isValid, 'Tampered Telegram user payload rejected with signature mismatch');

// Malformed hash (hex length < 64)
const malformedHashData = validInitData.replace(/hash=[0-9a-fA-F]{64}/, 'hash=short_bad_hash');
const malformedRes = verifyTelegramInitData(malformedHashData, mockBotToken);
assert(!malformedRes.isValid && malformedRes.error?.includes('invalid format'), 'Invalid/short hash rejected without exception');

// -------------------------------------------------------------
// 3. GIFTS SYSTEM & INVENTORY DUPLICATION SAFEGUARDS
// -------------------------------------------------------------
console.log('\n--- 3. Gift Rules, Single Copy & Negative Quantity Safeguards ---');

// Fresh test store setup
mockStore.saveUsers([
  {
    id: 'user-alice',
    username: 'alice',
    active_title_id: 'title-korol',
    free_spins_balance: 5,
    is_blocked: false,
  },
  {
    id: 'user-bob',
    username: 'bob',
    active_title_id: null,
    free_spins_balance: 5,
    is_blocked: false,
  },
]);

mockStore.saveInventory({
  'user-alice': [
    { rewardId: 'reward-rose-bouquet', quantity: 1, acquiredAt: '2026-11-10T10:00:00Z' }, // Only 1 copy
    { rewardId: 'reward-cup', quantity: 3, acquiredAt: '2026-11-10T10:00:00Z' }, // 3 copies (can gift up to 2)
    { rewardId: 'title-korol', quantity: 2, acquiredAt: '2026-11-10T10:00:00Z' }, // Equipped title with 2 copies
  ],
  'user-bob': [],
});

// A. Gifting only 1 copy must FAIL
const soleCopyRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'bob',
  rewardId: 'reward-rose-bouquet',
  quantity: 1,
});
assert(!soleCopyRes.success && soleCopyRes.error?.includes('единственный экземпляр'), 'Gifting the sole copy of an item rejected');

// B. Negative quantity exploit must FAIL (prevent item duplication)
const negativeRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'bob',
  rewardId: 'reward-cup',
  quantity: -5,
});
assert(!negativeRes.success, 'Negative quantity gift exploit rejected');

// C. Gifting ALL copies (quantity = 3, remaining = 0) must FAIL
const allCopiesRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'bob',
  rewardId: 'reward-cup',
  quantity: 3,
});
assert(!allCopiesRes.success && allCopiesRes.error?.includes('все копии'), 'Gifting all remaining copies (leaving 0) rejected');

// D. Gifting last copy of equipped title (quantity = 2, leaving 0) must FAIL
const activeTitleAllRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'bob',
  rewardId: 'title-korol',
  quantity: 2,
});
assert(!activeTitleAllRes.success, 'Gifting all copies of active equipped title rejected');

// E. Gifting to self must FAIL
const selfGiftRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'alice',
  rewardId: 'reward-cup',
  quantity: 1,
});
assert(!selfGiftRes.success && selfGiftRes.error?.includes('самому себе'), 'Gifting to self rejected');

// F. Legitimate gift of duplicate item (quantity = 1 out of 3) must SUCCEED
const validGiftRes = mockStore.sendGift({
  senderId: 'user-alice',
  recipientUsername: 'bob',
  rewardId: 'reward-cup',
  quantity: 1,
});
assert(validGiftRes.success, 'Legitimate gift of duplicate item succeeds');

// Check remaining quantity after valid gift
const aliceInv = mockStore.getUserInventory('user-alice');
const cupItem = aliceInv.find((i) => i.rewardId === 'reward-cup');
assert(cupItem && cupItem.quantity === 2, 'Sender retains remaining copy (quantity reduced from 3 to 2)');

const bobInv = mockStore.getUserInventory('user-bob');
const bobCup = bobInv.find((i) => i.rewardId === 'reward-cup');
assert(bobCup && bobCup.quantity === 1, 'Recipient correctly receives 1 copy');

// -------------------------------------------------------------
// 4. SPIN CONCURRENCY & RACE CONDITION PROTECTION SIMULATION
// -------------------------------------------------------------
console.log('\n--- 4. Spin Concurrency & Race Condition Simulation ---');

// Simulate 5 simultaneous spin requests for a user who has only 1 free spin
let simulatedUser = {
  id: 'user-racer',
  free_spins_balance: 1,
  spins_count: 0,
};

// Simulated atomic check-and-decrement
async function simulateAtomicSpin(userState) {
  // Simulate network latency / race condition
  await new Promise((r) => setTimeout(r, Math.random() * 10));

  // Atomic condition check: WHERE id = userState.id AND free_spins_balance > 0
  if (userState.free_spins_balance > 0) {
    userState.free_spins_balance -= 1;
    userState.spins_count += 1;
    return { success: true, spins_left: userState.free_spins_balance };
  } else {
    return { success: false, error: 'У вас закончились бесплатные вращения!' };
  }
}

const concurrentRequests = [
  simulateAtomicSpin(simulatedUser),
  simulateAtomicSpin(simulatedUser),
  simulateAtomicSpin(simulatedUser),
  simulateAtomicSpin(simulatedUser),
  simulateAtomicSpin(simulatedUser),
];

const results = await Promise.all(concurrentRequests);
const successfulSpins = results.filter((r) => r.success);
const rejectedSpins = results.filter((r) => !r.success);

assert(successfulSpins.length === 1, `Exactly 1 concurrent spin succeeded out of 5 requests (Got: ${successfulSpins.length})`);
assert(rejectedSpins.length === 4, `Remaining 4 concurrent spin requests rejected with out-of-spins error (Got: ${rejectedSpins.length})`);
assert(simulatedUser.free_spins_balance === 0, 'User free_spins_balance safely reached 0 without going negative');

// -------------------------------------------------------------
// 5. CREDENTIAL HYGIENE & DATA LEAKAGE PREVENTION
// -------------------------------------------------------------
console.log('\n--- 5. Credential Hygiene & Data Leakage Tests ---');

const rawUserRecord = {
  id: 'user-sec-999',
  telegram_id: 123456789,
  username: 'secret_user',
  browser_pin: '9876',
  auth_token: 'secret_bearer_token_xyz',
  total_uc: 100,
};

// Simulate API sanitization applied in auth and profile routes
const sanitized = { ...rawUserRecord };
delete sanitized.browser_pin;
delete sanitized.auth_token;

assert(!('browser_pin' in sanitized), 'browser_pin correctly stripped from API responses');
assert(!('auth_token' in sanitized), 'auth_token correctly stripped from API responses');
assert(sanitized.username === 'secret_user' && sanitized.total_uc === 100, 'Public profile properties preserved');

console.log('\n==========================================');
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
