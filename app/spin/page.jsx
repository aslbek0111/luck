'use client';

import React from 'react';
import Link from 'next/link';
import ChristmasSpinWheel from '../../components/spin/ChristmasSpinWheel';
import { useUserData } from '../../hooks/useUserData';
import GlassCard from '../../components/ui/GlassCard';
import RarityBadge from '../../components/ui/RarityBadge';
import { ArrowLeft, Sparkles, Trophy, Gift, RotateCcw } from 'lucide-react';

export default function SpinPage() {
  const { stats, lastWins, user } = useUserData();

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Top Header */}
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
              <span>Колесо Фортуны</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🎄 Новогоднее
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Вращай колесо и собирай праздничные сувениры</p>
          </div>
        </div>

        {/* Free Spins Counter Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/40 shadow-sm">
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-black text-sky-300">
            {stats.freeSpins} СПИНОВ
          </span>
        </div>
      </div>

      {/* The Animated Christmas Circular Wheel */}
      <ChristmasSpinWheel />

      {/* Recent Wins on Wheel */}
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Ваши последние выигрыши
          </h3>
          <Link href="/collection" className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors">
            Все награды →
          </Link>
        </div>

        {lastWins.length === 0 ? (
          <GlassCard className="p-4 text-center">
            <p className="text-xs text-zinc-400">Вы пока не делали вращений</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Крутите колесо, чтобы забрать первые праздничные сувениры!</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {lastWins.slice(0, 4).map((w, i) => (
              <GlassCard key={w.id || i} className="p-2.5 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-xl bg-zinc-800/80 flex items-center justify-center text-amber-400 mb-1.5">
                  <Gift className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white truncate max-w-full">{w.name}</span>
                <div className="mt-1">
                  <RarityBadge rarity={w.rarity} size="xs" />
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
