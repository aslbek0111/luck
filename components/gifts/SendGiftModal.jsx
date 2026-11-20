'use client';

import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import { getShopGifts, resolveReward, resolveTitle, REWARDS_CATALOG } from '../../lib/catalog-data';
import GlassCard from '../ui/GlassCard';
import GoldButton from '../ui/GoldButton';
import RarityBadge from '../ui/RarityBadge';
import {
  Gift,
  X,
  Search,
  Sparkles,
  Send,
  Coins,
  Package,
  Heart,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShoppingBag,
  User,
  Star,
  Crown,
  Flame,
  Flower,
  Smile,
  RotateCcw,
  TreePine,
  Baby,
  Wind,
  Bot,
  Award,
  Trophy,
  Shirt,
  Skull,
  Candy,
  Square,
  Globe,
  Bell,
  Archive,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  Gift,
  Star,
  Coins,
  Crown,
  ShoppingBag,
  Flame,
  Flower,
  Smile,
  RotateCcw,
  TreePine,
  Baby,
  Wind,
  Bot,
  Award,
  Trophy,
  Shirt,
  Skull,
  Candy,
  Square,
  Globe,
  Bell,
  Archive,
  Zap,
  Package,
  Sparkles,
};

export default function SendGiftModal({
  isOpen,
  onClose,
  defaultRecipient = '',
  defaultItemId = null,
}) {
  const { user, stats, inventory, allUsers, sendGift, setIsBrowserAuthModalOpen } = useUserData();
  const { triggerHaptic } = useTelegram();

  // Tab: 'inventory' | 'shop'
  const [activeSource, setActiveSource] = useState('inventory');
  const [recipientInput, setRecipientInput] = useState(defaultRecipient);
  const [selectedItemId, setSelectedItemId] = useState(defaultItemId || '');
  const [sendQuantity, setSendQuantity] = useState(1);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Sync defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientInput(defaultRecipient || '');
      setSelectedItemId(defaultItemId || '');
      setSendQuantity(1);
      setMessageText('');
      setErrorMessage('');
      setSuccessInfo(null);
      setIsConfirming(false);
      setSearchQuery('');
      // If default item passed, determine source
      if (defaultItemId) {
        const inInv = (inventory || []).some((it) => (it.id === defaultItemId || it.rewardId === defaultItemId) && it.quantity > 0);
        if (!inInv) {
          setActiveSource('shop');
        }
      }
    }
  }, [isOpen, defaultRecipient, defaultItemId, inventory]);

  const isAdmin = Boolean(user?.is_admin);
  const userCoins = isAdmin ? Infinity : (stats?.coinsBalance ?? user?.coins_balance ?? 0);

  // Filter other users for quick select
  const filteredUsers = useMemo(() => {
    if (!allUsers || !Array.isArray(allUsers)) return [];
    const currentUsername = (user?.username || '').toLowerCase();
    const query = recipientInput.replace('@', '').toLowerCase().trim();

    return allUsers
      .filter((u) => {
        const uName = (u.username || '').toLowerCase();
        if (uName === currentUsername) return false;
        if (!query) return true;
        return uName.includes(query);
      })
      .slice(0, 8);
  }, [allUsers, user?.username, recipientInput]);

  // Inventory items with qty > 0
  const inventoryItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter((item) => (item.quantity || 0) > 0);
  }, [inventory]);

  // Shop gifts
  const shopItems = useMemo(() => {
    return getShopGifts();
  }, []);

  // Filtered items based on active tab and search
  const displayedItems = useMemo(() => {
    const list = activeSource === 'inventory' ? inventoryItems : shopItems;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [activeSource, inventoryItems, shopItems, searchQuery]);

  // Selected item object
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    if (activeSource === 'inventory') {
      return inventoryItems.find((it) => it.id === selectedItemId || it.rewardId === selectedItemId) || null;
    }
    return shopItems.find((it) => it.id === selectedItemId) || null;
  }, [selectedItemId, activeSource, inventoryItems, shopItems]);

  if (!isOpen) return null;

  const handleSelectUser = (u) => {
    triggerHaptic('light');
    setRecipientInput(u.username);
  };

  const handleSelectItem = (item) => {
    triggerHaptic('light');
    setSelectedItemId(item.id || item.rewardId);
    setSendQuantity(1);
    setErrorMessage('');
  };

  const validateBeforeConfirm = () => {
    setErrorMessage('');
    const cleanUser = recipientInput.replace('@', '').trim();

    if (!cleanUser) {
      setErrorMessage('Пожалуйста, укажите никнейм получателя');
      triggerHaptic('error');
      return false;
    }

    if (user && cleanUser.toLowerCase() === (user.username || '').toLowerCase()) {
      setErrorMessage('Нельзя отправить подарок самому себе');
      triggerHaptic('error');
      return false;
    }

    if (!selectedItem) {
      setErrorMessage('Пожалуйста, выберите подарок для отправки');
      triggerHaptic('error');
      return false;
    }

    const qty = Math.max(1, parseInt(sendQuantity, 10) || 1);

    if (activeSource === 'shop') {
      const price = (selectedItem.priceCoins || selectedItem.pricePoints || 100) * qty;
      if (!isAdmin && userCoins < price) {
        setErrorMessage(`Недостаточно монет для покупки подарка (требуется ${price}, у вас ${userCoins})`);
        triggerHaptic('error');
        return false;
      }
    } else {
      if ((selectedItem.quantity || 0) < qty) {
        setErrorMessage(`Недостаточно предметов в вашем инвентаре (в наличии: ${selectedItem.quantity || 0})`);
        triggerHaptic('error');
        return false;
      }
    }

    return true;
  };

  const handleOpenConfirm = () => {
    if (!user) {
      setIsBrowserAuthModalOpen(true);
      return;
    }
    if (validateBeforeConfirm()) {
      triggerHaptic('medium');
      setIsConfirming(true);
    }
  };

  const handleExecuteSend = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    const cleanUser = recipientInput.replace('@', '').trim();
    const itemId = selectedItem.id || selectedItem.rewardId;
    const qty = Math.max(1, parseInt(sendQuantity, 10) || 1);

    try {
      const res = await sendGift({
        recipientUsername: cleanUser,
        rewardId: itemId,
        quantity: qty,
        message: messageText.trim(),
        source: activeSource,
      });

      if (res.success) {
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#fbbf24', '#10b981', '#38bdf8', '#ec4899'],
          });
        } catch {
          // Non-critical
        }
        triggerHaptic('success');
        const isSpin = selectedItem.category === 'spins' || String(itemId).startsWith('reward-spin-');
        const spinsCount = (selectedItem.value && selectedItem.value > 0 ? selectedItem.value : 1) * qty;

        setSuccessInfo({
          recipient: res.recipient || cleanUser,
          item: selectedItem.name,
          quantity: qty,
          source: activeSource,
          cost: res.cost || 0,
          isSpin,
          spinsCount,
        });
        setIsConfirming(false);
      } else {
        triggerHaptic('error');
        setErrorMessage(res.error || 'Не удалось отправить подарок');
        setIsConfirming(false);
      }
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err.message || 'Ошибка сети при отправке подарка');
      setIsConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl my-8 bg-gradient-to-b from-[#182035]/95 to-[#0b1020]/98 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] p-5 sm:p-6 text-white overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/25 to-amber-400/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Gift className="w-6 h-6 text-amber-400 animate-bounce" style={{ animationDuration: '2.5s' }} />
            </div>
            <div>
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 flex items-center gap-2">
                Отправить подарок
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-white/60">Порадуйте другого игрока волшебным подарком</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUCCESS VIEW */}
        {successInfo ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.35)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-emerald-300">Подарок успешно отправлен!</h3>
              <p className="text-sm text-white/80 mt-1">
                Игрок <span className="font-bold text-amber-400">@{successInfo.recipient}</span> получил{' '}
                <span className="font-bold text-white">«{successInfo.item}»</span> ({successInfo.quantity || 1} шт.)!
              </p>
              {successInfo.isSpin && (
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-300 shadow-sm">
                  <RotateCcw className="w-4 h-4 animate-spin text-emerald-400" style={{ animationDuration: '6s' }} />
                  Зачислено +{successInfo.spinsCount} рабочих вращений на Колесе Фортуны!
                </div>
              )}
              {successInfo.source === 'shop' && successInfo.cost > 0 && (
                <p className="text-xs text-amber-300/80 mt-2 flex items-center justify-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Списано: {successInfo.cost} монет
                </p>
              )}
            </div>
            <div className="pt-4">
              <GoldButton onClick={handleClose} fullWidth className="py-3 text-base">
                Отлично! 🎁
              </GoldButton>
            </div>
          </div>
        ) : isConfirming ? (
          /* CONFIRMATION STEP */
          <div className="py-4 space-y-5">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-amber-300">Подтверждение отправки</h3>
              <p className="text-sm text-white/80">
                Вы уверены, что хотите подарить <span className="text-amber-400 font-bold">«{selectedItem?.name}»</span> ({sendQuantity} шт.) игроку{' '}
                <span className="text-emerald-400 font-bold">@{recipientInput.replace('@', '').trim()}</span>?
              </p>
            </div>

            {/* Summary preview */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Получатель:</span>
                <span className="font-bold text-amber-400">@{recipientInput.replace('@', '').trim()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Подарок:</span>
                <span className="font-semibold text-white">{selectedItem?.name} ({sendQuantity} шт.)</span>
              </div>
              {(selectedItem?.category === 'spins' || String(selectedItem?.id || selectedItem?.rewardId).startsWith('reward-spin-')) && (
                <div className="flex items-center justify-between text-sm bg-amber-500/15 p-2 rounded-xl border border-amber-400/30">
                  <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    Начисление спинов:
                  </span>
                  <span className="font-black text-amber-300">
                    +{(selectedItem?.value || 1) * sendQuantity} вращений на Колесе
                  </span>
                </div>
              )}
              {selectedItem?.category === 'uc' && (
                <div className="flex items-center justify-between text-sm bg-amber-500/15 p-2 rounded-xl border border-amber-400/30">
                  <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Начисление UC:
                  </span>
                  <span className="font-black text-amber-300">
                    +{(selectedItem?.value || 0) * sendQuantity} UC
                  </span>
                </div>
              )}
              {selectedItem?.category === 'coins' && (
                <div className="flex items-center justify-between text-sm bg-amber-500/15 p-2 rounded-xl border border-amber-400/30">
                  <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Начисление монет:
                  </span>
                  <span className="font-black text-amber-300">
                    +{(selectedItem?.value || 0) * sendQuantity} монет
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Источник:</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  {activeSource === 'inventory' ? 'Из вашего рюкзака' : 'Покупка в магазине'}
                </span>
              </div>
              {activeSource === 'shop' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Итоговая стоимость:</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-4 h-4" />
                    {isAdmin ? 'Бесплатно (ADMIN)' : `${(selectedItem?.priceCoins || selectedItem?.pricePoints || 100) * sendQuantity} монет`}
                  </span>
                </div>
              )}
              {messageText.trim() && (
                <div className="pt-2 border-t border-white/10 text-xs text-white/70 italic">
                  «{messageText.trim()}»
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirming(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 font-medium text-sm transition-colors"
              >
                Назад
              </button>
              <GoldButton
                onClick={handleExecuteSend}
                disabled={isSubmitting}
                className="flex-1 py-3 text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Подтвердить и отправить
                  </>
                )}
              </GoldButton>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="pt-4 space-y-4">
            {/* Recipient Input */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center justify-between">
                <span>1. Кому отправить (Nickname):</span>
                <span className="text-[11px] text-white/40">Без символа @</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400/80">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Введите никнейм игрока..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
                />
              </div>

              {/* Quick suggestions */}
              {filteredUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-white/40 self-center mr-1">Быстрый выбор:</span>
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id || u.username}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        recipientInput.replace('@', '').toLowerCase() === (u.username || '').toLowerCase()
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      @{u.username}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Source Tab (Inventory vs Shop) */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                2. Выберите источник подарка:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveSource('inventory');
                    setSelectedItemId('');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSource === 'inventory'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Из рюкзака ({inventoryItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveSource('shop');
                    setSelectedItemId('');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSource === 'shop'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Купить в подарок
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeSource === 'inventory' ? 'Поиск в рюкзаке...' : 'Поиск подарка в магазине...'}
                className="w-full pl-9 pr-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Items Grid */}
            <div>
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                {displayedItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-white/40">
                    {activeSource === 'inventory'
                      ? 'В вашем рюкзаке пока нет предметов для подарка.'
                      : 'Подарки не найдены.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displayedItems.map((item) => {
                      const isSelected = selectedItemId === (item.id || item.rewardId);
                      const Icon = ICON_MAP[item.icon] || Gift;
                      const price = item.priceCoins || item.pricePoints || 100;

                      return (
                        <div
                          key={item.id || item.rewardId}
                          onClick={() => handleSelectItem(item)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 relative ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <RarityBadge rarity={item.rarity} size="xs" />
                              {activeSource === 'inventory' ? (
                                <span className="text-[10px] text-white/60">В наличии: x{item.quantity || 1}</span>
                              ) : (
                                <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-0.5">
                                  <Coins className="w-2.5 h-2.5" />
                                  {isAdmin ? '0 (ADMIN)' : `${price} м.`}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Selector & Functional Hint */}
            {selectedItem && (
              <div className="space-y-2">
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Количество для отправки:</span>
                    <span className="text-[10px] text-white/50">
                      {activeSource === 'inventory'
                        ? `В наличии: ${selectedItem.quantity || 1} шт.`
                        : `Цена за единицу: ${isAdmin ? '0 (ADMIN)' : (selectedItem.priceCoins || 100) + ' монет'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSendQuantity((q) => Math.max(1, q - 1))}
                      disabled={sendQuantity <= 1}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm text-white transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-black text-amber-300">{sendQuantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxQty = activeSource === 'inventory' ? (selectedItem.quantity || 1) : 99;
                        setSendQuantity((q) => Math.min(maxQty, q + 1));
                      }}
                      disabled={activeSource === 'inventory' && sendQuantity >= (selectedItem.quantity || 1)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Functional Banner for Spins */}
                {(selectedItem.category === 'spins' || String(selectedItem.id || selectedItem.rewardId).startsWith('reward-spin-')) && (
                  <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-emerald-500/20 border border-amber-400/40 text-xs text-amber-200 flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>
                      Получатель получит <strong className="text-white font-black">+{ (selectedItem.value || 1) * sendQuantity }</strong> рабочих вращений на Колесе Фортуны!
                    </span>
                  </div>
                )}
                {selectedItem.category === 'uc' && (
                  <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Получатель получит <strong className="text-white font-black">+{ (selectedItem.value || 0) * sendQuantity }</strong> UC прямо на свой баланс!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Optional Message */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center justify-between">
                <span>3. Сообщение (по желанию):</span>
                <span className="text-[10px] text-white/40">{messageText.length}/150</span>
              </label>
              <textarea
                value={messageText}
                maxLength={150}
                onChange={(e) => setMessageText(e.target.value)}
                rows={2}
                placeholder="С Новым Годом! Пусть удача всегда будет с тобой! 🎄🎁"
                className="w-full px-3 py-2 bg-black/40 border border-white/15 focus:border-amber-400 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none transition-colors"
              />
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Footer / Send Button */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
              <div className="text-xs text-white/60">
                {activeSource === 'shop' && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Coins className="w-3.5 h-3.5" />
                    Баланс: {isAdmin ? '∞' : userCoins} монет
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
                >
                  Отмена
                </button>
                <GoldButton
                  type="button"
                  onClick={handleOpenConfirm}
                  disabled={!recipientInput.trim() || !selectedItemId}
                  className="px-5 py-2.5 text-xs flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Перейти к отправке
                </GoldButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
