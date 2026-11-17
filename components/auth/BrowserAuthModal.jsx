'use client';

import React, { useState } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import GoldButton from '../ui/GoldButton';
import {
  Lock,
  User,
  KeyRound,
  X,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Crown,
  Gift,
  CheckCircle2,
} from 'lucide-react';

export default function BrowserAuthModal({ isOpen, onClose }) {
  const { browserAuth, isInsideTelegram, user } = useUserData();
  const { triggerHaptic } = useTelegram();

  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeGreeting, setWelcomeGreeting] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);

  if (!isOpen || isInsideTelegram) return null;

  const isVipCode = code.trim().toUpperCase().startsWith('VIP');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Введите ваш никнейм');
      triggerHaptic('error');
      return;
    }

    if (mode === 'register') {
      if (!code.trim()) {
        setError('Введите один из 12 выданных кодов регистрации');
        triggerHaptic('error');
        return;
      }

      if (password.length < 4) {
        setError('Пароль должен содержать не менее 4 символов');
        triggerHaptic('error');
        return;
      }

      if (password !== confirmPassword) {
        setError('Пароли не совпадают');
        triggerHaptic('error');
        return;
      }
    } else {
      if (!password) {
        setError('Введите пароль');
        triggerHaptic('error');
        return;
      }
    }

    setLoading(true);
    const result = await browserAuth({
      username: cleanUser,
      password,
      confirmPassword,
      code: code.trim(),
      action: mode,
    });
    setLoading(false);

    if (result.success) {
      triggerHaptic('success');
      if (mode === 'register') {
        setWelcomeGreeting(result.greeting || `Добро пожаловать, ${cleanUser}! 🎄`);
        setRegisteredUser(result.user);
      } else {
        if (onClose) onClose();
      }
    } else {
      setError(result.error || 'Ошибка авторизации');
      triggerHaptic('error');
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  // If already authenticated and user clicked dev button to open modal, can close.
  const canClose = Boolean(user) && !welcomeGreeting;

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

        {/* WELCOME SUCCESS SCREEN */}
        {welcomeGreeting ? (
          <div className="flex flex-col items-center text-center py-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-400/20 to-emerald-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-4 shadow-[0_0_30px_rgba(245,158,11,0.4)]">
              <Gift className="w-9 h-9 text-amber-400 animate-pulse" />
            </div>

            <h2 className="text-xl font-black text-white">{welcomeGreeting}</h2>

            <div className="mt-3 p-3.5 rounded-2xl bg-zinc-900/80 border border-amber-500/30 w-full text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Регистрация завершена!</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {registeredUser?.is_vip ? (
                  <span className="text-amber-300 font-semibold flex items-center gap-1 mt-0.5">
                    <Crown className="w-3.5 h-3.5" /> VIP-аккаунт активен: начислено 5000 UC и золотая рамка!
                  </span>
                ) : (
                  'Стандартный аккаунт создан. Стартовый баланс 0 UC. Спины начисляет Администратор.'
                )}
              </p>
            </div>

            <div className="w-full mt-5">
              <GoldButton
                variant="gold"
                className="w-full"
                onClick={() => {
                  setWelcomeGreeting('');
                  if (onClose) onClose();
                }}
              >
                <span>Войти на платформу 🚀</span>
              </GoldButton>
            </div>
          </div>
        ) : (
          <>
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
                {mode === 'register' ? 'Введите выданный код слота для регистрации' : 'Вход для игроков и администратора'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
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
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Form */}
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
                    placeholder="Например: SantaGamer"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  />
                </div>
              </div>

              {/* Registration Code Input (REGISTER MODE ONLY) */}
              {mode === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                    <span>Код регистрации (1 из 12)</span>
                    {isVipCode && (
                      <span className="text-[10px] font-black text-amber-400 flex items-center gap-0.5">
                        <Crown className="w-3 h-3" /> VIP слот!
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-amber-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Введите ваш код регистрации (напр. NY26-XXXX)"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all uppercase"
                    />
                  </div>
                  {isVipCode ? (
                    <span className="text-[10px] text-amber-400 font-medium">
                      ✨ Обнаружен VIP код! 5000 UC стартового баланса и золотая рамка профиля.
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      Стандартный код (0 UC стартового баланса). Доступно ровно 12 слотов.
                    </span>
                  )}
                </div>
              )}

              {/* Password Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-zinc-300">Пароль</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (REGISTER MODE ONLY) */}
              {mode === 'register' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-300">Подтвердите пароль</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите пароль"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all"
                    />
                  </div>
                </div>
              )}

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

            {/* Admin hint in login mode */}
            {mode === 'login' && (
              <div className="mt-3 text-center">
                <p className="text-[10px] text-zinc-500">
                  Администратор может войти под логином <strong className="text-zinc-400">admin</strong>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
