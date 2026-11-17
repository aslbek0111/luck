'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { CATEGORIES, REWARDS_CATALOG } from '../../lib/catalog-data';
import { useUserData } from '../../hooks/useUserData';
import RarityBadge from '../../components/ui/RarityBadge';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import EmptyState from '../../components/ui/EmptyState';
import {
  Sparkles,
  Coins,
  Flame,
  Flower,
  Smile,
  RotateCcw,
  Crown,
  ArrowLeft,
  Gift,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  X,
  TreePine,
} from 'lucide-react';

const ICON_MAP = {
  Sparkles,
  Coins,
  Flame,
  Flower,
  Flower2: Flower,
  Smile,
  RotateCcw,
  Crown,
  Gift,
  TreePine,
};

const RARITY_ORDER = {
  legendary: 5,
  mythic: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

export default function CollectionPage() {
  const { inventory } = useUserData();
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwned, setFilterOwned] = useState('all'); // 'all' | 'owned' | 'unowned'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'rarity_desc' | 'rarity_asc' | 'quantity'

  // Map inventory to map for fast lookup
  const inventoryMap = useMemo(() => {
    const map = new Map();
    inventory.forEach((item) => {
      map.set(item.id, item.quantity || 1);
    });
    return map;
  }, [inventory]);

  // Overall collection stats
  const totalCatalogCount = REWARDS_CATALOG.length;
  const uniqueOwnedCount = useMemo(() => {
    return REWARDS_CATALOG.filter((it) => (inventoryMap.get(it.id) || 0) > 0).length;
  }, [inventoryMap]);
  const progressPercent = Math.round((uniqueOwnedCount / totalCatalogCount) * 100);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let items = REWARDS_CATALOG.filter((item) => {
      // Category filter
      if (selectedCat !== 'all' && item.category !== selectedCat) return false;

      // Ownership filter
      const qty = inventoryMap.get(item.id) || 0;
      if (filterOwned === 'owned' && qty === 0) return false;
      if (filterOwned === 'unowned' && qty > 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = (item.description || '').toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }

      return true;
    });

    // Sorting
    if (sortBy === 'rarity_desc') {
      items.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
    } else if (sortBy === 'rarity_asc') {
      items.sort((a, b) => (RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0));
    } else if (sortBy === 'quantity') {
      items.sort((a, b) => (inventoryMap.get(b.id) || 0) - (inventoryMap.get(a.id) || 0));
    }

    return items;
  }, [selectedCat, filterOwned, searchQuery, sortBy, inventoryMap]);

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
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
              <Sparkles className="w-5 h-5 text-amber-400" />
              Коллекция Наград
            </h1>
            <p className="text-xs text-zinc-400">
              Каталог всех 25 предметов, титулов и сувениров
            </p>
          </div>
        </div>

        <Link href="/spin">
          <GoldButton size="sm" icon={RotateCcw}>
            Спин
          </GoldButton>
        </Link>
      </div>

      {/* Progress Card */}
      <div className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-r from-zinc-900/90 via-zinc-950 to-black border border-amber-500/25 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            Прогресс сбора коллекции
          </span>
          <span className="text-xs font-black text-amber-300 font-mono">
            {uniqueOwnedCount} / {totalCatalogCount} ({progressPercent}%)
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-500 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.6)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Search Bar & Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-zinc-500 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter: All / Owned / Unowned */}
          <select
            value={filterOwned}
            onChange={(e) => setFilterOwned(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">Все статусы</option>
            <option value="owned">Только в наличии</option>
            <option value="unowned">Еще не получены</option>
          </select>

          {/* Sort filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="default">Сортировка: по умолчанию</option>
            <option value="rarity_desc">Редкость: от легендарных</option>
            <option value="rarity_asc">Редкость: от обычных</option>
            <option value="quantity">По количеству копий</option>
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Rewards Grid */}
      {displayItems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Предметы не найдены"
          description="По заданным фильтрам и поисковому запросу ничего не найдено. Попробуйте сбросить фильтры."
          actionLabel="Сбросить фильтры"
          onAction={() => {
            setSearchQuery('');
            setSelectedCat('all');
            setFilterOwned('all');
            setSortBy('default');
          }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || Sparkles;
            const quantity = inventoryMap.get(item.id) || 0;
            const hasItem = quantity > 0;

            return (
              <GlassCard
                key={item.id}
                className={`p-3.5 flex flex-col justify-between border transition-all duration-200 ${
                  hasItem
                    ? 'border-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                    : 'border-zinc-800/80 opacity-60 hover:opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        hasItem
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                          : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <RarityBadge rarity={item.rarity} size="xs" />
                  </div>

                  <h3 className="text-sm font-black text-white line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-xs">
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      hasItem ? 'text-amber-300' : 'text-zinc-500'
                    }`}
                  >
                    {hasItem ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {quantity} шт.
                      </>
                    ) : (
                      'Не получено'
                    )}
                  </span>

                  {quantity > 1 && (
                    <Link href={`/gifts?item=${item.id}`}>
                      <span className="text-[10px] text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-all flex items-center gap-1 shadow-sm">
                        <Gift className="w-3 h-3 text-amber-400" /> Подарить
                      </span>
                    </Link>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
``    </div>
  );
}
