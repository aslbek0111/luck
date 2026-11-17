'use client';

import React from 'react';
import { RARITIES } from '../../lib/catalog-data';

export default function RarityBadge({ rarity = 'common', size = 'sm', className = '' }) {
  const config = RARITIES[rarity] || RARITIES.common;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
  }[size] || sizeClasses.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${config.badgeBg} ${config.badgeText} ${config.border} ${sizeClasses} ${className}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
