'use client';

import React from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import RarityBadge from '../ui/RarityBadge';
import GoldButton from '../ui/GoldButton';
import {
  Crown,
  Baby,
  Wind,
  Bot,
  ShieldAlert,
  Sparkle,
  Sparkles,
  Check,
  Gift,
  Eye,
} from 'lucide-react';

const ICON_MAP = {
  Baby,
  Wind,
  Crown,
  Sparkle,
  Sparkles,
  Bot,
  ShieldAlert,
};

export default function TitleCard({ title, onInspect }) {
  const { activeTitle, equipTitle, unequipTitle, inventory } = useUserData();
  const { triggerHaptic } = useTelegram();

  const Icon = ICON_MAP[title.icon] || Crown;
  const isEquipped = activeTitle?.id === title.id;
  const inventoryEntry = inventory.find((it) => it.id === title.id);
  const quantity = inventoryEntry?.quantity || 0;
  const isOwned = quantity > 0;
  const duplicateCount = Math.max(0, quantity - 1);

  // Dynamic Glow and border based on title rarity and theme
  const isVip = title.slug === 'vip';
  const isCyborg = title.slug === 'cyborg';

  const cardBorderClass = isVip
    ? 'border-amber-400/70 hover:border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
    : isCyborg
    ? 'border-purple-500/70 hover:border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.35)]'
    : isEquipped
    ? 'border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
    : 'border-zinc-800/80 hover:border-zinc-700';

  return (
    <div
      onClick={() => onInspect(title)}
      className={`group relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 cursor-pointer bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black ${cardBorderClass} hover:-translate-y-1`}
    >
      {/* Background Radial Glow */}
      <div
        className="absolute -top-14 -right-14 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-30 transition-opacity group-hover:opacity-60"
        style={{ backgroundColor: title.accentColor }}
      />

      {/* Equipped Badge Tag */}
      {isEquipped && (
        <div className="absolute top-0 right-0 z-10 bg-gradient-to-l from-amber-500 via-amber-400 to-yellow-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-lg flex items-center gap-1">
          <Check className="w-3 h-3 stroke-[3]" /> Активен
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3">
        {/* Top: Icon, Name, Rarity */}
        <div className="flex items-start gap-3.5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center p-3 border transition-transform duration-300 group-hover:scale-105 shrink-0 relative overflow-hidden"
            style={{
              backgroundColor: `${title.accentColor}18`,
              borderColor: `${title.accentColor}55`,
              boxShadow: `0 0 20px ${title.accentColor}30`,
            }}
          >
            <Icon className="w-8 h-8" style={{ color: title.accentColor }} />
            {isVip && (
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 via-transparent to-yellow-200/20 animate-pulse pointer-events-none" />
            )}
            {isCyborg && (
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-transparent to-fuchsia-300/20 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="flex-1 pr-16">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-lg font-black tracking-wider uppercase drop-shadow-sm"
                style={{ color: title.accentColor }}
              >
                {title.name}
              </h3>
              <RarityBadge rarity={title.rarity} size="xs" />
            </div>

            <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
              {title.description}
            </p>
          </div>
        </div>

        {/* Middle: Duplicates & Conditions info */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
          <div className="text-zinc-400">
            {isOwned ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> В коллекции: {quantity} шт.
              </span>
            ) : (
              <span className="text-zinc-500">Не разблокирован</span>
            )}
          </div>

          {duplicateCount > 0 && (
            <span className="text-amber-300 font-extrabold bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
              +{duplicateCount} дубликат
            </span>
          )}
        </div>

        {/* Bottom Buttons */}
        <div
          className="flex items-center justify-end gap-2 pt-1"
          onClick={(e) => e.stopPropagation()} // Keep button clicks from opening modal unintentionally if direct action
        >
          <button
            onClick={() => onInspect(title)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white hover:border-zinc-500 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            Примерить
          </button>

          {duplicateCount > 0 && (
            <Link href={`/gifts?item=${title.id}`}>
              <button className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors">
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                Подарить ({duplicateCount})
              </button>
            </Link>
          )}

          {isEquipped ? (
            <button
              onClick={() => {
                triggerHaptic('medium');
                unequipTitle();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 cursor-pointer transition-colors"
            >
              Снять
            </button>
          ) : (
            <GoldButton
              variant={isOwned ? 'gold' : 'dark'}
              size="sm"
              disabled={!isOwned}
              onClick={() => {
                triggerHaptic('success');
                equipTitle(title.id);
              }}
            >
              {isOwned ? 'Надеть' : 'Закрыт'}
            </GoldButton>
          )}
        </div>
      </div>
    </div>
  );
}
