'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({
  message,
  type = 'success', // 'success' | 'error' | 'info'
  onClose,
}) {
  if (!message) return null;

  const config = {
    success: {
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-950/90',
      text: 'text-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      shadow: 'shadow-[0_8px_30px_rgba(16,185,129,0.3)]',
    },
    error: {
      border: 'border-rose-500/40',
      bg: 'bg-rose-950/90',
      text: 'text-rose-200',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      shadow: 'shadow-[0_8px_30px_rgba(244,63,94,0.3)]',
    },
    info: {
      border: 'border-sky-500/40',
      bg: 'bg-sky-950/90',
      text: 'text-sky-200',
      icon: Info,
      iconColor: 'text-sky-400',
      shadow: 'shadow-[0_8px_30px_rgba(56,189,248,0.3)]',
    },
  }[type] || config.info;

  const Icon = config.icon;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] animate-in fade-in slide-in-from-top-3 duration-200">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl ${config.bg} ${config.border} ${config.shadow}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 shrink-0 ${config.iconColor}`} />
          <span className={`text-xs font-bold leading-snug ${config.text}`}>
            {message}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
