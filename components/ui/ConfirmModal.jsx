'use client';

import React from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import GoldButton from './GoldButton';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтверждение',
  description = 'Вы уверены, что хотите продолжить?',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  isLoading = false,
}) {
  const { triggerHaptic } = useTelegram();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    triggerHaptic(variant === 'danger' ? 'warning' : 'medium');
    if (onConfirm) await onConfirm();
  };

  const handleClose = () => {
    triggerHaptic('light');
    if (onClose) onClose();
  };

  const icons = {
    warning: AlertTriangle,
    danger: AlertCircle,
    info: HelpCircle,
    success: CheckCircle2,
  };
  const Icon = icons[variant] || AlertTriangle;

  const themeColors = {
    warning: {
      border: 'border-amber-500/40',
      shadow: 'shadow-[0_0_40px_rgba(245,158,11,0.25)]',
      bg: 'bg-amber-500/15',
      iconText: 'text-amber-400',
      btnVariant: 'gold',
    },
    danger: {
      border: 'border-rose-500/40',
      shadow: 'shadow-[0_0_40px_rgba(244,63,94,0.25)]',
      bg: 'bg-rose-500/15',
      iconText: 'text-rose-400',
      btnVariant: 'dark',
    },
    info: {
      border: 'border-sky-500/40',
      shadow: 'shadow-[0_0_40px_rgba(56,189,248,0.25)]',
      bg: 'bg-sky-500/15',
      iconText: 'text-sky-400',
      btnVariant: 'gold',
    },
    success: {
      border: 'border-emerald-500/40',
      shadow: 'shadow-[0_0_40px_rgba(16,185,129,0.25)]',
      bg: 'bg-emerald-500/15',
      iconText: 'text-emerald-400',
      btnVariant: 'gold',
    },
  }[variant] || themeColors.warning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-sm rounded-3xl border ${themeColors.border} p-6 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black ${themeColors.shadow} animate-in zoom-in-95`}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 rounded-2xl ${themeColors.bg} border ${themeColors.border} flex items-center justify-center ${themeColors.iconText} mb-3`}
          >
            <Icon className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            {description}
          </p>

          <div className="flex items-center gap-2.5 w-full mt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              {cancelText}
            </button>

            {variant === 'danger' ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Секунду...' : confirmText}
              </button>
            ) : (
              <GoldButton
                variant={themeColors.btnVariant}
                size="md"
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 py-2.5 text-xs font-black"
              >
                {isLoading ? 'Секунду...' : confirmText}
              </GoldButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
