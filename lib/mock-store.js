import { TITLES_LIST, REWARDS_CATALOG, CHRISTMAS_REWARDS, resolveReward, resolveTitle } from './catalog-data.js';

// The 14 official accounts: 10 Standard + 4 VIP
export const STANDARD_ACCOUNTS = [
  'Snow24A',
  'Frost82B',
  'Winter39C',
  'Gift51Dx',
  'Santa73K',
  'Magic46P',
  'Merry28Q',
  'North64R',
  'Star92Tm',
  'Candy35V',
];

export const VIP_ACCOUNTS = [
  'VIP5000X',
  'VIP2026Z',
  'VIP7777M',
  'VIP9999K',
];

export const ADMIN_ACCOUNTS = [
  'admin',
  'adminvip',
  'lucky_admin',
];

export const ADMIN_INITIAL_HASHES = {
  'admin': '$2b$10$BHM7vdAPHKw/sQfckKMCu.MkDQ0jAcT91R9w8AZRsw5IKwngyRoWa',
  'adminvip': '$2b$10$kcS89oEV9HlNoQHKf7WrEOGVHX/6c8634n43mzRMDVl0McoutdAPq',
  'lucky_admin': '$2b$10$TOLeleIkw/.fCfFYYlU0iOR4fBQVOXiuAmpvY2XNauZiLVG5Jjdpu',
};

export const INITIAL_USERS = [];

