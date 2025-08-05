'use client';

import React, { useMemo } from 'react';
import {
  StandaloneTimeseriesChart,
  SeriesConfig,
  InputDef,
} from '../molecules/StandaloneTimeseriesChart';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { formatNumber } from '@/lib/formatPrice';
import { GrowthType } from '../../calculation/utils/getPlatformUsersTimeline';

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
    platformCfg,
    setPlatformCfg,
    platformWithInvestmentSeries,
    lastPlatformSnapshot,
  } = useBTCPension();

  // updateK: universal setter for platformCfg
  const updateK = (key: string, value: any, scale: number = 1) => {
    setPlatformCfg((prev: any) => ({ ...prev, [key]: Number(value) / scale }));
  };

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

  // Input definitions
  const inputs: InputDef[] = [
    {
      id: 'userStarts',
      label: 'Users Start',
      type: 'number',
      value: platformCfg.userStarts,
      onChange: value => updateK('userStarts', value, 1),
      min: 0,
      step: 1000,
      tooltip: 'Initial number of platform users',
    },
    {
      id: 'userEnds',
      label: 'Users End',
      type: 'number',
      value: platformCfg.userEnds,
      onChange: value => updateK('userEnds', value, 1),
      min: 0,
      step: 10000,
      tooltip: 'Target number of platform users',
    },
    {
      id: 'growthType',
      label: 'Growth Type',
      type: 'toggle',
      value: platformCfg.growthType === GrowthType.Exponential,
      onChange: value =>
        setPlatformCfg(prev => ({
          ...prev,
          growthType: value ? GrowthType.Exponential : GrowthType.Linear,
        })),
      tooltip: 'User growth pattern',
    },
    {
      id: 'platformYearlyYieldPct',
      label: 'Platform Yield (%)',
      type: 'number',
      value: platformCfg.platformYearlyYieldPct * 100,
      onChange: value => updateK('platformYearlyYieldPct', value, 100),
      min: 0,
      step: 0.1,
      tooltip: "Platform's investment yield rate",
    },
  ];

  return (
    <StandaloneTimeseriesChart
      title="Platform Revenue & Capital Growth"
      description={`Platform fees, capital growth and investment returns over ${platformCfg.years} years`}
      height={portfolioHeight}
      data={enhancedPlatformSeries}
      xKey="month"
      series={series}
      inputs={inputs}
      onFullscreenClick={onFullscreenClick}
      xTickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
      leftTickFormatter={fmt}
      rightTickFormatter={v => formatNumber(v, { decimals: 4 })}
      tooltipFormatter={(value, name) => {
        if (name.includes('BTC') || name.includes('₿')) {
          return [formatNumber(Number(value), { decimals: 4 }), name];
        }
        return [fmt(Number(value)), name];
      }}
    />
  );
};

export default PlatformRevenueChart;
