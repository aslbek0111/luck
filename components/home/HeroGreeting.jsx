'use client';

import React from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { Skeleton } from '../ui/Skeleton';
import { Sparkles, Trophy, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export default function HeroGreeting() {
  const { user, stats, isAuthLoading, setIsBrowserAuthModalOpen } = useUserData();

  if (isAuthLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black border border-amber-500/20 shadow-xl">
        <div className="flex flex-col gap-3">
          <Skeleton variant="text" className="w-32 h-5 rounded-full" />
          <Skeleton variant="text" className="w-48 h-8 mt-1" />
          <Skeleton variant="text" className="w-full max-w-sm h-4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black border border-amber-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
        <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gradient-to-br from-amber-500/15 via-yellow-400/5 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              🎄 НОВОГОДНЯЯ ПЛАТФОРМА НАГРАД 2026
            </span>

            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Сезон 2026
            </span>
          </div>

          <div className="mt-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Добро пожаловать в <span className="gold-gradient-text-pure">Lucky UC!</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-sm leading-relaxed">
              Введите выданный код регистрации (10 Standard или 2 VIP слота), чтобы активировать свой аккаунт и крутить Колесо Фортуны!
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsBrowserAuthModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-black text-xs shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] transition-all cursor-pointer active:scale-98"
            >
              <span>Войти / Регистрация по коду 🎄</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate player level from total spins and achievements
  const playerLevel = Math.max(1, Math.floor((stats.spinsCount || 0) / 10) + 1);

  return (
    <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black border border-amber-500/25 shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
      {/* Golden Aura Background Effect */}
      <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-gradient-to-tr from-emerald-600/15 via-rose-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Top Tag */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {user.is_vip ? '✨ VIP ИГРОК • 5000 UC' : '🎄 РОЖДЕСТВЕНСКИЙ СЕЗОН 2026'}
          </span>

          <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Уровень {playerLevel}
          </span>
        </div>

        {/* Player Welcome */}
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Привет,</span>
              <span className="gold-gradient-text-pure font-black">
                {user.first_name || `@${user.username}`}!
              </span>
              <span>🎄</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-sm leading-relaxed">
              Рождественское Колесо Фортуны ждёт тебя! Собирай 15 праздничных артефактов, дари подарки друзьям и побеждай!
            </p>
          </div>

          <Link
            href="/leaderboard"
            className="hidden sm:flex flex-col items-center justify-center p-3 rounded-2xl bg-black/50 border border-amber-500/25 shadow-inner hover:border-amber-400 transition-colors group cursor-pointer"
            title="Перейти в таблицу лидеров"
          >
            <Trophy className="w-6 h-6 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] text-zinc-400 font-medium">Рейтинг</span>
            <span className="text-xs font-black text-amber-300 flex items-center gap-0.5">
              Топ игроков →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
