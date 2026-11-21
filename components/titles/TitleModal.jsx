'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import RarityBadge from '../ui/RarityBadge';
import GoldButton from '../ui/GoldButton';
import FemboyBadge from '../ui/FemboyBadge';
import {
  Crown,
  Baby,
  Wind,
  Bot,
  ShieldAlert,
  Sparkle,
  Sparkles,
  X,
  Check,
  Eye,
  Gift,
  AlertCircle,
  Sparkles as SparklesIcon,
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

export default function TitleModal({ title, isOpen, onClose }) {
  const { user, activeTitle, equipTitle, unequipTitle, inventory } = useUserData();
  const { triggerHaptic } = useTelegram();
  const [isPreviewing, setIsPreviewing] = useState(false);

  if (!isOpen || !title) return null;

  const Icon = ICON_MAP[title.icon] || Crown;
  const isCurrentlyEquipped = activeTitle?.id === title.id;
  const inventoryEntry = inventory.find((it) => it.id === title.id);
  const quantity = inventoryEntry?.quantity || 0;
  const isOwned = quantity > 0;
  const duplicateCount = Math.max(0, quantity - 1);

  const handleEquip = () => {
    triggerHaptic('success');
    equipTitle(title.id);
    setIsPreviewing(false);
  };

  const handleUnequip = () => {
    triggerHaptic('medium');
    unequipTitle();
    setIsPreviewing(false);
  };

  const handleTogglePreview = () => {
    triggerHaptic('light');
    setIsPreviewing(!isPreviewing);
  };

  const handleClose = () => {
    triggerHaptic('light');
    setIsPreviewing(false);
    onClose();
  };

  // Glow shadow mapping based on title
  const glowStyle = title.slug === 'vip'
    ? '0 0 50px rgba(245, 158, 11, 0.65)'
    : title.slug === 'cyborg'
    ? '0 0 50px rgba(168, 85, 247, 0.6)'
    : `0 0 40px ${title.accentColor}55`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border p-6 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black shadow-2xl transition-all duration-300 animate-in zoom-in-95"
        style={{
          borderColor: `${title.accentColor}66`,
          boxShadow: glowStyle,
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ backgroundColor: title.accentColor }}
        />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-20 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Rarity & Tier */}
          <div className="mb-4">
            <RarityBadge rarity={title.rarity} size="md" />
          </div>

          {/* Large Title Icon with Animated Aura */}
          <div
            className="relative w-24 h-24 rounded-3xl flex items-center justify-center mb-4 border-2 p-3 transition-transform duration-300 hover:scale-105 overflow-hidden"
            style={{
              backgroundColor: `${title.accentColor}18`,
              borderColor: `${title.accentColor}88`,
              boxShadow: `0 0 35px ${title.accentColor}55`,
            }}
          >
            {title.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={title.imageUrl}
                alt={title.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <Icon className="w-14 h-14" style={{ color: title.accentColor }} />
            )}
            {/* Shimmer line */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="w-full h-full bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
            </div>
          </div>

          {/* Title Name */}
          <h2
            className="text-2xl font-black tracking-wider uppercase drop-shadow-md mb-1"
            style={{ color: title.accentColor }}
          >
            {title.name}
          </h2>

          <p className="text-xs text-zinc-300 max-w-xs mt-1 leading-relaxed">
            {title.description}
          </p>

          {/* Try-on Live Preview Banner */}
          {isPreviewing && (
            <div className="w-full mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-400/40 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold mb-1.5">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Режим примерки:
                </span>
                <span className="text-[10px] text-zinc-400">Как видят другие игроки</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-black/60 border border-zinc-800">
                <span className="text-xs font-bold text-white flex items-center">
                  @{user?.username || 'player'}
                  <FemboyBadge titleId={title.id} titleSlug={title.slug} size="xs" />
                </span>
                <span
                  className="text-[11px] font-black uppercase px-2 py-0.5 rounded tracking-wider border shadow-sm"
                  style={{
                    color: title.accentColor,
                    borderColor: `${title.accentColor}88`,
                    backgroundColor: `${title.accentColor}25`,
                  }}
                >
                  {title.name}
                </span>
              </div>
            </div>
          )}

          {/* Status & Duplicates Info */}
          <div className="w-full mt-4 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Условие получения:</span>
              <span className="text-zinc-200 font-medium text-right max-w-[200px]">{title.conditions}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span className="text-zinc-400">Статус наличия:</span>
              <span className="font-bold">
                {isOwned ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Разблокирован ({quantity} шт.)
                  </span>
                ) : (
                  <span className="text-zinc-500">Заблокирован</span>
                )}
              </span>
            </div>

            {/* Duplicates info rule */}
            {isOwned && (
              <div className="pt-2 border-t border-zinc-800/80 text-[11px]">
                {duplicateCount > 0 ? (
                  <div className="text-amber-300 flex items-center gap-1 font-medium">
                    <SparklesIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      1 шт. активна, <strong>{duplicateCount} дубликат(а)</strong> доступны для подарка.
                    </span>
                  </div>
                ) : (
                  <div className="text-zinc-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>Единственный экземпляр. Подарить нельзя.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full mt-5 flex flex-col gap-2.5">
            {/* Try-on button */}
            <GoldButton
              variant="outline"
              size="md"
              icon={Eye}
              onClick={handleTogglePreview}
              className="w-full"
            >
              {isPreviewing ? 'Скрыть примерку' : 'Примерить титул'}
            </GoldButton>

            {/* Equip / Unequip logic */}
            {isCurrentlyEquipped ? (
              <button
                onClick={handleUnequip}
                className="w-full py-3 rounded-xl font-bold text-sm bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 transition-all cursor-pointer"
              >
                Снять титул
              </button>
            ) : isOwned ? (
              <GoldButton
                variant="gold"
                size="md"
                icon={Check}
                onClick={handleEquip}
                className="w-full"
              >
                Надеть титул
              </GoldButton>
            ) : (
              <button
                disabled
                className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed"
              >
                Титул пока не разблокирован
              </button>
            )}

            {/* Gift duplicate button */}
            {duplicateCount > 0 && (
              <Link href={`/gifts?item=${title.id}`} className="w-full">
                <button className="w-full py-2.5 rounded-xl font-bold text-xs bg-zinc-900 text-amber-300 border border-amber-500/30 hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  Подарить дубликат другу ({duplicateCount} шт.)
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
