'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import { CHRISTMAS_REWARDS, REWARDS_CATALOG } from '../../lib/catalog-data';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Coins,
  RotateCcw,
  Gift,
  Check,
  Ban,
  ArrowLeft,
  Search,
  Sparkles,
  KeyRound,
  FileText,
  ToggleLeft,
  ToggleRight,
  Send,
  Crown,
  AlertCircle,
  Clock,
} from 'lucide-react';

export default function AdminPage() {
  const { user } = useUserData();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'gifts' | 'spins' | 'wheel' | 'logs'

  // Subsystems data
  const [players, setPlayers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [wheelSegments, setWheelSegments] = useState([]);
  const [isWheelEnabled, setIsWheelEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Form states: Gift Management
  const [giftTargetUser, setGiftTargetUser] = useState('');
  const [giftRewardId, setGiftRewardId] = useState(CHRISTMAS_REWARDS[0]?.id || 'reward-xmas-sticker');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftMessage, setGiftMessage] = useState('С Новым Годом от Администрации Lucky UC! 🎄');

  // Form states: Spins Management
  const [spinTargetUser, setSpinTargetUser] = useState('ALL');
  const [spinAmount, setSpinAmount] = useState(5);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, spinRes, wheelRes, logRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/spins'),
        fetch('/api/admin/wheel'),
        fetch('/api/admin/logs'),
      ]);

      if (userRes.ok) {
        const uData = await userRes.json();
        if (uData.success) {
          setPlayers(uData.users || []);
          setCodes(uData.codes || []);
        }
      }
      if (spinRes.ok) {
        const sData = await spinRes.json();
        if (sData.success) {
          setIsWheelEnabled(Boolean(sData.spin_wheel_enabled));
        }
      }
      if (wheelRes.ok) {
        const wData = await wheelRes.json();
        if (wData.success && Array.isArray(wData.segments)) {
          setWheelSegments(wData.segments);
        }
      }
      if (logRes.ok) {
        const lData = await logRes.json();
        if (lData.success) {
          setLogs(lData.logs || []);
        }
      }
    } catch (err) {
      console.warn('Admin fetch notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (user?.is_admin) {
      async function initAdmin() {
        try {
          const [userRes, spinRes, wheelRes, logRes] = await Promise.all([
            fetch('/api/admin/users'),
            fetch('/api/admin/spins'),
            fetch('/api/admin/wheel'),
            fetch('/api/admin/logs'),
          ]);
          if (ignore) return;
          if (userRes.ok) {
            const uData = await userRes.json();
            if (uData.success) {
              setPlayers(uData.users || []);
              setCodes(uData.codes || []);
            }
          }
          if (spinRes.ok) {
            const sData = await spinRes.json();
            if (sData.success) {
              setIsWheelEnabled(Boolean(sData.spin_wheel_enabled));
            }
          }
          if (wheelRes.ok) {
            const wData = await wheelRes.json();
            if (wData.success && Array.isArray(wData.segments)) {
              setWheelSegments(wData.segments);
            }
          }
          if (logRes.ok) {
            const lData = await logRes.json();
            if (lData.success) {
              setLogs(lData.logs || []);
            }
          }
        } catch (err) {
          console.warn('Admin fetch notice:', err);
        }
      }
      initAdmin();
    }
    return () => {
      ignore = true;
    };
  }, [user?.id, user?.is_admin]);

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-white">Доступ ограничен</h1>
        <p className="text-xs text-zinc-400 max-w-sm mt-2 mb-6">
          Этот раздел защищён и доступен исключительно администраторам платформы LUCKY UC.
        </p>
        <Link href="/">
          <GoldButton variant="gold">
            <span>Вернуться на главную</span>
          </GoldButton>
        </Link>
      </div>
    );
  }

  // Action: Toggle User Block
  const handleToggleBlock = async (targetUserId) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action: 'toggle_block' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Статус блокировки игрока изменен!' });
        fetchAdminData();
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Ошибка изменения статуса' });
    }
  };

  // Action: Grant Gift
  const handleGrantGift = async (e) => {
    e.preventDefault();
    if (!giftTargetUser) {
      setStatusMsg({ type: 'error', text: 'Выберите игрока-получателя' });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/admin/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: giftTargetUser,
          rewardId: giftRewardId,
          quantity: giftQuantity,
          message: giftMessage,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Награда успешно начислена игроку @${data.target}!` });
        fetchAdminData();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Ошибка начисления награды' });
      }
    } catch (err) {
      setLoading(false);
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Grant Spins
  const handleGrantSpins = async (amountToGrant, isAll = false) => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant_spins',
          targetUserId: isAll ? null : spinTargetUser,
          amount: amountToGrant,
          allUsers: isAll,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: isAll
            ? `Начислено ${amountToGrant} спинов ВСЕМ игрокам платформы!`
            : `Начислено ${amountToGrant} спинов игроку @${data.target}!`,
        });
        fetchAdminData();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Ошибка начисления спинов' });
      }
    } catch (err) {
      setLoading(false);
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Toggle Wheel Feature
  const handleToggleWheel = async () => {
    try {
      const next = !isWheelEnabled;
      const res = await fetch('/api/admin/spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_spin_feature',
          enabled: next,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsWheelEnabled(data.spin_wheel_enabled);
        setStatusMsg({
          type: 'success',
          text: data.spin_wheel_enabled
            ? 'Колесо Фортуны ВКЛЮЧЕНО для всех игроков!'
            : 'Колесо Фортуны ОТКЛЮЧЕНО на техническое обслуживание!',
        });
        fetchAdminData();
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Ошибка переключения колеса' });
    }
  };

  const nonAdminPlayers = players.filter((p) => !p.is_admin);

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-amber-400/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              <span>Панель Администратора</span>
            </h1>
            <p className="text-xs text-zinc-400">Управление 12 слотами игроков, подарками, спинами и колесом</p>
          </div>
        </div>
      </div>

      {/* Status Feedback Toast/Banner */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="font-bold underline text-[11px] ml-2">
            OK
          </button>
        </div>
      )}

      {/* 4 Core Admin Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-zinc-800 pb-2">
        {[
          { id: 'users', label: '1. Игроки (12 слотов)', icon: Users },
          { id: 'gifts', label: '2. Выдача подарков', icon: Gift },
          { id: 'spins', label: '3. Управление спинами', icon: RotateCcw },
          { id: 'wheel', label: '4. Колесо Фортуны', icon: Sparkles },
          { id: 'logs', label: '5. Аудит-логи', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStatusMsg(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: USERS & 12 SLOTS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GlassCard className="p-3.5">
              <span className="text-[11px] text-zinc-400">Занято слотов</span>
              <div className="text-2xl font-black text-white mt-1">
                {nonAdminPlayers.length} / 12
              </div>
              <span className="text-[10px] text-amber-400 mt-0.5 block">
                {12 - nonAdminPlayers.length} слотов свободно
              </span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[11px] text-zinc-400">VIP игроки</span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {nonAdminPlayers.filter((p) => p.is_vip).length} / 2
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">5000 UC баланс</span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[11px] text-zinc-400">Standard игроки</span>
              <div className="text-2xl font-black text-sky-400 mt-1">
                {nonAdminPlayers.filter((p) => !p.is_vip).length} / 10
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">0 UC баланс</span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[11px] text-zinc-400">Всего спинов у игроков</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {nonAdminPlayers.reduce((acc, p) => acc + (p.free_spins_balance || 0), 0)}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">активные попытки</span>
            </GlassCard>
          </div>

          {/* Registered Players List */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider px-1">
              Зарегистрированные игроки ({nonAdminPlayers.length} из 12)
            </h3>

            {nonAdminPlayers.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-xs text-zinc-400">Пока ни один игрок не зарегистрировался</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Раздайте 12 кодов регистрации участникам.
                </p>
              </GlassCard>
            ) : (
              <div className="flex flex-col gap-2">
                {nonAdminPlayers.map((p) => (
                  <GlassCard key={p.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full overflow-hidden p-0.5 ${
                            p.is_vip ? 'vip-golden-frame' : 'border border-zinc-700'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={p.username}
                            className="w-full h-full object-cover rounded-full bg-zinc-900"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">@{p.username}</span>
                          {p.is_vip ? (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> VIP (5000 UC)
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-400/30">
                              Standard
                            </span>
                          )}
                          {p.is_blocked && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                              Заблокирован
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                          <span>Баланс: <strong className="text-amber-300">{p.total_uc || 0} UC</strong></span>
                          <span>Спинов: <strong className="text-sky-300">{p.free_spins_balance || 0}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleBlock(p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          p.is_blocked
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                        }`}
                      >
                        {p.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>

          {/* 12 Registration Codes Tracker */}
          <div className="flex flex-col gap-2 mt-2">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider px-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              12 Кодов регистрации (10 Standard + 2 VIP)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {codes.map((c) => (
                <div
                  key={c.code}
                  className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                    c.isUsed || c.is_used
                      ? 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                      : c.type === 'vip'
                      ? 'bg-amber-500/10 border-amber-400/40 text-amber-300'
                      : 'bg-zinc-900/80 border-zinc-700/60 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm tracking-wider">{c.code}</span>
                    <span className="text-[9px] font-bold uppercase">{c.type}</span>
                  </div>
                  <div className="mt-1 text-[10px]">
                    {c.isUsed || c.is_used ? (
                      <span className="text-zinc-500 font-medium">Использован</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">Свободен для ввода</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GIFT MANAGEMENT */}
      {activeTab === 'gifts' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <GlassCard className="p-5 rounded-3xl border border-amber-500/20">
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Выдать новогоднюю награду игроку</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Администратор может начислить любой предмет из каталога (15 рождественских сувениров, титулы, UC) с персональным сообщением.
            </p>

            <form onSubmit={handleGrantGift} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Игрок-получатель:</label>
                <select
                  value={giftTargetUser}
                  onChange={(e) => setGiftTargetUser(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Выберите игрока --</option>
                  {nonAdminPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      @{p.username} ({p.is_vip ? 'VIP' : 'Standard'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Награда из каталога:</label>
                <select
                  value={giftRewardId}
                  onChange={(e) => setGiftRewardId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <optgroup label="🎄 15 Рождественских Наград">
                    {CHRISTMAS_REWARDS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.rarity})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎁 Общий каталог наград">
                    {REWARDS_CATALOG.filter((r) => r.category !== 'christmas').map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.rarity})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Количество предметов:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={giftQuantity}
                  onChange={(e) => setGiftQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Поздравительное сообщение:</label>
                <textarea
                  rows={2}
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Сообщение, которое увидит игрок в центре уведомлений..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <GoldButton type="submit" variant="gold" className="w-full mt-2" disabled={loading}>
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Выдать подарок игроку 🎁</span>
                </span>
              </GoldButton>
            </form>
          </GlassCard>
        </div>
      )}

      {/* TAB 3: SPINS MANAGEMENT */}
      {activeTab === 'spins' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {/* Global Toggle */}
          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Функция «Колесо Фортуны»</span>
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isWheelEnabled ? 'Колесо доступно для вращений игроками' : 'Колесо отключено на техобслуживание'}
              </p>
            </div>

            <button
              onClick={handleToggleWheel}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isWheelEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {isWheelEnabled ? 'ВКЛЮЧЕНО (Отключить)' : 'ОТКЛЮЧЕНО (Включить)'}
            </button>
          </GlassCard>

          {/* Mass Grant Spins */}
          <GlassCard className="p-5 rounded-3xl border border-amber-500/20">
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Массовая выдача спинов</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Быстрое начисление бесплатных вращений всем 12 слотам игроков в честь праздника:
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleGrantSpins(5, true)}
                className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 hover:border-amber-400 text-amber-300 font-black text-xs transition-all cursor-pointer active:scale-95 text-center"
              >
                +5 спинов ВСЕМ 🎄
              </button>

              <button
                onClick={() => handleGrantSpins(10, true)}
                className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 hover:border-amber-400 text-amber-300 font-black text-xs transition-all cursor-pointer active:scale-95 text-center"
              >
                +10 спинов ВСЕМ 🎁
              </button>

              <button
                onClick={() => handleGrantSpins(-5, true)}
                className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 font-bold text-xs transition-all cursor-pointer active:scale-95 text-center"
              >
                -5 спинов всем
              </button>
            </div>
          </GlassCard>

          {/* Individual Spin Grant */}
          <GlassCard className="p-5 rounded-3xl border border-amber-500/20">
            <h3 className="text-sm font-black text-white mb-1">
              Персональная выдача / списание спинов
            </h3>

            <div className="flex flex-col gap-3 mt-3">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Выберите игрока:</label>
                <select
                  value={spinTargetUser}
                  onChange={(e) => setSpinTargetUser(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">Все игроки платформы</option>
                  {nonAdminPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      @{p.username} (Текущий баланс: {p.free_spins_balance || 0} спинов)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Количество спинов (может быть отрицательным):</label>
                <input
                  type="number"
                  value={spinAmount}
                  onChange={(e) => setSpinAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <GoldButton
                variant="gold"
                onClick={() => handleGrantSpins(spinAmount, spinTargetUser === 'ALL')}
                className="w-full mt-1"
                disabled={loading || spinAmount === 0}
              >
                <span>Применить начисление спинов</span>
              </GoldButton>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 4: SPIN WHEEL REWARD CONFIG */}
      {activeTab === 'wheel' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-white">Сегменты Колеса Фортуны</h3>
                <p className="text-xs text-zinc-400">Настройка вероятностей выпадения и призов на колесе</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {wheelSegments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white block">{seg.name}</span>
                      <RarityBadge rarity={seg.rarity} size="xs" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 text-[11px]">
                      Шанс: <strong className="text-amber-300">{seg.weight || 10}%</strong>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Активен
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-3 animate-in fade-in duration-200">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            История действий Администратора
          </h3>

          {logs.length === 0 ? (
            <GlassCard className="p-6 text-center text-xs text-zinc-400">
              Логи пока пусты
            </GlassCard>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <GlassCard key={log.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 uppercase text-[10px]">
                      {log.actionType}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(log.createdAt).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="mt-1 text-zinc-300">
                    Цель: <strong className="text-white">@{log.targetUsername}</strong>
                  </div>
                  {log.details && (
                    <div className="mt-1 text-[11px] text-zinc-400 bg-black/40 p-1.5 rounded-lg font-mono">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
