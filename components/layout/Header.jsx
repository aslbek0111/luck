'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import NotificationCenter from '../notifications/NotificationCenter';
import { Coins, RotateCcw, ShieldCheck, Crown, Sparkles } from 'lucide-react';

function subscribeSnow(callback) {
  window.addEventListener('toggle-snow', callback);
  return () => window.removeEventListener('toggle-snow', callback);
}

function getSnowSnapshot() {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('lucky_snow_enabled');
  return saved === null ? true : saved === 'true';
}

function getServerSnowSnapshot() {
  return true;
}

export default function Header() {
  const { user, stats, activeTitle, setIsBrowserAuthModalOpen } = useUserData();
  const snowEnabled = useSyncExternalStore(subscribeSnow, getSnowSnapshot, getServerSnowSnapshot);

  const toggleSnow = () => {
    const next = !snowEnabled;
    localStorage.setItem('lucky_snow_enabled', String(next));
    window.dispatchEvent(new CustomEvent('toggle-snow', { detail: { enabled: next } }));
  };

  const isVip = Boolean(user?.is_vip);

  if (!user) {
    return (
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-black/80 border-b border-amber-500/20 px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-amber-500/30 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black shadow-sm">
              🎄
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wide flex items-center gap-1">
                <span>LUCKY UC</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">2026</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Snow Toggle */}
            <button
              onClick={toggleSnow}
              type="button"
              className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                snowEnabled
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
              }`}
              title={snowEnabled ? 'Снег включен (нажмите для отключения)' : 'Снег выключен (нажмите для включения)'}
            >
              ❄️
            </button>

            <button
              onClick={() => setIsBrowserAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-black text-xs hover:brightness-110 transition-all cursor-pointer shadow-md"
            >
              <span>Войти / Регистрация 🎄</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-black/80 border-b border-amber-500/20 px-4 py-2.5">
      {/* Christmas Garland Twinkle Bulbs along header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between pb-1 px-1">
        <div className="flex items-center gap-3 w-full justify-between opacity-80 pointer-events-none text-[8px]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 garland-bulb-1 shadow-[0_0_6px_#ef4444]" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 garland-bulb-2 shadow-[0_0_6px_#34d399]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 garland-bulb-3 shadow-[0_0_6px_#fde047]" />
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 garland-bulb-1 shadow-[0_0_6px_#38bdf8]" />
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 garland-bulb-2 shadow-[0_0_6px_#ec4899]" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 garland-bulb-3 shadow-[0_0_6px_#34d399]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 garland-bulb-1 shadow-[0_0_6px_#fbbf24]" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 garland-bulb-2 shadow-[0_0_6px_#ef4444]" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Left: User Avatar & Info */}
        <Link href="/profile" className="flex items-center gap-2.5 group cursor-pointer">
          <div className="relative">
            {/* VIP Golden Frame */}
            <div
              className={`w-10 h-10 rounded-full overflow-hidden p-0.5 group-hover:scale-105 transition-transform ${
                isVip
                  ? 'vip-golden-frame'
                  : 'border-2 border-amber-400/80 bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={user.username}
                className="w-full h-full object-cover rounded-full bg-zinc-900"
              />
            </div>

            {/* VIP or Admin Tag */}
            {isVip && (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-black text-[8px] font-black rounded-full px-1 py-0.2 shadow-md flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5" /> VIP
              </span>
            )}
            {user.is_admin && !isVip && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black rounded-full p-0.5 shadow-md">
                <ShieldCheck className="w-3 h-3" />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate max-w-[110px] sm:max-w-[160px]">
                @{user.username}
              </span>
              {activeTitle && (
                <span
                  className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded tracking-wider border shrink-0"
                  style={{
                    color: activeTitle.accentColor,
                    borderColor: `${activeTitle.accentColor}55`,
                    backgroundColor: `${activeTitle.accentColor}18`,
                  }}
                >
                  {activeTitle.name}
                </span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[180px]">
              {user.first_name} {user.last_name || ''}
            </span>
          </div>
        </Link>

        {/* Right: Snow toggle, Notification Bell, Balances, and Admin Link */}
        <div className="flex items-center gap-2">
          {/* Snow Toggle */}
          <button
            onClick={toggleSnow}
            type="button"
            className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
              snowEnabled
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
            }`}
            title={snowEnabled ? 'Снег включен (нажмите для отключения)' : 'Снег выключен (нажмите для включения)'}
          >
            ❄️
          </button>

          {/* In-app Notification Center */}
          <NotificationCenter />

          {/* Admin link button if user is admin */}
          {user.is_admin && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-colors shadow-sm"
              title="Панель администратора"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Админ</span>
            </Link>
          )}

          {/* UC Badge */}
          <Link
            href="/profile"
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors cursor-pointer ${
              isVip
                ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'bg-zinc-900/80 border border-amber-400/30'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-amber-300 leading-none">
                {stats.totalUc}
              </span>
              <span className="text-[9px] text-amber-400/70 font-semibold leading-none">
                UC
              </span>
            </div>
          </Link>

          {/* Free Spins Badge */}
          <Link
            href="/spin"
            className="flex items-center gap-1.5 bg-zinc-900/80 border border-sky-500/40 hover:border-sky-400 rounded-xl px-2.5 py-1.5 transition-all shadow-[0_0_12px_rgba(56,189,248,0.2)] cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-sky-200 leading-none">
                {stats.freeSpins}
              </span>
              <span className="text-[9px] text-zinc-400 font-semibold leading-none">
                СПИН
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
