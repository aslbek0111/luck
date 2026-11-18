'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import { getShopItems, getShopGifts, getShopTitles, CATEGORIES } from '../../lib/catalog-data';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Toast from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import {
  ShoppingBag,
  Star,
  Crown,
  Gift,
  ArrowLeft,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  ShieldCheck,
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
  Ghost,
  Swords,
  Shield,
} from 'lucide-react';

const ICON_MAP = {
  ShoppingBag,
  Star,
  Crown,
  Gift,
  Coins,
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
  Sparkle: Sparkles,
  Ghost,
  Swords,
  Shield,
};

export default function ShopPage() {
  const { user, stats, buyShopItem, inventory, setIsBrowserAuthModalOpen } = useUserData();
  const { triggerHaptic } = useTelegram();

  // Navigation & filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'gifts' | 'titles' | 'pro-epic'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Purchase modal & state
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  // Notifications
  const [toastMessage, setToastMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [insufficientPointsModal, setInsufficientPointsModal] = useState(null); // { item, required, current }

  const isAdmin = Boolean(user?.is_admin);
  const userCoins = isAdmin ? Infinity : stats.coinsBalance ?? user?.coins_balance ?? user?.points_balance ?? 1000;
  const userPoints = userCoins;

  // Filtered shop items
  const filteredItems = useMemo(() => {
    let items = [];
    if (activeTab === 'all') {
      items = getShopItems();
    } else if (activeTab === 'gifts') {
      items = getShopGifts().map((g) => ({ ...g, itemType: 'gift' }));
    } else if (activeTab === 'titles') {
      items = getShopTitles().map((t) => ({ ...t, itemType: 'title' }));
    } else if (activeTab === 'pro-epic') {
      items = getShopTitles().filter((t) => t.rarity === 'pro-epic').map((t) => ({ ...t, itemType: 'title' }));
    }

    return items.filter((item) => {
      // Category filter (only applicable when tab is not 'titles' or matches)
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'pro-epic') {
          if (item.rarity !== 'pro-epic') return false;
        } else if (item.category !== selectedCategory && item.rarity !== selectedCategory) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [activeTab, selectedCategory, searchQuery]);

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#06b6d4', '#f59e0b', '#fbbf24', '#38bdf8', '#ec4899', '#10b981'],
      });
    } catch {
      // Non-critical
    }
  };

  // Open confirm purchase modal
  const handleOpenBuy = (item) => {
    if (!user) {
      setIsBrowserAuthModalOpen(true);
      return;
    }

    const unitCost = item.priceCoins || item.pricePoints || 100;
    const totalCost = isAdmin ? 0 : unitCost;

    if (!isAdmin && userCoins < totalCost) {
      triggerHaptic('error');
      setInsufficientPointsModal({
        item,
        required: totalCost,
        current: userCoins,
      });
      return;
    }

    triggerHaptic('selection');
    setSelectedItemForPurchase(item);
    setPurchaseQuantity(1);
  };

  // Execute purchase
  const handleExecutePurchase = async () => {
    if (!selectedItemForPurchase) return;
    setIsProcessingPurchase(true);

    const result = await buyShopItem({
      itemId: selectedItemForPurchase.id,
      quantity: purchaseQuantity,
    });

    setIsProcessingPurchase(false);
    setSelectedItemForPurchase(null);

    if (result.success) {
      triggerConfetti();
      triggerHaptic('success');
      setToastMessage({
        type: 'success',
        text: `Покупка завершена! «${selectedItemForPurchase.name}» добавлен в ваш Инвентарь.`,
      });
    } else {
      triggerHaptic('error');
      if (result.requiredCoins || result.requiredPoints) {
        setInsufficientPointsModal({
          item: selectedItemForPurchase,
          required: result.requiredCoins || result.requiredPoints,
          current: result.currentCoins ?? result.currentPoints ?? userCoins,
        });
      } else {
        setToastMessage({
          type: 'error',
          text: result.error || 'Не удалось совершить покупку',
        });
      }
    }
  };

  // Count items already in user inventory
  const getOwnedQuantity = (itemId) => {
    const entry = inventory.find((it) => it.id === itemId || it.rewardId === itemId);
    return entry?.quantity || 0;
  };

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Top Header */}
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
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Магазин Подарков и Титулов
            </h1>
            <p className="text-xs text-zinc-400">Подарки, сувениры и PRO-EPIC титулы за Монеты 🪙</p>
          </div>
        </div>

        {/* User Balance Header Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border ${
            isAdmin
              ? 'bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 border-amber-300/60 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-zinc-900/90 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isAdmin ? 'bg-amber-400/30 text-amber-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            <Coins className="w-3.5 h-3.5 fill-current" />
          </div>
          <div className="flex flex-col text-right">
            <span
              className={`text-sm font-black leading-none ${
                isAdmin ? 'text-amber-300 text-base' : 'text-amber-200'
              }`}
            >
              {isAdmin ? '∞' : userCoins}
            </span>
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              {isAdmin ? 'UNLIMITED' : 'МОНЕТ'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Unlimited Notice Banner */}
      {isAdmin && (
        <div className="relative overflow-hidden rounded-2xl p-3.5 border border-amber-400/40 bg-gradient-to-r from-amber-950/60 via-zinc-900/90 to-amber-950/60 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <span>ADMIN UNLIMITED COINS & POINTS</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-400/40">
                  АКТИВНО
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                У вас права администратора: любые подарки и титулы приобретаются без списания Монет (0 🪙).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs (All / Gifts / Titles / PRO-EPIC) */}
      <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800">
        <button
          onClick={() => {
            setActiveTab('all');
            setSelectedCategory('all');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Все товары</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('gifts');
            setSelectedCategory('all');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'gifts'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Подарки 🎁</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('titles');
            setSelectedCategory('all');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'titles'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Титулы 👑</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('pro-epic');
            setSelectedCategory('all');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
            activeTab === 'pro-epic'
              ? 'bg-gradient-to-r from-cyan-500 via-sky-400 to-fuchsia-500 text-black font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.5)] border-cyan-300'
              : 'bg-cyan-950/30 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>PRO-EPIC ⚡</span>
        </button>
      </div>

      {/* PRO-EPIC Featured Showcase Header */}
      {(activeTab === 'pro-epic' || (activeTab === 'titles' && selectedCategory === 'pro-epic')) && (
        <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-cyan-400/60 bg-gradient-to-r from-cyan-950/70 via-indigo-950/80 to-fuchsia-950/70 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
                <Zap className="w-6 h-6 fill-current animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black">
                    Эксклюзив
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300">
                    КОЛЛЕКЦИЯ PRO-EPIC ТИТУЛОВ
                  </h3>
                </div>
                <p className="text-xs text-zinc-300 mt-1 max-w-xl leading-relaxed">
                  5 уникальных статусов: <strong>ФЕНИКС</strong>, <strong>ПРИЗРАК</strong>, <strong>ДОМИНАТОР</strong>, <strong>ТИТАН</strong> и <strong>ОВЕРЛОРД</strong>. Неоновые градиенты, персональные иконки и отображение рядом с никнеймом в лидерборде!
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Диапазон цен</span>
              <span className="text-sm font-black text-amber-300 font-mono flex items-center gap-1 justify-end">
                <Coins className="w-4 h-4 fill-current" />
                1200 – 1800 Монет
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Category Pills for Titles */}
      {activeTab === 'titles' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Все титулы
          </button>
          <button
            onClick={() => setSelectedCategory('pro-epic')}
            className={`px-3 py-1 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'pro-epic'
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:border-cyan-300'
            }`}
          >
            ⚡ PRO-EPIC (5)
          </button>
          <button
            onClick={() => setSelectedCategory('rare')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'rare'
                ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Редкие
          </button>
          <button
            onClick={() => setSelectedCategory('epic')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'epic'
                ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Эпические
          </button>
          <button
            onClick={() => setSelectedCategory('legendary')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'legendary'
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Легендарные
          </button>
          <button
            onClick={() => setSelectedCategory('mythic')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'mythic'
                ? 'bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Мифические
          </button>
        </div>
      )}

      {/* Sub-Category Pills (for gifts & all) */}
      {activeTab !== 'titles' && activeTab !== 'pro-epic' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Все категории
          </button>
          <button
            onClick={() => setSelectedCategory('christmas')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'christmas'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🎄 Новогодние
          </button>
          <button
            onClick={() => setSelectedCategory('roses')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'roses'
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🌹 Розы
          </button>
          <button
            onClick={() => setSelectedCategory('jokes')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'jokes'
                ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            😂 Шуточные
          </button>
          <button
            onClick={() => setSelectedCategory('popularity')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'popularity'
                ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🔥 Популярность
          </button>
          <button
            onClick={() => setSelectedCategory('spins')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategory === 'spins'
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🔄 Вращения
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по названию или описанию товара..."
          className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Товары не найдены"
          description="Попробуйте изменить поисковый запрос или выбрать другую категорию."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || Gift;
            const ownedQty = getOwnedQuantity(item.id);
            const unitPrice = item.priceCoins || item.pricePoints || 100;
            const canAfford = isAdmin || userCoins >= unitPrice;
            const isTitle = item.isTitle || item.itemType === 'title' || item.category === 'titles';
            const isProEpic = item.rarity === 'pro-epic';

            return (
              <div
                key={item.id}
                className={`glass-card rounded-3xl p-3.5 flex flex-col justify-between border transition-all group relative overflow-hidden ${
                  isProEpic
                    ? 'border-cyan-400/80 bg-gradient-to-br from-cyan-950/40 via-zinc-900/90 to-purple-950/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/30'
                    : 'border-zinc-800/80 hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                }`}
              >
                {/* Background aura glow */}
                <div
                  className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{
                    backgroundColor:
                      isProEpic
                        ? '#06b6d4'
                        : item.rarity === 'legendary'
                        ? '#f59e0b'
                        : item.rarity === 'mythic'
                        ? '#a855f7'
                        : item.rarity === 'epic'
                        ? '#ec4899'
                        : item.rarity === 'uncommon'
                        ? '#10b981'
                        : '#38bdf8',
                  }}
                />

                <div>
                  {/* Top: Icon + Rarity */}
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center p-2 group-hover:scale-105 transition-transform shadow-inner border border-white/5"
                      style={{
                        backgroundColor:
                          isProEpic
                            ? 'rgba(6,182,212,0.25)'
                            : item.rarity === 'legendary'
                            ? 'rgba(245,158,11,0.2)'
                            : item.rarity === 'mythic'
                            ? 'rgba(168,85,247,0.2)'
                            : item.rarity === 'epic'
                            ? 'rgba(236,72,153,0.2)'
                            : item.rarity === 'uncommon'
                            ? 'rgba(16,185,129,0.2)'
                            : 'rgba(56,189,248,0.2)',
                      }}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{
                          color:
                            isProEpic
                              ? '#06b6d4'
                              : item.rarity === 'legendary'
                              ? '#f59e0b'
                              : item.rarity === 'mythic'
                              ? '#a855f7'
                              : item.rarity === 'epic'
                              ? '#ec4899'
                              : item.rarity === 'uncommon'
                              ? '#10b981'
                              : '#38bdf8',
                        }}
                      />
                    </div>
                    <RarityBadge rarity={item.rarity} size="xs" />
                  </div>

                  {/* Title & Description */}
                  <h3
                    className={`text-xs sm:text-sm font-black transition-colors line-clamp-1 ${
                      isProEpic
                        ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300'
                        : 'text-white group-hover:text-amber-300'
                    }`}
                  >
                    {item.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.description || item.conditions || 'Новогодний сувенир'}
                  </p>

                  {/* Already in inventory badge */}
                  {ownedQty > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 w-fit">
                      <CheckCircle2 className="w-2.5 h-2.5" /> В инвентаре: {ownedQty}
                    </div>
                  )}
                </div>

                {/* Bottom: Price in Coins + Buy Button */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-semibold leading-none">
                      Цена
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-black flex items-center gap-1 mt-0.5 ${
                        isAdmin ? 'text-amber-300 font-mono' : isProEpic ? 'text-cyan-300 font-bold' : 'text-amber-300 font-bold'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 fill-current text-amber-400" />
                      {isAdmin ? '0 (∞)' : `${unitPrice}`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenBuy(item)}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-md active:scale-95 ${
                      canAfford
                        ? isProEpic
                          ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 text-black hover:brightness-110 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                          : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750 border border-zinc-700'
                    }`}
                  >
                    <span>{isTitle ? 'Купить' : 'Купить'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedItemForPurchase && (
        <ConfirmModal
          isOpen={Boolean(selectedItemForPurchase)}
          onClose={() => setSelectedItemForPurchase(null)}
          onConfirm={handleExecutePurchase}
          title="Подтверждение покупки"
          confirmText={isProcessingPurchase ? 'Покупка...' : 'Подтвердить и купить'}
          cancelText="Отмена"
          isDanger={false}
        >
          <div className="flex flex-col gap-3 py-1 text-left">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                {(() => {
                  const Icon = ICON_MAP[selectedItemForPurchase.icon] || Gift;
                  return <Icon className="w-6 h-6" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white truncate">
                    {selectedItemForPurchase.name}
                  </h4>
                  <RarityBadge rarity={selectedItemForPurchase.rarity} size="xs" />
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                  {selectedItemForPurchase.description}
                </p>
              </div>
            </div>

            {/* Price & Balance calculation */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Стоимость товара:</span>
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 fill-current text-amber-400" />
                  {isAdmin
                    ? '0 Монет (Бесплатно для Admin)'
                    : `${selectedItemForPurchase.priceCoins || selectedItemForPurchase.pricePoints} Монет`}
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span>Ваш текущий баланс:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 fill-current text-amber-400" />
                  {isAdmin ? '∞ Монет' : `${userCoins} Монет`}
                </span>
              </div>

              {!isAdmin && (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-zinc-300 font-semibold">
                  <span>Остаток после покупки:</span>
                  <span className="font-black text-emerald-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 fill-current text-amber-400" />
                    {userCoins - (selectedItemForPurchase.priceCoins || selectedItemForPurchase.pricePoints || 100)} Монет
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              После подтверждения товар будет немедленно добавлен в ваш постоянный Инвентарь.
            </p>
          </div>
        </ConfirmModal>
      )}

      {/* Insufficient Coins Modal */}
      {insufficientPointsModal && (
        <ConfirmModal
          isOpen={Boolean(insufficientPointsModal)}
          onClose={() => setInsufficientPointsModal(null)}
          onConfirm={() => setInsufficientPointsModal(null)}
          title="Недостаточно Монет"
          confirmText="Понятно"
          cancelText=""
        >
          <div className="flex flex-col gap-3 py-1 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h4 className="text-sm font-black text-white">
              Не хватает Монет для покупки
            </h4>

            <p className="text-xs text-zinc-400">
              Для приобретения товара «{insufficientPointsModal.item?.name}» требуется{' '}
              <strong className="text-amber-300">{insufficientPointsModal.required} 🪙 Монет</strong>,
              а на вашем балансе сейчас всего{' '}
              <strong className="text-rose-400">{insufficientPointsModal.current} 🪙 Монет</strong>.
            </p>

            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-left text-xs text-zinc-300 flex flex-col gap-1.5 mt-1">
              <span className="font-bold text-amber-300">Как заработать больше Монет?</span>
              <span>• Крутите Колесо Фортуны — выигрывайте 25, 50, 75 или 125 Монет за спин!</span>
              <span>• Выполняйте ежедневные задания и открывайте достижения.</span>
              <span>• Получайте подарки и сувениры от друзей.</span>
            </div>

            <div className="pt-2">
              <Link
                href="/spin"
                className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black flex items-center justify-center gap-2 hover:brightness-110 shadow-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Крутить Колесо Фортуны
              </Link>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
