'use client';

import React from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import RarityBadge from '../ui/RarityBadge';
import { ListItemSkeleton } from '../ui/Skeleton';
import { Crown, Coins, Flower, Gift, Award, Sparkles, ChevronRight, Activity } from 'lucide-react';

const ICON_MAP = {
  Crown,
  Coins,
  Flower,
  Gift,
  Award,
  Sparkles,
  ShieldAlert: Crown,
};

export default function LiveFeedWidget() {
  const { events, isAuthLoading } = useUserData();

  // Show recent 4-5 events in the widget
  const displayedEvents = events.slice(0, 4);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
          </div>
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
            Публичная лента событий
          </h3>
        </div>

        <Link
          href="/feed"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
        >
          Вся лента <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="glass-card rounded-3xl p-2 sm:p-3 divide-y divide-zinc-800/60 border border-amber-500/15">
        {isAuthLoading ? (
          <div className="flex flex-col gap-2 p-2">
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="py-6 px-4 text-center">
            <Activity className="w-6 h-6 text-zinc-600 mx-auto mb-1.5" />
            <p className="text-xs text-zinc-400 font-medium">Пока нет недавних событий</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Крутите слот-машину, чтобы занять место в ленте!</p>
          </div>
        ) : (
          displayedEvents.map((evt) => {
            const Icon = ICON_MAP[evt.icon] || Sparkles;

            return (
              <div
                key={evt.id}
                className="flex items-center justify-between py-2.5 px-2 hover:bg-white/[0.02] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-amber-300">
                        {evt.username}
                      </span>
                      <span className="text-xs text-zinc-400">получил</span>
                      <span className="text-xs font-bold text-white">
                        {evt.rewardName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      {evt.createdAt}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  <RarityBadge rarity={evt.rewardRarity} size="xs" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
