'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUserData } from '../../hooks/useUserData';
import GlassCard from '../../components/ui/GlassCard';
import GoldButton from '../../components/ui/GoldButton';
import RarityBadge from '../../components/ui/RarityBadge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import {
  Gift,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Sparkles,
  Info,
  MessageSquare,
} from 'lucide-react';

function GiftsContent() {
  const searchParams = useSearchParams();
  const preselectedItemId = searchParams.get('item');

  const { inventory, sendGift, allUsers, user, giftsHistory } = useUserData();
  const [recipientUsername, setRecipientUsername] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState(preselectedItemId || '');
  const [message, setMessage] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filter items where quantity > 0
  const giftableItems = useMemo(() => {
    return inventory.filter((item) => (item.quantity || 0) > 0);
  }, [inventory]);

  // Filter giftable items by search query
  const filteredGiftableItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return giftableItems;
    const q = itemSearchQuery.toLowerCase().trim();
    return giftableItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [giftableItems, itemSearchQuery]);

  const selectedItemMeta = useMemo(() => {
    return giftableItems.find((it) => it.id === selectedRewardId) || null;
  }, [giftableItems, selectedRewardId]);

  // Open confirmation modal
  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanUser = recipientUsername.replace('@', '').trim();
    if (!cleanUser) {
      setStatusMessage({ type: 'error', text: 'Укажите никнейм получателя' });
      return;
    }
    if (!selectedRewardId) {
      setStatusMessage({ type: 'error', text: 'Выберите предмет для подарка' });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Perform sending after confirmation
  const executeSend = async () => {
    setIsSending(true);
    const cleanUser = recipientUsername.replace('@', '').trim();

    const res = await sendGift({
      recipientUsername: cleanUser,
      rewardId: selectedRewardId,
      quantity: 1,
      message,
    });
    setIsSending(false);
    setIsConfirmModalOpen(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Подарок «${selectedItemMeta?.name || 'Предмет'}» успешно отправлен игроку @${res.recipient}!`,
      });
      setRecipientUsername('');
      setSelectedRewardId('');
      setMessage('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Ошибка при отправке подарка' });
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <Link
          href="/"
          className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-amber-400/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>Новогодние Подарки</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              🎁 Игрок → Игроку
            </span>
          </h1>
          <p className="text-xs text-zinc-400">Дарите сувениры другим игрокам с личными пожеланиями</p>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Gift Rules Info */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-rose-950/30 border border-amber-500/25 text-xs text-zinc-300 flex items-start gap-3 shadow-md">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-amber-300">Праздничный обмен подарками:</span>
          <p className="text-zinc-300 mt-0.5">
            Все 10 Standard и 2 VIP игроков могут свободно дарить друг другу любые предметы из своего инвентаря с персональным поздравлением!
          </p>
        </div>
      </div>

      {/* Gift Form */}
      <GlassCard className="p-4 sm:p-5 rounded-3xl border border-amber-500/20">
        <form onSubmit={handleOpenConfirm} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center justify-between">
              <span>1. Никнейм получателя:</span>
              <span className="text-[10px] text-zinc-500">Без символа @ или с ним</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="например: SantaPlayer"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <User className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3" />
            </div>

            {/* Quick recipient suggestions */}
            {allUsers.length > 1 && (
              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-zinc-500 shrink-0">Игроки:</span>
                {allUsers
                  .filter((u) => u.id !== user?.id && !u.is_admin)
                  .slice(0, 8)
                  .map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setRecipientUsername(u.username)}
                      className="text-[10px] font-bold text-amber-400/90 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-xl hover:border-amber-400/40 hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      @{u.username}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300 block">
                2. Выберите предмет для подарка:
              </label>
              <span className="text-[10px] text-amber-300 font-bold">
                В наличии: {giftableItems.length}
              </span>
            </div>

            {giftableItems.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="Инвентарь пуст"
                description="У вас пока нет предметов. Крутите Колесо Фортуны, чтобы собрать новогодние сувениры!"
                actionLabel="Крутить Колесо Фортуны"
                actionHref="/spin"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {giftableItems.length > 4 && (
                  <div className="relative mb-1">
                    <input
                      type="text"
                      placeholder="Поиск по инвентарю..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2" />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredGiftableItems.map((item) => {
                    const isSelected = selectedRewardId === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedRewardId(item.id)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-400 shrink-0">
                            <Gift className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <RarityBadge rarity={item.rarity} size="xs" />
                              <span className="text-[10px] text-zinc-400">
                                В наличии: <strong className="text-zinc-200">{item.quantity} шт.</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-amber-400 bg-amber-400'
                                : 'border-zinc-600 bg-transparent'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Optional Message Field */}
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Новогоднее поздравление / записка (необязательно):</span>
            </label>
            <textarea
              rows={2}
              placeholder="Например: С Новым Годом 2026! Дарю частичку удачи 🎄"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />
          </div>

          <GoldButton
            type="submit"
            variant="gold"
            disabled={!recipientUsername || !selectedRewardId || giftableItems.length === 0}
            className="w-full mt-2"
          >
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span>Отправить подарок</span>
            </span>
          </GoldButton>
        </form>
      </GlassCard>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeSend}
        title="Подтверждение подарка"
        description={
          `Вы уверены, что хотите подарить «${selectedItemMeta?.name || 'Предмет'}» игроку @${recipientUsername}?` +
          (message ? `\n\nСообщение: «${message}»` : '')
        }
        confirmText="Да, отправить 🎁"
        cancelText="Отмена"
        variant="gold"
        isLoading={isSending}
      />

      {/* Gifts History */}
      <div className="mt-2 flex flex-col gap-2.5">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider px-1">
          История отправленных и полученных подарков
        </h3>

        {giftsHistory.length === 0 ? (
          <GlassCard className="p-4 text-center">
            <p className="text-xs text-zinc-400">Подарков пока нет</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Отправьте первый сувенир другу, чтобы порадовать его!</p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2">
            {giftsHistory.map((g) => {
              const isOutgoing = g.senderUsername?.toLowerCase() === user?.username?.toLowerCase();
              return (
                <GlassCard key={g.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-xl bg-zinc-800 text-amber-400 mt-0.5">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          {isOutgoing ? (
                            <>Вы подарили <strong className="text-amber-300">«{g.rewardName}»</strong> игроку @{g.recipientUsername}</>
                          ) : (
                            <>Игрок @{g.senderUsername} подарил вам <strong className="text-amber-300">«{g.rewardName}»</strong></>
                          )}
                        </div>
                        {g.message && (
                          <div className="mt-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 italic">
                            «{g.message}»
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0">{g.createdAt}</span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GiftsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs text-zinc-500">Загрузка подарков...</div>}>
      <GiftsContent />
    </Suspense>
  );
}
