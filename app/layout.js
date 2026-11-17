import './globals.css';
import { UserDataProvider } from '../hooks/useUserData';
import Header from '../components/layout/Header';
import BottomNav from '../components/layout/BottomNav';
import DevToolbar from '../components/layout/DevToolbar';
import AuthModalWrapper from '../components/auth/AuthModalWrapper';
import SnowEffect from '../components/effects/SnowEffect';
import Script from 'next/script';

export const metadata = {
  title: 'LUCKY UC - Premium Gaming Platform',
  description: 'Telegram Mini App для розыгрышей, титулов, сувениров и наград',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className="dark h-full antialiased">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#09090b] text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
        <UserDataProvider>
          {/* Falling Snow Animation */}
          <SnowEffect />

          {/* Dev user switcher for testing */}
          <DevToolbar />

          {/* Sticky Header */}
          <Header />

          {/* Main Content Area */}
          <main className="flex-1 pb-24 max-w-2xl w-full mx-auto px-4 pt-3">
            {children}
          </main>

          {/* Fixed Bottom Navigation */}
          <BottomNav />

          {/* Global Authentication Modal */}
          <AuthModalWrapper />
        </UserDataProvider>
      </body>
    </html>
  );
}
