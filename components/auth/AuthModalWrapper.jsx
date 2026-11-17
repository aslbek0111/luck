'use client';

import React from 'react';
import { useUserData } from '../../hooks/useUserData';
import BrowserAuthModal from './BrowserAuthModal';

export default function AuthModalWrapper() {
  const { isBrowserAuthModalOpen, setIsBrowserAuthModalOpen } = useUserData();

  return (
    <BrowserAuthModal
      isOpen={isBrowserAuthModalOpen}
      onClose={() => setIsBrowserAuthModalOpen(false)}
    />
  );
}
