'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/atoms/card';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';
import { InputsRenderer } from '../molecules/InputsRenderer';
import { InputDef } from '../molecules/StandaloneTimeseriesChart';
import { GrowthType } from '../../calculation/utils/getPlatformUsersTimeline';

/***********************************
 * Simulation Parameters Form Component
 ***********************************/
const SimulationParametersForm: React.FC = () => {
  const {
    marketData,
    userData,
    platformData,
    simulationSettings,
    yieldData,
    setMarketData,
    setUserData,
    setPlatformData,
    setSimulationSettings,
    setYieldData,
  } = useBTCPension();

  // BTC & Market Parameters
  const marketInputs: InputDef[] = [
    {
      id: 'initialBtcPriceInEuro',
      label: 'Initial BTC Price (EUR)',
      type: 'number',
      value: marketData.initialBtcPriceInEuro,
      onChange: value =>
        setMarketData(prev => ({
          ...prev,
          initialBtcPriceInEuro: Number(value),
        })),
      min: 0,
      step: 1,
      tooltip: 'Starting BTC price in EUR',
    },
    {
      id: 'btcCagrToday',
      label: 'BTC CAGR Start (%)',
      type: 'number',
      value: marketData.btcCagrToday * 100,
      onChange: value =>
        setMarketData(prev => ({ ...prev, btcCagrToday: Number(value) / 100 })),
      min: 0,
      step: 0.1,
      tooltip: 'Initial annual BTC growth rate',
    },
    {
      id: 'btcCagrAsymptote',
      label: 'BTC CAGR Asymptote (%)',
      type: 'number',
      value: marketData.btcCagrAsymptote * 100,
      onChange: value =>
        setMarketData(prev => ({
          ...prev,
          btcCagrAsymptote: Number(value) / 100,
        })),
      min: 0,
      step: 0.1,
      tooltip: 'Final BTC growth rate that CAGR approaches over time',
    },
    {
      id: 'settleYears',
      label: 'Settle Years',
      type: 'number',
      value: marketData.settleYears,
      onChange: value =>
        setMarketData(prev => ({ ...prev, settleYears: Number(value) })),
      min: 1,
      step: 1,
      tooltip: 'Years until CAGR settles to asymptote',
    },
    {
      id: 'settleEpsilon',
      label: 'Settle Epsilon (%)',
      type: 'number',
      value: (marketData.settleEpsilon || 0.05) * 100,
      onChange: value =>
        setMarketData(prev => ({
          ...prev,
          settleEpsilon: Number(value) / 100,
        })),
      min: 0,
      step: 0.01,
      tooltip: 'Residual fraction remaining after settle years',
    },
    {
      id: 'cpi',
      label: 'CPI Rate (%)',
      type: 'number',
      value: marketData.cpi * 100,
      onChange: value =>
        setMarketData(prev => ({ ...prev, cpi: Number(value) / 100 })),
      min: 0,
      step: 0.1,
      tooltip: 'Annual inflation rate (Consumer Price Index)',
    },
    {
      id: 'enableIndexing',
      label: 'Inflation Indexing',
      type: 'toggle',
      value: marketData.enableIndexing,
      onChange: value =>
        setMarketData(prev => ({ ...prev, enableIndexing: value })),
      tooltip:
        'When ON: monthly contributions increase with inflation over time',
    },
  ];

  // User Parameters
  const userInputs: InputDef[] = [
    {
      id: 'monthlyDcaInEuro',
      label: 'Monthly DCA (EUR)',
      type: 'number',
      value: userData.monthlyDcaInEuro,
      onChange: value =>
        setUserData(prev => ({ ...prev, monthlyDcaInEuro: Number(value) })),
      min: 0,
      step: 1,
      tooltip: 'Monthly dollar cost averaging amount in EUR',
    },
    {
      id: 'initialBtcHolding',
      label: 'Initial BTC Holding',
      type: 'number',
      value: userData.initialBtcHolding || 0,
      onChange: value =>
        setUserData(prev => ({ ...prev, initialBtcHolding: Number(value) })),
      min: 0,
      step: 0.0001,
      tooltip: 'Starting BTC amount before DCA begins',
    },
  ];

  // Platform Parameters
  const platformInputs: InputDef[] = [
    {
      id: 'userStarts',
      label: 'Users Start',
      type: 'number',
      value: platformData.userStarts,
      onChange: value =>
        setPlatformData(prev => ({ ...prev, userStarts: Number(value) })),
      min: 0,
      step: 1000,
      tooltip: 'Initial number of platform users',
    },
    {
      id: 'userEnds',
      label: 'Users End',
      type: 'number',
      value: platformData.userEnds,
      onChange: value =>
        setPlatformData(prev => ({ ...prev, userEnds: Number(value) })),
      min: 0,
      step: 10000,
      tooltip: 'Target number of platform users',
    },

    {
      id: 'platformFeeFromYieldPct',
      label: 'Platform Yield Fee (%)',
      type: 'number',
      value: platformData.platformFeeFromYieldPct * 100,
      onChange: value =>
        setPlatformData(prev => ({
          ...prev,
          platformFeeFromYieldPct: Number(value) / 100,
        })),
      min: 0,
      step: 0.1,
      tooltip: 'Platform fee percentage from yield',
    },
    {
      id: 'platformExchangeFeePct',
      label: 'Platform Exchange Fee (%)',
      type: 'number',
      value: platformData.platformExchangeFeePct * 100,
      onChange: value =>
        setPlatformData(prev => ({
          ...prev,
          platformExchangeFeePct: Number(value) / 100,
        })),
      min: 0,
      step: 0.01,
      tooltip: 'Platform exchange fee percentage',
    },
    {
      id: 'growthType',
      label: 'Users Growth Type',
      type: 'toggle',
      value: platformData.growthType === GrowthType.Exponential,
      onChange: value =>
        setPlatformData(prev => ({
          ...prev,
          growthType: value ? GrowthType.Exponential : GrowthType.Linear,
        })),
      tooltip: 'User growth pattern linear or exponential',
    },
  ];

  // Yield Parameters
  const yieldInputs: InputDef[] = [
    {
      id: 'userYearlyYieldPct',
      label: 'User Yield Rate (APY, %)',
      type: 'number',
      value: yieldData.userYearlyYieldPct * 100,
      onChange: value =>
        setYieldData(prev => ({
          ...prev,
          userYearlyYieldPct: Number(value) / 100,
        })),
      min: 0,
      step: 0.1,
      tooltip: 'Annual yield rate on accumulated BTC',
    },
    {
      id: 'platformYearlyYieldPct',
      label: 'Platform Yield Rate (APY, %)',
      type: 'number',
      value: yieldData.platformYearlyYieldPct * 100,
      onChange: value =>
        setYieldData(prev => ({
          ...prev,
          platformYearlyYieldPct: Number(value) / 100,
        })),
      min: 0,
      step: 0.1,
      tooltip: "Platform's investment yield rate",
    },
  ];

  // Simulation Settings
  const simulationInputs: InputDef[] = [
    {
      id: 'numberOfYears',
      label: 'Horizon (yrs)',
      type: 'number',
      value: simulationSettings.numberOfYears,
      onChange: value =>
        setSimulationSettings(prev => ({
          ...prev,
          numberOfYears: Number(value),
        })),
      min: 1,
      step: 1,
      tooltip: 'Savings horizon in years',
    },
  ];

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
      <CardHeader className="px-6 pt-6 pb-3">
        <CardTitle className="text-lg text-white">Global Parameters</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-8 space-y-6">
        {/* Simulation Settings */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            Simulation Settings
          </h4>
          <InputsRenderer
            inputs={simulationInputs}
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          />
        </div>

        {/* BTC & Market Parameters */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            BTC & Market Parameters
          </h4>
          <InputsRenderer
            inputs={marketInputs}
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          />
        </div>

        {/* User Parameters */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            User Parameters
          </h4>
          <InputsRenderer
            inputs={userInputs}
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          />
        </div>

        {/* Platform Parameters */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            Platform Parameters
          </h4>
          <InputsRenderer
            inputs={platformInputs}
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          />
        </div>

        {/* Yield Parameters */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            Yield Parameters
          </h4>
          <InputsRenderer
            inputs={yieldInputs}
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SimulationParametersForm;
