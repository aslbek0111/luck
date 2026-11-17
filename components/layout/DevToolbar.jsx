'use client';

import React, { useState } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { Users, ChevronDown, ChevronUp, Shield, Wrench, LogIn } from 'lucide-react';

export default function DevToolbar() {
  const { user, allUsers, switchUser, isInsideTelegram, setIsBrowserAuthModalOpen } = useUserData();
  const [isOpen, setIsOpen] = useState(false);

  // Strictly hide DevToolbar in production environment
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed top-2 right-2 z-50">
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5">
          {!isInsideTelegram && !user && (
            <button
              onClick={() => setIsBrowserAuthModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full shadow-lg backdrop-blur-md hover:bg-amber-500/30 transition-all cursor-pointer"
            >
              <LogIn className="w-3 h-3 text-amber-400" />
              <span>Войти</span>
            </button>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-zinc-900/90 text-amber-300 border border-amber-500/30 rounded-full shadow-lg backdrop-blur-md hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Dev Режим</span>
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {isOpen && (
          <div className="mt-1.5 w-64 bg-zinc-950/95 border border-amber-500/30 rounded-xl shadow-2xl p-2.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-amber-400" />
                Сменить игрока:
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                {user?.is_admin ? 'Admin' : 'Player'}
              </span>
            </div>

            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {allUsers.map((u) => {
                const isCurrent = user && u.id === user.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                        : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isCurrent ? '#f59e0b' : '#52525b' }}
                      />
                      <span className="truncate">@{u.username}</span>
                    </div>
                    {u.is_admin && (
                      <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                        <Shield className="w-2.5 h-2.5" /> Admin
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
