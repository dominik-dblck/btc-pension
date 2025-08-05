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
  const { marketData, userData, platformData, simulationSettings, yieldData } =
    useBTCPension();

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
              from {(marketData.btcCagrToday * 100).toFixed(2)}% to{' '}
              {(marketData.btcCagrAsymptote * 100).toFixed(2)}% CAGR over{' '}
              {marketData.settleYears} years (no volatility).
            </li>
            <li>
              <strong>Inflation</strong>: CPI rate{' '}
              {(marketData.cpi * 100).toFixed(2)}% annually.{' '}
              <strong>
                Indexing {marketData.enableIndexing ? 'ON' : 'OFF'}
              </strong>{' '}
              — when ON: contributions increase with inflation.
            </li>
            <li>
              <strong>Platform Fees</strong>: yield fee{' '}
              {(platformData.platformFeeFromYieldPct * 100).toFixed(2)}% from
              gross yield + exchange fee{' '}
              {(platformData.platformExchangeFeePct * 100).toFixed(2)}% on
              purchases.
            </li>
            <li>
              <strong>Earn Yield</strong>:{' '}
              {(yieldData.userYearlyYieldPct * 100).toFixed(2)}% APY on
              accumulated BTC.
            </li>
            <li>
              <strong>Platform Growth</strong>:{' '}
              {platformData.userStarts.toLocaleString()} to{' '}
              {platformData.userEnds.toLocaleString()} users over{' '}
              {simulationSettings.numberOfYears} years (
              {platformData.growthType} growth).
            </li>
            <li>
              <strong>Platform Investment</strong>: Platform reinvests fees at{' '}
              {(yieldData.platformYearlyYieldPct * 100).toFixed(2)}% APY.
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
