'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { Clock, Sparkles, Crown, RotateCcw, CheckCircle2 } from 'lucide-react';

function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function DailySpinsCountdown({ className = '', compact = false }) {
  const { user, stats, checkDailySpins } = useUserData();
  const isVipAdmin = Boolean(user?.is_vip || user?.is_admin);
  const nextAtStr = user?.next_daily_spins_at || stats?.nextDailySpinsAt;
  const targetMs = nextAtStr ? new Date(nextAtStr).getTime() : 0;

  const [secondsRemaining, setSecondsRemaining] = useState(() => stats?.secondsUntilNextSpins || 0);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [targetMs]);

  useEffect(() => {
    if (isVipAdmin || !targetMs) return;

    const computeDiff = () => Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));

    const timer = setInterval(() => {
      const remaining = computeDiff();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          checkDailySpins?.();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isVipAdmin, targetMs, checkDailySpins]);

  if (isVipAdmin) {
    if (compact) {
      return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 ${className}`}>
          <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-[11px] font-black text-amber-300">VIP: ∞ СПИНОВ</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 ${className}`}>
        <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <span className="text-xs font-black text-amber-300 block">VIP Статус активен</span>
          <span className="text-[10px] text-zinc-400">Вам доступны неограниченные новогодние вращения</span>
        </div>
      </div>
    );
  }

  const isReady = secondsRemaining <= 0;
  const timeFormatted = formatCountdown(secondsRemaining);

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${isReady ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'} border shadow-sm ${className}`}>
        <Clock className={`w-3.5 h-3.5 ${isReady ? 'text-emerald-400 animate-bounce' : 'text-amber-400'}`} />
        <span className="text-[11px] font-mono font-bold tracking-wider">
          {isReady ? '2 спина готовы!' : timeFormatted}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-2xl border transition-all ${
      isReady 
        ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
        : 'bg-zinc-900/90 border-zinc-800/90 shadow-sm'
    } ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isReady ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">
                {isReady ? 'Бесплатные спины доступны!' : 'Следующие 2 бесплатных спина'}
              </span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <p className="text-[10px] text-zinc-400">
              {isReady 
                ? 'Начислено 2 спина. Крутите колесо удачи!' 
                : 'Каждые 24 часа начисляются 2 бесплатных вращения'}
            </p>
          </div>
        </div>

        {/* Live Timer Display */}
        <div className="text-right shrink-0">
          <div className={`text-sm sm:text-base font-black font-mono tracking-widest ${
            isReady ? 'text-emerald-400 animate-pulse' : 'text-amber-300'
          }`}>
            {isReady ? '+2 СПИНА' : timeFormatted}
          </div>
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
            {isReady ? 'Готово' : 'Таймер 24ч'}
          </span>
        </div>
      </div>
    </div>
  );
}
