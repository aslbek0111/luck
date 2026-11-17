'use client';

import React from 'react';

export function Skeleton({ className = '', variant = 'rect', ...props }) {
  const variantClasses = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    text: 'rounded-md h-4',
    card: 'rounded-2xl h-24',
  }[variant] || 'rounded-xl';

  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-zinc-800/60 via-zinc-700/40 to-zinc-800/60 bg-[length:200%_100%] ${variantClasses} ${className}`}
      {...props}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-3.5 flex flex-col justify-between border border-zinc-800/80">
      <div className="flex items-center justify-between mb-2">
        <Skeleton variant="text" className="w-16 h-3" />
        <Skeleton variant="circle" className="w-7 h-7" />
      </div>
      <div>
        <Skeleton variant="text" className="w-20 h-6 mb-1" />
        <Skeleton variant="text" className="w-14 h-2.5" />
      </div>
    </div>
  );
}

export function RewardCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-3.5 flex flex-col justify-between border border-zinc-800/80">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Skeleton variant="circle" className="w-9 h-9" />
          <Skeleton variant="text" className="w-14 h-4 rounded-full" />
        </div>
        <Skeleton variant="text" className="w-24 h-4 mb-1" />
        <Skeleton variant="text" className="w-full h-3 mb-1" />
        <Skeleton variant="text" className="w-2/3 h-3" />
      </div>
      <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between">
        <Skeleton variant="text" className="w-16 h-3" />
        <Skeleton variant="text" className="w-10 h-3" />
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-3.5 flex items-center justify-between border border-zinc-800/80">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton variant="text" className="w-28 h-3.5" />
          <Skeleton variant="text" className="w-44 h-2.5" />
        </div>
      </div>
      <Skeleton variant="text" className="w-16 h-5 rounded-lg" />
    </div>
  );
}

export default Skeleton;
