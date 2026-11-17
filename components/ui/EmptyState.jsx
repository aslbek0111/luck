'use client';

import React from 'react';
import { PackageOpen } from 'lucide-react';
import GoldButton from './GoldButton';

import Link from 'next/link';

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'Ничего не найдено',
  description = 'По вашему запросу не найдено ни одного элемента',
  actionLabel,
  onAction,
  actionHref,
  className = '',
}) {
  return (
    <div
      className={`glass-card rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-zinc-800/80 my-2 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-base font-black text-white tracking-tight">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-xs mt-1 leading-relaxed">
        {description}
      </p>

      {(actionLabel && (onAction || actionHref)) && (
        <div className="mt-4">
          {actionHref ? (
            <Link href={actionHref}>
              <GoldButton size="sm" variant="gold">
                {actionLabel}
              </GoldButton>
            </Link>
          ) : (
            <GoldButton size="sm" variant="gold" onClick={onAction}>
              {actionLabel}
            </GoldButton>
          )}
        </div>
      )}
    </div>
  );
}
