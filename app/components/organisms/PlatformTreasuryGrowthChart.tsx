'use client';

import React, { useMemo } from 'react';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';
import { FullscreenChartWrapper } from '../molecules/FullscreenChartWrapper';
import { SeriesConfig } from '../molecules/StandaloneTimeseriesChart';

interface PlatformTreasuryGrowthChartProps {
  isOpen: boolean;
  onClose: () => void;
}

/***********************************
 * Series Configuration
 ***********************************/
const PLATFORM_TREASURY_GROWTH_SERIES: SeriesConfig[] = [
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
];

/***********************************
 * Platform Treasury Growth Fullscreen Chart Component
 ***********************************/
const PlatformTreasuryGrowthChart: React.FC<
  PlatformTreasuryGrowthChartProps
> = ({ isOpen, onClose }) => {
  const { simulationSettings, platformWithInvestmentSeries } = useBTCPension();

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
    }));
  }, [platformWithInvestmentSeries]);

  return (
    <FullscreenChartWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Platform Revenue & Capital Growth — Fullscreen"
      chartProps={{
        title: 'Platform Revenue & Capital Growth',
        description: `Platform fees, capital growth and investment returns over ${simulationSettings.numberOfYears} years`,
        height: 600,
        data: enhancedPlatformSeries,
        xKey: 'month',
        series: PLATFORM_TREASURY_GROWTH_SERIES,
        xTickFormatter: v => (v % 12 === 0 ? String(v / 12) : ''),
        leftTickFormatter: v => v.toLocaleString('en-US'),
        rightTickFormatter: v => formatNumber(v, { decimals: 8 }),
        tooltipFormatter: (value, name) => {
          if (name.includes('BTC') || name.includes('₿')) {
            return [formatNumber(Number(value), { decimals: 8 }), name];
          }
          return [Number(value).toLocaleString('en-US'), name];
        },
      }}
    />
  );
};

export default PlatformTreasuryGrowthChart;
