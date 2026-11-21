'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import RarityBadge from '../../components/ui/RarityBadge';
import GlassCard from '../../components/ui/GlassCard';
import EmptyState from '../../components/ui/EmptyState';
import FemboyBadge from '../../components/ui/FemboyBadge';
import { Activity, ArrowLeft, Crown, Coins, Flower, Gift, Award, Sparkles, Search, X } from 'lucide-react';

const ICON_MAP = {
  Crown,
  Coins,
  Flower,
  Gift,
  Award,
  Sparkles,
  ShieldAlert: Crown,
};

export default function FeedPage() {
  const { events } = useUserData();
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'titles' | 'uc' | 'gifts'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Category filter
      if (selectedFilter === 'titles' && evt.rewardCategory !== 'titles') return false;
      if (selectedFilter === 'uc' && evt.rewardCategory !== 'uc') return false;
      if (selectedFilter === 'gifts' && !evt.rewardName?.includes('ПОДАРОК') && evt.rewardCategory !== 'gifts') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesUser = evt.username?.toLowerCase().includes(q);
        const matchesReward = evt.rewardName?.toLowerCase().includes(q);
        return matchesUser || matchesReward;
      }

      return true;
    });
  }, [events, selectedFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-amber-400/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              Публичная Лента
            </h1>
            <p className="text-xs text-zinc-400">События и выигрыши игроков платформы</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>LIVE</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Поиск по никнейму или названию награды..."
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

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'Все события' },
          { id: 'titles', label: 'Титулы' },
          { id: 'uc', label: 'Выигрыши UC' },
          { id: 'gifts', label: 'Подарки' },
        ].map((tab) => {
          const isSelected = selectedFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Events List */}
      <div className="flex flex-col gap-2.5">
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="События не найдены"
            description="По заданным фильтрам нет событий в ленте."
            actionLabel="Сбросить фильтры"
            onAction={() => {
              setSelectedFilter('all');
              setSearchQuery('');
            }}
          />
        ) : (
          filteredEvents.map((evt) => {
            const Icon = ICON_MAP[evt.icon] || Sparkles;

            return (
              <GlassCard
                key={evt.id}
                className="p-3.5 flex items-center justify-between border border-amber-500/15 hover:border-amber-400/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-amber-300 flex items-center">
                        {evt.username}
                        <FemboyBadge titleId={evt.userTitleId || evt.active_title_id} size="xs" />
                      </span>
                      <span className="text-xs text-zinc-400">получил</span>
                      <span className="text-xs font-bold text-white">
                        {evt.rewardName}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-0.5">
                      {evt.createdAt}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  <RarityBadge rarity={evt.rewardRarity} size="xs" />
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
