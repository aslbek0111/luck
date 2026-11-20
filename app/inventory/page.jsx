'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import { TITLES_LIST } from '../../lib/catalog-data';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import EmptyState from '../../components/ui/EmptyState';
import Toast from '../../components/ui/Toast';
import {
  Package,
  Crown,
  Gift,
  ArrowLeft,
  Search,
  Check,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Send,
  RotateCcw,
  Star,
  Clock,
  Eye,
  Award,
  Flame,
  Flower,
  Smile,
  Baby,
  Wind,
  Bot,
  ShieldAlert,
  Coins,
  TreePine,
} from 'lucide-react';

const ICON_MAP = {
  Package,
  Crown,
  Gift,
  RotateCcw,
  Star,
  Award,
  Flame,
  Flower,
  Flower2: Flower,
  Smile,
  Baby,
  Wind,
  Bot,
  ShieldAlert,
  Coins,
  TreePine,
  Sparkles,
};

export default function InventoryPage() {
  const { user, stats, inventory, activeTitle, equipTitle, unequipTitle, purchasesHistory, useInventoryItem } = useUserData();
  const { triggerHaptic } = useTelegram();

  // Tabs: 'all' | 'titles' | 'gifts' | 'history'
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [equippingId, setEquippingId] = useState(null);
  const [usingItemId, setUsingItemId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Handle consumable item usage
  const handleUseItem = async (item) => {
    if (!item || usingItemId) return;
    setUsingItemId(item.id);
    try {
      const res = await useInventoryItem(item.id, 1);
      if (res.success) {
        setToastMessage({
          type: 'success',
          text: res.message || `Предмет «${item.name}» успешно использован!`,
        });
      } else {
        setToastMessage({
          type: 'error',
          text: res.error || 'Не удалось использовать предмет',
        });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.message || 'Ошибка при использовании предмета',
      });
    } finally {
      setUsingItemId(null);
    }
  };

  // Split inventory into titles and gifts
  const inventoryTitles = useMemo(() => {
    return inventory.filter((item) => item.isTitle || item.category === 'titles');
  }, [inventory]);

  const inventoryGifts = useMemo(() => {
    return inventory.filter((item) => !item.isTitle && item.category !== 'titles');
  }, [inventory]);

  // Filter items based on activeTab and searchQuery
  const displayItems = useMemo(() => {
    let list = [];
    if (activeTab === 'all') {
      list = inventory;
    } else if (activeTab === 'titles') {
      list = inventoryTitles;
    } else if (activeTab === 'gifts') {
      list = inventoryGifts;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((it) => (it.name || '').toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q));
  }, [activeTab, inventory, inventoryTitles, inventoryGifts, searchQuery]);

  // Handle title equip / unequip
  const handleToggleEquip = async (titleItem) => {
    const isCurrentlyEquipped = activeTitle?.id === titleItem.id || activeTitle?.slug === titleItem.slug;
    setEquippingId(titleItem.id);

    try {
      if (isCurrentlyEquipped) {
        await unequipTitle();
        triggerHaptic('medium');
        setToastMessage({
          type: 'success',
          text: `Титул «${titleItem.name}» снят`,
        });
      } else {
        await equipTitle(titleItem.id);
        triggerHaptic('success');
        setToastMessage({
          type: 'success',
          text: `Титул «${titleItem.name}» успешно экипирован и сохранен в базе!`,
        });
      }
    } catch {
      triggerHaptic('error');
    } finally {
      setEquippingId(null);
    }
  };

  const totalItemCount = inventory.reduce((sum, item) => sum + (item.quantity || 1), 0);

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
              <Package className="w-5 h-5 text-emerald-400" />
              Мой Инвентарь
            </h1>
            <p className="text-xs text-zinc-400">
              Купленные подарки, смена титулов и история покупок 🎒
            </p>
          </div>
        </div>

        <Link
          href="/shop"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition-all shadow-sm"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>В Магазин</span>
        </Link>
      </div>

      {/* Active Title Banner if equipped */}
      {activeTitle && (
        <div
          className="relative overflow-hidden rounded-3xl p-4 border flex items-center justify-between shadow-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(18,18,24,0.95), rgba(12,12,18,0.9))',
            borderColor: `${activeTitle.accentColor || '#f59e0b'}55`,
            boxShadow: `0 0 25px ${activeTitle.accentColor || '#f59e0b'}25`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center p-2 border shadow-sm"
              style={{
                backgroundColor: `${activeTitle.accentColor || '#f59e0b'}20`,
                borderColor: `${activeTitle.accentColor || '#f59e0b'}60`,
              }}
            >
              <Crown className="w-5 h-5" style={{ color: activeTitle.accentColor || '#f59e0b' }} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-semibold">
                <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                Активный титул профиля:
              </div>
              <span
                className="text-base font-black uppercase tracking-wider"
                style={{ color: activeTitle.accentColor || '#f59e0b' }}
              >
                {activeTitle.name}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleToggleEquip(activeTitle)}
            type="button"
            className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
          >
            Снять
          </button>
        </div>
      )}

      {/* Inventory Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Все ({totalItemCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('titles')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'titles'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Титулы ({inventoryTitles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gifts')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'gifts'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Подарки ({inventoryGifts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Покупки ({purchasesHistory.length})</span>
        </button>
      </div>

      {/* Search Input for items */}
      {activeTab !== 'history' && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по инвентарю..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 transition-colors"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* ITEMS LIST (All / Titles / Gifts)                                         */}
      {/* ========================================================================= */}
      {activeTab !== 'history' && (
        <div>
          {displayItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-3">
              <Package className="w-12 h-12 text-zinc-700" />
              <span>В этой вкладке пока нет предметов.</span>
              <Link href="/shop">
                <GoldButton variant="gold" size="sm">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Перейти в Магазин 🎁</span>
                </GoldButton>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayItems.map((item) => {
                const Icon = ICON_MAP[item.icon] || Package;
                const isTitle = item.isTitle || item.category === 'titles';
                const isEquipped = isTitle && (activeTitle?.id === item.id || activeTitle?.slug === item.titleSlug);
                const isConsumable =
                  !isTitle &&
                  (['spins', 'uc', 'coins', 'popularity'].includes(item.category) ||
                    String(item.id).startsWith('reward-spin-') ||
                    String(item.id).startsWith('reward-uc-') ||
                    String(item.id).startsWith('reward-coins-') ||
                    String(item.id).startsWith('reward-pop-'));

                return (
                  <GlassCard
                    key={item.id}
                    className={`p-4 flex flex-col justify-between gap-3 relative overflow-hidden transition-all ${
                      isEquipped
                        ? 'border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                        : 'border-zinc-800/80 hover:border-zinc-750'
                    }`}
                  >
                    {/* Equipped Badge */}
                    {isEquipped && (
                      <div className="absolute top-0 right-0 z-10 bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl shadow-md flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> Активен
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 shrink-0 border"
                        style={{
                          backgroundColor:
                            item.rarity === 'legendary'
                              ? 'rgba(245,158,11,0.2)'
                              : item.rarity === 'mythic'
                              ? 'rgba(168,85,247,0.2)'
                              : item.rarity === 'epic'
                              ? 'rgba(236,72,153,0.2)'
                              : 'rgba(56,189,248,0.2)',
                          borderColor:
                            item.rarity === 'legendary'
                              ? 'rgba(245,158,11,0.4)'
                              : item.rarity === 'mythic'
                              ? 'rgba(168,85,247,0.4)'
                              : item.rarity === 'epic'
                              ? 'rgba(236,72,153,0.4)'
                              : 'rgba(56,189,248,0.4)',
                        }}
                      >
                        <Icon
                          className="w-6 h-6"
                          style={{
                            color:
                              item.rarity === 'legendary'
                                ? '#f59e0b'
                                : item.rarity === 'mythic'
                                ? '#a855f7'
                                : item.rarity === 'epic'
                                ? '#ec4899'
                                : '#38bdf8',
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-white truncate">{item.name}</h3>
                          <RarityBadge rarity={item.rarity} size="xs" />
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                          {item.description || item.conditions || 'Предмет инвентаря'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span className="font-semibold">Количество:</span>
                        <span className="font-mono font-black text-white bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-700/60">
                          x{item.quantity || 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isTitle ? (
                          <button
                            onClick={() => handleToggleEquip(item)}
                            disabled={equippingId === item.id}
                            type="button"
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              isEquipped
                                ? 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:brightness-110 shadow-md font-black'
                            }`}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>
                              {equippingId === item.id
                                ? 'Сохранение...'
                                : isEquipped
                                ? 'Снять титул'
                                : 'Экипировать'}
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {isConsumable && (
                              <button
                                onClick={() => handleUseItem(item)}
                                disabled={usingItemId === item.id}
                                type="button"
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{usingItemId === item.id ? '...' : 'Использовать'}</span>
                              </button>
                            )}
                            <Link
                              href={`/gifts?tab=send&item=${item.id}`}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all flex items-center gap-1"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Подарить</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PURCHASES HISTORY                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Все покупки в магазине
            </h3>
            <span className="text-xs text-zinc-500">{purchasesHistory.length} записей</span>
          </div>

          {purchasesHistory.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="История покупок пуста"
              description="Вы еще не совершали покупок в магазине за Points."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {purchasesHistory.map((p) => {
                const isTitle = p.itemType === 'title' || p.item_type === 'title';
                const cost = p.costPoints ?? p.cost_points ?? 0;
                const isAdminBuy = p.isAdminPurchase || p.is_admin_purchase;

                return (
                  <GlassCard key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center p-2 shrink-0 ${
                          isTitle
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isTitle ? <Crown className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {p.itemName || p.item_name}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-bold">
                            x{p.quantity || 1}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(p.createdAt || p.created_at).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-black flex items-center gap-1 justify-end ${
                          isAdminBuy ? 'text-amber-300 font-mono' : 'text-purple-300'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {isAdminBuy ? '0 ⭐ (Admin)' : `-${cost} ⭐`}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-semibold block">
                        Успешно
                      </span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
