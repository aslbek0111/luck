'use client';

import React from 'react';
import { useTelegram } from '../../hooks/useTelegram';

export default function GoldButton({
  children,
  onClick,
  variant = 'gold', // 'gold' | 'outline' | 'dark' | 'glass'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  disabled = false,
  className = '',
  hapticType = 'light',
  ...props
}) {
  const { triggerHaptic } = useTelegram();

  const handleClick = (e) => {
    if (disabled) return;
    triggerHaptic(hapticType);
    if (onClick) onClick(e);
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 font-medium',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2 font-semibold',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5 font-bold',
  }[size] || sizeClasses.md;

  let variantClasses = '';
  switch (variant) {
    case 'gold':
      variantClasses =
        'gold-gradient-shine text-black shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_28px_rgba(245,158,11,0.55)] active:scale-[0.98] border border-amber-300/40';
      break;
    case 'outline':
      variantClasses =
        'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 active:scale-[0.98]';
      break;
    case 'glass':
      variantClasses =
        'bg-white/5 backdrop-blur-md text-white border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]';
      break;
    case 'dark':
    default:
      variantClasses =
        'bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:text-white active:scale-[0.98]';
      break;
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      <span>{children}</span>
    </button>
  );
}
