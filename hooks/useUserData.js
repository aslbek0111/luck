'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { TITLES_LIST, REWARDS_CATALOG, resolveTitle } from '../lib/catalog-data';
import { useTelegram } from './useTelegram';

const UserDataContext = createContext(null);

export function UserDataProvider({ children }) {
  const { initData, triggerHaptic, isInsideTelegram } = useTelegram();

  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [inventoryRaw, setInventoryRaw] = useState([]);
  const [events, setEvents] = useState([]);
  const [giftsHistoryRaw, setGiftsHistoryRaw] = useState([]);
  const [purchasesHistoryRaw, setPurchasesHistoryRaw] = useState([]);
  const [lastWinsRaw, setLastWinsRaw] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isBrowserAuthModalOpen, setIsBrowserAuthModalOpen] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState('');

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch {
      // Non-critical
    }
  }, []);

  const markNotificationsAsRead = useCallback(async (notificationIds = null) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
        cache: 'no-store',
      });
      fetchNotifications();
    } catch {
      // Non-critical
    }
  }, [fetchNotifications]);

  // Sync profile data from server API (Supabase / mockStore) in parallel
  const syncProfile = useCallback(async () => {
    try {
      setIsSyncing(true);

      const [profileRes, feedRes, lbRes] = await Promise.allSettled([
        fetch('/api/user/profile', { cache: 'no-store' }),
        fetch('/api/feed', { cache: 'no-store' }),
        fetch('/api/leaderboard', { cache: 'no-store' }),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const data = await profileRes.value.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          if (data.inventory) setInventoryRaw(data.inventory);
          if (data.giftsHistory) setGiftsHistoryRaw(data.giftsHistory);
          if (data.purchasesHistory) setPurchasesHistoryRaw(data.purchasesHistory);
          if (data.lastWins) setLastWinsRaw(data.lastWins);
        }
      }

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const feedData = await feedRes.value.json();
        if (feedData.success && feedData.events?.length > 0) {
          setEvents(feedData.events);
        }
      }

      if (lbRes.status === 'fulfilled' && lbRes.value.ok) {
        const lbData = await lbRes.value.json();
        if (lbData.success && lbData.leaders?.length > 0) {
          setAllUsers(lbData.leaders);
        }
      }

      fetchNotifications();
    } catch (err) {
      console.warn('Sync profile notice:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchNotifications]);

  // Check persistent session on startup
  useEffect(() => {
    let active = true;

    async function checkAuthSession() {
      setIsAuthLoading(true);

      // 1. If inside Telegram WebApp with initData
      if (initData) {
        try {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          });
          const result = await res.json();
          if (active && result.success && result.user) {
            setCurrentUser(result.user);
            await syncProfile();
            setIsBrowserAuthModalOpen(false);
            setIsAuthLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Auto auth notice:', e);
        }
      }

      // 2. Regular browser session check via /api/auth/me
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (active && meData.authenticated && meData.user) {
            setCurrentUser(meData.user);
            await syncProfile();
            setIsBrowserAuthModalOpen(false);
            setIsAuthLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Auth check notice:', err);
      }

      // 3. If no valid session, load public feed/leaderboard, open auth modal and clear current user
      if (active) {
        setCurrentUser(null);
        try {
          const [fRes, lbRes] = await Promise.all([
            fetch('/api/feed', { cache: 'no-store' }),
            fetch('/api/leaderboard', { cache: 'no-store' }),
          ]);
          if (fRes.ok) {
            const fData = await fRes.json();
            if (active && fData.success && fData.events) setEvents(fData.events);
          }
          if (lbRes.ok) {
            const lbData = await lbRes.json();
            if (active && lbData.success && lbData.leaders) setAllUsers(lbData.leaders);
          }
        } catch {
          // Non-critical
        }
        if (!isInsideTelegram) {
          setIsBrowserAuthModalOpen(true);
        }
        setIsAuthLoading(false);
      }
    }

    checkAuthSession();

    return () => {
      active = false;
    };
  }, [initData, isInsideTelegram, syncProfile]);

  // Enrich inventory items with catalog metadata
  const inventory = useMemo(() => {
    return inventoryRaw
      .map((item) => {
        const catalogItem = REWARDS_CATALOG.find((r) => r.id === (item.id || item.rewardId));
        return {
          ...(catalogItem || {}),
          ...item,
        };
      })
      .filter((it) => it.id);
  }, [inventoryRaw]);

  // Last wins
  const lastWins = useMemo(() => {
    if (lastWinsRaw.length > 0) return lastWinsRaw;
    return [...inventory].sort((a, b) => {
      const dateA = new Date(a.acquiredAt || 0).getTime();
      const dateB = new Date(b.acquiredAt || 0).getTime();
      return dateB - dateA;
    });
  }, [lastWinsRaw, inventory]);

  // Active equipped title object
  const activeTitle = useMemo(() => {
    const titleId = currentUser?.active_title_id || (currentUser?.is_vip ? 'title-vip' : null);
    if (!titleId) return null;
    return resolveTitle(titleId) || null;
  }, [currentUser]);

  // Browser Login / Register action
  const browserAuth = useCallback(
    async ({ username, code, recoveryKey, password, action = 'login' }) => {
      try {
        const res = await fetch('/api/auth/browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, code, recoveryKey, password, action }),
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          setLogoutNotice('');
          setIsBrowserAuthModalOpen(false);
          await syncProfile();
          triggerHaptic('success');
          return {
            success: true,
            user: data.user,
            recoveryKey: data.recoveryKey,
            greeting: data.greeting,
          };
        }
        triggerHaptic('error');
        return { success: false, error: data.error };
      } catch (err) {
        triggerHaptic('error');
        return { success: false, error: err.message };
      }
    },
    [syncProfile, triggerHaptic]
  );

  // Logout action
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setInventoryRaw([]);
    setLastWinsRaw([]);
    setGiftsHistoryRaw([]);
    setNotifications([]);
    setUnreadCount(0);
    setLogoutNotice('Вы успешно вышли из аккаунта');
    setIsBrowserAuthModalOpen(true);
    triggerHaptic('medium');
    return { success: true, message: 'Вы успешно вышли из аккаунта' };
  }, [triggerHaptic]);

  // Switch active user (Dev/Testing)
  const switchUser = useCallback(
    async (userId) => {
      const targetUser = allUsers.find((u) => u.id === userId);
      if (targetUser) {
        try {
          await fetch('/api/auth/browser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: targetUser.username, password: 'password123' }),
          });
        } catch {
          // Fallback
        }
      }
      syncProfile();
      triggerHaptic('medium');
    },
    [allUsers, syncProfile, triggerHaptic]
  );

  // Equip title (Server API)
  const equipTitle = useCallback(
    async (titleId) => {
      if (!currentUser) return;
      try {
        const res = await fetch('/api/titles/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titleId }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.warn('Equip title notice:', err);
      }
      syncProfile();
      triggerHaptic('success');
    },
    [currentUser, syncProfile, triggerHaptic]
  );

  // Unequip title (Server API)
  const unequipTitle = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/titles/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.warn('Unequip title notice:', err);
    }
    syncProfile();
    triggerHaptic('medium');
  }, [currentUser, syncProfile, triggerHaptic]);

  // Send gift (Server + Local)
  const sendGift = useCallback(
    async ({ recipientUsername, rewardId, quantity = 1, message = '', source = 'inventory' }) => {
      if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };

      try {
        const res = await fetch('/api/gifts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientUsername, rewardId, quantity, message, source }),
        });
        const data = await res.json();
        if (data.success) {
          syncProfile();
          triggerHaptic('success');
          return {
            success: true,
            recipient: data.recipient,
            item: data.item || data.reward_name,
            cost: data.cost,
            message: data.message,
          };
        }
        triggerHaptic('error');
        return { success: false, error: data.error };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [currentUser, syncProfile, triggerHaptic]
  );

  // Play Slot Machine / Wheel Spin (Server)
  const playSpin = useCallback(async () => {
    if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };

    try {
      const res = await fetch('/api/spin/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        const newCoins = typeof data.coins_balance === 'number' ? data.coins_balance : (typeof data.coinsBalance === 'number' ? data.coinsBalance : undefined);
        const newPoints = typeof data.points_balance === 'number' ? data.points_balance : (typeof data.pointsBalance === 'number' ? data.pointsBalance : undefined);
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                free_spins_balance: data.spins_left,
                spins_count: data.total_spins,
                total_uc: data.total_uc,
                total_popularity: data.total_popularity,
                coins_balance: newCoins ?? prev.coins_balance,
                points_balance: newPoints ?? prev.points_balance,
              }
            : null
        );
        syncProfile();
        triggerHaptic('success');
        return data;
      }
      triggerHaptic('error');
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [currentUser, syncProfile, triggerHaptic]);

  // Buy Shop Item (Coins / Points)
  const buyShopItem = useCallback(
    async ({ itemId, quantity = 1 }) => {
      if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };

      try {
        const res = await fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, quantity }),
        });
        const data = await res.json();
        if (data.success) {
          const newCoins = typeof data.coinsBalance === 'number' ? data.coinsBalance : data.coins_balance;
          const newPoints = typeof data.pointsBalance === 'number' ? data.pointsBalance : data.points_balance;
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  coins_balance: newCoins ?? prev.coins_balance,
                  points_balance: newPoints ?? prev.points_balance,
                }
              : null
          );
          syncProfile();
          triggerHaptic('success');
          return data;
        }
        triggerHaptic('error');
        return data;
      } catch (err) {
        triggerHaptic('error');
        return { success: false, error: err.message };
      }
    },
    [currentUser, syncProfile, triggerHaptic]
  );

  // Check & grant 24-hour daily free spins
  const checkDailySpins = useCallback(async () => {
    try {
      const res = await fetch('/api/spin/daily', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const spinsLeft = typeof data.free_spins === 'number' ? data.free_spins : (typeof data.freeSpins === 'number' ? data.freeSpins : undefined);
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  free_spins_balance: spinsLeft !== undefined ? spinsLeft : prev.free_spins_balance,
                  last_daily_spins_at: data.last_daily_spins_at ?? prev.last_daily_spins_at,
                  next_daily_spins_at: data.next_daily_spins_at ?? prev.next_daily_spins_at,
                  seconds_until_next_spins: data.seconds_remaining ?? prev.seconds_until_next_spins,
                }
              : null
          );
          return data;
        }
      }
    } catch {
      // Non-critical
    }
    return null;
  }, []);

  // Total stats calculations
  const stats = useMemo(() => {
    const totalRewardsCount = inventory.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const uniqueRewardsCount = inventory.length;
    const achievementsCount = Math.min(15, Math.floor((currentUser?.spins_count || 0) / 10) + uniqueRewardsCount);
    const isVipAdmin = Boolean(currentUser?.is_admin && currentUser?.is_vip);
    const isAdmin = Boolean(currentUser?.is_admin);
    const isVip = Boolean(currentUser?.is_vip);

    const rawCoins = isVip || isAdmin
      ? (typeof currentUser?.coins_balance === 'number' ? Math.max(currentUser.coins_balance, 1000) : 1000)
      : (typeof currentUser?.coins_balance === 'number' ? currentUser.coins_balance : 0);

    const rawUc = (isVip || isAdmin)
      ? (typeof currentUser?.total_uc === 'number' ? Math.max(currentUser.total_uc, 5000) : 5000)
      : (currentUser?.total_uc || 0);
    const rawPopularity = currentUser?.total_popularity || 0;

    return {
      totalRewardsCount,
      uniqueRewardsCount,
      achievementsCount,
      spinsCount: currentUser?.spins_count || 0,
      totalUc: rawUc,
      popularity: rawPopularity,
      pp: rawPopularity,
      freeSpins: (isVipAdmin || isAdmin) ? Infinity : (currentUser?.free_spins_balance || 0),
      coinsBalance: isVipAdmin || isAdmin ? Infinity : rawCoins,
      pointsBalance: isVipAdmin || isAdmin ? Infinity : rawCoins,
      rawCoinsBalance: rawCoins,
      rawPointsBalance: rawCoins,
      nextDailySpinsAt: currentUser?.next_daily_spins_at || null,
      secondsUntilNextSpins: currentUser?.seconds_until_next_spins || 0,
    };
  }, [inventory, currentUser]);

  const value = useMemo(
    () => ({
      user: currentUser,
      activeTitle,
      inventory,
      events,
      giftsHistory: giftsHistoryRaw,
      purchasesHistory: purchasesHistoryRaw,
      lastWins,
      allUsers,
      stats,
      notifications,
      unreadCount,
      fetchNotifications,
      markNotificationsAsRead,
      isLoaded: !isAuthLoading,
      isAuthLoading,
      isAuthenticated: Boolean(currentUser),
      isSyncing,
      isInsideTelegram,
      isBrowserAuthModalOpen,
      setIsBrowserAuthModalOpen,
      logoutNotice,
      setLogoutNotice,
      browserAuth,
      logout,
      switchUser,
      equipTitle,
      unequipTitle,
      sendGift,
      buyShopItem,
      playSpin,
      checkDailySpins,
      refreshData: syncProfile,
    }),
    [
      currentUser,
      activeTitle,
      inventory,
      events,
      giftsHistoryRaw,
      purchasesHistoryRaw,
      lastWins,
      allUsers,
      stats,
      notifications,
      unreadCount,
      fetchNotifications,
      markNotificationsAsRead,
      isAuthLoading,
      isSyncing,
      isInsideTelegram,
      isBrowserAuthModalOpen,
      logoutNotice,
      browserAuth,
      logout,
      switchUser,
      equipTitle,
      unequipTitle,
      sendGift,
      buyShopItem,
      playSpin,
      checkDailySpins,
      syncProfile,
    ]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
}
