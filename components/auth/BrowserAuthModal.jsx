'use client';

import React, { useState } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import GoldButton from '../ui/GoldButton';
import {
  User,
  KeyRound,
  X,
  Sparkles,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function BrowserAuthModal({ isOpen, onClose }) {
  const { browserAuth, isInsideTelegram, user, logoutNotice, setLogoutNotice } = useUserData();
  const { triggerHaptic } = useTelegram();

  const [internalMode, setInternalMode] = useState('login'); // 'login' | 'register'
  const mode = logoutNotice ? 'login' : internalMode;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || isInsideTelegram) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUser) {
      setError('Введите ваш никнейм');
      triggerHaptic('error');
      return;
    }

    if (!cleanPassword) {
      setError('Введите ваш пароль');
      triggerHaptic('error');
      return;
    }

    setLoading(true);
    const result = await browserAuth({
      username: cleanUser,
      password: cleanPassword,
      action: mode,
    });
    setLoading(false);

    if (result.success) {
      triggerHaptic('success');
      setPassword('');
      if (onClose) onClose();
    } else {
      setError(result.error || 'Ошибка авторизации');
      triggerHaptic('error');
    }
  };

  const switchMode = (newMode) => {
    setInternalMode(newMode);
    setError('');
    if (setLogoutNotice) setLogoutNotice('');
  };

  // If already authenticated, user can close modal
  const canClose = Boolean(user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Ambient Winter Glows */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl border border-amber-500/40 p-5 sm:p-6 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black shadow-[0_0_60px_rgba(245,158,11,0.25)] animate-in zoom-in-95">
        {/* Close Button (only if user is already authenticated) */}
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header / Festive Branding */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 via-amber-500/30 to-rose-600/30 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-2.5 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
            <span>LUCKY UC</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              🎄 New Year 2026
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {mode === 'register'
              ? 'Создание аккаунта: Никнейм и Пароль'
              : 'Вход в аккаунт: Никнейм и Пароль'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Войти</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Регистрация</span>
          </button>
        </div>

        {/* Logout Notice Banner */}
        {logoutNotice && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-start gap-2.5 text-emerald-300 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1">
              <span className="font-bold block leading-snug">{logoutNotice}</span>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                Вы вышли из сессии. Введите никнейм и пароль для входа.
              </span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Form: ONLY Nickname and Password */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Username Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
              <span>Никнейм игрока</span>
              <span className="text-[10px] text-zinc-500">буквы и цифры</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-zinc-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите ваш никнейм"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
              <span>Пароль</span>
              <span className="text-[10px] text-zinc-500">минимум 3 символа</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-300 font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-zinc-500">
              {mode === 'login'
                ? 'При первом входе в аккаунт будет сохранён введённый пароль.'
                : 'Придумайте надёжный пароль для вашего аккаунта.'}
            </span>
          </div>

          {/* Submit Button */}
          <div className="mt-2">
            <GoldButton
              type="submit"
              variant="gold"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Обработка...
                </span>
              ) : mode === 'register' ? (
                <span>Зарегистрироваться 🎄</span>
              ) : (
                <span>Войти в аккаунт 🚀</span>
              )}
            </GoldButton>
          </div>
        </form>
      </div>
    </div>
  );
}
