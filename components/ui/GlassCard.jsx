'use client';

import React from 'react';

export default function GlassCard({
  children,
  className = '',
  hoverEffect = true,
  glowColor = 'gold', // 'gold' | 'purple' | 'cyan' | 'rose' | 'none'
  ...props
}) {
  const glowClasses = {
    gold: 'hover:border-amber-400/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.18)]',
    purple: 'hover:border-purple-400/40 hover:shadow-[0_0_25px_rgba(168,85,247,0.22)]',
    cyan: 'hover:border-sky-400/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.22)]',
    rose: 'hover:border-rose-400/40 hover:shadow-[0_0_25px_rgba(244,63,94,0.22)]',
    none: '',
  }[glowColor] || '';

  return (
    <div
      className={`glass-card rounded-2xl p-4 sm:p-5 transition-all duration-200 ${
        hoverEffect ? `glass-card-hover ${glowClasses}` : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
