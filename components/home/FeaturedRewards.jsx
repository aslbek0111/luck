'use client';

import React from 'react';
import Link from 'next/link';
import { REWARDS_CATALOG } from '../../lib/catalog-data';
import RarityBadge from '../ui/RarityBadge';
import { Sparkles, Coins, Award, Trophy, Gift, Crown, ChevronRight } from 'lucide-react';

const ICON_MAP = {
  Coins,
  Award,
  Trophy,
  Gift,
  Crown,
};

// Pre-filtered static spotlight rewards
const SPOTLIGHT_IDS = [
  'reward-xmas-miracle-box',
  'reward-xmas-santas-sleigh',
  'reward-xmas-golden-tree',
  'reward-xmas-snow-globe',
];

const SPOTLIGHT_REWARDS = REWARDS_CATALOG.filter((r) =>
  SPOTLIGHT_IDS.includes(r.id)
);

export default function FeaturedRewards() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          🎄 Новогодние артефакты 2026
        </h3>

        <Link
          href="/collection"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
        >
          Все награды <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {SPOTLIGHT_REWARDS.map((reward) => {
          const Icon = ICON_MAP[reward.icon] || Award;

          return (
            <Link
              key={reward.id}
              href="/collection"
              className="glass-card rounded-2xl p-3 flex flex-col justify-between border border-amber-500/15 hover:border-amber-400/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <RarityBadge rarity={reward.rarity} size="xs" />
                </div>

                <h4 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                  {reward.name}
                </h4>
                <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">
                  {reward.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-amber-400/80 font-bold">LUCKY UC</span>
                <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  Обзор →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
