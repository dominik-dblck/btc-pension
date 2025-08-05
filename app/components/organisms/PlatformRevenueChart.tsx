'use client';

import React, { useMemo } from 'react';
import {
  StandaloneTimeseriesChart,
  SeriesConfig,
} from '../molecules/StandaloneTimeseriesChart';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';

/******************************************************
 * Utility helpers
 ******************************************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d });

/***********************************
 * Platform Revenue Chart Component
 ***********************************/
interface PlatformRevenueChartProps {
  portfolioHeight: number;
  onFullscreenClick: () => void;
}

const PlatformRevenueChart: React.FC<PlatformRevenueChartProps> = ({
  portfolioHeight,
  onFullscreenClick,
}) => {
  const {
    simulationSettings,
    platformWithInvestmentSeries,
    lastPlatformSnapshot,
  } = useBTCPension();

  // Enhanced platform series with calculated values
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
      totalUsers: snapshot.totalUsers,
      totalUsersBtcOnPlatform: snapshot.totalUsersBtcOnPlatform,
    }));
  }, [platformWithInvestmentSeries]);

  // Chart series configuration
  const series: SeriesConfig[] = [
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
      id: 'totalUsersBtcOnPlatform',
      name: 'Users BTC on Platform (₿)',
      dataKey: 'totalUsersBtcOnPlatform',
      color: '#8b5cf6',
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
  ];

  return (
    <StandaloneTimeseriesChart
      title="Platform Revenue & Capital Growth"
      description={`Platform fees, capital growth and investment returns over ${simulationSettings.numberOfYears} years`}
      height={portfolioHeight}
      data={enhancedPlatformSeries}
      xKey="month"
      series={series}
      onFullscreenClick={onFullscreenClick}
      xTickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
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

export default PlatformRevenueChart;
