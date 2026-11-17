'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { TITLES_LIST, REWARDS_CATALOG } from '../lib/catalog-data';
import { useTelegram } from './useTelegram';

const UserDataContext = createContext(null);

export function UserDataProvider({ children }) {
  const { initData, triggerHaptic, isInsideTelegram } = useTelegram();

  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [inventoryRaw, setInventoryRaw] = useState([]);
  const [events, setEvents] = useState([]);
  const [giftsHistoryRaw, setGiftsHistoryRaw] = useState([]);
  const [lastWinsRaw, setLastWinsRaw] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isBrowserAuthModalOpen, setIsBrowserAuthModalOpen] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
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
        fetch('/api/user/profile'),
        fetch('/api/feed'),
        fetch('/api/leaderboard'),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const data = await profileRes.value.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          if (data.inventory) setInventoryRaw(data.inventory);
          if (data.giftsHistory) setGiftsHistoryRaw(data.giftsHistory);
          if (data.lastWins) setLastWinsRaw(data.lastWins);
        }
      } else if (profileRes.status === 'fulfilled' && profileRes.value.status === 401) {
        setCurrentUser(null);
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
        const meRes = await fetch('/api/auth/me');
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
          const [fRes, lbRes] = await Promise.all([fetch('/api/feed'), fetch('/api/leaderboard')]);
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
    if (!currentUser?.active_title_id) return null;
    return TITLES_LIST.find((t) => t.id === currentUser.active_title_id) || null;
  }, [currentUser]);

  // Browser Login / Register action
  const browserAuth = useCallback(
    async ({ username, password, confirmPassword, code, action = 'login' }) => {
      try {
        const res = await fetch('/api/auth/browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, confirmPassword, code, action }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          setIsBrowserAuthModalOpen(false);
          await syncProfile();
          triggerHaptic('success');
          return { success: true, user: data.user, greeting: data.greeting };
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
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setInventoryRaw([]);
    setLastWinsRaw([]);
    setGiftsHistoryRaw([]);
    setNotifications([]);
    setUnreadCount(0);
    setIsBrowserAuthModalOpen(true);
    triggerHaptic('medium');
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
    async ({ recipientUsername, rewardId, quantity = 1, message = '' }) => {
      if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };

      try {
        const res = await fetch('/api/gifts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientUsername, rewardId, quantity, message }),
        });
        const data = await res.json();
        if (data.success) {
          syncProfile();
          triggerHaptic('success');
          return { success: true, recipient: data.recipient, item: data.item || data.reward_name };
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
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                free_spins_balance: data.spins_left,
                spins_count: data.total_spins,
                total_uc: data.total_uc,
                total_popularity: data.total_popularity,
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

  // Total stats calculations
  const stats = useMemo(() => {
    const totalRewardsCount = inventory.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const uniqueRewardsCount = inventory.length;
    const achievementsCount = Math.min(15, Math.floor((currentUser?.spins_count || 0) / 10) + uniqueRewardsCount);

    return {
      totalRewardsCount,
      uniqueRewardsCount,
      achievementsCount,
      spinsCount: currentUser?.spins_count || 0,
      totalUc: currentUser?.total_uc || 0,
      popularity: currentUser?.total_popularity || 0,
      freeSpins: currentUser?.free_spins_balance || 0,
    };
  }, [inventory, currentUser]);

  const value = useMemo(
    () => ({
      user: currentUser,
      activeTitle,
      inventory,
      events,
      giftsHistory: giftsHistoryRaw,
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
      browserAuth,
      logout,
      switchUser,
      equipTitle,
      unequipTitle,
      sendGift,
      playSpin,
      refreshData: syncProfile,
    }),
    [
      currentUser,
      activeTitle,
      inventory,
      events,
      giftsHistoryRaw,
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
      browserAuth,
      logout,
      switchUser,
      equipTitle,
      unequipTitle,
      sendGift,
      playSpin,
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
