'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Award,
  TreePine,
  CheckCircle2,
} from 'lucide-react';

const SEGMENT_COLORS = [
  '#b91c1c', // Ruby Red
  '#065f46', // Emerald Pine
  '#1e3a8a', // Winter Blue
  '#991b1b', // Deep Crimson
  '#047857', // Forest Green
  '#6b21a8', // Royal Purple
  '#d97706', // Festive Amber Gold
  '#0f766e', // Frosty Teal
  '#be185d', // Berry Pink
  '#854d0e', // Ancient Gold
];

export default function ChristmasSpinWheel() {
  const { user, stats, playSpin } = useUserData();
  const { triggerHaptic } = useTelegram();

  const [segments, setSegments] = useState([]);
  const [wheelEnabled, setWheelEnabled] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonReward, setWonReward] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const audioCtxRef = useRef(null);
  const tickIntervalRef = useRef(null);
  const spinTimeoutRef = useRef(null);

  // Fetch wheel segments and status in parallel
  useEffect(() => {
    let ignore = false;
    async function fetchWheel() {
      try {
        const [wheelRes, cfgRes] = await Promise.all([
          fetch('/api/admin/wheel'),
          fetch('/api/admin/spins'),
        ]);

        if (ignore) return;

        if (wheelRes.ok) {
          const data = await wheelRes.json();
          if (data.success && Array.isArray(data.segments)) {
            setSegments(data.segments);
          }
        } else {
          setSegments(CHRISTMAS_REWARDS.slice(0, 10));
        }

        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData.spin_wheel_enabled !== undefined) {
            setWheelEnabled(Boolean(cfgData.spin_wheel_enabled));
          }
        }
      } catch {
        if (!ignore) {
          setSegments(CHRISTMAS_REWARDS.slice(0, 10));
        }
      }
    }

    fetchWheel();

    return () => {
      ignore = true;
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const activeSegments = useMemo(() => {
    const list = segments.length > 0 ? segments : CHRISTMAS_REWARDS.slice(0, 10);
    return list.slice(0, 10);
  }, [segments]);

  const numSegments = activeSegments.length || 10;
  const segmentAngle = 360 / numSegments;

  // Sound generator
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio fallback
    }
  };

  const playWinCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#ef4444', '#38bdf8'],
      });
    } catch {
      // Fallback
    }
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    setErrorMessage('');

    if (!user) {
      setErrorMessage('Войдите или зарегистрируйтесь, чтобы крутить колесо');
      return;
    }

    if (!wheelEnabled) {
      setErrorMessage('Колесо Фортуны временно отключено Администратором');
      return;
    }

    if ((stats.freeSpins || 0) <= 0) {
      setErrorMessage('У вас нет бесплатных спинов. Обратитесь к Администратору для начисления спинов.');
      triggerHaptic('error');
      return;
    }

    setIsSpinning(true);
    triggerHaptic('impact');

    const result = await playSpin();

    if (!result.success) {
      setIsSpinning(false);
      setErrorMessage(result.error || 'Ошибка при вращении');
      triggerHaptic('error');
      return;
    }

    const won = result.reward;

    // Find segment index matching won reward
    let targetIndex = activeSegments.findIndex((s) => s.id === won.id || s.rewardId === won.id);
    if (targetIndex === -1) {
      // Match by rarity
      targetIndex = activeSegments.findIndex((s) => s.rarity === won.rarity);
      if (targetIndex === -1) targetIndex = 0;
    }

    // Top pointer is at 0 degrees (12 o'clock).
    // Segment i spans from (i * angle) to ((i + 1) * angle).
    // Center of segment is i * angle + angle / 2.
    // To bring that center under top pointer (270 or 0 deg), rotate clockwise:
    const segmentCenter = targetIndex * segmentAngle + segmentAngle / 2;
    const targetOffset = 360 - segmentCenter;

    // Perform 5 full spins (1800 deg) + current offset
    const currentBaseRot = Math.ceil(rotation / 360) * 360;
    const nextRotation = currentBaseRot + 1800 + targetOffset;

    setRotation(nextRotation);

    // Audio clicks during spin
    let tickCount = 0;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      tickCount++;
      playTickSound();
      if (tickCount > 35) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }, 110);

    // Animation takes 4.5 seconds
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = setTimeout(() => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      setIsSpinning(false);
      setWonReward(won);
      triggerHaptic('success');
      playWinCelebration();
    }, 4500);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2 animate-in fade-in duration-300">
      {/* Top Status & Controls */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-amber-500/30 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <TreePine className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5">
              <span>Рождественское Колесо</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                2026
              </span>
            </h2>
            <p className="text-[10px] text-zinc-400">Вращай и выигрывай праздничные артефакты</p>
          </div>
        </div>

        {/* Sound toggle */}
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Disabled Banner */}
      {!wheelEnabled && (
        <div className="w-full p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Колесо Фортуны временно отключено Администратором на техническое обслуживание.</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="w-full p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* THE CIRCULAR WHEEL CONTAINER */}
      <div className="relative flex items-center justify-center my-3 select-none">
        {/* Needle / Top Pointer with Christmas Bow */}
        <div className="absolute -top-4 z-20 flex flex-col items-center pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 border border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.8)] flex items-center justify-center text-[10px]">
            ❄️
          </div>
          <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[18px] border-t-amber-400 -mt-1 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Outer Festive Golden Ring */}
        <div className="w-[min(84vw,320px)] h-[min(84vw,320px)] sm:w-[350px] sm:h-[350px] rounded-full p-2.5 sm:p-3 bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-600 border-4 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.35)] flex items-center justify-center">
          {/* Rotating Wheel Canvas/SVG */}
          <div
            className="w-full h-full rounded-full overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg) translateZ(0)`,
              transition: isSpinning ? 'transform 4.5s cubic-bezier(0.12, 0.8, 0.15, 1)' : 'none',
              willChange: 'transform',
            }}
          >
            <svg viewBox="0 0 400 400" className="w-full h-full">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>

              {activeSegments.map((seg, i) => {
                const startA = (i * segmentAngle * Math.PI) / 180;
                const endA = ((i + 1) * segmentAngle * Math.PI) / 180;

                const x1 = 200 + 195 * Math.sin(startA);
                const y1 = 200 - 195 * Math.cos(startA);
                const x2 = 200 + 195 * Math.sin(endA);
                const y2 = 200 - 195 * Math.cos(endA);

                const pathData = `M 200 200 L ${x1} ${y1} A 195 195 0 0 1 ${x2} ${y2} Z`;

                const midA = ((i + 0.5) * segmentAngle * Math.PI) / 180;
                const textX = 200 + 125 * Math.sin(midA);
                const textY = 200 - 125 * Math.cos(midA);
                const textRot = (i + 0.5) * segmentAngle;

                return (
                  <g key={seg.id || i}>
                    <path
                      d={pathData}
                      fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                      stroke="#fef08a"
                      strokeWidth="2.5"
                    />
                    {/* Item label */}
                    <text
                      x={textX}
                      y={textY}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="900"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      transform={`rotate(${textRot + 90}, ${textX}, ${textY})`}
                      filter="url(#shadow)"
                    >
                      {seg.name.length > 12 ? seg.name.slice(0, 11) + '..' : seg.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Golden Center Hub */}
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-700 border-4 border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.8)] flex flex-col items-center justify-center pointer-events-none">
            <Sparkles className="w-6 h-6 text-black animate-spin" style={{ animationDuration: '8s' }} />
            <span className="text-[9px] font-black text-black uppercase tracking-tight">LUCKY</span>
          </div>
        </div>
      </div>

      {/* Action / Spin Button */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2 mt-1">
        <GoldButton
          variant="gold"
          className="w-full py-3.5 text-sm font-black"
          onClick={handleSpin}
          disabled={isSpinning || !wheelEnabled || (stats.freeSpins || 0) <= 0}
        >
          {isSpinning ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              Колесо крутится...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>КРУТИТЬ КОЛЕСО ({stats.freeSpins} СПИНОВ)</span>
            </span>
          )}
        </GoldButton>

        <span className="text-[11px] text-zinc-400">
          Осталось спинов: <strong className="text-amber-300">{stats.freeSpins}</strong> • Баланс: <strong className="text-amber-300">{stats.totalUc} UC</strong>
        </span>
      </div>

      {/* CELEBRATION WIN MODAL */}
      {wonReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl border border-amber-400/60 p-6 bg-gradient-to-b from-zinc-900/98 via-zinc-950 to-black shadow-[0_0_60px_rgba(245,158,11,0.4)] text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-400/20 to-emerald-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 mx-auto mb-3 shadow-[0_0_25px_rgba(245,158,11,0.5)]">
              <Gift className="w-9 h-9 text-amber-400 animate-bounce" />
            </div>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> ВЫИГРЫШ!
            </span>

            <h3 className="text-xl font-black text-white">{wonReward.name}</h3>

            <div className="my-2 flex justify-center">
              <RarityBadge rarity={wonReward.rarity} />
            </div>

            <p className="text-xs text-zinc-300 mt-2 max-w-xs mx-auto leading-relaxed">
              {wonReward.description || 'Награда добавлена в ваш новогодний инвентарь!'}
            </p>

            <div className="mt-5">
              <GoldButton
                variant="gold"
                className="w-full"
                onClick={() => setWonReward(null)}
              >
                <span>Забрать награду 🎁</span>
              </GoldButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
