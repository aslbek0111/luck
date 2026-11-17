'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import GlassCard from '../../components/ui/GlassCard';
import { ListItemSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { Trophy, ArrowLeft, Flame, RotateCcw, Coins, Medal, Search, X, Crown } from 'lucide-react';

export default function LeaderboardPage() {
  const { user, allUsers } = useUserData();
  const [leaders, setLeaders] = useState(allUsers || []);
  const [sortBy, setSortBy] = useState('popularity'); // 'popularity' | 'spins' | 'uc'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(!allUsers || allUsers.length === 0);

  useEffect(() => {
    let ignore = false;
    async function loadLeaders() {
      try {
        if (!allUsers || allUsers.length === 0) {
          setLoading(true);
        }
        const res = await fetch('/api/leaderboard');
        if (res.ok && !ignore) {
          const data = await res.json();
          if (data.leaders) {
            setLeaders(data.leaders);
          }
        }
      } catch (err) {
        console.warn('Leaderboard error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadLeaders();
    return () => {
      ignore = true;
    };
  }, [allUsers]);

  const sortedLeaders = useMemo(() => {
    const list = [...leaders].sort((a, b) => {
      if (sortBy === 'spins') return (b.spinsCount || 0) - (a.spinsCount || 0);
      if (sortBy === 'uc') return (b.totalUc || 0) - (a.totalUc || 0);
      return (b.popularity || 0) - (a.popularity || 0);
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => p.username.toLowerCase().includes(q));
  }, [leaders, sortBy, searchQuery]);

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
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
              <Trophy className="w-5 h-5 text-amber-400" />
              Таблица Лидеров
            </h1>
            <p className="text-xs text-zinc-400">Лучшие игроки сезона LUCKY UC</p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Поиск игрока в рейтинге по @username..."
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
      <div className="flex gap-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'popularity', label: 'По популярности', icon: Flame },
          { id: 'spins', label: 'По вращениям', icon: RotateCcw },
          { id: 'uc', label: 'По балансу UC', icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = sortBy === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSortBy(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Leaderboard List */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : sortedLeaders.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Игроки не найдены"
            description="По вашему запросу не найдено ни одного игрока в рейтинге."
            actionLabel="Сбросить поиск"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          sortedLeaders.map((player, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            const isCurrentUser = user && player.id === user.id;

            const rankBadge =
              rank === 1
                ? 'text-yellow-300 border-yellow-400/60 bg-gradient-to-br from-yellow-500/30 to-amber-600/20 shadow-[0_0_15px_rgba(234,179,8,0.35)]'
                : rank === 2
                ? 'text-zinc-200 border-zinc-400/60 bg-gradient-to-br from-zinc-400/30 to-zinc-600/20 shadow-[0_0_15px_rgba(161,161,170,0.35)]'
                : rank === 3
                ? 'text-amber-500 border-amber-600/60 bg-gradient-to-br from-amber-600/30 to-amber-800/20 shadow-[0_0_15px_rgba(217,119,6,0.35)]'
                : 'text-zinc-500 border-zinc-800 bg-zinc-900/60';

            return (
              <GlassCard
                key={player.id}
                className={`p-3.5 flex items-center justify-between border transition-all duration-200 ${
                  isCurrentUser
                    ? 'border-amber-400/70 bg-amber-500/[0.04] shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                    : rank === 1
                    ? 'border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : 'border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={`w-8 h-8 rounded-2xl flex items-center justify-center font-black text-xs border shrink-0 ${rankBadge}`}
                  >
                    {isTop3 ? <Medal className="w-4 h-4" /> : rank}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full overflow-hidden shrink-0 bg-zinc-900 shadow-sm ${
                      player.is_vip || player.isVip
                        ? 'vip-golden-frame'
                        : 'border-2 border-amber-400/60'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={player.username}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name & Active Title */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-white">
                        @{player.username}
                      </span>
                      {(player.is_vip || player.isVip) && (
                        <span className="text-[9px] bg-gradient-to-r from-amber-400 to-yellow-300 text-black font-black px-1.5 py-0.2 rounded shadow-sm flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> VIP
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="text-[9px] bg-amber-500 text-black font-black px-1.5 py-0.2 rounded shadow-sm">
                          ВЫ
                        </span>
                      )}
                      {player.isAdmin && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                          Admin
                        </span>
                      )}
                    </div>

                    {player.activeTitle ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider block mt-0.5"
                        style={{ color: player.activeTitle.accentColor }}
                      >
                        {player.activeTitle.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Без титула
                      </span>
                    )}
                  </div>
                </div>

                {/* Score Column */}
                <div className="text-right">
                  <div className="text-sm font-black text-white">
                    {sortBy === 'spins'
                      ? `${player.spinsCount} спинов`
                      : sortBy === 'uc'
                      ? `${player.totalUc} UC`
                      : `${player.popularity} очков`}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {sortBy === 'popularity' ? 'Популярность' : sortBy === 'spins' ? 'Вращений' : 'Баланс'}
                  </span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
