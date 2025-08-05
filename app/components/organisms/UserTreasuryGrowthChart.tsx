'use client';

import React, { useMemo } from 'react';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';
import { calculateMonthlyDcaInEuro } from '../../calculation/utils/calculateMonthlyDcaInEuro';
import { FullscreenChartWrapper } from '../molecules/FullscreenChartWrapper';
import { SeriesConfig } from '../molecules/StandaloneTimeseriesChart';

interface UserTreasuryGrowthChartProps {
  isOpen: boolean;
  onClose: () => void;
}

/***********************************
 * Series Configuration
 ***********************************/
const USER_TREASURY_GROWTH_SERIES: SeriesConfig[] = [
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
];

/***********************************
 * User Treasury Growth Fullscreen Chart Component
 ***********************************/
const UserTreasuryGrowthChart: React.FC<UserTreasuryGrowthChartProps> = ({
  isOpen,
  onClose,
}) => {
  const { marketData, userData, simulationSettings, userSeries } =
    useBTCPension();

  // Enhanced user series with calculated values
  const enhancedUserSeries = useMemo(() => {
    return userSeries.map((snapshot, index) => {
      // Calculate total investment up to this month
      let totalInvestment = 0;
      const monthlyDca = userData.monthlyDcaInEuro;
      const startMonth = userData.startMonth;
      const enableIndexing = marketData.enableIndexing;
      const cpi = marketData.cpi;

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
  }, [userSeries, userData, marketData]);

  return (
    <FullscreenChartWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="User BTC Accumulation & Platform Fees — Fullscreen"
      chartProps={{
        title: 'User BTC Accumulation & Platform Fees',
        description: `BTC accumulation and platform fees over ${simulationSettings.numberOfYears} years`,
        height: 600,
        data: enhancedUserSeries,
        xKey: 'month',
        series: USER_TREASURY_GROWTH_SERIES,
        xTickFormatter: v => (v % 12 === 0 ? String(v / 12) : ''),
        leftTickFormatter: v => v.toLocaleString('en-US'),
        rightTickFormatter: v => formatNumber(v, { decimals: 8 }),
        tooltipFormatter: (value, name) => {
          if (name.includes('BTC')) {
            return [formatNumber(Number(value), { decimals: 8 }), name];
          }
          return [Number(value).toLocaleString('en-US'), name];
        },
      }}
    />
  );
};

export default UserTreasuryGrowthChart;
