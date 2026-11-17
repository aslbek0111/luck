'use client';

import React from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import GlassCard from '../ui/GlassCard';
import { StatCardSkeleton } from '../ui/Skeleton';
import { Award, RotateCcw, Coins, Flame } from 'lucide-react';

export default function StatsSummary() {
  const { stats, isAuthLoading } = useUserData();
  const { triggerHaptic } = useTelegram();

  if (isAuthLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const level = Math.max(1, Math.floor((stats.achievementsCount || 0) / 3) + 1);

  const statItems = [
    {
      label: 'Достижений',
      value: `${stats.achievementsCount}/15`,
      subtext: `Уровень ${level}`,
      href: '/collection',
      icon: Award,
      color: '#fbbf24',
      glow: 'gold',
    },
    {
      label: 'Вращений',
      value: stats.spinsCount,
      subtext: 'Всего попыток',
      href: '/spin',
      icon: RotateCcw,
      color: '#38bdf8',
      glow: 'cyan',
    },
    {
      label: 'Баланс UC',
      value: `${stats.totalUc} UC`,
      subtext: 'Подтверждено',
      href: '/profile',
      icon: Coins,
      color: '#f59e0b',
      glow: 'gold',
    },
    {
      label: 'Популярность',
      value: stats.popularity,
      subtext: 'Очки славы',
      href: '/leaderboard',
      icon: Flame,
      color: '#f97316',
      glow: 'rose',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {statItems.map((st, idx) => {
        const Icon = st.icon;
        return (
          <Link
            key={idx}
            href={st.href}
            onClick={() => triggerHaptic('light')}
            className="group cursor-pointer select-none"
          >
            <GlassCard
              glowColor={st.glow}
              className="p-3.5 flex flex-col justify-between relative overflow-hidden h-full group-active:scale-98 transition-transform"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  {st.label}
                </span>
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${st.color}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: st.color }} />
                </div>
              </div>

              <div>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  {st.value}
                </div>
                <div className="text-[10px] text-zinc-500 font-medium mt-0.5 flex items-center justify-between">
                  <span>{st.subtext}</span>
                  <span className="text-zinc-600 group-hover:text-amber-400/80 transition-colors">→</span>
                </div>
              </div>
            </GlassCard>
          </Link>
        );
      })}
    </div>
  );
}
