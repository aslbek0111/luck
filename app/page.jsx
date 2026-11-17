'use client';

import React from 'react';
import HeroGreeting from '../components/home/HeroGreeting';
import ActiveTitleCard from '../components/home/ActiveTitleCard';
import StatsSummary from '../components/home/StatsSummary';
import FeaturedRewards from '../components/home/FeaturedRewards';
import QuickNavGrid from '../components/home/QuickNavGrid';
import LiveFeedWidget from '../components/home/LiveFeedWidget';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-5 py-2 animate-in fade-in duration-300">
      {/* 1. Player Greeting Banner */}
      <HeroGreeting />

      {/* 2. Active Title 3D Showcase Card */}
      <ActiveTitleCard />

      {/* 3. Player Stats & Achievements Summary */}
      <StatsSummary />

      {/* 4. Quick Navigation Buttons */}
      <QuickNavGrid />

      {/* 5. Rewards Catalog Spotlight */}
      <FeaturedRewards />

      {/* 6. Live Events Feed */}
      <LiveFeedWidget />
    </div>
  );
}
