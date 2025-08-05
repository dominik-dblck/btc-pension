'use client';

import React, { useMemo } from 'react';
import {
  StandaloneTimeseriesChart,
  SeriesConfig,
  InputDef,
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
  const { userInput, setUserInput, userSeries, lastUserSnapshot } =
    useBTCPension();

  // updateK: universal setter for userInput
  const updateK = (path: string, value: any, scale: number = 1) => {
    setUserInput((prev: any) => {
      const keys = path.split('.');
      const newValue = { ...prev };
      let current = newValue;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = Number(value) / scale;
      return newValue;
    });
  };

  // Enhanced user series with calculated values
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

  // Input definitions
  const inputs: InputDef[] = [
    {
      id: 'initialBtcHolding',
      label: 'Initial BTC Holding',
      type: 'number',
      value: userInput.userData.initialBtcHolding || 0,
      onChange: value => updateK('userData.initialBtcHolding', value, 1),
      min: 0,
      step: 0.0001,
      tooltip: 'Starting BTC amount before DCA begins',
    },
    {
      id: 'startMonth',
      label: 'Start Month',
      type: 'number',
      value: userInput.userData.startMonth,
      onChange: value => updateK('userData.startMonth', value, 1),
      min: 0,
      step: 1,
      tooltip: 'Month when user starts DCA (0 = immediate start)',
    },
    {
      id: 'enableIndexing',
      label: 'Enable Inflation Indexing',
      type: 'toggle',
      value: userInput.marketData.enableIndexing,
      onChange: value =>
        setUserInput((prev: any) => ({
          ...prev,
          marketData: {
            ...prev.marketData,
            enableIndexing: value,
          },
        })),
      tooltip:
        'When ON: monthly contributions increase with inflation over time',
    },
  ];

  return (
    <StandaloneTimeseriesChart
      title="User BTC Accumulation & Platform Fees"
      description={`BTC accumulation and platform fees over ${userInput.marketData.numberOfYears} years`}
      height={portfolioHeight}
      data={enhancedUserSeries}
      xKey="month"
      series={series}
      inputs={inputs}
      onFullscreenClick={onFullscreenClick}
      xTickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
      leftTickFormatter={fmt}
      rightTickFormatter={v => formatNumber(v, { decimals: 4 })}
      tooltipFormatter={(value, name) => {
        if (name.includes('BTC')) {
          return [formatNumber(Number(value), { decimals: 4 }), name];
        }
        return [fmt(Number(value)), name];
      }}
    />
  );
};

export default UserPortfolioChart;
