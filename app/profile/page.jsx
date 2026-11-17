'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUserData } from '../../hooks/useUserData';
import { useTelegram } from '../../hooks/useTelegram';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import Toast from '../../components/ui/Toast';
import {
  User,
  ShieldCheck,
  Award,
  RotateCcw,
  Coins,
  Flame,
  ArrowLeft,
  Crown,
  Gift,
  Sparkles,
  Box,
  ChevronRight,
  Send,
  Download,
  CheckCircle2,
  LogOut,
  Copy,
  Check,
  Search,
  Zap,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, stats, activeTitle, inventory, giftsHistory, lastWins, logout } = useUserData();
  const { triggerHaptic } = useTelegram();

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'wins' | 'gifts'
  const [inventorySearch, setInventorySearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Player level calculations
  const playerLevel = Math.max(1, Math.floor((stats.spinsCount || 0) / 10) + 1);
  const currentLevelSpins = (stats.spinsCount || 0) % 10;
  const levelProgressPercent = (currentLevelSpins / 10) * 100;

  // Filter inventory in tab
  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return inventory;
    const q = inventorySearch.toLowerCase().trim();
    return inventory.filter((item) => item.name.toLowerCase().includes(q));
  }, [inventory, inventorySearch]);

  const handleCopyUsername = () => {
    if (!user?.username) return;
    try {
      navigator.clipboard.writeText(`@${user.username}`);
      setCopied(true);
      triggerHaptic('success');
      setToastMessage(`Никнейм @${user.username} скопирован в буфер обмена!`);
      setTimeout(() => {
        setCopied(false);
        setToastMessage('');
      }, 2500);
    } catch {
      // Fallback
    }
  };

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Toast Notification */}
      <Toast message={toastMessage} type="success" onClose={() => setToastMessage('')} />

      {/* Top Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-amber-400/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Профиль Игрока</h1>
            <p className="text-xs text-zinc-400">Статистика, титулы и коллекция наград</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.is_admin && (
            <Link href="/admin">
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" /> Админ
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-all cursor-pointer shadow-sm"
            title="Выйти из аккаунта"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* 1. Main Hero Identity Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 border border-amber-500/30 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black shadow-2xl">
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{ backgroundColor: activeTitle ? activeTitle.accentColor : '#f59e0b' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Avatar with luxury golden ring */}
          <div className="relative shrink-0">
            <div
              className={`w-24 h-24 rounded-full overflow-hidden p-1 ${
                user.is_vip
                  ? 'vip-golden-frame'
                  : 'border-2 border-amber-400 bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-500 shadow-[0_0_30px_rgba(245,158,11,0.45)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={user.username}
                className="w-full h-full object-cover rounded-full bg-zinc-900"
              />
            </div>
            {user.is_vip && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-black text-[10px] font-black rounded-full px-2 py-0.5 shadow-lg border border-black flex items-center gap-1">
                <Crown className="w-3 h-3" /> VIP
              </span>
            )}
            {user.is_admin && !user.is_vip && (
              <span className="absolute bottom-0 right-0 bg-amber-500 text-black text-xs font-black rounded-full p-1.5 shadow-lg border border-black">
                <ShieldCheck className="w-4 h-4" />
              </span>
            )}
          </div>

          {/* User Meta Info */}
          <div className="flex-1 flex flex-col items-center sm:items-start">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                @{user.username}
              </h2>
              <button
                onClick={handleCopyUsername}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Скопировать никнейм"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <span className="text-xs text-zinc-400 font-semibold">
                ({user.first_name} {user.last_name || ''})
              </span>
            </div>

            {/* Active Title Card */}
            <div className="mt-2 flex items-center gap-2">
              {activeTitle ? (
                <Link href="/titles" className="group">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md transition-all group-hover:scale-105"
                    style={{
                      color: activeTitle.accentColor,
                      borderColor: `${activeTitle.accentColor}66`,
                      backgroundColor: `${activeTitle.accentColor}20`,
                    }}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    {activeTitle.name}
                    <span className="text-[10px] text-zinc-400 font-normal">
                      (изменить →)
                    </span>
                  </span>
                </Link>
              ) : (
                <Link
                  href="/titles"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 hover:text-white transition-all shadow-sm"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  Выбрать титул
                </Link>
              )}
            </div>

            {/* Level Progression Bar */}
            <div className="w-full mt-4 pt-3 border-t border-zinc-800/80 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Уровень игрока {playerLevel}
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">
                  {currentLevelSpins} / 10 вращений до Ур. {playerLevel + 1}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ width: `${levelProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Player Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <GlassCard glowColor="cyan" className="p-3.5 flex flex-col justify-between border-sky-500/35 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Осталось</span>
            <RotateCcw className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-300 mt-1.5">
            {stats.freeSpins}
          </div>
          <span className="text-[10px] text-sky-400/80 font-bold mt-0.5">Спинов</span>
        </GlassCard>

        <GlassCard glowColor="none" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Вращений</span>
            <Sparkles className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1.5">
            {stats.spinsCount}
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5">Всего попыток</span>
        </GlassCard>

        <GlassCard glowColor="gold" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Баланс UC</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1.5">
            {stats.totalUc} UC
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5">Подтверждено</span>
        </GlassCard>

        <GlassCard glowColor="none" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Популярность</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-400 mt-1.5">
            {stats.popularity}
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5">Очки славы</span>
        </GlassCard>

        <GlassCard glowColor="gold" className="p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Коллекция</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1.5">
            {stats.totalRewardsCount}
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5">{stats.uniqueRewardsCount} уникальных</span>
        </GlassCard>
      </div>

      {/* 3. Navigation Tabs: Collection, Recent Wins, Gifts History */}
      <div className="flex gap-2 border-b border-zinc-800/80 pb-2 mt-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('inventory');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Моя сумка ({inventory.length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('wins');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'wins'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          История дропов ({lastWins.length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('gifts');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'gifts'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          Подарки ({giftsHistory.length})
        </button>
      </div>

      {/* TAB 1: USER'S INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <span className="text-xs text-zinc-400">Предметы в вашей сумке:</span>
            <div className="flex items-center gap-3">
              {inventory.length > 3 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Поиск по сумке..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                  <Search className="w-3 h-3 text-zinc-500 absolute right-2.5 top-2" />
                </div>
              )}
              <Link
                href="/collection"
                className="text-xs text-amber-400 font-semibold hover:text-amber-300 flex items-center gap-1"
              >
                Весь каталог <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {filteredInventory.length === 0 ? (
            <EmptyState
              icon={Box}
              title={inventorySearch ? 'Ничего не найдено' : 'Сумка пуста'}
              description={
                inventorySearch
                  ? 'По запросу предметов не найдено'
                  : 'Крутите слот-машину, чтобы наполнить свой инвентарь наградами!'
              }
              actionLabel="Крутить слот-машину"
              actionHref="/spin"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredInventory.map((item) => (
                <GlassCard
                  key={item.id}
                  className="p-3.5 flex items-center justify-between border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-sm shrink-0 shadow-sm">
                      {item.isTitle ? <Crown className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-white">{item.name}</h4>
                        <RarityBadge rarity={item.rarity} size="xs" />
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block">
                        Количество: <strong className="text-amber-300">{item.quantity} шт.</strong>
                      </span>
                    </div>
                  </div>

                  {item.quantity > 1 && (
                    <Link href={`/gifts?item=${item.id}`}>
                      <span className="text-[10px] text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl hover:bg-amber-500/30 flex items-center gap-1 shadow-sm">
                        <Gift className="w-3 h-3 text-amber-400" /> Подарить
                      </span>
                    </Link>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECENT WINS */}
      {activeTab === 'wins' && (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs text-zinc-400 px-1">
            Хронология получения предметов в профиле:
          </span>

          {lastWins.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="История выигрышей пуста"
              description="Вы пока не совершали вращений. Сделайте первый спин прямо сейчас!"
              actionLabel="Крутить слот-машину"
              actionHref="/spin"
            />
          ) : (
            lastWins.map((win) => (
              <GlassCard
                key={win.id}
                className="p-3.5 flex items-center justify-between border border-amber-500/15"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{win.name}</span>
                      <RarityBadge rarity={win.rarity} size="xs" />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      Получено: {new Date(win.acquiredAt).toLocaleDateString('ru-RU')} • {win.quantity} шт.
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-amber-400">
                  {win.category === 'uc' ? `+${win.value} UC` : 'В сумке'}
                </span>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* TAB 3: GIFTS HISTORY */}
      {activeTab === 'gifts' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Все отправленные и полученные подарки:</span>
            <Link
              href="/gifts"
              className="text-amber-400 font-semibold hover:text-amber-300 flex items-center gap-1"
            >
              Отправить подарок <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {giftsHistory.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="История подарков пуста"
              description="Вы еще не отправляли и не получали подарков от других игроков."
              actionLabel="Перейти к подаркам"
              actionHref="/gifts"
            />
          ) : (
            giftsHistory.map((gift) => {
              const isSender = gift.senderId === user.id;

              return (
                <GlassCard
                  key={gift.id}
                  className="p-3.5 flex items-center justify-between border border-amber-500/15"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSender
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {isSender ? <Send className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {isSender ? (
                            <>Подарил <strong>{gift.rewardName}</strong> игроку <strong className="text-amber-300">@{gift.recipientUsername}</strong></>
                          ) : (
                            <>Получил <strong>{gift.rewardName}</strong> от <strong className="text-amber-300">@{gift.senderUsername}</strong></>
                          )}
                        </span>
                      </div>
                      {gift.message && (
                        <div className="mt-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 italic">
                          «{gift.message}»
                        </div>
                      )}
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        {gift.createdAt}
                      </span>
                    </div>
                  </div>

                  <RarityBadge rarity={gift.rewardRarity} size="xs" />
                </GlassCard>
              );
            })
          )}
        </div>
      )}

      {/* 4. Account Actions & Logout */}
      <div className="mt-4 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <span className="text-xs font-bold text-zinc-300 block">Управление сессией</span>
          <span className="text-[10px] text-zinc-500">Завершить сессию на этом устройстве</span>
        </div>

        <button
          type="button"
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-zinc-900 border border-rose-500/30 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Выйти из аккаунта</span>
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Выход из аккаунта"
        description="Вы уверены, что хотите выйти? Ваш баланс спинов и инвентарь надежно сохранены в базе данных."
        confirmText="Выйти"
        cancelText="Остаться"
        variant="danger"
      />
    </div>
  );
}
