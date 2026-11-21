'use client';

import React from 'react';

export default function FemboyBadge({
  titleId,
  titleSlug,
  isEquipped = false,
  className = '',
  size = 'sm',
}) {
  const isFemboy =
    isEquipped ||
    titleId === 'title-femboy' ||
    titleSlug === 'femboy' ||
    (typeof titleId === 'string' && titleId.toLowerCase().includes('femboy')) ||
    (typeof titleSlug === 'string' && titleSlug.toLowerCase().includes('femboy'));

  if (!isFemboy) return null;

  const sizeClass =
    size === 'xs'
      ? 'w-3.5 h-3.5'
      : size === 'lg'
      ? 'w-5 h-5'
      : 'w-4 h-4';

  return (
    <img
      src="/images/femboy_badge.png"
      alt="FEMBOY Special Effect"
      title="FEMBOY Special Effect"
      className={`${sizeClass} rounded-full inline-block object-cover border border-pink-400/80 shadow-[0_0_8px_rgba(244,114,182,0.7)] ml-1 shrink-0 align-middle pointer-events-auto ${className}`}
    />
  );
}
