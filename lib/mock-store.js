import { TITLES_LIST, REWARDS_CATALOG, CHRISTMAS_REWARDS } from './catalog-data.js';

// Initial pre-seeded mock users: ONLY the separate Admin account
const SEED_PASSWORD_HASH = '$2b$10$3BlKi0I0Ej5CUahNEOmHtOW3cPsNAIgJDXYga4wggNfv7Mu//aRkC'; // '1234'

export const INITIAL_USERS = [
  {
    id: 'user-admin',
    telegram_id: 999999001,
    username: 'lucky_admin',
    first_name: 'Александр',
    last_name: 'Admin',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    active_title_id: 'title-vip',
    spins_count: 50,
    total_uc: 1000,
    total_popularity: 850,
    free_spins_balance: 10,
    is_approved: true,
    is_blocked: false,
    is_admin: true,
    is_vip: true,
    profile_frame: 'vip_gold',
    password_hash: SEED_PASSWORD_HASH,
    created_at: new Date('2026-11-01T00:00:00Z').toISOString(),
  },
];

// Exactly 12 registration codes (10 Standard + 2 VIP)
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
];

export const INITIAL_INVENTORY = {
  'user-admin': [
    { rewardId: 'title-vip', quantity: 1, acquiredAt: '2026-11-10T12:00:00Z' },
    { rewardId: 'reward-xmas-miracle-box', quantity: 1, acquiredAt: '2026-11-15T10:00:00Z' },
    { rewardId: 'reward-xmas-golden-tree', quantity: 2, acquiredAt: '2026-11-15T11:00:00Z' },
    { rewardId: 'reward-xmas-santas-gift', quantity: 3, acquiredAt: '2026-11-15T12:00:00Z' },
    { rewardId: 'reward-xmas-candy-cane', quantity: 5, acquiredAt: '2026-11-15T13:00:00Z' },
  ],
};

