'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { Bell, Gift, Sparkles, CheckCheck, X, ShieldAlert, Award } from 'lucide-react';

export default function NotificationCenter() {
  const { notifications, unreadCount, markNotificationsAsRead } = useUserData();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markNotificationsAsRead();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleOpen}
        type="button"
        className="relative p-2 rounded-xl bg-zinc-900/90 border border-amber-500/30 hover:border-amber-400 text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
        title="Уведомления"
        aria-label="Уведомления"
      >
        <Bell className="w-4 h-4 text-amber-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-[0_0_8px_rgba(244,63,94,0.7)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[360px] sm:w-96 rounded-2xl bg-gradient-to-b from-zinc-900/98 via-zinc-950 to-black border border-amber-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.8)] z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black text-white">Уведомления</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  +{unreadCount} новых
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={() => markNotificationsAsRead()}
                  className="p-1 text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Отметить все прочитанными"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Все</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="mt-3 flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500 mb-2">
                  ❄️
                </div>
                <p className="text-xs text-zinc-400 font-medium">Новых уведомлений нет</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Здесь появятся подарки и спины от администрации</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isGift = n.type === 'gift_received';
                const isAdmin = n.type === 'admin_bonus';

                return (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border text-xs transition-colors ${
                      n.isRead
                        ? 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg shrink-0 mt-0.5 bg-black/40 border border-zinc-700/40">
                        {isGift ? (
                          <Gift className="w-4 h-4 text-rose-400" />
                        ) : isAdmin ? (
                          <Award className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-sky-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-white text-[12px] truncate">{n.title}</h4>
                          <span className="text-[9px] text-zinc-500 shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-[11px] mt-1 leading-relaxed whitespace-pre-wrap">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
