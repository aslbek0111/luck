'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import { getShopGifts } from '../../lib/catalog-data';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import Toast from '../../components/ui/Toast';
import {
  Gift,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Sparkles,
  Info,
  MessageSquare,
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
  PackageCheck,
  UserCheck,
} from 'lucide-react';

const ICON_MAP = {
  Gift,
  Star,
  Coins,
  Crown,
  ShoppingBag,
  Flame,
  Flower,
  Flower2: Flower,
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
  PackageCheck,
  UserCheck,
  Sparkles,
};

function GiftsContent() {
  const searchParams = useSearchParams();
  const preselectedItemId = searchParams.get('item');
  const initialTab = searchParams.get('tab') || (preselectedItemId ? 'send' : 'catalog');

  const { inventory, sendGift, buyShopItem, allUsers, user, stats, giftsHistory, setIsBrowserAuthModalOpen } = useUserData();
  const { triggerHaptic } = useTelegram();

  // Tab state: 'catalog' | 'send' | 'history'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Send Gift State
  const [recipientUsername, setRecipientUsername] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState(preselectedItemId || '');
  const [message, setMessage] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isConfirmSendModalOpen, setIsConfirmSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Catalog State
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('all');
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  // Notifications
  const [statusMessage, setStatusMessage] = useState(null); // { type, text }
  const [insufficientPointsModal, setInsufficientPointsModal] = useState(null);

  const isAdmin = Boolean(user?.is_admin);
  const userPoints = isAdmin ? Infinity : stats.pointsBalance ?? user?.points_balance ?? 1000;

  // Available gifts catalog (excluding UC VIP)
  const availableGifts = useMemo(() => {
    const gifts = getShopGifts();
    return gifts.filter((gift) => {
      if (selectedCatalogCategory !== 'all' && gift.category !== selectedCatalogCategory) {
        return false;
      }
      if (catalogSearchQuery.trim()) {
        const q = catalogSearchQuery.toLowerCase().trim();
        return (gift.name || '').toLowerCase().includes(q) || (gift.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedCatalogCategory, catalogSearchQuery]);

  // Giftable items from user inventory
  const giftableItems = useMemo(() => {
    return inventory.filter((item) => (item.quantity || 0) > 0);
  }, [inventory]);

  const filteredGiftableItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return giftableItems;
    const q = itemSearchQuery.toLowerCase().trim();
    return giftableItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [giftableItems, itemSearchQuery]);

  const selectedItemMeta = useMemo(() => {
    return giftableItems.find((it) => it.id === selectedRewardId) || null;
  }, [giftableItems, selectedRewardId]);

  // Open confirmation for sending gift
  const handleOpenSendConfirm = (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanUser = recipientUsername.replace('@', '').trim();
    if (!cleanUser) {
      setStatusMessage({ type: 'error', text: 'Укажите никнейм получателя' });
      return;
    }
    if (!selectedRewardId) {
      setStatusMessage({ type: 'error', text: 'Выберите предмет для подарка' });
      return;
    }

    setIsConfirmSendModalOpen(true);
  };

  // Perform sending gift
  const executeSend = async () => {
    setIsSending(true);
    const cleanUser = recipientUsername.replace('@', '').trim();

    const res = await sendGift({
      recipientUsername: cleanUser,
      rewardId: selectedRewardId,
      quantity: 1,
      message,
    });
    setIsSending(false);
    setIsConfirmSendModalOpen(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Подарок «${selectedItemMeta?.name || 'Предмет'}» успешно отправлен игроку @${res.recipient}!`,
      });
      setRecipientUsername('');
      setSelectedRewardId('');
      setMessage('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Ошибка при отправке подарка' });
    }
  };

  // Open buy modal from catalog
  const handleOpenBuy = (item) => {
    if (!user) {
      setIsBrowserAuthModalOpen(true);
      return;
    }

    const unitCost = item.pricePoints || 100;
    const totalCost = isAdmin ? 0 : unitCost;

    if (!isAdmin && userPoints < totalCost) {
      triggerHaptic('error');
      setInsufficientPointsModal({
        item,
        required: totalCost,
        current: userPoints,
      });
      return;
    }

    triggerHaptic('selection');
    setSelectedItemForPurchase(item);
  };

  // Execute buy
  const handleExecutePurchase = async () => {
    if (!selectedItemForPurchase) return;
    setIsProcessingPurchase(true);

    const result = await buyShopItem({
      itemId: selectedItemForPurchase.id,
      quantity: 1,
    });

    setIsProcessingPurchase(false);
    setSelectedItemForPurchase(null);

    if (result.success) {
      try {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#f59e0b', '#ec4899', '#38bdf8'],
        });
      } catch {}
      triggerHaptic('success');
      setStatusMessage({
        type: 'success',
        text: `Подарок «${selectedItemForPurchase.name}» успешно приобретен и добавлен в ваш Инвентарь!`,
      });
    } else {
      triggerHaptic('error');
      if (result.requiredPoints) {
        setInsufficientPointsModal({
          item: selectedItemForPurchase,
          required: result.requiredPoints,
          current: result.currentPoints ?? userPoints,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Не удалось совершить покупку',
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {statusMessage && (
        <Toast
          message={statusMessage.text}
          type={statusMessage.type}
          onClose={() => setStatusMessage(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-amber-400/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-rose-400" />
              Раздел Подарков
            </h1>
            <p className="text-xs text-zinc-400">Покупка подарков за Points и отправка друзьям 🎁</p>
          </div>
        </div>

        {/* User Balance Header Badge */}
        <Link
          href="/shop"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all ${
            isAdmin
              ? 'bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 border-amber-300/60 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-zinc-900/90 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
          }`}
          title="Открыть Магазин"
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isAdmin ? 'bg-amber-400/30 text-amber-300' : 'bg-purple-500/20 text-purple-300'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
          </div>
          <div className="flex flex-col text-right">
            <span
              className={`text-sm font-black leading-none ${
                isAdmin ? 'text-amber-300 text-base' : 'text-purple-200'
              }`}
            >
              {isAdmin ? '∞' : userPoints}
            </span>
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              POINTS
            </span>
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Каталог подарков</span>
        </button>

        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'send'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Отправить другу</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>История</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GIFTS CATALOG FOR PURCHASE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          {/* Sub-Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCatalogCategory('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'all'
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Все подарки
            </button>
            <button
              onClick={() => setSelectedCatalogCategory('christmas')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'christmas'
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🎄 Новогодние
            </button>
            <button
              onClick={() => setSelectedCatalogCategory('roses')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'roses'
                  ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🌹 Розы
            </button>
            <button
              onClick={() => setSelectedCatalogCategory('jokes')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'jokes'
                  ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              😂 Шуточные
            </button>
            <button
              onClick={() => setSelectedCatalogCategory('popularity')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'popularity'
                  ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🔥 Популярность
            </button>
            <button
              onClick={() => setSelectedCatalogCategory('spins')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCatalogCategory === 'spins'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🔄 Вращения
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={catalogSearchQuery}
              onChange={(e) => setCatalogSearchQuery(e.target.value)}
              placeholder="Поиск подарков..."
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 transition-colors"
            />
          </div>

          {/* Gifts Grid */}
          {availableGifts.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="Подарки не найдены"
              description="Попробуйте изменить категорию или поисковый запрос."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableGifts.map((gift) => {
                const Icon = ICON_MAP[gift.icon] || Gift;
                const unitPrice = gift.pricePoints || 100;
                const canAfford = isAdmin || userPoints >= unitPrice;

                return (
                  <div
                    key={gift.id}
                    className="glass-card rounded-3xl p-3.5 flex flex-col justify-between border border-zinc-800/80 hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center p-2 group-hover:scale-105 transition-transform shadow-inner border border-white/5"
                          style={{
                            backgroundColor:
                              gift.rarity === 'legendary'
                                ? 'rgba(245,158,11,0.2)'
                                : gift.rarity === 'mythic'
                                ? 'rgba(168,85,247,0.2)'
                                : gift.rarity === 'epic'
                                ? 'rgba(236,72,153,0.2)'
                                : 'rgba(56,189,248,0.2)',
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{
                              color:
                                gift.rarity === 'legendary'
                                  ? '#f59e0b'
                                  : gift.rarity === 'mythic'
                                  ? '#a855f7'
                                  : gift.rarity === 'epic'
                                  ? '#ec4899'
                                  : '#38bdf8',
                            }}
                          />
                        </div>
                        <RarityBadge rarity={gift.rarity} size="xs" />
                      </div>

                      <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {gift.name}
                      </h3>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {gift.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-500 uppercase font-semibold leading-none">
                          Стоимость
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-black flex items-center gap-1 mt-0.5 ${
                            isAdmin ? 'text-amber-300 font-mono' : 'text-purple-300'
                          }`}
                        >
                          <Star className="w-3 h-3 fill-current" />
                          {isAdmin ? '0 (∞)' : `${unitPrice}`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenBuy(gift)}
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-md active:scale-95 ${
                          canAfford
                            ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750 border border-zinc-700'
                        }`}
                      >
                        Купить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SEND GIFT TO FRIEND (Preserved functionality)                       */}
      {/* ========================================================================= */}
      {activeTab === 'send' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <form onSubmit={handleOpenSendConfirm} className="flex flex-col gap-4">
            {/* Step 1: Select Recipient */}
            <GlassCard className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[10px] text-amber-400">
                  1
                </span>
                <span>Кому отправить подарок:</span>
              </div>

              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm">
                  @
                </div>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  placeholder="никнейм игрока (например, frostking)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/60 transition-colors"
                />
              </div>

              {/* Quick Select from Leaderboard / All Players */}
              {allUsers.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-400 font-semibold">Игроки онлайн:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {allUsers
                      .filter((u) => u.username !== user?.username)
                      .slice(0, 10)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setRecipientUsername(u.username)}
                          className={`text-xs px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                            recipientUsername.toLowerCase() === u.username.toLowerCase()
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 font-bold'
                              : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          @{u.username}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Step 2: Select Item from Inventory */}
            <GlassCard className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[10px] text-amber-400">
                    2
                  </span>
                  <span>Выберите предмет из инвентаря:</span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Доступно: {giftableItems.length} видов
                </span>
              </div>

              {giftableItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <Gift className="w-8 h-8 text-zinc-600" />
                  <span>В вашем инвентаре пока нет предметов для передачи.</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="text-amber-400 underline cursor-pointer"
                  >
                    Перейти в Каталог и купить подарок за Points
                  </button>
                </div>
              ) : (
                <>
                  {giftableItems.length > 6 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="text"
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        placeholder="Поиск по предметам инвентаря..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {filteredGiftableItems.map((item) => {
                      const isSelected = selectedRewardId === item.id;
                      const Icon = ICON_MAP[item.icon] || Gift;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedRewardId(item.id)}
                          className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                            isSelected
                              ? 'bg-gradient-to-br from-rose-950/60 to-zinc-900 border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-7 h-7 rounded-xl bg-white/5 flex items-center justify-center text-white">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-300">
                              x{item.quantity}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-white line-clamp-1">{item.name}</div>
                            <RarityBadge rarity={item.rarity} size="xs" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </GlassCard>

            {/* Step 3: Message / Note */}
            <GlassCard className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[10px] text-amber-400">
                  3
                </span>
                <span>Новогоднее пожелание (необязательно):</span>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="С Новым Годом 2026! Желаю удачи и бесконечных спинов!"
                maxLength={200}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/60 resize-none transition-colors"
              />
              <span className="text-[10px] text-zinc-500 text-right">{message.length}/200</span>
            </GlassCard>

            {/* Submit button */}
            <GoldButton
              type="submit"
              disabled={isSending || giftableItems.length === 0}
              className="w-full py-3.5"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Отправка подарка...' : 'Отправить подарок другу 🎁'}</span>
            </GoldButton>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GIFTS HISTORY                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              История подарков
            </h3>
            <span className="text-xs text-zinc-500">{giftsHistory.length} записей</span>
          </div>

          {giftsHistory.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="История подарков пуста"
              description="Вы еще не отправляли и не получали подарков от других игроков."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {giftsHistory.map((g) => {
                const isSent = g.senderUsername === user?.username || g.senderId === user?.id;

                return (
                  <GlassCard key={g.id} className="p-3 flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center p-2 shrink-0 ${
                        isSent
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <Gift className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {isSent ? `Отправлено @${g.recipientUsername}` : `Получено от @${g.senderUsername}`}
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0">{g.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-black text-amber-300">{g.rewardName}</span>
                        {g.quantity > 1 && (
                          <span className="text-[10px] text-zinc-400 font-bold">x{g.quantity}</span>
                        )}
                        <RarityBadge rarity={g.rewardRarity || 'common'} size="xs" />
                      </div>

                      {g.message && (
                        <p className="text-[11px] text-zinc-300 mt-1 italic bg-white/5 p-2 rounded-xl border border-white/5">
                          «{g.message}»
                        </p>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Sending Gift */}
      <ConfirmModal
        isOpen={isConfirmSendModalOpen}
        onClose={() => setIsConfirmSendModalOpen(false)}
        onConfirm={executeSend}
        title="Подтверждение отправки"
        confirmText={isSending ? 'Отправка...' : 'Подтвердить отправку'}
        cancelText="Отмена"
        isDanger={false}
      >
        <div className="flex flex-col gap-2 text-left py-1 text-xs text-zinc-300">
          <p>
            Вы уверены, что хотите передать подарок игроку{' '}
            <strong className="text-white">@{recipientUsername.replace('@', '')}</strong>?
          </p>
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center gap-2.5 my-1">
            <Gift className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-white">{selectedItemMeta?.name}</div>
              <div className="text-[11px] text-zinc-400">Предмет будет передан безвозвратно</div>
            </div>
          </div>
          {message && (
            <p className="text-[11px] text-zinc-400 italic">С сообщением: «{message}»</p>
          )}
        </div>
      </ConfirmModal>

      {/* Confirmation Modal for Purchasing Gift */}
      {selectedItemForPurchase && (
        <ConfirmModal
          isOpen={Boolean(selectedItemForPurchase)}
          onClose={() => setSelectedItemForPurchase(null)}
          onConfirm={handleExecutePurchase}
          title="Купить подарок"
          confirmText={isProcessingPurchase ? 'Покупка...' : 'Купить за Points'}
          cancelText="Отмена"
          isDanger={false}
        >
          <div className="flex flex-col gap-3 py-1 text-left text-xs">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">{selectedItemForPurchase.name}</h4>
                <p className="text-[11px] text-zinc-400">{selectedItemForPurchase.description}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col gap-1.5">
              <div className="flex justify-between text-zinc-400">
                <span>Стоимость:</span>
                <span className="font-bold text-purple-300">
                  {isAdmin ? '0 Points (Бесплатно для Admin)' : `${selectedItemForPurchase.pricePoints} Points`}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Ваш баланс:</span>
                <span className="font-bold text-white">{isAdmin ? '∞ Points' : `${userPoints} Points`}</span>
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Insufficient Points Modal */}
      {insufficientPointsModal && (
        <ConfirmModal
          isOpen={Boolean(insufficientPointsModal)}
          onClose={() => setInsufficientPointsModal(null)}
          onConfirm={() => setInsufficientPointsModal(null)}
          title="Недостаточно Points"
          confirmText="Понятно"
          cancelText=""
        >
          <div className="flex flex-col gap-3 py-1 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-white">Не хватает Points для покупки</h4>
            <p className="text-xs text-zinc-400">
              Для приобретения подарка «{insufficientPointsModal.item?.name}» требуется{' '}
              <strong className="text-purple-300">{insufficientPointsModal.required} ⭐ Points</strong>,
              а на вашем балансе{' '}
              <strong className="text-amber-300">{insufficientPointsModal.current} ⭐ Points</strong>.
            </p>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

export default function GiftsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
          <Gift className="w-8 h-8 text-zinc-600 animate-pulse" />
          <span>Загрузка раздела подарков...</span>
        </div>
      }
    >
      <GiftsContent />
    </Suspense>
  );
}
