'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useTelegram } from '../../hooks/useTelegram';
import { useUserData } from '../../hooks/useUserData';
import { Sparkles, Crown, Gift, Activity, RotateCcw, Trophy, ChevronRight, ShieldCheck, ShoppingBag, Package } from 'lucide-react';

export default function QuickNavGrid() {
  const { triggerHaptic } = useTelegram();
  const { stats, inventory, user } = useUserData();

  // Count items available for gifting
  const giftsCount = useMemo(() => {
    return inventory.filter((item) => (item.quantity || 0) > 0).length;
  }, [inventory]);

  const navCards = [
    {
      title: 'Рождественское Колесо',
      description: 'Круглое колесо фортуны, 15 праздничных наград и UC',
      href: '/spin',
      icon: RotateCcw,
      color: '#f59e0b',
      badge: stats.freeSpins > 0 ? `${stats.freeSpins} СПИНОВ` : 'КРУТИТЬ',
      badgeGlow: stats.freeSpins > 0,
      gradient: 'from-amber-950/60 via-zinc-900/75 to-zinc-950/90',
      border: 'border-amber-400/50 hover:border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.25)]',
    },
    {
      title: 'Новогодний Магазин',
      description: 'Покупка подарков, сувениров и титулов за Points',
      href: '/shop',
      icon: ShoppingBag,
      color: '#c084fc',
      badge: user?.is_admin ? '∞ POINTS' : `${stats.pointsBalance ?? user?.points_balance ?? 1000} PTS`,
      badgeGlow: true,
      gradient: 'from-purple-950/50 via-zinc-900/70 to-zinc-950/90',
      border: 'border-purple-500/40 hover:border-purple-300 shadow-[0_0_20px_rgba(192,132,252,0.25)]',
    },
    {
      title: 'Система Подарков',
      description: 'Подарить новогодний сувенир другу с пожеланием',
      href: '/gifts',
      icon: Gift,
      color: '#f43f5e',
      badge: giftsCount > 0 ? `${giftsCount} предметов` : 'Передача',
      badgeGlow: giftsCount > 0,
      gradient: 'from-rose-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-rose-500/30 hover:border-rose-400/60',
    },
    {
      title: 'Мой Инвентарь',
      description: 'Все купленные подарки, смена и экипировка титулов',
      href: '/inventory',
      icon: Package,
      color: '#34d399',
      badge: `${stats.uniqueRewardsCount} предметов`,
      gradient: 'from-emerald-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-emerald-500/30 hover:border-emerald-400/60',
    },
    {
      title: 'Моя Коллекция',
      description: 'Все полученные награды, стикеры и артефакты',
      href: '/collection',
      icon: Sparkles,
      color: '#fbbf24',
      badge: `${stats.uniqueRewardsCount} / 40 наград`,
      gradient: 'from-amber-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-amber-500/30 hover:border-amber-400/60',
    },
    {
      title: 'Зал Титулов',
      description: 'СОСУН, КОРОЛЬ, КИБОРГ, VIP и примерка',
      href: '/titles',
      icon: Crown,
      color: '#a855f7',
      badge: '6 титулов',
      gradient: 'from-purple-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-purple-500/30 hover:border-purple-400/60',
    },
    {
      title: 'Таблица Лидеров',
      description: 'Топ 12 игроков по балансу UC и подаркам',
      href: '/leaderboard',
      icon: Trophy,
      color: '#eab308',
      badge: 'Рейтинг',
      gradient: 'from-yellow-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-yellow-500/30 hover:border-yellow-400/60',
    },
    {
      title: 'Живая Лента',
      description: 'Реальные события игроков в прямом эфире',
      href: '/feed',
      icon: Activity,
      color: '#38bdf8',
      badge: 'В эфире',
      gradient: 'from-sky-950/40 via-zinc-900/60 to-zinc-950/80',
      border: 'border-sky-500/30 hover:border-sky-400/60',
    },
  ];

  if (user?.is_admin) {
    navCards.unshift({
      title: 'Admin возможности',
      description: 'Управление 12 слотами игроков, спинами и колесом',
      href: '/admin',
      icon: ShieldCheck,
      color: '#10b981',
      badge: 'АДМИНИСТРАТОР',
      badgeGlow: true,
      gradient: 'from-emerald-950/60 via-zinc-900/80 to-zinc-950/90',
      border: 'border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]',
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Разделы платформы
        </h3>
        <span className="text-xs text-zinc-500">Быстрый доступ</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {navCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              onClick={() => triggerHaptic('light')}
              className={`group relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br ${card.gradient} border ${card.border} transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center p-2 mb-2 transition-transform duration-200 group-hover:scale-110 shadow-inner"
                  style={{ backgroundColor: `${card.color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    card.badgeGlow ? 'animate-pulse' : ''
                  }`}
                  style={{
                    color: card.color,
                    borderColor: `${card.color}40`,
                    backgroundColor: `${card.color}18`,
                    boxShadow: card.badgeGlow ? `0 0 12px ${card.color}40` : 'none',
                  }}
                >
                  {card.badge}
                </span>
              </div>

              <div className="flex items-end justify-between mt-1">
                <div>
                  <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {card.description}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-amber-500/25 transition-all shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
