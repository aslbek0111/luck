'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import GoldButton from '../ui/GoldButton';
import RarityBadge from '../ui/RarityBadge';
import { CHRISTMAS_REWARDS, REWARDS_CATALOG, RARITIES } from '../../lib/catalog-data';
import {
  RotateCcw,
  Sparkles,
  Gift,
  Volume2,
  VolumeX,
  AlertCircle,
  Coins,
  Crown,
  TreePine,
  CheckCircle2,
  Star,
  Flame,
  Award,
  Globe,
  Candy,
  Smile,
  ShieldCheck,
} from 'lucide-react';

const ROW_HEIGHT = 100; // px per item row
const VIEWPORT_HEIGHT = 300; // px (3 items visible: index-1, selected index, index+1)
const CENTER_OFFSET = 100; // px top of center selection window
const STRIP_LENGTH = 45; // total items in the reel strip
const TARGET_INDEX = 38; // exact landing index inside the strip

// Icon mapper for catalog items
function RewardIcon({ iconName, className = 'w-6 h-6' }) {
  switch (iconName) {
    case 'TreePine':
      return <TreePine className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Globe':
      return <Globe className={className} />;
    case 'Candy':
      return <Candy className={className} />;
    case 'Smile':
      return <Smile className={className} />;
    case 'Sparkles':
    case 'Sparkle':
      return <Sparkles className={className} />;
    default:
      return <Gift className={className} />;
  }
}

