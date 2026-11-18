'use client';

import React from 'react';
import { RARITIES } from '../../lib/catalog-data';

export default function RarityBadge({ rarity = 'common', size = 'sm', className = '' }) {
  const normalizedRarity = String(rarity || 'common').toLowerCase().replace('_', '-');
  const config = RARITIES[normalizedRarity] || RARITIES[rarity] || RARITIES.common;
  const isProEpic = normalizedRarity === 'pro-epic';

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
  }[size] || 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${config.badgeBg} ${config.badgeText} ${config.border} ${sizeClasses} ${
        isProEpic ? 'shadow-[0_0_12px_rgba(6,182,212,0.45)] ring-1 ring-cyan-400/40 font-bold' : ''
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isProEpic ? 'animate-ping' : 'animate-pulse'}`}
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