// Exactly 14 registration codes (10 Standard + 4 VIP)
export const INITIAL_REGISTRATION_CODES = [
  { code: 'Snow24A', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Frost82B', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Winter39C', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Gift51Dx', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Santa73K', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Magic46P', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Merry28Q', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'North64R', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Star92Tm', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'Candy35V', type: 'standard', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'VIP5000X', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'VIP2026Z', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'VIP7777M', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
  { code: 'VIP9999K', type: 'vip', isUsed: false, usedByUserId: null, usedAt: null },
];

export const INITIAL_INVENTORY = {};

export const INITIAL_EVENTS = [];

export const INITIAL_GIFTS_HISTORY = [];

const STORAGE_KEYS = {
  USERS: 'lucky_uc_users_v2',
  CURRENT_USER_ID: 'lucky_uc_current_user_id_v2',
  INVENTORY: 'lucky_uc_inventory_v2',
  EVENTS: 'lucky_uc_events_v2',
  GIFTS_HISTORY: 'lucky_uc_gifts_history_v2',
  CODES: 'lucky_uc_codes_v2',
  NOTIFICATIONS: 'lucky_uc_notifications_v2',
  AUDIT_LOGS: 'lucky_uc_audit_logs_v2',
  CONFIG: 'lucky_uc_config_v2',
};

function getFsAndPath() {
  if (typeof window !== 'undefined') return { fs: null, path: null };
  try {
    if (typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function') {
      const fs = process.getBuiltinModule('fs');
      const path = process.getBuiltinModule('path');
      if (fs && path) return { fs, path };
    }
  } catch {}
  try {
    const fs = eval('require')('fs');
    const path = eval('require')('path');
    return { fs, path };
  } catch {}
  return { fs: null, path: null };
}

class MockStore {
  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    this.serverUsers = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.serverInventory = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
    this.serverCurrentUserId = null; // NEVER auto-login by default
    this.serverEvents = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.serverGiftsHistory = JSON.parse(JSON.stringify(INITIAL_GIFTS_HISTORY));
    this.serverRegistrationCodes = JSON.parse(JSON.stringify(INITIAL_REGISTRATION_CODES));
    this.serverNotifications = [];
    this.serverAuditLogs = [];
    this.serverSpinsHistory = [];
    this.serverPurchasesHistory = [];
    this.serverPopularityTransactions = [];
    this.serverSystemConfig = {
      spin_wheel_enabled: true,
      max_player_slots: 14,
    };

    if (!this.isBrowser) {
      this.loadFromFile();
    }
    this.ensureCanonicalAccounts();
  }

  ensureCanonicalAccounts() {
    if (!this.serverUsers) this.serverUsers = [];
    if (!this.serverInventory) this.serverInventory = {};

    let modified = false;

    // 10 Standard Accounts
    for (const name of STANDARD_ACCOUNTS) {
      const existing = this.serverUsers.find(
        (u) => u.username && u.username.toLowerCase() === name.toLowerCase()
      );
      if (!existing) {
        const userId = `user-${name.toLowerCase()}`;
        this.serverUsers.push({
          id: userId,
          telegram_id: null,
          username: name,
          first_name: name,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          active_title_id: null,
          password_hash: null,
          recovery_key_hash: null,
          spins_count: 0,
          total_uc: 0,
          total_popularity: 0,
          popularity_updated_at: new Date().toISOString(),
          free_spins_balance: 2,
          last_daily_spins_at: new Date().toISOString(),
          is_approved: true,
          is_blocked: false,
          is_admin: false,
          is_vip: false,
          profile_frame: 'default',
          vip_badge: null,
          coins_balance: 0,
          points_balance: 0,
          created_at: new Date().toISOString(),
        });
        if (!this.serverInventory[userId]) {
          this.serverInventory[userId] = [];
        }
        if (!this.serverInventory[userId].some((it) => it.rewardId === 'reward-xmas-sticker')) {
          this.serverInventory[userId].push({
            id: `inv-reward-xmas-sticker-${userId}`,
            rewardId: 'reward-xmas-sticker',
            quantity: 1,
            acquiredAt: new Date().toISOString(),
          });
        }
        modified = true;
      }
    }

    // 4 VIP Accounts
    for (const name of VIP_ACCOUNTS) {
      const existing = this.serverUsers.find(
        (u) => u.username && u.username.toLowerCase() === name.toLowerCase()
      );
      if (!existing) {
        const userId = `user-${name.toLowerCase()}`;
        this.serverUsers.push({
          id: userId,
          telegram_id: null,
          username: name,
          first_name: name,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          active_title_id: 'title-vip',
          password_hash: null,
          recovery_key_hash: null,
          spins_count: 0,
          total_uc: 5000,
          total_popularity: 0,
          popularity_updated_at: new Date().toISOString(),
          free_spins_balance: 999999,
          last_daily_spins_at: new Date().toISOString(),
          is_approved: true,
          is_blocked: false,
          is_admin: true,
          is_vip: true,
          profile_frame: 'vip_gold',
          vip_badge: 'VIP_ADMIN',
          coins_balance: 1000,
          points_balance: 1000,
          created_at: new Date().toISOString(),
        });
        this.seedVipAdminInventory(userId);
        modified = true;
      } else {
        // Enforce all former VIP privileges on existing VIP accounts
        if (!existing.is_vip) { existing.is_vip = true; modified = true; }
        if (!existing.is_admin) { existing.is_admin = true; modified = true; }
        if (existing.profile_frame !== 'vip_gold') { existing.profile_frame = 'vip_gold'; modified = true; }
        if (existing.vip_badge !== 'VIP_ADMIN') { existing.vip_badge = 'VIP_ADMIN'; modified = true; }
        if (!existing.active_title_id) { existing.active_title_id = 'title-vip'; modified = true; }
        if (typeof existing.total_uc !== 'number' || existing.total_uc < 5000) { existing.total_uc = 5000; modified = true; }
        if (typeof existing.free_spins_balance !== 'number' || existing.free_spins_balance < 999999) { existing.free_spins_balance = 999999; modified = true; }
        if (typeof existing.coins_balance !== 'number' || existing.coins_balance < 1000) { existing.coins_balance = 1000; modified = true; }
        if (typeof existing.points_balance !== 'number' || existing.points_balance < 1000) { existing.points_balance = existing.coins_balance; modified = true; }
        this.seedVipAdminInventory(existing.id);
      }
    }

    // Dedicated ADMIN Accounts (Distinct ADMIN role: is_admin: true, is_vip: false, unlimited points & coins)
    for (const name of ADMIN_ACCOUNTS) {
      const existing = this.serverUsers.find(
        (u) => u.username && u.username.toLowerCase() === name.toLowerCase()
      );
      const defaultHash = ADMIN_INITIAL_HASHES[name.toLowerCase()] || null;
      if (!existing) {
        const userId = `user-${name.toLowerCase()}`;
        this.serverUsers.push({
          id: userId,
          telegram_id: null,
          username: name,
          first_name: name.charAt(0).toUpperCase() + name.slice(1),
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          active_title_id: null,
          password_hash: defaultHash,
          recovery_key_hash: defaultHash,
          spins_count: 0,
          total_uc: 5000,
          total_popularity: 0,
          popularity_updated_at: new Date().toISOString(),
          free_spins_balance: 999999,
          last_daily_spins_at: new Date().toISOString(),
          is_approved: true,
          is_blocked: false,
          is_admin: true,
          is_vip: false,
          profile_frame: 'admin_shield',
          vip_badge: null,
          coins_balance: 999999,
          points_balance: 999999,
          created_at: new Date().toISOString(),
        });
        this.seedVipAdminInventory(userId);
        modified = true;
      } else {
        if (!existing.is_admin) { existing.is_admin = true; modified = true; }
        if (existing.is_vip) { existing.is_vip = false; modified = true; }
        if (existing.profile_frame === 'default') { existing.profile_frame = 'admin_shield'; modified = true; }
        if (!existing.password_hash && defaultHash) {
          existing.password_hash = defaultHash;
          existing.recovery_key_hash = defaultHash;
          modified = true;
        }
        if (typeof existing.total_uc !== 'number' || existing.total_uc < 5000) { existing.total_uc = 5000; modified = true; }
        if (typeof existing.free_spins_balance !== 'number' || existing.free_spins_balance < 999999) { existing.free_spins_balance = 999999; modified = true; }
        if (typeof existing.coins_balance !== 'number' || existing.coins_balance < 999999) { existing.coins_balance = 999999; modified = true; }
        if (typeof existing.points_balance !== 'number' || existing.points_balance < 999999) { existing.points_balance = 999999; modified = true; }
        this.seedVipAdminInventory(existing.id);
      }
    }

    if (modified && !this.isBrowser) {
      this.saveToFile();
    }
  }

  loadFromFile() {
    if (this.isBrowser) return;
    try {
      const { fs, path } = getFsAndPath();
      if (!fs || !path) return;
      const dataFilePath = path.join(process.cwd(), '.dev_store.json');
      if (fs.existsSync(dataFilePath)) {
        this.lastLoadedMtime = fs.statSync(dataFilePath).mtimeMs;
        const raw = fs.readFileSync(dataFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          // Do not delete or filter out lucky_admin or other admin accounts
          const cleaned = data.users;
          // Enforce role-based privileges: ADMIN, VIP, Standard
          cleaned.forEach((u) => {
            const isAdminName = ADMIN_ACCOUNTS.some((a) => a.toLowerCase() === (u.username || '').toLowerCase());
            const isVipName = VIP_ACCOUNTS.some((v) => v.toLowerCase() === (u.username || '').toLowerCase());

            if (isAdminName || (u.is_admin && !u.is_vip)) {
              // Dedicated ADMIN Account (Unlimited points, coins, spins, full admin dashboard access)
              u.is_admin = true;
              u.is_vip = false;
              if (u.profile_frame === 'default') u.profile_frame = 'admin_shield';
              const defaultHash = ADMIN_INITIAL_HASHES[u.username.toLowerCase()];
              if (!u.password_hash && defaultHash) {
                u.password_hash = defaultHash;
                u.recovery_key_hash = defaultHash;
              }
              if (typeof u.total_uc !== 'number' || u.total_uc < 5000) {
                u.total_uc = 5000;
              }
              if (typeof u.free_spins_balance !== 'number' || u.free_spins_balance < 999999) {
                u.free_spins_balance = 999999;
              }
              if (typeof u.coins_balance !== 'number' || u.coins_balance < 999999) {
                u.coins_balance = 999999;
              }
              if (typeof u.points_balance !== 'number' || u.points_balance < 999999) {
                u.points_balance = 999999;
              }
              this.seedVipAdminInventory(u.id);
            } else if (isVipName || u.is_vip) {
              // VIP account
              u.is_vip = true;
              u.is_admin = true;
              u.profile_frame = 'vip_gold';
              u.vip_badge = 'VIP_ADMIN';
              if (!u.active_title_id) {
                u.active_title_id = 'title-vip';
              }
              if (typeof u.total_uc !== 'number' || u.total_uc < 5000) {
                u.total_uc = 5000;
              }
              if (typeof u.free_spins_balance !== 'number' || u.free_spins_balance < 999999) {
                u.free_spins_balance = 999999;
              }
              if (typeof u.coins_balance !== 'number' || u.coins_balance < 1000) {
                u.coins_balance = typeof u.points_balance === 'number' && u.points_balance >= 1000 ? u.points_balance : 1000;
              }
              if (typeof u.points_balance !== 'number' || u.points_balance < 1000) {
                u.points_balance = u.coins_balance;
              }
            } else {
              // STANDARD accounts: keep existing earned balances, default to 0 if not set
              if (typeof u.total_uc !== 'number') u.total_uc = 0;
              if (typeof u.coins_balance !== 'number') u.coins_balance = 0;
              if (typeof u.points_balance !== 'number') u.points_balance = u.coins_balance;
              if (typeof u.free_spins_balance !== 'number') {
                u.free_spins_balance = 2;
              }
              if (!u.last_daily_spins_at) {
                u.last_daily_spins_at = u.created_at || new Date().toISOString();
              }
            }
            if (typeof u.total_popularity !== 'number') {
              u.total_popularity = 0;
            }
            if (!u.popularity_updated_at) {
              u.popularity_updated_at = u.created_at || new Date().toISOString();
            }
          });
          this.serverUsers = cleaned;
        }
        if (data.inventory) {
          const inv = { ...data.inventory };
          delete inv['user-admin'];
          this.serverInventory = inv;
        }
        if (data.events) this.serverEvents = data.events;
        if (data.giftsHistory) this.serverGiftsHistory = data.giftsHistory;
        if (data.registrationCodes) {
          // Merge with initial codes
          const codes = [...INITIAL_REGISTRATION_CODES];
          for (const savedCode of data.registrationCodes) {
            const idx = codes.findIndex((c) => c.code.toLowerCase() === savedCode.code.toLowerCase());
            if (idx !== -1) {
              codes[idx] = savedCode;
            }
          }
          this.serverRegistrationCodes = codes;
        }
        if (data.notifications) this.serverNotifications = data.notifications;
        if (data.auditLogs) this.serverAuditLogs = data.auditLogs;
        if (data.spinsHistory) this.serverSpinsHistory = data.spinsHistory;
        if (data.purchasesHistory) this.serverPurchasesHistory = data.purchasesHistory;
        if (data.popularityTransactions) this.serverPopularityTransactions = data.popularityTransactions;
        if (data.systemConfig) {
          this.serverSystemConfig = {
            ...data.systemConfig,
            max_player_slots: Math.max(14, data.systemConfig.max_player_slots || 14),
          };
        }
        if (data.currentUserId !== undefined) this.serverCurrentUserId = data.currentUserId;
      }
    } catch {
      // In-memory fallback
    }
    this.ensureCanonicalAccounts();
  }

  checkFileSync() {
    if (this.isBrowser) return;
    try {
      const { fs, path } = getFsAndPath();
      if (!fs || !path) return;
      const dataFilePath = path.join(process.cwd(), '.dev_store.json');
      if (fs.existsSync(dataFilePath)) {
        const mtime = fs.statSync(dataFilePath).mtimeMs;
        if (!this.lastLoadedMtime || mtime > this.lastLoadedMtime) {
          this.loadFromFile();
        }
      }
    } catch {
      // ignore
    }
  }

  saveToFile() {
    if (this.isBrowser) return;
    try {
      const { fs, path } = getFsAndPath();
      if (!fs || !path) return;
      const dataFilePath = path.join(process.cwd(), '.dev_store.json');
      const payload = {
        users: this.serverUsers,
        inventory: this.serverInventory,
        events: this.serverEvents,
        giftsHistory: this.serverGiftsHistory,
        registrationCodes: this.serverRegistrationCodes,
        notifications: this.serverNotifications,
        auditLogs: this.serverAuditLogs,
        spinsHistory: this.serverSpinsHistory || [],
        purchasesHistory: this.serverPurchasesHistory || [],
        popularityTransactions: this.serverPopularityTransactions || [],
        systemConfig: this.serverSystemConfig,
        currentUserId: this.serverCurrentUserId,
      };
      fs.writeFileSync(dataFilePath, JSON.stringify(payload, null, 2), 'utf8');
      this.lastLoadedMtime = fs.statSync(dataFilePath).mtimeMs;
    } catch {
      // In-memory fallback
    }
  }

  // --- REGISTRATION CODES MANAGEMENT ---
  getRegistrationCodes() {
    this.checkFileSync();
    return this.serverRegistrationCodes;
  }

  isRegistrationCode(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim().toLowerCase();
    this.checkFileSync();
    return this.serverRegistrationCodes.some((c) => c.code.toLowerCase() === clean);
  }

  validateAndUseCode(code, userId) {
    if (!code) {
      return { valid: false, error: 'Введите код регистрации' };
    }

    const cleanCode = code.trim();
    const codeObj = this.serverRegistrationCodes.find(
      (c) => c.code.toLowerCase() === cleanCode.toLowerCase()
    );

    if (!codeObj) {
      return { valid: false, error: 'Неверный код регистрации. Проверьте код и повторите ввод.' };
    }

    if (codeObj.isUsed) {
      return { valid: false, error: 'Этот код регистрации уже был использован другим игроком.' };
    }

    // Check 14 player accounts limit
    const totalPlayers = this.getUsers().length;
    if (totalPlayers >= 14) {
      return { valid: false, error: 'Регистрация закрыта: все 14 игровых мест заняты.' };
    }

    // Mark as used
    codeObj.isUsed = true;
    codeObj.usedByUserId = userId;
    codeObj.usedAt = new Date().toISOString();
    this.saveToFile();

    return {
      valid: true,
      type: codeObj.type, // 'standard' | 'vip'
      code: codeObj.code,
    };
  }

  seedVipAdminInventory(userId) {
    if (!this.serverInventory) this.serverInventory = {};
    if (!this.serverInventory[userId]) {
      this.serverInventory[userId] = [];
    }
    const userItems = this.serverInventory[userId];
    const allCatalogItems = [
      ...REWARDS_CATALOG,
      ...TITLES_LIST.map((t) => ({ id: t.id, name: t.name })),
    ];
    allCatalogItems.forEach((item) => {
      const existing = userItems.find((it) => it.rewardId === item.id);
      if (!existing) {
        userItems.push({
          id: 'inv-' + item.id + '-' + userId,
          rewardId: item.id,
          quantity: 3,
          acquiredAt: new Date().toISOString(),
        });
      } else if ((existing.quantity || 0) < 3) {
        existing.quantity = 3;
      }
    });
    this.saveToFile();
  }

  // --- USERS MANAGEMENT ---
  getUsers() {
    this.checkFileSync();
    if (!this.isBrowser) return this.serverUsers;
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      return this.serverUsers;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return this.serverUsers;
    }
  }

  saveUsers(users) {
    this.serverUsers = users;
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } else {
      this.saveToFile();
    }
  }

  getUserById(userId) {
    if (!userId) return null;
    this.ensureCanonicalAccounts();
    const users = this.getUsers();
    return users.find((u) => u.id === userId) || null;
  }

  getUserByUsername(username) {
    if (!username) return null;
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    this.ensureCanonicalAccounts();
    const users = this.getUsers();
    return users.find((u) => u.username?.toLowerCase() === clean) || null;
  }

  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.saveUsers(users);
      return users[index];
    }
    return null;
  }

  unblockAllUsers() {
    const users = this.getUsers();
    let modified = false;
    users.forEach((u) => {
      if (u.is_blocked || !u.is_approved) {
        u.is_blocked = false;
        u.is_approved = true;
        modified = true;
      }
    });
    if (modified) {
      this.saveUsers(users);
    }
    return users;
  }

  addUser(newUser) {
    const isVip = Boolean(newUser.is_vip);
    const isAdmin = Boolean(newUser.is_admin) || ADMIN_ACCOUNTS.some((a) => a.toLowerCase() === (newUser.username || '').toLowerCase());
    const normalizedUser = { ...newUser };
    if (!isVip && !isAdmin) {
      normalizedUser.total_uc = 0;
      normalizedUser.coins_balance = 0;
      normalizedUser.points_balance = 0;
      normalizedUser.free_spins_balance = 2;
      normalizedUser.last_daily_spins_at = normalizedUser.last_daily_spins_at || new Date().toISOString();
    } else if (isAdmin && !isVip) {
      normalizedUser.is_admin = true;
      normalizedUser.is_vip = false;
      normalizedUser.profile_frame = normalizedUser.profile_frame || 'admin_shield';
      normalizedUser.vip_badge = null;
      normalizedUser.free_spins_balance = 999999;
      if (typeof normalizedUser.total_uc !== 'number' || normalizedUser.total_uc < 5000) {
        normalizedUser.total_uc = 5000;
      }
      normalizedUser.coins_balance = 999999;
      normalizedUser.points_balance = 999999;
      this.seedVipAdminInventory(normalizedUser.id);
    } else if (isVip) {
      normalizedUser.is_admin = true;
      normalizedUser.profile_frame = 'vip_gold';
      normalizedUser.vip_badge = 'VIP_ADMIN';
      normalizedUser.free_spins_balance = 999999;
      if (!normalizedUser.active_title_id) {
        normalizedUser.active_title_id = 'title-vip';
      }
      if (typeof normalizedUser.total_uc !== 'number' || normalizedUser.total_uc < 5000) {
        normalizedUser.total_uc = 5000;
      }
      if (typeof normalizedUser.coins_balance !== 'number' || normalizedUser.coins_balance < 1000) {
        normalizedUser.coins_balance = 1000;
      }
      if (typeof normalizedUser.points_balance !== 'number' || normalizedUser.points_balance < 1000) {
        normalizedUser.points_balance = normalizedUser.coins_balance;
      }
      this.seedVipAdminInventory(normalizedUser.id);
    }
    if (typeof normalizedUser.total_popularity !== 'number') {
      normalizedUser.total_popularity = 0;
    }
    if (!normalizedUser.popularity_updated_at) {
      normalizedUser.popularity_updated_at = normalizedUser.created_at || new Date().toISOString();
    }

    const users = this.getUsers();
    const existingIdx = users.findIndex(
      (u) => u.id === normalizedUser.id || u.username.toLowerCase() === normalizedUser.username.toLowerCase()
    );
    if (existingIdx !== -1) {
      users[existingIdx] = { ...users[existingIdx], ...normalizedUser };
    } else {
      users.push(normalizedUser);
    }
    this.saveUsers(users);
    return normalizedUser;
  }

  // --- POPULARITY POINTS (PP) SYSTEM & REAL-TIME LEADERBOARD ---
  recordPopularityTransaction({ userId, amount, source = 'spin', description = '', referenceId = null }) {
    this.checkFileSync();
    const pts = parseInt(amount, 10);
    if (isNaN(pts) || pts <= 0) {
      return { success: false, error: 'Количество очков популярности должно быть больше 0' };
    }

    if (!this.serverPopularityTransactions) this.serverPopularityTransactions = [];

    // Strict idempotency: prevent duplicate PP transactions
    if (referenceId && String(referenceId).trim()) {
      const cleanRef = String(referenceId).trim().toLowerCase();
      const existingTx = this.serverPopularityTransactions.find(
        (tx) => tx.referenceId && String(tx.referenceId).toLowerCase() === cleanRef
      );
      if (existingTx) {
        const u = this.getUserById(userId);
        return {
          success: true,
          alreadyProcessed: true,
          total_popularity: u ? (u.total_popularity || 0) : 0,
          transaction: existingTx,
          message: 'Транзакция уже обработана ранее (защита от дублирования)',
        };
      }
    }

    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }
    if (user.is_blocked) {
      return { success: false, error: 'Аккаунт заблокирован' };
    }

    const newPopularity = (user.total_popularity || 0) + pts;
    const nowIso = new Date().toISOString();
    user.total_popularity = newPopularity;
    user.popularity_updated_at = nowIso;
    this.saveUsers(users);

    const txRecord = {
      id: 'poptx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      userId: user.id,
      amount: pts,
      source,
      description,
      referenceId: referenceId ? String(referenceId).trim() : null,
      createdAt: nowIso,
    };
    this.serverPopularityTransactions.unshift(txRecord);
    this.saveToFile();

    return {
      success: true,
      user_id: user.id,
      username: user.username,
      added_amount: pts,
      total_popularity: newPopularity,
      popularity_updated_at: nowIso,
      transaction: txRecord,
    };
  }

  getLeaderboard() {
    this.checkFileSync();
    const users = this.getUsers();
    // Non-blocked registered users
    const validUsers = users.filter((u) => !u.is_blocked);

    // Leaderboard sorting rules:
    // 1. Total popularity points (PP) descending: highest PP is always #1
    // 2. Secondary rule: most recent achievement time descending (popularity_updated_at DESC)
    // 3. Fallback: created_at ascending
    const sorted = [...validUsers].sort((a, b) => {
      const popA = a.total_popularity || 0;
      const popB = b.total_popularity || 0;
      if (popB !== popA) {
        return popB - popA;
      }
      const timeA = a.popularity_updated_at ? new Date(a.popularity_updated_at).getTime() : 0;
      const timeB = b.popularity_updated_at ? new Date(b.popularity_updated_at).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdA - createdB;
    });

    return sorted.map((u, index) => ({
      ...u,
      rank: index + 1,
      total_popularity: u.total_popularity || 0,
      popularity: u.total_popularity || 0,
      pp: u.total_popularity || 0,
      popularity_updated_at: u.popularity_updated_at || u.created_at || new Date().toISOString(),
    }));
  }

  // --- 24-HOUR DAILY FREE SPINS SYSTEM ---
  checkAndGrantDailySpins(userId) {
    this.checkFileSync();
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Пользователь не найден' };

    // VIP and Admin have unlimited spins (999999) without cooldown
    if (user.is_vip || user.is_admin) {
      return {
        success: true,
        isVip: true,
        isAdmin: true,
        freeSpins: 999999,
        secondsRemaining: 0,
        nextDailySpinsAt: null,
      };
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lastTime = user.last_daily_spins_at ? new Date(user.last_daily_spins_at).getTime() : 0;
    let granted = false;

    // Check if 24 hours have elapsed since last daily grant
    if (!user.last_daily_spins_at || now - lastTime >= DAY_MS) {
      user.free_spins_balance = (user.free_spins_balance || 0) + 2;
      user.last_daily_spins_at = new Date(now).toISOString();
      granted = true;
      this.saveUsers(users);
    }

    const nextTime = new Date(user.last_daily_spins_at).getTime() + DAY_MS;
    const secondsRemaining = Math.max(0, Math.ceil((nextTime - now) / 1000));

    return {
      success: true,
      granted,
      freeSpins: user.free_spins_balance || 0,
      lastDailySpinsAt: user.last_daily_spins_at,
      nextDailySpinsAt: new Date(nextTime).toISOString(),
      secondsRemaining,
    };
  }

  getCurrentUserId() {
    if (!this.isBrowser) return this.serverCurrentUserId;
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || null;
  }

  setCurrentUserId(id) {
    this.serverCurrentUserId = id;
    if (this.isBrowser) {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      }
    } else {
      this.saveToFile();
    }
  }

  getCurrentUser() {
    const currentId = this.getCurrentUserId();
    if (!currentId) return null;
    return this.getUserById(currentId);
  }

  // --- INVENTORY MANAGEMENT ---
  getInventory() {
    this.checkFileSync();
    return this.serverInventory;
  }

  saveInventory(inv) {
    this.serverInventory = inv;
    this.saveToFile();
  }

  getUserInventory(userId) {
    const all = this.getInventory();
    return all[userId] || [];
  }

  addItemToInventory(userId, rewardId, quantity = 1) {
    const all = this.getInventory();
    if (!all[userId]) all[userId] = [];
    const existing = all[userId].find((it) => it.rewardId === rewardId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      all[userId].push({
        rewardId,
        quantity,
        acquiredAt: new Date().toISOString(),
      });
    }
    this.saveInventory(all);
  }

  // --- NOTIFICATIONS MANAGEMENT ---
  getNotifications(userId) {
    if (!this.serverNotifications) this.serverNotifications = [];
    if (!userId) return [];
    return this.serverNotifications.filter((n) => n.userId === userId);
  }

  addNotification(notification) {
    if (!this.serverNotifications) this.serverNotifications = [];
    const item = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      isRead: false,
      createdAt: new Date().toISOString(),
      ...notification,
    };
    this.serverNotifications.unshift(item);
    if (this.serverNotifications.length > 200) this.serverNotifications.pop();
    this.saveToFile();
    return item;
  }

  markNotificationsAsRead(userId, ids = null) {
    if (!this.serverNotifications) return;
    this.serverNotifications.forEach((n) => {
      if (n.userId === userId) {
        if (!ids || ids.includes(n.id)) {
          n.isRead = true;
        }
      }
    });
    this.saveToFile();
  }

  // --- ADMIN AUDIT LOGS ---
  getAdminAuditLogs() {
    if (!this.serverAuditLogs) this.serverAuditLogs = [];
    return this.serverAuditLogs;
  }

  addAdminAuditLog(log) {
    if (!this.serverAuditLogs) this.serverAuditLogs = [];
    const item = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
      ...log,
    };
    this.serverAuditLogs.unshift(item);
    if (this.serverAuditLogs.length > 300) this.serverAuditLogs.pop();
    this.saveToFile();
    return item;
  }

  // --- SYSTEM CONFIG (Features like spin wheel enabled) ---
  getSystemConfig(key) {
    if (!this.serverSystemConfig) this.serverSystemConfig = { spin_wheel_enabled: true };
    return key ? this.serverSystemConfig[key] : this.serverSystemConfig;
  }

  setSystemConfig(key, value) {
    if (!this.serverSystemConfig) this.serverSystemConfig = {};
    this.serverSystemConfig[key] = value;
    this.saveToFile();
    return this.serverSystemConfig;
  }

  // --- ADMIN ACTIONS ---
  adminGrantSpins({ adminId, targetUserId, amount, allUsers = false }) {
    const qty = parseInt(amount, 10);
    if (isNaN(qty) || qty === 0) {
      return { success: false, error: 'Укажите корректное количество спинов' };
    }

    const users = this.getUsers();
    const affectedUsernames = [];

    if (allUsers) {
      users.forEach((u) => {
        if (!u.is_admin) {
          u.free_spins_balance = Math.max(0, (u.free_spins_balance || 0) + qty);
          affectedUsernames.push(u.username);
          this.addNotification({
            userId: u.id,
            type: 'admin_bonus',
            title: 'Новогодний подарок от Администратора! 🎄',
            message: `Вам начислено ${qty} бесплатных спинов на Колесе Фортуны!`,
          });
        }
      });
    } else {
      const target = users.find((u) => u.id === targetUserId);
      if (!target) return { success: false, error: 'Пользователь не найден' };
      target.free_spins_balance = Math.max(0, (target.free_spins_balance || 0) + qty);
      affectedUsernames.push(target.username);
      this.addNotification({
        userId: target.id,
        type: 'admin_bonus',
        title: 'Бонус от Администратора! 🎄',
        message: `Вам начислено ${qty} бесплатных спинов на Колесе Фортуны!`,
      });
    }

    this.saveUsers(users);

    this.addAdminAuditLog({
      adminId,
      actionType: 'grant_spins',
      targetUserId: allUsers ? 'ALL' : targetUserId,
      details: { amount: qty, allUsers, affected: affectedUsernames },
    });

    return { success: true, affected: affectedUsernames, amount: qty };
  }

  adminGrantReward({ adminId, targetUserId, rewardId, quantity = 1, message = '' }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, error: 'Укажите количество больше 0' };
    }

    const users = this.getUsers();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return { success: false, error: 'Пользователь не найден' };

    const reward = REWARDS_CATALOG.find((r) => r.id === rewardId);
    if (!reward) return { success: false, error: 'Награда не найдена в каталоге' };

    this.addItemToInventory(target.id, reward.id, qty);

    this.addNotification({
      userId: target.id,
      type: 'admin_bonus',
      title: 'Награда от Администрации! 🎁',
      message: `Вам начислена награда «${reward.name}» (${qty} шт.)! ${message ? `\nСообщение: «${message}»` : ''}`,
      data: { rewardId, rewardName: reward.name, quantity: qty, message },
    });

    this.addAdminAuditLog({
      adminId,
      actionType: 'grant_reward',
      targetUserId: target.id,
      details: { rewardId, rewardName: reward.name, quantity: qty, message },
    });

    return { success: true, target: target.username, rewardName: reward.name, quantity: qty };
  }

  adminGrantUc({ adminId, targetUserId, amount = 100, allUsers = false }) {
    const ucVal = parseInt(amount, 10);
    if (isNaN(ucVal) || ucVal <= 0) {
      return { success: false, error: 'Укажите количество UC больше 0' };
    }

    const users = this.getUsers();
    const affectedUsernames = [];

    if (allUsers) {
      users.forEach((u) => {
        u.total_uc = (u.total_uc || 0) + ucVal;
        affectedUsernames.push(u.username);
        this.addNotification({
          userId: u.id,
          type: 'admin_bonus',
          title: 'Начисление UC! 🪙',
          message: `Вам начислено ${ucVal} UC на новогодний баланс!`,
        });
      });
    } else {
      const target = users.find((u) => u.id === targetUserId);
      if (!target) return { success: false, error: 'Пользователь не найден' };
      target.total_uc = (target.total_uc || 0) + ucVal;
      affectedUsernames.push(target.username);
      this.addNotification({
        userId: target.id,
        type: 'admin_bonus',
        title: 'Начисление UC! 🪙',
        message: `Вам начислено ${ucVal} UC на новогодний баланс!`,
      });
    }

    this.saveUsers(users);

    this.addAdminAuditLog({
      adminId,
      actionType: 'grant_uc',
      targetUserId: allUsers ? 'ALL' : targetUserId,
      details: { amount: ucVal, allUsers, affected: affectedUsernames },
    });

    return { success: true, affected: affectedUsernames, amount: ucVal };
  }

  adminManageInventory({ adminId, targetUserId, rewardId, quantity = 1, operation = 'set' }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      return { success: false, error: 'Некорректное количество' };
    }

    const users = this.getUsers();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return { success: false, error: 'Пользователь не найден' };

    const inv = this.getInventory();
    if (!inv[target.id]) inv[target.id] = [];
    const userItems = inv[target.id];
    const existing = userItems.find((it) => it.rewardId === rewardId);

    if (operation === 'set') {
      if (qty === 0) {
        inv[target.id] = userItems.filter((it) => it.rewardId !== rewardId);
      } else if (existing) {
        existing.quantity = qty;
      } else {
        userItems.push({
          id: 'inv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          rewardId,
          quantity: qty,
          acquiredAt: new Date().toISOString(),
        });
      }
    } else if (operation === 'add') {
      if (existing) {
        existing.quantity += qty;
      } else {
        userItems.push({
          id: 'inv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          rewardId,
          quantity: qty,
          acquiredAt: new Date().toISOString(),
        });
      }
    } else if (operation === 'remove') {
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity - qty);
        if (existing.quantity === 0) {
          inv[target.id] = userItems.filter((it) => it.rewardId !== rewardId);
        }
      }
    }

    this.saveInventory(inv);

    this.addAdminAuditLog({
      adminId,
      actionType: 'manage_inventory',
      targetUserId,
      details: { rewardId, quantity: qty, operation, username: target.username },
    });

    return { success: true, target: target.username, rewardId, quantity: qty };
  }

  adminSendNotification({ adminId, targetUserId, title, message, allUsers = false }) {
    if (!title || !message) {
      return { success: false, error: 'Заголовок и сообщение обязательны' };
    }

    const users = this.getUsers();
    const affected = [];

    if (allUsers) {
      users.forEach((u) => {
        this.addNotification({
          userId: u.id,
          type: 'system',
          title,
          message,
        });
        affected.push(u.username);
      });
    } else {
      const target = users.find((u) => u.id === targetUserId);
      if (!target) return { success: false, error: 'Пользователь не найден' };
      this.addNotification({
        userId: target.id,
        type: 'system',
        title,
        message,
      });
      affected.push(target.username);
    }

    this.addAdminAuditLog({
      adminId,
      actionType: 'send_notification',
      targetUserId: allUsers ? 'ALL' : targetUserId,
      details: { title, message, allUsers, affected },
    });

    return { success: true, affected };
  }

  // --- PLAYER-TO-PLAYER GIFTS (Quantity > 0 rule, inventory transfer & shop gifting) ---
  sendGift({ senderId, recipientUsername, rewardId, quantity = 1, message = '', source = 'inventory' }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return { success: false, error: 'Некорректное количество предметов' };
    }

    const users = this.getUsers();
    const sender = users.find((u) => u.id === senderId);
    if (!sender) {
      return { success: false, error: 'Отправитель не найден' };
    }
    if (sender.is_blocked) {
      return { success: false, error: 'Ваш аккаунт заблокирован' };
    }

    const cleanUsername = (recipientUsername || '').replace('@', '').trim().toLowerCase();
    const recipient = users.find(
      (u) => (u.username || '').toLowerCase() === cleanUsername
    );

    if (!recipient) {
      return { success: false, error: `Игрок @${cleanUsername} не найден` };
    }

    if (recipient.id === senderId) {
      return { success: false, error: 'Нельзя отправить подарок самому себе' };
    }

    const itemMeta = resolveReward(rewardId) || resolveTitle(rewardId) || REWARDS_CATALOG.find((r) => r.id === rewardId);
    if (!itemMeta) {
      return { success: false, error: 'Предмет не найден в каталоге' };
    }

    const inventory = this.getInventory();
    const senderItems = inventory[senderId] || [];
    let totalCost = 0;

    if (source === 'shop') {
      const unitCost = itemMeta.priceCoins || itemMeta.pricePoints || 100;
      const isAdmin = Boolean(sender.is_admin);
      totalCost = isAdmin ? 0 : unitCost * qty;

      const senderCoins = typeof sender.coins_balance === 'number' ? sender.coins_balance : 0;
      if (!isAdmin && senderCoins < totalCost) {
        return {
          success: false,
          error: `Недостаточно монет для покупки подарка (требуется ${totalCost}, у вас ${senderCoins})`,
        };
      }

      if (!isAdmin && totalCost > 0) {
        sender.coins_balance -= totalCost;
        sender.points_balance = sender.coins_balance;
        this.updateUser(sender.id, {
          coins_balance: sender.coins_balance,
          points_balance: sender.points_balance,
        });
      }
    } else {
      // Transfer from existing sender inventory
      const itemIndex = senderItems.findIndex((it) => it.rewardId === rewardId || it.id === rewardId);
      if (itemIndex === -1) {
        return { success: false, error: 'Предмет не найден в вашем инвентаре' };
      }

      const currentQty = senderItems[itemIndex].quantity;
      if (currentQty < qty) {
        return {
          success: false,
          error: `Недостаточно предметов в инвентаре (у вас есть ${currentQty})`,
        };
      }

      // Atomic deduction: if gifting all copies, remove item from sender
      if (currentQty === qty) {
        senderItems.splice(itemIndex, 1);
      } else {
        senderItems[itemIndex].quantity -= qty;
      }
    }

    // Determine functional item category vs decorative gifts
    const isSpin = itemMeta.category === 'spins' || String(rewardId).startsWith('reward-spin-');
    const isUc = itemMeta.category === 'uc' || String(rewardId).startsWith('reward-uc-');
    const isCoins = itemMeta.category === 'coins' || String(rewardId).startsWith('reward-coins-');

    if (isSpin) {
      // Credit real functional spins to free_spins_balance
      const perUnitSpins = itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 1;
      const spinsToAdd = perUnitSpins * qty;
      recipient.free_spins_balance = (recipient.free_spins_balance || 0) + spinsToAdd;
      this.updateUser(recipient.id, { free_spins_balance: recipient.free_spins_balance });
    } else if (isUc) {
      // Credit real UC to total_uc balance
      const perUnitUc = itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 0;
      const ucToAdd = perUnitUc * qty;
      recipient.total_uc = (recipient.total_uc || 0) + ucToAdd;
      this.updateUser(recipient.id, { total_uc: recipient.total_uc });
    } else if (isCoins) {
      // Credit real coins to coins_balance and points_balance
      const perUnitCoins = itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 0;
      const coinsToAdd = perUnitCoins * qty;
      recipient.coins_balance = (recipient.coins_balance || 0) + coinsToAdd;
      recipient.points_balance = recipient.coins_balance;
      this.updateUser(recipient.id, {
        coins_balance: recipient.coins_balance,
        points_balance: recipient.points_balance,
      });
    } else {
      // Credit regular items / souvenirs / titles to recipient inventory
      if (!inventory[recipient.id]) {
        inventory[recipient.id] = [];
      }
      const recipItem = inventory[recipient.id].find((it) => it.rewardId === rewardId || it.id === rewardId);
      if (recipItem) {
        recipItem.quantity += qty;
      } else {
        inventory[recipient.id].push({
          id: `inv-${rewardId}-${Date.now()}`,
          rewardId,
          quantity: qty,
          acquiredAt: new Date().toISOString(),
        });
      }
      this.saveInventory(inventory);
    }

    // Save gift entry in history
    const giftEntry = {
      id: 'gift-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      senderId,
      senderUsername: sender?.username || 'Игрок',
      recipientId: recipient.id,
      recipientUsername: recipient.username,
      rewardId,
      rewardName: itemMeta?.name || 'Предмет',
      rewardRarity: itemMeta?.rarity || 'common',
      rewardCategory: itemMeta?.category || 'christmas',
      quantity: qty,
      source: source || 'inventory',
      costCoins: totalCost,
      message: message || '',
      createdAt: new Date().toISOString(),
    };
    this.saveGiftEntry(giftEntry);

    // Create in-app notification for recipient
    let notifTitle = 'Вы получили новый подарок! 🎁';
    let notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам «${itemMeta?.name || 'Предмет'}» (${qty} шт.)!${message ? `\nСообщение: «${message}»` : ''}`;

    if (isSpin) {
      const spinsCount = (itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 1) * qty;
      notifTitle = 'Вы получили новые вращения! 🎰';
      notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${spinsCount} вращений на Колесе Фортуны! Они уже начислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
    } else if (isUc) {
      const ucCount = (itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 0) * qty;
      notifTitle = 'Вам начислено UC! 🪙';
      notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${ucCount} UC! Они зачислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
    } else if (isCoins) {
      const coinsCount = (itemMeta.value && itemMeta.value > 0 ? itemMeta.value : 0) * qty;
      notifTitle = 'Вам подарили монеты! 💰';
      notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${coinsCount} монет! Они зачислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
    }

    this.addNotification({
      userId: recipient.id,
      type: 'gift_received',
      title: notifTitle,
      message: notifMsg,
      data: {
        senderUsername: sender?.username,
        rewardName: itemMeta?.name,
        rewardRarity: itemMeta?.rarity,
        quantity: qty,
        message,
        isSpin,
        isUc,
        isCoins,
      },
    });

    // If the gift is popularity, credit recipient's popularity points
    if (itemMeta && (itemMeta.category === 'popularity' || itemMeta.category === 'roses')) {
      const popAmount = (itemMeta.value || 10) * qty;
      this.recordPopularityTransaction({
        userId: recipient.id,
        amount: popAmount,
        source: 'gift',
        description: `Подарок «${itemMeta.name}» от @${sender?.username || 'Игрок'}`,
        referenceId: `gift-${giftEntry.id}`,
      });
    }

    // Public feed event
    this.addEvent({
      userId: senderId,
      username: `@${sender?.username || 'Игрок'}`,
      rewardName: `ПОДАРОК: ${itemMeta?.name || 'Предмет'} для @${recipient.username}`,
      rewardRarity: itemMeta?.rarity || 'common',
      rewardCategory: itemMeta?.category || 'christmas',
      icon: 'Gift',
    });

    return {
      success: true,
      recipient: recipient.username,
      item: itemMeta?.name,
      quantity: qty,
      source: source || 'inventory',
      remainingCoins: sender.coins_balance,
    };
  }

  getGiftsHistory(userId) {
    if (!this.serverGiftsHistory) this.serverGiftsHistory = [];
    if (!userId) return this.serverGiftsHistory;
    return this.serverGiftsHistory.filter((g) => g.senderId === userId || g.recipientId === userId);
  }

  saveGiftEntry(entry) {
    if (!this.serverGiftsHistory) this.serverGiftsHistory = [];
    this.serverGiftsHistory.unshift(entry);
    this.saveToFile();
  }

  // --- EVENTS & FEED ---
  getEvents() {
    return this.serverEvents;
  }

  addEvent(event) {
    const events = this.serverEvents;
    const newEvent = {
      id: 'evt-' + Date.now(),
      createdAt: 'Только что',
      ...event,
    };
    events.unshift(newEvent);
    if (events.length > 50) events.pop();
    this.serverEvents = events;
    this.saveToFile();
    return newEvent;
  }

  // --- SPINS HISTORY ---
  getSpinsHistory(userId) {
    if (!this.serverSpinsHistory) this.serverSpinsHistory = [];
    if (!userId) return this.serverSpinsHistory;
    return this.serverSpinsHistory.filter((s) => s.userId === userId || s.user_id === userId);
  }

  addSpinHistory(entry) {
    if (!this.serverSpinsHistory) this.serverSpinsHistory = [];
    const item = {
      id: 'spin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
      ...entry,
    };
    this.serverSpinsHistory.unshift(item);
    if (this.serverSpinsHistory.length > 100) this.serverSpinsHistory.pop();
    this.saveToFile();
    return item;
  }

  // --- TITLES EQUIP / UNEQUIP ---
  equipTitle(userId, titleId) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].active_title_id = titleId;
      this.saveUsers(users);

      const title = TITLES_LIST.find((t) => t.id === titleId);
      this.addEvent({
        userId,
        username: `@${users[index].username}`,
        rewardName: `Титул ${title?.name || 'НОВЫЙ'}`,
        rewardRarity: title?.rarity || 'epic',
        rewardCategory: 'titles',
        icon: title?.icon || 'Crown',
      });

      return users[index];
    }
    return null;
  }

  unequipTitle(userId) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].active_title_id = null;
      this.saveUsers(users);
      return users[index];
    }
    return null;
  }

  getCoinsBalance(userId) {
    const user = this.getUserById(userId);
    if (!user) return 0;
    return typeof user.coins_balance === 'number'
      ? user.coins_balance
      : typeof user.points_balance === 'number'
      ? user.points_balance
      : 1000;
  }

  updateCoinsBalance(userId, coins) {
    const val = Math.max(0, parseInt(coins, 10) || 0);
    this.updateUser(userId, { coins_balance: val, points_balance: val });
    return val;
  }

  getPointsBalance(userId) {
    return this.getCoinsBalance(userId);
  }

  updatePointsBalance(userId, points) {
    return this.updateCoinsBalance(userId, points);
  }

  // --- PURCHASES & SHOP SYSTEM ---
  getPurchasesHistory(userId) {
    this.checkFileSync();
    if (!this.serverPurchasesHistory) this.serverPurchasesHistory = [];
    if (!userId) return this.serverPurchasesHistory;
    return this.serverPurchasesHistory.filter((p) => p.userId === userId || p.user_id === userId);
  }

  purchaseItem(userId, itemSlug, quantity = 1) {
    this.checkFileSync();
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return { success: false, error: 'Некорректное количество предметов' };
    }

    if (!itemSlug) {
      return { success: false, error: 'Укажите идентификатор товара' };
    }

    const cleanSlug = String(itemSlug).trim();

    // Strict exclusion of UC VIP
    const lower = cleanSlug.toLowerCase();
    if (
      lower === 'reward-uc-30' ||
      lower === 'reward-uc-60' ||
      lower === 'title-vip' ||
      lower === 'vip' ||
      (lower.includes('uc') && lower.includes('vip'))
    ) {
      return { success: false, error: 'Товар UC VIP полностью исключен из покупок за монеты' };
    }

    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (user.is_blocked) {
      return { success: false, error: 'Ваш аккаунт заблокирован' };
    }

    // Resolve item from catalog
    const rewardMeta = resolveReward(cleanSlug) || resolveTitle(cleanSlug);
    if (!rewardMeta) {
      return { success: false, error: 'Товар не найден в каталоге наград' };
    }

    if (rewardMeta.excludedFromShop || rewardMeta.category === 'uc' || rewardMeta.isVipExclusive) {
      return { success: false, error: 'Данный товар (UC VIP) недоступен для покупки за монеты' };
    }

    const unitCost = rewardMeta.priceCoins || rewardMeta.pricePoints || 100;
    const isAdmin = Boolean(user.is_admin);
    let totalCost = 0;

    if (!isAdmin) {
      totalCost = unitCost * qty;
      const currentCoins = typeof user.coins_balance === 'number'
        ? user.coins_balance
        : typeof user.points_balance === 'number'
        ? user.points_balance
        : 1000;

      if (currentCoins < totalCost) {
        return {
          success: false,
          error: `Недостаточно Монет для покупки. Требуется: ${totalCost}, доступно: ${currentCoins}`,
          requiredCoins: totalCost,
          currentCoins,
          requiredPoints: totalCost,
          currentPoints: currentCoins,
        };
      }
      user.coins_balance = currentCoins - totalCost;
      user.points_balance = user.coins_balance;
    }

    this.saveUsers(users);

    // Add to user inventory
    const inv = this.getInventory();
    if (!inv[userId]) inv[userId] = [];
    const userItems = inv[userId];
    const existing = userItems.find((it) => it.rewardId === rewardMeta.id || it.id === rewardMeta.id);

    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      userItems.push({
        id: 'inv-' + rewardMeta.id + '-' + userId,
        rewardId: rewardMeta.id,
        quantity: qty,
        acquiredAt: new Date().toISOString(),
      });
    }
    this.saveInventory(inv);

    // Add purchase history record
    const purchaseRecord = {
      id: 'pur-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      userId,
      user_id: userId,
      rewardId: rewardMeta.id,
      itemType: rewardMeta.isTitle || rewardMeta.category === 'titles' ? 'title' : 'gift',
      itemName: rewardMeta.name,
      itemSlug: rewardMeta.id,
      costCoins: totalCost,
      cost_coins: totalCost,
      costPoints: totalCost,
      cost_points: totalCost,
      quantity: qty,
      isAdminPurchase: isAdmin,
      is_admin_purchase: isAdmin,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    if (!this.serverPurchasesHistory) this.serverPurchasesHistory = [];
    this.serverPurchasesHistory.unshift(purchaseRecord);

    // Add live event
    this.addEvent({
      userId,
      username: `@${user.username}`,
      rewardName: rewardMeta.name,
      rewardRarity: rewardMeta.rarity || 'common',
      rewardCategory: rewardMeta.category || 'jokes',
      icon: rewardMeta.icon || 'Gift',
      eventType: 'item_purchased',
    });

    this.saveToFile();

    return {
      success: true,
      item: {
        id: rewardMeta.id,
        name: rewardMeta.name,
        category: rewardMeta.category,
        rarity: rewardMeta.rarity,
        isTitle: Boolean(rewardMeta.isTitle),
        quantity: existing ? existing.quantity : qty,
      },
      costCoins: totalCost,
      cost_coins: totalCost,
      costPoints: totalCost,
      cost_points: totalCost,
      coinsBalance: user.coins_balance,
      coins_balance: user.coins_balance,
      pointsBalance: user.points_balance,
      points_balance: user.points_balance,
      isAdmin,
      message: `Товар «${rewardMeta.name}» успешно приобретен и добавлен в ваш Инвентарь!`,
    };
  }

  useInventoryItem(userId, itemIdentifier, quantity = 1) {
    this.checkFileSync();
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }
    if (user.is_blocked) {
      return { success: false, error: 'Ваш аккаунт заблокирован' };
    }

    const cleanIdentifier = String(itemIdentifier).trim();
    const rewardMeta = resolveReward(cleanIdentifier) || resolveTitle(cleanIdentifier);
    if (!rewardMeta) {
      return { success: false, error: 'Предмет не найден в каталоге' };
    }
    if (rewardMeta.isTitle || rewardMeta.category === 'titles') {
      return { success: false, error: 'Титулы экипируются в профиле, а не расходуются' };
    }

    const inv = this.getInventory();
    if (!inv[userId]) inv[userId] = [];
    const userItems = inv[userId];
    const targetItem = userItems.find(
      (it) => it.rewardId === rewardMeta.id || it.id === rewardMeta.id || it.rewardId === rewardMeta.uuid
    );

    if (!targetItem || (targetItem.quantity || 1) < qty) {
      return { success: false, error: 'Недостаточно предметов в инвентаре для использования' };
    }

    const newQty = (targetItem.quantity || 1) - qty;
    if (newQty <= 0) {
      inv[userId] = userItems.filter((it) => it !== targetItem);
    } else {
      targetItem.quantity = newQty;
    }
    this.saveInventory(inv);

    let spinsAdded = 0;
    let ucAdded = 0;
    let coinsAdded = 0;
    let popAdded = 0;
    let grantedDesc = '';

    const cat = rewardMeta.category || '';
    const slug = rewardMeta.id || '';

    if (cat === 'spins' || slug.includes('spin')) {
      spinsAdded = (rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 1) * qty;
      user.free_spins_balance = (user.free_spins_balance || 0) + spinsAdded;
      grantedDesc = `+${spinsAdded} вращений на Колесе`;
    } else if (cat === 'uc' || slug.includes('uc')) {
      ucAdded = (rewardMeta.value || 0) * qty;
      user.total_uc = (user.total_uc || 0) + ucAdded;
      grantedDesc = `+${ucAdded} UC`;
    } else if (cat === 'coins' || slug.includes('coins')) {
      coinsAdded = (rewardMeta.value || 0) * qty;
      user.coins_balance = (user.coins_balance || 0) + coinsAdded;
      user.points_balance = (user.points_balance || user.coins_balance || 0) + coinsAdded;
      grantedDesc = `+${coinsAdded} Монет`;
    } else if (cat === 'popularity' || slug.includes('pop')) {
      popAdded = (rewardMeta.value || 0) * qty;
      user.total_popularity = (user.total_popularity || 0) + popAdded;
      grantedDesc = `+${popAdded} очков популярности`;
    } else {
      coinsAdded = Math.max(50, rewardMeta.value || 50) * qty;
      user.coins_balance = (user.coins_balance || 0) + coinsAdded;
      user.points_balance = (user.points_balance || user.coins_balance || 0) + coinsAdded;
      grantedDesc = `+${coinsAdded} Монет из подарка`;
    }

    this.saveUsers(users);

    this.addNotification({
      userId,
      type: 'system',
      title: 'Предмет использован! ✨',
      message: `Вы успешно активировали «${rewardMeta.name}» (${qty} шт.). Получено: ${grantedDesc}.`,
    });

    this.saveToFile();

    return {
      success: true,
      item: rewardMeta.name,
      quantityUsed: qty,
      remainingQuantity: newQty,
      granted: grantedDesc,
      user: {
        free_spins_balance: user.free_spins_balance,
        total_uc: user.total_uc,
        coins_balance: user.coins_balance,
        points_balance: user.points_balance,
        total_popularity: user.total_popularity,
      },
      message: `Вы успешно использовали «${rewardMeta.name}»! Получено: ${grantedDesc}`,
    };
  }
}

export const mockStore = new MockStore();
