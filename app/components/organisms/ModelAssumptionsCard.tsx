'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/atoms/card';
import { useBTCPension } from '../providers/BtcTreasuryGrowthSimulationProvider';

/***********************************
 * Model Assumptions Display Component
 ***********************************/
const ModelAssumptionsCard: React.FC = () => {
  const { userInput, platformCfg } = useBTCPension();

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-xl">
      <CardHeader className="px-6 pt-6 pb-3">
        <CardTitle className="text-xl text-white">Model Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-8 space-y-6 text-sm">
        <div>
          <h3 className="font-semibold mb-1 text-white">
            Key assumptions (ideal conditions)
          </h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-300">
            <li>
              <strong>Accumulation</strong>: monthly DCA in EUR; BTC price grows
              from {(userInput.marketData.btcCagrToday * 100).toFixed(1)}% to{' '}
              {(userInput.marketData.btcCagrAsymptote * 100).toFixed(1)}% CAGR
              over {userInput.marketData.settleYears} years (no volatility).
            </li>
            <li>
              <strong>Inflation</strong>: CPI rate{' '}
              {(userInput.marketData.cpi * 100).toFixed(1)}% annually.{' '}
              <strong>
                Indexing {userInput.marketData.enableIndexing ? 'ON' : 'OFF'}
              </strong>{' '}
              — when ON: contributions increase with inflation.
            </li>
            <li>
              <strong>Platform Fees</strong>: yield fee{' '}
              {(userInput.platformData.platformFeeFromYieldPct * 100).toFixed(
                1
              )}
              % from gross yield + exchange fee{' '}
              {(userInput.platformData.platformExchangeFeePct * 100).toFixed(1)}
              % on purchases.
            </li>
            <li>
              <strong>Earn Yield</strong>:{' '}
              {(userInput.earnData.yearlyYieldPct * 100).toFixed(1)}% APY on
              accumulated BTC.
            </li>
            <li>
              <strong>Platform Growth</strong>:{' '}
              {platformCfg.userStarts.toLocaleString()} to{' '}
              {platformCfg.userEnds.toLocaleString()} users over{' '}
              {platformCfg.years} years ({platformCfg.growthType} growth).
            </li>
            <li>
              <strong>Platform Investment</strong>: Platform reinvests fees at{' '}
              {(platformCfg.platformYearlyYieldPct * 100).toFixed(1)}% APY.
            </li>
            <li>
              <strong>Cadence</strong>: all calculations are done monthly with
              monthly snapshots.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModelAssumptionsCard;
