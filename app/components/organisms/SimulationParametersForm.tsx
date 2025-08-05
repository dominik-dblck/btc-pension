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

/***********************************
 * Simulation Parameters Form Component
 ***********************************/
const SimulationParametersForm: React.FC = () => {
  const { userInput, setUserInput } = useBTCPension();

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

  // BTC & Market Parameters
  const marketInputs: InputDef[] = [
    {
      id: 'initialBtcPriceInEuro',
      label: 'Initial BTC Price (EUR)',
      type: 'number',
      value: userInput.marketData.initialBtcPriceInEuro,
      onChange: value => updateK('marketData.initialBtcPriceInEuro', value, 1),
      min: 0,
      step: 1,
      tooltip: 'Starting BTC price in EUR',
    },
    {
      id: 'btcCagrToday',
      label: 'BTC CAGR Start (%)',
      type: 'number',
      value: userInput.marketData.btcCagrToday * 100,
      onChange: value => updateK('marketData.btcCagrToday', value, 100),
      min: 0,
      step: 0.1,
      tooltip: 'Initial annual BTC growth rate',
    },
    {
      id: 'btcCagrAsymptote',
      label: 'BTC CAGR Asymptote (%)',
      type: 'number',
      value: userInput.marketData.btcCagrAsymptote * 100,
      onChange: value => updateK('marketData.btcCagrAsymptote', value, 100),
      min: 0,
      step: 0.1,
      tooltip: 'Final BTC growth rate that CAGR approaches over time',
    },
    {
      id: 'settleYears',
      label: 'Settle Years',
      type: 'number',
      value: userInput.marketData.settleYears,
      onChange: value => updateK('marketData.settleYears', value, 1),
      min: 1,
      step: 1,
      tooltip: 'Years until CAGR settles to asymptote',
    },
    {
      id: 'settleEpsilon',
      label: 'Settle Epsilon (%)',
      type: 'number',
      value: (userInput.marketData.settleEpsilon || 0.05) * 100,
      onChange: value => updateK('marketData.settleEpsilon', value, 100),
      min: 0,
      step: 0.01,
      tooltip: 'Residual fraction remaining after settle years',
    },
    {
      id: 'numberOfYears',
      label: 'Horizon (yrs)',
      type: 'number',
      value: userInput.marketData.numberOfYears,
      onChange: value => updateK('marketData.numberOfYears', value, 1),
      min: 1,
      step: 1,
      tooltip: 'Savings horizon in years',
    },
    {
      id: 'cpi',
      label: 'CPI Rate (%)',
      type: 'number',
      value: userInput.marketData.cpi * 100,
      onChange: value => updateK('marketData.cpi', value, 100),
      min: 0,
      step: 0.1,
      tooltip: 'Annual inflation rate (Consumer Price Index)',
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

  // User Parameters
  const userInputs: InputDef[] = [
    {
      id: 'monthlyDcaInEuro',
      label: 'Monthly DCA (EUR)',
      type: 'number',
      value: userInput.userData.monthlyDcaInEuro,
      onChange: value => updateK('userData.monthlyDcaInEuro', value, 1),
      min: 0,
      step: 1,
      tooltip: 'Monthly dollar cost averaging amount in EUR',
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
      id: 'yearlyYieldPct',
      label: 'Yield Rate (APY, %)',
      type: 'number',
      value: userInput.earnData.yearlyYieldPct * 100,
      onChange: value => updateK('earnData.yearlyYieldPct', value, 100),
      min: 0,
      step: 0.1,
      tooltip: 'Annual yield rate on accumulated BTC',
    },
    {
      id: 'platformFeeFromYieldPct',
      label: 'Platform Yield Fee (%)',
      type: 'number',
      value: userInput.platformData.platformFeeFromYieldPct * 100,
      onChange: value =>
        updateK('platformData.platformFeeFromYieldPct', value, 100),
      min: 0,
      step: 0.1,
      tooltip: 'Platform fee percentage from yield',
    },
    {
      id: 'platformExchangeFeePct',
      label: 'Platform Exchange Fee (%)',
      type: 'number',
      value: userInput.platformData.platformExchangeFeePct * 100,
      onChange: value =>
        updateK('platformData.platformExchangeFeePct', value, 100),
      min: 0,
      step: 0.01,
      tooltip: 'Platform exchange fee percentage',
    },
  ];

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
      <CardHeader className="px-6 pt-6 pb-3">
        <CardTitle className="text-lg text-white">Global Parameters</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-8 space-y-6">
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
            gridCols="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SimulationParametersForm;
