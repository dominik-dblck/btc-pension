'use client';

import React, { useMemo } from 'react';
import {
  StandaloneTimeseriesChart,
  SeriesConfig,
} from '../molecules/StandaloneTimeseriesChart';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';
import { calculateMonthlyDcaInEuro } from '../../calculation/utils/calculateMonthlyDcaInEuro';

/******************************************************
 * Utility helpers
 ******************************************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d });

/***********************************
 * User Portfolio Chart Component
 ***********************************/
interface UserPortfolioChartProps {
  portfolioHeight: number;
  onFullscreenClick: () => void;
}

const UserPortfolioChart: React.FC<UserPortfolioChartProps> = ({
  portfolioHeight,
  onFullscreenClick,
}) => {
  const {
    marketData,
    userData,
    simulationSettings,
    userSeries,
    lastUserSnapshot,
  } = useBTCPension();

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

      const monthNumber = index + 1; // numer miesiąca (1-300)
      const yearNumber = monthNumber / 12; // lata (1/12 do 25)

      return {
        year: yearNumber, // konwertuj miesiące na lata
        month: monthNumber,
        yearLabel: `${yearNumber.toFixed(1)} years (${monthNumber} months)`, // etykieta z latami i miesiącami
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

  // Chart series configuration
  const series: SeriesConfig[] = [
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

  return (
    <StandaloneTimeseriesChart
      title="User BTC Accumulation & Platform Fees"
      description={`BTC accumulation and platform fees over ${simulationSettings.numberOfYears} years`}
      height={portfolioHeight}
      data={enhancedUserSeries}
      xKey="yearLabel"
      series={series}
      onFullscreenClick={onFullscreenClick}
      xTickFormatter={v => {
        // yearLabel ma format "X.Y years (Z months)", chcemy tylko pełne lata dla osi
        const match = String(v).match(/^(\d+)\.\d+ years/);
        return match ? `${match[1]} years` : String(v);
      }}
      leftTickFormatter={fmt}
      rightTickFormatter={v => formatNumber(v, { decimals: 1 })}
      tooltipFormatter={(value, name) => {
        if (name.includes('BTC') || name.includes('₿')) {
          return [formatNumber(Number(value), { decimals: 1 }), name];
        }
        return [fmt(Number(value)), name];
      }}
    />
  );
};

export default UserPortfolioChart;
