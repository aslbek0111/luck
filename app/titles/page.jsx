'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { TITLES_LIST } from '../../lib/catalog-data';
import { useUserData } from '../../hooks/useUserData';
import TitleCard from '../../components/titles/TitleCard';
import TitleModal from '../../components/titles/TitleModal';
import EmptyState from '../../components/ui/EmptyState';
import { Crown, ArrowLeft, Search, Check, Info, X } from 'lucide-react';

export default function TitlesPage() {
  const { activeTitle, unequipTitle, inventory } = useUserData();
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingTitle, setInspectingTitle] = useState(null);

  // Count how many titles user has unlocked
  const ownedTitlesCount = useMemo(() => {
    return TITLES_LIST.filter((t) => {
      const inv = inventory.find((it) => it.id === t.id);
      return (inv?.quantity || 0) > 0;
    }).length;
  }, [inventory]);

  const filteredTitles = useMemo(() => {
    return TITLES_LIST.filter((t) => {
      if (selectedRarity !== 'all' && t.rarity !== selectedRarity) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesDesc = (t.description || '').toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [selectedRarity, searchQuery]);

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
              <Crown className="w-5 h-5 text-amber-400" />
              Зал Титулов
            </h1>
            <p className="text-xs text-zinc-400">
              СОСУН, ВОЗДУХАН, КОРОЛЬ, КОРОЛЕВА, КИБОРГ, VIP
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-zinc-400 font-semibold block">Разблокировано</span>
          <span className="text-xs font-black text-amber-300 font-mono">
            {ownedTitlesCount} из {TITLES_LIST.length}
          </span>
        </div>
      </div>

      {/* Currently Active Title Banner */}
      {activeTitle ? (
        <div
          className="relative overflow-hidden rounded-3xl p-4 border flex items-center justify-between shadow-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(18,18,24,0.95), rgba(12,12,18,0.9))',
            borderColor: `${activeTitle.accentColor}55`,
            boxShadow: `0 0 25px ${activeTitle.accentColor}25`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center p-2 border shadow-sm"
              style={{
                backgroundColor: `${activeTitle.accentColor}20`,
                borderColor: `${activeTitle.accentColor}60`,
              }}
            >
              <Crown className="w-5 h-5" style={{ color: activeTitle.accentColor }} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-semibold">
                <Check className="w-3 h-3 text-emerald-400" />
                Текущий экипированный титул:
              </div>
              <span
                className="text-base font-black uppercase tracking-wider"
                style={{ color: activeTitle.accentColor }}
              >
                {activeTitle.name}
              </span>
            </div>
          </div>

          <button
            onClick={unequipTitle}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer shadow-sm"
          >
            Снять титул
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
          <span>Сейчас у вас не надет ни один титул.</span>
          <span className="text-amber-400 font-semibold">Выберите титул ниже</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Поиск титула по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
        />
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-zinc-500 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Rarity Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'Все титулы (6)' },
          { id: 'rare', label: 'Редкие (2)' },
          { id: 'epic', label: 'Эпические (2)' },
          { id: 'mythic', label: 'Мифический (1)' },
          { id: 'legendary', label: 'Легендарный (1)' },
        ].map((tab) => {
          const isSelected = selectedRarity === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedRarity(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Titles Grid */}
      {filteredTitles.length === 0 ? (
        <EmptyState
          icon={Crown}
          title="Титулы не найдены"
          description="По вашему запросу не найдено ни одного титула."
          actionLabel="Показать все титулы"
          onAction={() => {
            setSearchQuery('');
            setSelectedRarity('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTitles.map((title) => (
            <TitleCard
              key={title.id}
              title={title}
              onInspect={(t) => setInspectingTitle(t)}
            />
          ))}
        </div>
      )}

      {/* Duplicate System Explanatory Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-zinc-950 to-zinc-900 border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-3 mt-2 shadow-lg">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-bold text-amber-300">
            Правила системы дубликатов титулов:
          </span>
          <p className="text-zinc-400 leading-relaxed">
            Если вы получаете одинаковый титул повторно, первый экземпляр навсегда сохраняется для вашей экипировки, а все последующие дубликаты становятся доступны для подарка другим игрокам по их Telegram @username.
          </p>
        </div>
      </div>

      {/* Interactive Title Modal */}
      <TitleModal
        title={inspectingTitle}
        isOpen={Boolean(inspectingTitle)}
        onClose={() => setInspectingTitle(null)}
      />
    </div>
  );
}
