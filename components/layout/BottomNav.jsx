'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import { Home, RotateCcw, Crown, Sparkles, Gift, User, ShieldAlert } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const { user, stats, inventory } = useUserData();
  const { triggerHaptic } = useTelegram();

  const duplicateGiftsCount = useMemo(() => {
    return inventory.filter((item) => (item.quantity || 0) > 0).length;
  }, [inventory]);

  const navItems = [
    { label: 'Главная', href: '/', icon: Home },
    {
      label: 'Спин',
      href: '/spin',
      icon: RotateCcw,
      isSpin: true,
      badge: stats.freeSpins > 0 ? stats.freeSpins : null,
      badgeColor: 'bg-amber-400 text-black',
    },
    { label: 'Титулы', href: '/titles', icon: Crown },
    { label: 'Коллекция', href: '/collection', icon: Sparkles },
    {
      label: 'Подарки',
      href: '/gifts',
      icon: Gift,
      badge: duplicateGiftsCount > 0 ? duplicateGiftsCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { label: 'Профиль', href: '/profile', icon: User },
  ];

  if (user?.is_admin) {
    navItems.push({ label: 'Админ', href: '/admin', icon: ShieldAlert, isAdmin: true });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-amber-500/20 px-1 py-1.5 pb-safe safe-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic('light')}
              className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-2 rounded-xl transition-all duration-200 relative ${
                item.isSpin
                  ? isActive
                    ? 'text-amber-300 font-black scale-110 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                    : 'text-amber-400 font-bold hover:scale-105'
                  : isActive
                  ? 'text-amber-400 font-bold scale-105'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : ''
                  }`}
                />

                {/* Badge counter */}
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full text-[9px] font-black leading-none shadow-md ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
