'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TooltipProvider } from '@/app/components/atoms/tooltip';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';

// Import the new components
import BtcPensionPageHeader from './BtcPensionPageHeader';
import ModelAssumptionsCard from './ModelAssumptionsCard';
import SimulationParametersForm from './SimulationParametersForm';
import TabbedChartsInterface from './TabbedChartsInterface';
import UserTreasuryGrowthChart from './UserTreasuryGrowthChart';
import PlatformTreasuryGrowthChart from './PlatformTreasuryGrowthChart';

/** Months between state‑snapshot points */
export const SNAPSHOT_STEP = 1; // monthly snapshots

/***********************************
 * Main BTC Pension Calculator Component
 ***********************************/
const BtcTreasuryGrowthSimulation: React.FC = () => {
  // fullscreen state for charts
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);
  const [isPlatformFullscreen, setIsPlatformFullscreen] = useState(false);

  // compute a stable pixel height for the charts
  const portfolioHeight = useMemo(() => {
    return 420; // fixed height for full-width chart
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-gray-100">
        <motion.div
          className="max-w-7xl mx-auto px-6 py-12 space-y-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <BtcPensionPageHeader />

          <ModelAssumptionsCard />

          <SimulationParametersForm />

          {/* Tabbed Chart Interface */}
          <TabbedChartsInterface
            portfolioHeight={portfolioHeight}
            onUserFullscreenClick={() => setIsPortfolioFullscreen(true)}
            onPlatformFullscreenClick={() => setIsPlatformFullscreen(true)}
          />

          {/* Fullscreen Charts */}
          <UserTreasuryGrowthChart
            isOpen={isPortfolioFullscreen}
            onClose={() => setIsPortfolioFullscreen(false)}
          />

          <PlatformTreasuryGrowthChart
            isOpen={isPlatformFullscreen}
            onClose={() => setIsPlatformFullscreen(false)}
          />
        </motion.div>
      </div>
    </TooltipProvider>
  );
};

export default BtcTreasuryGrowthSimulation;