export const INITIAL_EVENTS = [
  {
    id: 'evt-1',
    userId: 'user-admin',
    username: '@lucky_admin',
    rewardName: 'Шкатулка Рождественского чуда',
    rewardRarity: 'mythic',
    rewardCategory: 'christmas',
    icon: 'PackageCheck',
    createdAt: '5 минут назад',
  },
  {
    id: 'evt-2',
    userId: 'user-admin',
    username: '@lucky_admin',
    rewardName: 'Золотая ёлочка',
    rewardRarity: 'epic',
    rewardCategory: 'christmas',
    icon: 'TreePine',
    createdAt: '15 минут назад',
  },
];

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
    this.serverSystemConfig = {
      spin_wheel_enabled: true,
      max_player_slots: 12,
    };

    if (!this.isBrowser) {
      this.loadFromFile();
    }
  }

  loadFromFile() {
    if (this.isBrowser) return;
    try {
      const fs = typeof window === 'undefined' ? eval('require')('fs') : null;
      const path = typeof window === 'undefined' ? eval('require')('path') : null;
      if (!fs || !path) return;
      const dataFilePath = path.join(process.cwd(), '.dev_store.json');
      if (fs.existsSync(dataFilePath)) {
        const raw = fs.readFileSync(dataFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          // Merge admin seed user
          const merged = [...data.users];
          for (const seed of INITIAL_USERS) {
            if (!merged.some((u) => u.id === seed.id || u.username.toLowerCase() === seed.username.toLowerCase())) {
              merged.unshift(seed);
            }
          }
          this.serverUsers = merged;
        }
        if (data.inventory) this.serverInventory = data.inventory;
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
        if (data.systemConfig) this.serverSystemConfig = data.systemConfig;
        if (data.currentUserId !== undefined) this.serverCurrentUserId = data.currentUserId;
      }
    } catch {
      // In-memory fallback
    }
  }

  saveToFile() {
    if (this.isBrowser) return;
    try {
      const fs = typeof window === 'undefined' ? eval('require')('fs') : null;
      const path = typeof window === 'undefined' ? eval('require')('path') : null;
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
        systemConfig: this.serverSystemConfig,
        currentUserId: this.serverCurrentUserId,
      };
      fs.writeFileSync(dataFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // In-memory fallback
    }
  }

  // --- REGISTRATION CODES MANAGEMENT ---
  getRegistrationCodes() {
    return this.serverRegistrationCodes;
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

    // Check 12 player accounts limit (excluding admin)
    const nonAdminPlayers = this.getUsers().filter((u) => !u.is_admin);
    if (nonAdminPlayers.length >= 12) {
      return { valid: false, error: 'Регистрация закрыта: все 12 игровых мест заняты.' };
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

  // --- USERS MANAGEMENT ---
  getUsers() {
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
    const users = this.getUsers();
    return users.find((u) => u.id === userId) || null;
  }

  getUserByUsername(username) {
    if (!username) return null;
    const clean = username.replace(/^@/, '').trim().toLowerCase();
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

  addUser(newUser) {
    const users = this.getUsers();
    const existingIdx = users.findIndex(
      (u) => u.id === newUser.id || u.username.toLowerCase() === newUser.username.toLowerCase()
    );
    if (existingIdx !== -1) {
      users[existingIdx] = { ...users[existingIdx], ...newUser };
    } else {
      users.push(newUser);
    }
    this.saveUsers(users);
    return newUser;
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

  // --- PLAYER-TO-PLAYER GIFTS (Quantity > 0 rule) ---
  sendGift({ senderId, recipientUsername, rewardId, quantity = 1, message = '' }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return { success: false, error: 'Некорректное количество предметов' };
    }

    const inventory = this.getInventory();
    const senderItems = inventory[senderId] || [];
    const itemIndex = senderItems.findIndex((it) => it.rewardId === rewardId);

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

    const users = this.getUsers();
    const sender = users.find((u) => u.id === senderId);

    const cleanUsername = recipientUsername.replace('@', '').trim().toLowerCase();
    const recipient = users.find(
      (u) => u.username.toLowerCase() === cleanUsername
    );

    if (!recipient) {
      return { success: false, error: `Игрок @${cleanUsername} не найден` };
    }

    if (recipient.id === senderId) {
      return { success: false, error: 'Нельзя отправить подарок самому себе' };
    }

    // Atomic deduction: if gifting all copies, remove item from sender
    if (currentQty === qty) {
      senderItems.splice(itemIndex, 1);
    } else {
      senderItems[itemIndex].quantity -= qty;
    }

    // Credit to recipient
    if (!inventory[recipient.id]) {
      inventory[recipient.id] = [];
    }
    const recipItem = inventory[recipient.id].find((it) => it.rewardId === rewardId);
    if (recipItem) {
      recipItem.quantity += qty;
    } else {
      inventory[recipient.id].push({
        rewardId,
        quantity: qty,
        acquiredAt: new Date().toISOString(),
      });
    }

    this.saveInventory(inventory);

    const itemMeta = REWARDS_CATALOG.find((r) => r.id === rewardId);

    // Save gift entry in history
    const giftEntry = {
      id: 'gift-' + Date.now(),
      senderId,
      senderUsername: sender?.username || 'Игрок',
      recipientId: recipient.id,
      recipientUsername: recipient.username,
      rewardId,
      rewardName: itemMeta?.name || 'Предмет',
      rewardRarity: itemMeta?.rarity || 'common',
      quantity: qty,
      message: message || '',
      createdAt: 'Только что',
    };
    this.saveGiftEntry(giftEntry);

    // Create in-app notification for recipient
    this.addNotification({
      userId: recipient.id,
      type: 'gift_received',
      title: 'Вам пришел подарок! 🎁',
      message: `Игрок @${sender?.username || 'Игрок'} подарил вам «${itemMeta?.name || 'Предмет'}» (${qty} шт.)!${message ? `\nСообщение: «${message}»` : ''}`,
      data: {
        senderUsername: sender?.username,
        rewardName: itemMeta?.name,
        rewardRarity: itemMeta?.rarity,
        quantity: qty,
        message,
      },
    });

    // Public feed event
    this.addEvent({
      userId: senderId,
      username: `@${sender?.username || 'Игрок'}`,
      rewardName: `ПОДАРОК: ${itemMeta?.name || 'Предмет'} для @${recipient.username}`,
      rewardRarity: itemMeta?.rarity || 'common',
      rewardCategory: itemMeta?.category || 'christmas',
      icon: 'Gift',
    });

    return { success: true, recipient: recipient.username, item: itemMeta?.name, quantity: qty };
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
}

export const mockStore = new MockStore();
