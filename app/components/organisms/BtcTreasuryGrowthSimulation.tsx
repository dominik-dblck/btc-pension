'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TooltipProvider } from '@/app/components/atoms/tooltip';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';
import { calculateMonthlyDcaInEuro } from '../../calculation/utils/calculateMonthlyDcaInEuro';

// Import the new components
import BtcPensionPageHeader from './BtcPensionPageHeader';
import ModelAssumptionsCard from './ModelAssumptionsCard';
import SimulationParametersForm from './SimulationParametersForm';
import UserPortfolioChart from './UserPortfolioChart';
import PlatformRevenueChart from './PlatformRevenueChart';
import { FullscreenChartWrapper } from '../molecules/FullscreenChartWrapper';

/** Months between state‑snapshot points */
export const SNAPSHOT_STEP = 1; // monthly snapshots

/***********************************
 * Main BTC Pension Calculator Component
 ***********************************/
const BtcTreasuryGrowthSimulation: React.FC = () => {
  const { userInput, userSeries, platformWithInvestmentSeries } =
    useBTCPension();

  // fullscreen state for charts
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);
  const [isPlatformFullscreen, setIsPlatformFullscreen] = useState(false);

  // compute a stable pixel height for the charts
  const portfolioHeight = useMemo(() => {
    return 420; // fixed height for full-width chart
  }, []);

  // Enhanced user series for fullscreen
  const enhancedUserSeries = useMemo(() => {
    return userSeries.map((snapshot, index) => {
      // Calculate total investment up to this month
      let totalInvestment = 0;
      const monthlyDca = userInput.userData.monthlyDcaInEuro;
      const startMonth = userInput.userData.startMonth;
      const enableIndexing = userInput.marketData.enableIndexing;
      const cpi = userInput.marketData.cpi;

      for (let m = startMonth; m <= index; m++) {
        if (m >= startMonth) {
          const cpiFactor = Math.pow(1 + cpi, m / 12);
          const monthlyContribution = calculateMonthlyDcaInEuro(
            monthlyDca,
            cpiFactor,
            enableIndexing
          );
          totalInvestment += monthlyContribution;
        }
      }

      return {
        month: index,
        btcPrice: snapshot.currentBtcPriceInEuro,
        btcHolding: snapshot.userAccumulatedBtcHolding,
        btcValue:
          snapshot.userAccumulatedBtcHolding * snapshot.currentBtcPriceInEuro,
        totalInvestment,
        platformFeeFromYield: snapshot.platformFeeFromYieldInBtc,
        platformExchangeFee: snapshot.platformExchangeFeeInBtc,
        totalPlatformFees:
          (snapshot.platformFeeFromYieldInBtc || 0) +
          (snapshot.platformExchangeFeeInBtc || 0),
      };
    });
  }, [userSeries, userInput]);

  // Enhanced platform series for fullscreen
  const enhancedPlatformSeries = useMemo(() => {
    return platformWithInvestmentSeries.map((snapshot, index) => ({
      month: index,
      btcPrice: snapshot.btcPriceInEuro,
      btcFeeFromYield: snapshot.btcFeeFromYield,
      btcFeeFromExchange: snapshot.btcFeeFromExchange,
      btcFeeTotal: snapshot.btcFeeTotal,
      platformWorkingBtc: snapshot.platformWorkingBtc,
      platformMonthlyYieldBtc: snapshot.platformMonthlyYieldBtc,
      platformPrincipalEndBtc: snapshot.platformPrincipalEndBtc,
      platformCapitalInEuro:
        snapshot.platformPrincipalEndBtc * snapshot.btcPriceInEuro,
    }));
  }, [platformWithInvestmentSeries]);

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

          <UserPortfolioChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={() => setIsPortfolioFullscreen(true)}
          />

          <PlatformRevenueChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={() => setIsPlatformFullscreen(true)}
          />

          <FullscreenChartWrapper
            isOpen={isPortfolioFullscreen}
            onClose={() => setIsPortfolioFullscreen(false)}
            title="User BTC Accumulation & Platform Fees — Fullscreen"
            chartProps={{
              title: 'User BTC Accumulation & Platform Fees',
              description: `BTC accumulation and platform fees over ${userInput.marketData.numberOfYears} years`,
              height: 600,
              data: enhancedUserSeries,
              xKey: 'month',
              series: [
                {
                  id: 'btcValue',
                  name: 'BTC Value (€)',
                  dataKey: 'btcValue',
                  color: '#f59e0b',
                  yAxisId: 'left',
                },
                {
                  id: 'btcPrice',
                  name: 'BTC Price (€)',
                  dataKey: 'btcPrice',
                  color: '#ef4444',
                  yAxisId: 'left',
                  strokeDasharray: '5 5',
                },
                {
                  id: 'btcHolding',
                  name: 'BTC Holdings (₿)',
                  dataKey: 'btcHolding',
                  color: '#22c55e',
                  yAxisId: 'right',
                },
                {
                  id: 'totalPlatformFees',
                  name: 'Platform Fees (₿)',
                  dataKey: 'totalPlatformFees',
                  color: '#06b6d4',
                  yAxisId: 'right',
                  strokeDasharray: '2 2',
                },
                {
                  id: 'totalInvestment',
                  name: 'Total Investment (€)',
                  dataKey: 'totalInvestment',
                  color: '#8b5cf6',
                  yAxisId: 'left',
                  strokeDasharray: '3 1',
                },
              ],
              xTickFormatter: v => (v % 12 === 0 ? String(v / 12) : ''),
              leftTickFormatter: v => v.toLocaleString('en-US'),
              rightTickFormatter: v => formatNumber(v, { decimals: 4 }),
              tooltipFormatter: (value, name) => {
                if (name.includes('BTC')) {
                  return [formatNumber(Number(value), { decimals: 4 }), name];
                }
                return [Number(value).toLocaleString('en-US'), name];
              },
            }}
          />

          <FullscreenChartWrapper
            isOpen={isPlatformFullscreen}
            onClose={() => setIsPlatformFullscreen(false)}
            title="Platform Revenue & Capital Growth — Fullscreen"
            chartProps={{
              title: 'Platform Revenue & Capital Growth',
              description: `Platform fees, capital growth and investment returns over ${userInput.marketData.numberOfYears} years`,
              height: 600,
              data: enhancedPlatformSeries,
              xKey: 'month',
              series: [
                {
                  id: 'platformCapitalInEuro',
                  name: 'Platform Capital (€)',
                  dataKey: 'platformCapitalInEuro',
                  color: '#f59e0b',
                  yAxisId: 'left',
                },
                {
                  id: 'platformPrincipalEndBtc',
                  name: 'Platform Capital (₿)',
                  dataKey: 'platformPrincipalEndBtc',
                  color: '#22c55e',
                  yAxisId: 'right',
                },
                {
                  id: 'btcFeeTotal',
                  name: 'Monthly Fees (₿)',
                  dataKey: 'btcFeeTotal',
                  color: '#06b6d4',
                  yAxisId: 'right',
                  strokeDasharray: '2 2',
                },
                {
                  id: 'platformMonthlyYieldBtc',
                  name: 'Monthly Yield (₿)',
                  dataKey: 'platformMonthlyYieldBtc',
                  color: '#ef4444',
                  yAxisId: 'right',
                  strokeDasharray: '4 2',
                },
                {
                  id: 'totalUsers',
                  name: 'Total Users',
                  dataKey: 'totalUsers',
                  color: '#f472b6',
                  yAxisId: 'right',
                  strokeDasharray: '3 1',
                },
              ],
              xTickFormatter: v => (v % 12 === 0 ? String(v / 12) : ''),
              leftTickFormatter: v => v.toLocaleString('en-US'),
              rightTickFormatter: v => formatNumber(v, { decimals: 4 }),
              tooltipFormatter: (value, name) => {
                if (name.includes('BTC') || name.includes('₿')) {
                  return [formatNumber(Number(value), { decimals: 4 }), name];
                }
                return [Number(value).toLocaleString('en-US'), name];
              },
            }}
          />
        </motion.div>
      </div>
    </TooltipProvider>
  );
};

export default BtcTreasuryGrowthSimulation;
