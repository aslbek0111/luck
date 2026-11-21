'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import GlassCard from '../../components/ui/GlassCard';
import { ListItemSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import FemboyBadge from '../../components/ui/FemboyBadge';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  Trophy,
  ArrowLeft,
  Flame,
  Search,
  X,
  Crown,
  Medal,
  Sparkles,
  TreePine,
  RotateCcw,
  Users,
  Award,
  ChevronUp,
} from 'lucide-react';

export default function LeaderboardPage() {
  const { user } = useUserData();
  const [leaders, setLeaders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch verified global leaderboard from single source of truth
  const fetchLeaders = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.leaders)) {
          setLeaders(data.leaders);
        }
      }
    } catch (err) {
      console.warn('Leaderboard fetch notice:', err);
    } finally {
      setLoading(false);
      if (showRefreshing) setIsRefreshing(false);
    }
  }, []);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    let ignore = false;

    const loadInitial = async () => {
      try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success && Array.isArray(data.leaders)) {
            setLeaders(data.leaders);
          }
        }
      } catch (err) {
        console.warn('Leaderboard fetch notice:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    // Supabase Realtime subscription
    let channel = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel('realtime:leaderboard')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users' },
            () => {
              fetchLeaders();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'popularity_transactions' },
            () => {
              fetchLeaders();
            }
          )
          .subscribe();
      } catch (subErr) {
        console.warn('Supabase Realtime subscription notice:', subErr);
      }
    }

    // Live reactive polling every 4 seconds to guarantee real-time sync across all devices
    const interval = setInterval(() => {
      fetchLeaders();
    }, 4000);

    // Refresh when user returns to tab
    const handleFocus = () => fetchLeaders();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [fetchLeaders]);

  // Rank sorting:
  // 1. Total PP descending (highest PP is always #1)
  // 2. Most recent achievement time descending (popularityUpdatedAt)
  const rankedLeaders = useMemo(() => {
    const list = [...leaders].sort((a, b) => {
      const ppA = a.pp ?? a.popularity ?? 0;
      const ppB = b.pp ?? b.popularity ?? 0;
      if (ppB !== ppA) {
        return ppB - ppA;
      }
      const timeA = a.popularityUpdatedAt ? new Date(a.popularityUpdatedAt).getTime() : 0;
      const timeB = b.popularityUpdatedAt ? new Date(b.popularityUpdatedAt).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return 0;
    });

    return list.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
  }, [leaders]);

  // Filtered by search query
  const filteredLeaders = useMemo(() => {
    if (!searchQuery.trim()) return rankedLeaders;
    const q = searchQuery.toLowerCase().trim();
    return rankedLeaders.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.firstName && p.firstName.toLowerCase().includes(q))
    );
  }, [rankedLeaders, searchQuery]);

  // Find currently logged-in user's position in global rankings
  const currentUserEntry = useMemo(() => {
    if (!user) return null;
    return rankedLeaders.find((p) => p.id === user.id) || null;
  }, [rankedLeaders, user]);

  // Points needed to reach next rank
  const pointsToNextRank = useMemo(() => {
    if (!currentUserEntry || currentUserEntry.rank === 1) return 0;
    const playerAbove = rankedLeaders.find((p) => p.rank === currentUserEntry.rank - 1);
    if (!playerAbove) return 0;
    const diff = (playerAbove.pp ?? playerAbove.popularity ?? 0) - (currentUserEntry.pp ?? currentUserEntry.popularity ?? 0);
    return Math.max(1, diff);
  }, [currentUserEntry, rankedLeaders]);

  const totalPlayersCount = rankedLeaders.length;

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
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Таблица Лидеров PP</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                🎄 2026
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Глобальный рейтинг популярности игроков в реальном времени</p>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => fetchLeaders(true)}
          disabled={isRefreshing}
          className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-400/40 transition-all cursor-pointer"
          title="Обновить рейтинг"
        >
          <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Stats Counter & Rules Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800/80 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <span className="text-zinc-300 font-bold">Всего в рейтинге:</span>
          <span className="font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
            {totalPlayersCount} игроков
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>Сортировка по PP</span>
        </div>
      </div>

      {/* Currently Logged-in User Position Banner */}
      {user && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-600/15 border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-black font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                {currentUserEntry ? `#${currentUserEntry.rank}` : '—'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">Ваша позиция</span>
                  <span className="text-[9px] bg-amber-400 text-black font-black px-1.5 py-0.2 rounded">ВЫ</span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  {currentUserEntry ? (
                    <>
                      Ранг <strong className="text-amber-300">#{currentUserEntry.rank}</strong> из{' '}
                      {totalPlayersCount} участников
                    </>
                  ) : (
                    'Вы еще не получили первые очки PP'
                  )}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm sm:text-base font-black text-amber-300 flex items-center justify-end gap-1">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{currentUserEntry ? (currentUserEntry.pp ?? currentUserEntry.popularity ?? 0) : 0} PP</span>
              </div>
              {currentUserEntry && currentUserEntry.rank > 1 && pointsToNextRank > 0 && (
                <span className="text-[10px] text-zinc-400 flex items-center justify-end gap-0.5">
                  <ChevronUp className="w-3 h-3 text-emerald-400" />
                  +<strong>{pointsToNextRank} PP</strong> до #{currentUserEntry.rank - 1}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Поиск игрока по никнейму @username..."
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

      {/* Leaderboard List */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : filteredLeaders.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Игроки не найдены"
            description="В таблице лидеров пока нет игроков или ни один не совпал с поисковым запросом."
            actionLabel="Сбросить поиск"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          filteredLeaders.map((player) => {
            const rank = player.rank;
            const isRank1 = rank === 1;
            const isRank2 = rank === 2;
            const isRank3 = rank === 3;
            const isTop3 = rank <= 3;
            const isCurrentUser = user && player.id === user.id;

            // Visual Card Stying per Rank
            let cardClasses = 'border-zinc-800/80 hover:border-zinc-700 bg-zinc-900/60';
            let rankBadgeStyle = 'text-zinc-500 border-zinc-800 bg-zinc-900/80';
            let crownOrIcon = null;

            if (isRank1) {
              cardClasses =
                'border-amber-400/80 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-600/15 shadow-[0_0_30px_rgba(245,158,11,0.35)]';
              rankBadgeStyle =
                'text-yellow-300 border-yellow-400 bg-gradient-to-br from-yellow-500/50 via-amber-600/40 to-yellow-700/30 shadow-[0_0_20px_rgba(234,179,8,0.5)]';
              crownOrIcon = <Crown className="w-4 h-4 text-yellow-300 animate-bounce" />;
            } else if (isRank2) {
              cardClasses =
                'border-slate-300/70 bg-gradient-to-r from-slate-400/15 via-zinc-400/10 to-slate-500/10 shadow-[0_0_20px_rgba(203,213,225,0.25)]';
              rankBadgeStyle =
                'text-slate-200 border-slate-300 bg-gradient-to-br from-slate-300/40 via-zinc-400/30 to-slate-500/20 shadow-[0_0_15px_rgba(203,213,225,0.35)]';
              crownOrIcon = <Medal className="w-4 h-4 text-slate-200" />;
            } else if (isRank3) {
              cardClasses =
                'border-amber-600/60 bg-gradient-to-r from-amber-700/15 via-amber-800/10 to-amber-900/10 shadow-[0_0_20px_rgba(217,119,6,0.2)]';
              rankBadgeStyle =
                'text-amber-400 border-amber-600 bg-gradient-to-br from-amber-600/40 via-amber-700/30 to-amber-800/20 shadow-[0_0_15px_rgba(217,119,6,0.3)]';
              crownOrIcon = <Award className="w-4 h-4 text-amber-400" />;
            }

            if (isCurrentUser) {
              cardClasses += ' ring-2 ring-amber-400/80';
            }

            return (
              <GlassCard
                key={player.id}
                className={`p-3.5 flex items-center justify-between border transition-all duration-200 ${cardClasses}`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs border shrink-0 ${rankBadgeStyle}`}
                  >
                    {crownOrIcon || rank}
                  </div>

                  {/* Player Avatar */}
                  <div
                    className={`w-11 h-11 rounded-full overflow-hidden shrink-0 bg-zinc-900 relative shadow-md ${
                      player.isVip || player.is_vip
                        ? 'vip-golden-frame'
                        : isRank1
                        ? 'border-2 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]'
                        : 'border-2 border-amber-400/50'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={player.username}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name, VIP badge & Active Title */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-black flex items-center ${isRank1 ? 'text-yellow-300' : 'text-white'}`}>
                        @{player.username}
                        <FemboyBadge
                          titleId={player.activeTitle?.id || player.active_title_id}
                          titleSlug={player.activeTitle?.slug}
                          size="xs"
                        />
                      </span>

                      {isRank1 && (
                        <span className="text-[9px] bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black px-1.5 py-0.2 rounded shadow-sm flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> ТОП-1
                        </span>
                      )}

                      {(player.isVip || player.is_vip) && (
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
                        style={{ color: player.activeTitle.accentColor || '#f59e0b' }}
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

                {/* Popularity Points Column */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm sm:text-base font-black flex items-center justify-end gap-1 ${
                      isRank1 ? 'text-yellow-300 text-lg' : isRank2 ? 'text-slate-100' : isRank3 ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    <Flame className={`w-4 h-4 ${isRank1 ? 'text-yellow-400 fill-yellow-400' : 'text-rose-400 fill-rose-400'}`} />
                    <span>{player.pp ?? player.popularity ?? 0}</span>
                    <span className="text-[10px] font-bold text-zinc-400">PP</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
                    Популярность
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