export default function ChristmasPrizeReel() {
  const { user, stats, playSpin } = useUserData();
  const { triggerHaptic } = useTelegram();

  const [reelEnabled, setReelEnabled] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonReward, setWonReward] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('lucky_reel_sound');
    return saved === null ? true : saved === 'true';
  });
  const [errorMessage, setErrorMessage] = useState('');

  // Audio Context ref
  const audioCtxRef = useRef(null);
  const tickTimerRef = useRef(null);
  const winTimeoutRef = useRef(null);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lucky_reel_sound', String(next));
      }
      return next;
    });
  };

  // Check if reel is enabled from backend
  useEffect(() => {
    let ignore = false;
    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/spins');
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.spin_wheel_enabled !== undefined) {
            setReelEnabled(Boolean(data.spin_wheel_enabled));
          }
        }
      } catch {
        // keep default enabled
      }
    }
    checkStatus();
    return () => {
      ignore = true;
    };
  }, []);

  // Web Audio Synthesizer
  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {
      // AudioContext blocked
    }
  }, []);

  const playClickSound = useCallback(() => {
    if (!soundEnabled || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480 + Math.random() * 80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  const playWinFanfare = useCallback(() => {
    if (!soundEnabled || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.5);
      });
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Generate initial strip cards
  const pool = useMemo(() => {
    return [...CHRISTMAS_REWARDS, ...REWARDS_CATALOG.filter((r) => r.category === 'uc' || r.category === 'titles')];
  }, []);

  const [stripItems, setStripItems] = useState(() => {
    const initial = [];
    for (let i = 0; i < STRIP_LENGTH; i++) {
      initial.push(pool[i % pool.length]);
    }
    return initial;
  });

  const [scrollOffset, setScrollOffset] = useState(0); // in px
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Is current user an Admin or VIP?
  const isVipAdmin = Boolean(user?.is_vip || user?.is_admin);
  const spinsLeft = isVipAdmin ? 999999 : stats.freeSpins;

  // Spin handler
  const handleSpin = async () => {
    if (isSpinning) return;
    setErrorMessage('');
    initAudio();

    if (!user) {
      setErrorMessage('Войдите в аккаунт, чтобы крутить слот!');
      triggerHaptic('error');
      return;
    }

    if (!reelEnabled) {
      setErrorMessage('Слот-приз временно на техническом обслуживании.');
      triggerHaptic('error');
      return;
    }

    if (!isVipAdmin && stats.freeSpins <= 0) {
      setErrorMessage('У вас закончились бесплатные спины!');
      triggerHaptic('error');
      return;
    }

    setIsSpinning(true);
    triggerHaptic('impact');

    try {
      // 1. Request server-side spin result (100% authoritative RNG)
      const res = await playSpin();

      if (!res.success) {
        setIsSpinning(false);
        setErrorMessage(res.error || 'Ошибка вращения слота');
        triggerHaptic('error');
        return;
      }

      const awarded = res.reward;
      setWonReward(awarded);

      // 2. Prepare strip cards with server reward placed precisely at TARGET_INDEX
      const newStrip = [];
      for (let i = 0; i < STRIP_LENGTH; i++) {
        if (i === TARGET_INDEX) {
          newStrip.push(awarded);
        } else {
          newStrip.push(pool[Math.floor(Math.random() * pool.length)]);
        }
      }
      setStripItems(newStrip);

      // 3. Reset position to top without transition
      setIsTransitioning(false);
      setScrollOffset(0);

      // 4. Force browser paint then animate downwards/upwards through cards
      // The strip moves upwards, so translateY is negative
      // We want card at TARGET_INDEX to be at CENTER_OFFSET (100px from top):
      // cardTop = TARGET_INDEX * ROW_HEIGHT + translateY = CENTER_OFFSET
      // translateY = -(TARGET_INDEX * ROW_HEIGHT - CENTER_OFFSET)
      const targetTranslateY = -(TARGET_INDEX * ROW_HEIGHT - CENTER_OFFSET);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          setScrollOffset(targetTranslateY);

          // Mechanical clicking sound ticker
          let tickDelay = 35;
          let elapsed = 0;
          const totalDuration = 4200;

          const runTicker = () => {
            playClickSound();
            elapsed += tickDelay;
            // Gradual deceleration curve
            const progress = elapsed / totalDuration;
            tickDelay = 35 + Math.pow(progress, 3) * 280;

            if (elapsed < totalDuration) {
              tickTimerRef.current = setTimeout(runTicker, tickDelay);
            }
          };
          tickTimerRef.current = setTimeout(runTicker, tickDelay);
        });
      });

      // 5. Completion callback after transition
      winTimeoutRef.current = setTimeout(() => {
        setIsSpinning(false);
        playWinFanfare();
        triggerHaptic('success');

        // Confetti burst
        confetti({
          particleCount: 100,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#ef4444', '#38bdf8', '#a855f7'],
        });

        // Show win celebration modal
        setShowWinModal(true);
      }, 4300);
    } catch (err) {
      setIsSpinning(false);
      setErrorMessage(err.message || 'Ошибка связи с сервером');
      triggerHaptic('error');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto animate-in fade-in duration-300">
      {/* Slot Machine Main Housing */}
      <div className="w-full relative rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.2)] p-3 sm:p-4 overflow-hidden">
        {/* Festive Christmas Garland Bulbs */}
        <div className="flex items-center justify-between px-3 py-1 mb-2 border-b border-amber-500/15">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 garland-bulb-1 shadow-[0_0_8px_#ef4444]" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 garland-bulb-2 shadow-[0_0_8px_#34d399]" />
            <span className="w-2 h-2 rounded-full bg-amber-400 garland-bulb-3 shadow-[0_0_8px_#fbbf24]" />
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <span>PRIZE REEL</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                2026
              </span>
            </span>
          </div>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={toggleSound}
            className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
            title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Vertical Reel Viewport */}
        <div
          className="relative w-full rounded-2xl bg-zinc-950/90 border border-zinc-800 overflow-hidden shadow-inner"
          style={{ height: `${VIEWPORT_HEIGHT}px` }}
        >
          {/* Top Fade Gradient */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-10" />

          {/* Bottom Fade Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-10" />

          {/* Fixed Center Selection Window with Golden Glow & Indicator Arrows */}
          <div
            className="absolute left-2 right-2 rounded-2xl pointer-events-none z-20 flex items-center justify-between px-1.5"
            style={{
              top: `${CENTER_OFFSET}px`,
              height: `${ROW_HEIGHT}px`,
            }}
          >
            {/* Glowing Golden Selection Border Frame */}
            <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] bg-amber-500/10 pointer-events-none" />

            {/* Left Indicator Arrow ▶ */}
            <div className="relative z-30 flex items-center text-amber-400 font-black text-xl animate-pulse filter drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] -ml-1">
              ▶
            </div>

            {/* Right Indicator Arrow ◀ */}
            <div className="relative z-30 flex items-center text-amber-400 font-black text-xl animate-pulse filter drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] -mr-1">
              ◀
            </div>
          </div>

          {/* Scrolling Strip of Reward Cards (moving upwards) */}
          <div
            className="w-full flex flex-col"
            style={{
              transform: `translate3d(0, ${scrollOffset}px, 0)`,
              transition: isTransitioning
                ? 'transform 4200ms cubic-bezier(0.12, 0.8, 0.25, 1.0)'
                : 'none',
              willChange: 'transform',
            }}
          >
            {stripItems.map((item, index) => {
              const rarityConfig = RARITIES[item.rarity] || RARITIES.common;
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="w-full px-3 py-1.5 flex items-center justify-center shrink-0"
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  <div
                    className={`w-full h-full rounded-2xl p-2.5 flex items-center justify-between border transition-all ${rarityConfig.border} bg-gradient-to-r ${rarityConfig.cardGradient} shadow-sm`}
                  >
                    {/* Left: Icon & Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${rarityConfig.border} bg-zinc-900/80 shadow-[0_0_12px_rgba(0,0,0,0.5)]`}
                        style={{ color: rarityConfig.color }}
                      >
                        <RewardIcon iconName={item.icon} className="w-6 h-6" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          {item.value > 0 ? (
                            <span className="text-[10px] font-bold text-amber-300">
                              +{item.value} {item.category === 'uc' ? 'UC' : item.category === 'popularity' ? 'Популярности' : 'Очков'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-zinc-400">
                              {item.category === 'titles' ? 'Титул профиля' : 'Новогодний сувенир'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Rarity Tag */}
                    <div className="shrink-0 pl-2">
                      <RarityBadge rarity={item.rarity} size="xs" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message Feedback */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Spin Action Button */}
        <div className="mt-4">
          <GoldButton
            variant="gold"
            size="lg"
            className="w-full py-4 text-sm font-black uppercase tracking-wider relative overflow-hidden"
            onClick={handleSpin}
            disabled={isSpinning || (!isVipAdmin && stats.freeSpins <= 0)}
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                ВРАЩЕНИЕ ЛЕНТЫ...
              </span>
            ) : isVipAdmin ? (
              <span className="flex items-center justify-center gap-1.5 text-black font-black">
                <Crown className="w-4 h-4" />
                БЕСКОНЕЧНЫЕ СПИНЫ (VIP ADMIN) ∞
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 text-black font-black">
                <RotateCcw className="w-4 h-4" />
                ВРАЩАТЬ (ОСТАЛОСЬ: {stats.freeSpins})
              </span>
            )}
          </GoldButton>
        </div>

        {/* VIP Status or Free Spins Footer Status */}
        <div className="mt-3 text-center">
          {isVipAdmin ? (
            <p className="text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              VIP Администратор: неограниченное число бесплатных вращений
            </p>
          ) : (
            <p className="text-[11px] text-zinc-400">
              {stats.freeSpins > 0 
                ? 'Каждое вращение расходует 1 бесплатный спин. Каждые 24 часа начисляются 2 новых спина.' 
                : 'Все спины на сегодня израсходованы. Следующие 2 бесплатных спина будут начислены по таймеру.'}
            </p>
          )}
        </div>
      </div>

      {/* Win Celebration Modal */}
      {showWinModal && wonReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border-2 border-amber-400 p-6 text-center shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-in zoom-in-95 duration-200">
            {/* Christmas Garland / Sparkle Header */}
            <div className="w-16 h-16 rounded-2xl mx-auto mb-3 bg-gradient-to-tr from-amber-500/25 via-yellow-400/20 to-amber-600/30 border border-amber-400/60 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              {wonReward.category === 'coins' ? (
                <Coins className="w-8 h-8 text-amber-300 animate-bounce" />
              ) : (
                <RewardIcon iconName={wonReward.icon} className="w-8 h-8" />
              )}
            </div>

            <span className="text-[10px] font-black tracking-widest uppercase text-amber-400">
              {wonReward.category === 'coins' ? '🪙 ВЫИГРЫШ МОНЕТ! 🪙' : '🎄 ВЫИГРЫШ НА СЛОТЕ 🎄'}
            </span>

            <h3 className="text-xl font-black text-white mt-1 mb-2">
              {wonReward.name}
            </h3>

            <div className="flex justify-center mb-3">
              <RarityBadge rarity={wonReward.rarity} size="sm" />
            </div>

            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              {wonReward.category === 'coins'
                ? `Поздравляем! +${wonReward.value} Монет успешно зачислены на ваш баланс!`
                : wonReward.description || 'Награда успешно зачислена в ваш игровой инвентарь!'}
            </p>

            <GoldButton
              variant="gold"
              className="w-full py-3 text-xs font-bold"
              onClick={() => setShowWinModal(false)}
            >
              <span>Забрать награду 🎁</span>
            </GoldButton>
          </div>
        </div>
      )}
    </div>
  );
}
