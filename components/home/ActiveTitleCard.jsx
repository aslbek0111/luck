'use client';

import React from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import RarityBadge from '../ui/RarityBadge';
import {
  Crown,
  Baby,
  Wind,
  Bot,
  ShieldAlert,
  Sparkle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Flame,
  Ghost,
  Swords,
  Shield,
  Skull,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  Baby,
  Wind,
  Crown,
  Sparkle,
  Sparkles,
  Bot,
  ShieldAlert,
  Flame,
  Ghost,
  Swords,
  Shield,
  Skull,
  Zap,
};

export default function ActiveTitleCard() {
  const { activeTitle } = useUserData();

  if (!activeTitle) {
    return (
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Активный титул</span>
          <p className="text-sm font-bold text-zinc-300 mt-0.5">Титул не выбран</p>
        </div>
        <Link
          href="/titles"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
        >
          Выбрать <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const TitleIcon = ICON_MAP[activeTitle.icon] || Crown;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 shadow-xl"
      style={{
        background: `linear-gradient(135deg, rgba(18, 18, 24, 0.95) 0%, rgba(10, 10, 14, 0.9) 100%)`,
        borderColor: `${activeTitle.accentColor}55`,
        boxShadow: `0 0 30px ${activeTitle.accentColor}25`,
      }}
    >
      {/* Background radial glow */}
      <div
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ backgroundColor: activeTitle.accentColor }}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Header line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Текущий титул
            </span>
            <RarityBadge rarity={activeTitle.rarity} size="xs" />
          </div>

          <Link
            href="/titles"
            className="text-xs font-bold flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
          >
            Все титулы <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </Link>
        </div>

        {/* Title Identity Display */}
        <div className="flex items-center gap-4 py-1">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center p-3 border shadow-lg relative overflow-hidden"
            style={{
              backgroundColor: `${activeTitle.accentColor}15`,
              borderColor: `${activeTitle.accentColor}66`,
              boxShadow: `0 0 20px ${activeTitle.accentColor}40`,
            }}
          >
            <TitleIcon
              className="w-8 h-8 transition-transform duration-300 hover:scale-110"
              style={{ color: activeTitle.accentColor }}
            />
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
          </div>

          <div className="flex-1">
            <h3
              className="text-xl sm:text-2xl font-black tracking-wider uppercase drop-shadow-md"
              style={{ color: activeTitle.accentColor }}
            >
              {activeTitle.name}
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
              {activeTitle.description}
            </p>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400">
          <span>Условие: {activeTitle.conditions}</span>
          <span className="text-amber-400/90 font-medium">Экипирован</span>
        </div>
      </div>
    </div>
  );
}
