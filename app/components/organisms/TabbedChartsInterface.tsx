'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import UserPortfolioChart from './UserPortfolioChart';
import PlatformRevenueChart from './PlatformRevenueChart';

type TabType = 'user' | 'platform';

interface TabbedChartsInterfaceProps {
  portfolioHeight: number;
  onUserFullscreenClick: () => void;
  onPlatformFullscreenClick: () => void;
}

/***********************************
 * Tabbed Charts Interface Component
 ***********************************/
const TabbedChartsInterface: React.FC<TabbedChartsInterfaceProps> = ({
  portfolioHeight,
  onUserFullscreenClick,
  onPlatformFullscreenClick,
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('user');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800/60 backdrop-blur rounded-lg p-1 border border-slate-700">
        <button
          onClick={() => setActiveTab('user')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'user'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          User Treasury Growth
        </button>
        <button
          onClick={() => setActiveTab('platform')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'platform'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          Platform Treasury Growth
        </button>
      </div>

      {/* Chart Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'user' && (
          <UserPortfolioChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={onUserFullscreenClick}
          />
        )}
        {activeTab === 'platform' && (
          <PlatformRevenueChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={onPlatformFullscreenClick}
          />
        )}
      </motion.div>
    </div>
  );
};

export default TabbedChartsInterface;
