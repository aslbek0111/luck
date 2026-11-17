'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';

function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

const emptySubscribe = () => () => {};

export function useTelegram() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (webApp) {
      try {
        webApp.ready();
        webApp.expand();
        if (webApp.setHeaderColor) {
          webApp.setHeaderColor('#09090b');
        }
        if (webApp.setBackgroundColor) {
          webApp.setBackgroundColor('#09090b');
        }
      } catch (err) {
        console.warn('Telegram WebApp init notice:', err);
      }
    }
  }, []);

  const tg = isClient ? getTelegramWebApp() : null;
  const user = tg?.initDataUnsafe?.user || null;
  const initData = tg?.initData || '';

  const triggerHaptic = useCallback((type = 'light') => {
    try {
      const webApp = getTelegramWebApp();
      if (webApp?.HapticFeedback) {
        if (type === 'success' || type === 'error' || type === 'warning') {
          webApp.HapticFeedback.notificationOccurred(type);
        } else {
          webApp.HapticFeedback.impactOccurred(type);
        }
      }
    } catch {
      // Haptics fallback
    }
  }, []);

  const closeApp = useCallback(() => {
    const webApp = getTelegramWebApp();
    if (webApp?.close) {
      webApp.close();
    }
  }, []);

  const showBackButton = useCallback((callback) => {
    const webApp = getTelegramWebApp();
    if (webApp?.BackButton) {
      webApp.BackButton.show();
      if (callback) {
        webApp.BackButton.onClick(callback);
      }
    }
  }, []);

  const hideBackButton = useCallback(() => {
    const webApp = getTelegramWebApp();
    if (webApp?.BackButton) {
      webApp.BackButton.hide();
    }
  }, []);

  const showMainButton = useCallback((text, callback, options = {}) => {
    const webApp = getTelegramWebApp();
    if (webApp?.MainButton) {
      webApp.MainButton.setText(text);
      if (options.color) webApp.MainButton.setParams({ color: options.color });
      webApp.MainButton.show();
      if (callback) {
        webApp.MainButton.onClick(callback);
      }
    }
  }, []);

  const hideMainButton = useCallback(() => {
    const webApp = getTelegramWebApp();
    if (webApp?.MainButton) {
      webApp.MainButton.hide();
    }
  }, []);

  return {
    tg,
    initData,
    isReady: isClient,
    telegramUser: user,
    isInsideTelegram: Boolean(initData),
    triggerHaptic,
    closeApp,
    showBackButton,
    hideBackButton,
    showMainButton,
    hideMainButton,
  };
}
