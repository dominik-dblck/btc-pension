'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/atoms/card';
import { Input } from '@/app/components/atoms/input';
import { Button } from '@/app/components/atoms/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/atoms/tooltip';
import { Info, Maximize2, X } from 'lucide-react';
import { useBTCPension } from '../providers/BTCPensionProviderV3';
import { formatNumber, formatPrice } from '@/lib/formatPrice';
import { GrowthType } from '../../calculation/utils/getPlatformUsersTimeline';
import { calculateMonthlyDcaInEuro } from '../../calculation/utils/calculateMonthlyDcaInEuro';

/************************************************************************************************
 * Embedded meme (Bitcoin tree cartoon) as external URL
 ************************************************************************************************/
const memeSrc = `https://public.bnbstatic.com/image-proxy/rs_lg_webp/static/content/square/images/ea01f73e06f740dd94a7e420888ba115.jpg`;

/******************************************************
 * Utility helpers
 ******************************************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d });
const yrs = (m: number | null) =>
  m === null ? '—' : m ? `${(m / 12).toFixed(1)} yrs` : '—';

/** Months between state‑snapshot points */
export const SNAPSHOT_STEP = 1; // monthly snapshots

/***********************************
 * Small UI helper: label with tooltip icon
 ***********************************/
const LabelWithInfo: React.FC<{ text: string; tip: string }> = ({
  text,
  tip,
}) => (
  <div className="flex items-center gap-1">
    <span className="text-xs font-semibold text-gray-300">{text}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Info: ${text}`}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-600 text-slate-300 hover:text-white bg-slate-800/80"
        >
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs text-xs bg-slate-900/95 text-slate-100 border border-slate-700 shadow-xl"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  </div>
);

/***********************************
 * Header Component
 ***********************************/
const Header: React.FC = () => (
  <>
    <header className="text-center space-y-4">
      <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-lg">
        Bitcoin Pension & Platform Revenue Calculator
      </h1>
      <p className="text-sm md:text-base text-gray-300 max-w-3xl mx-auto">
        DCA simulation with platform fee modeling. User accumulation and
        platform revenue growth under ideal conditions.
      </p>
      <p className="text-xs md:text-sm text-gray-400 max-w-3xl mx-auto">
        Enter % fields as <em>percent values</em>; the model converts them to
        fractions.
      </p>
    </header>

    <img
      src={memeSrc}
      alt="Bitcoin tree cartoon meme"
      className="mx-auto w-80 md:w-[28rem] my-6 rounded-lg shadow-lg"
    />
  </>
);

/***********************************
 * Model Snapshot Component
 ***********************************/
const ModelSnapshot: React.FC = () => {
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
              at fixed CAGR {(userInput.marketData.btcCAGR * 100).toFixed(1)}%
              (no volatility).
            </li>
            <li>
              <strong>Inflation</strong>: CPI rate{' '}
              {(userInput.marketData.cpi * 100).toFixed(1)}% annually.{' '}
              <strong>
                Indexing {userInput.userData.enableIndexing ? 'ON' : 'OFF'}
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

/***********************************
 * Global Parameters Card Component
 ***********************************/
const GlobalParametersCard: React.FC = () => {
  const { userInput, setUserInput } = useBTCPension();

  // updateK: uniwersalny setter do userInput
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <LabelWithInfo
                text="Initial BTC Price (EUR)"
                tip="Starting BTC price in EUR"
              />
              <Input
                type="number"
                min={0}
                step={1}
                value={userInput.marketData.initialBtcPriceInEuro}
                onChange={e =>
                  updateK('marketData.initialBtcPriceInEuro', e.target.value, 1)
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="BTC CAGR (%)"
                tip="Annual BTC growth rate in the ideal scenario (no volatility)"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={userInput.marketData.btcCAGR * 100}
                onChange={e =>
                  updateK('marketData.btcCAGR', e.target.value, 100)
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Horizon (yrs)"
                tip="Savings horizon in years"
              />
              <Input
                type="number"
                min={1}
                step={1}
                value={userInput.userData.numberOfYears}
                onChange={e =>
                  updateK('userData.numberOfYears', e.target.value, 1)
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="CPI Rate (%)"
                tip="Annual inflation rate (Consumer Price Index)"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={userInput.marketData.cpi * 100}
                onChange={e => updateK('marketData.cpi', e.target.value, 100)}
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
          </div>
        </div>

        {/* User Parameters */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            User Parameters
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <LabelWithInfo
                text="Monthly DCA (EUR)"
                tip="Monthly dollar cost averaging amount in EUR"
              />
              <Input
                type="number"
                min={0}
                step={1}
                value={userInput.userData.monthlyDcaInEuro}
                onChange={e =>
                  updateK('userData.monthlyDcaInEuro', e.target.value, 1)
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Yield Rate (APY, %)"
                tip="Annual yield rate on accumulated BTC"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={userInput.earnData.yearlyYieldPct * 100}
                onChange={e =>
                  updateK('earnData.yearlyYieldPct', e.target.value, 100)
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Platform Yield Fee (%)"
                tip="Platform fee percentage from yield"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={userInput.platformData.platformFeeFromYieldPct * 100}
                onChange={e =>
                  updateK(
                    'platformData.platformFeeFromYieldPct',
                    e.target.value,
                    100
                  )
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Platform Exchange Fee (%)"
                tip="Platform exchange fee percentage"
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                value={userInput.platformData.platformExchangeFeePct * 100}
                onChange={e =>
                  updateK(
                    'platformData.platformExchangeFeePct',
                    e.target.value,
                    100
                  )
                }
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Enable Inflation Indexing"
                tip="When ON: monthly contributions increase with inflation over time"
              />
              <Button
                type="button"
                className={`w-full ${userInput.userData.enableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() =>
                  setUserInput((prev: any) => ({
                    ...prev,
                    userData: {
                      ...prev.userData,
                      enableIndexing: !prev.userData.enableIndexing,
                    },
                  }))
                }
              >
                {userInput.userData.enableIndexing ? 'ON' : 'OFF'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/***********************************
 * Portfolio Chart Component
 ***********************************/
const PortfolioChart: React.FC<{
  portfolioHeight: number;
  onFullscreenClick: () => void;
}> = ({ portfolioHeight, onFullscreenClick }) => {
  const { userInput, setUserInput, userSeries, lastUserSnapshot } =
    useBTCPension();

  // updateK: uniwersalny setter do userInput
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
      const enableIndexing = userInput.userData.enableIndexing;
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

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg relative">
      <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg text-white text-left">
          User BTC Accumulation & Platform Fees
        </CardTitle>
        <Button
          type="button"
          className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
          onClick={onFullscreenClick}
          aria-label="Open fullscreen"
          title="Show fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-8 space-y-6">
        {/* User Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <LabelWithInfo
              text="Monthly DCA (EUR)"
              tip="Monthly dollar cost averaging amount in EUR"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={userInput.userData.monthlyDcaInEuro}
              onChange={e =>
                updateK('userData.monthlyDcaInEuro', e.target.value, 1)
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Start Month"
              tip="Month when user starts DCA (0 = immediate start)"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={userInput.userData.startMonth}
              onChange={e => updateK('userData.startMonth', e.target.value, 1)}
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Enable Inflation Indexing"
              tip="When ON: monthly contributions increase with inflation over time"
            />
            <Button
              type="button"
              className={`w-full ${userInput.userData.enableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              onClick={() =>
                setUserInput((prev: any) => ({
                  ...prev,
                  userData: {
                    ...prev.userData,
                    enableIndexing: !prev.userData.enableIndexing,
                  },
                }))
              }
            >
              {userInput.userData.enableIndexing ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>

        {/* Chart */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            BTC accumulation and platform fees over{' '}
            {userInput.userData.numberOfYears} years
          </p>
          <div className="w-full" style={{ height: portfolioHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enhancedUserSeries}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => fmt(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => formatNumber(v, { decimals: 4 })}
                />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name.includes('BTC'))
                      return [formatNumber(v, { decimals: 4 }), name];
                    return [fmt(v), name];
                  }}
                  contentStyle={{
                    background: '#0b1220',
                    color: '#e5e7eb',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="btcValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                  name="BTC Value (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="btcPrice"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                  name="BTC Price (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcHolding"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e' }}
                  name="BTC Holdings (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalPlatformFees"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#06b6d4' }}
                  name="Platform Fees (₿)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalInvestment"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="3 1"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
                  name="Total Investment (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">Summary</h4>
          <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
            <span>
              Total BTC:{' '}
              <strong>
                {formatNumber(lastUserSnapshot.userAccumulatedBtcHolding, {
                  decimals: 4,
                })}
              </strong>
            </span>
            <span>
              BTC Value:{' '}
              <strong>
                €
                {fmt(
                  lastUserSnapshot.userAccumulatedBtcHolding *
                    lastUserSnapshot.currentBtcPriceInEuro
                )}
              </strong>
            </span>
            <span>
              Total Investment:{' '}
              <strong>
                €
                {fmt(
                  enhancedUserSeries[enhancedUserSeries.length - 1]
                    ?.totalInvestment || 0
                )}
              </strong>
            </span>
            <span>
              BTC Price:{' '}
              <strong>€{fmt(lastUserSnapshot.currentBtcPriceInEuro)}</strong>
            </span>
            <span>
              Total Platform Fees:{' '}
              <strong>
                {formatNumber(
                  (lastUserSnapshot.platformFeeFromYieldInBtc || 0) +
                    (lastUserSnapshot.platformExchangeFeeInBtc || 0),
                  { decimals: 0 }
                )}{' '}
                ₿
              </strong>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/***********************************
 * Platform Chart Component
 ***********************************/
const PlatformChart: React.FC<{
  portfolioHeight: number;
  onFullscreenClick: () => void;
}> = ({ portfolioHeight, onFullscreenClick }) => {
  const {
    platformCfg,
    setPlatformCfg,
    platformWithInvestmentSeries,
    lastPlatformSnapshot,
  } = useBTCPension();

  // updateK: uniwersalny setter do platformCfg
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

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg relative">
      <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg text-white text-left">
          Platform Revenue & Capital Growth
        </CardTitle>
        <Button
          type="button"
          className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
          onClick={onFullscreenClick}
          aria-label="Open fullscreen"
          title="Show fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-8 space-y-6">
        {/* Platform Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <LabelWithInfo
              text="Users Start"
              tip="Initial number of platform users"
            />
            <Input
              type="number"
              min={0}
              step={1000}
              value={platformCfg.userStarts}
              onChange={e => updateK('userStarts', e.target.value, 1)}
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Users End"
              tip="Target number of platform users"
            />
            <Input
              type="number"
              min={0}
              step={10000}
              value={platformCfg.userEnds}
              onChange={e => updateK('userEnds', e.target.value, 1)}
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo text="Growth Type" tip="User growth pattern" />
            <Button
              type="button"
              className={`w-full ${platformCfg.growthType === GrowthType.Linear ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              onClick={() =>
                setPlatformCfg(prev => ({
                  ...prev,
                  growthType:
                    prev.growthType === GrowthType.Linear
                      ? GrowthType.Exponential
                      : GrowthType.Linear,
                }))
              }
            >
              {platformCfg.growthType === GrowthType.Linear
                ? 'Linear'
                : 'Exponential'}
            </Button>
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Platform Yield (%)"
              tip="Platform's investment yield rate"
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              value={platformCfg.platformYearlyYieldPct * 100}
              onChange={e =>
                updateK('platformYearlyYieldPct', e.target.value, 100)
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
        </div>

        {/* Chart */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Platform fees, capital growth and investment returns over{' '}
            {platformCfg.years} years
          </p>
          <div className="w-full" style={{ height: portfolioHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enhancedPlatformSeries}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => fmt(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => formatNumber(v, { decimals: 4 })}
                />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name.includes('BTC') || name.includes('₿'))
                      return [formatNumber(v, { decimals: 4 }), name];
                    return [fmt(v), name];
                  }}
                  contentStyle={{
                    background: '#0b1220',
                    color: '#e5e7eb',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="platformCapitalInEuro"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                  name="Platform Capital (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="platformPrincipalEndBtc"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e' }}
                  name="Platform Capital (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcFeeTotal"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#06b6d4' }}
                  name="Monthly Fees (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="platformMonthlyYieldBtc"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                  name="Monthly Yield (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalUsers"
                  stroke="#f472b6"
                  strokeWidth={2}
                  strokeDasharray="3 1"
                  dot={false}
                  activeDot={{ r: 4, fill: '#f472b6' }}
                  name="Total Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            Platform Summary
          </h4>
          <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
            <span>
              Platform Capital:{' '}
              <strong>
                {formatNumber(lastPlatformSnapshot.platformPrincipalEndBtc, {
                  decimals: 4,
                })}{' '}
                ₿
              </strong>
            </span>
            <span>
              Platform Capital Value:{' '}
              <strong>
                €
                {fmt(
                  lastPlatformSnapshot.platformPrincipalEndBtc *
                    lastPlatformSnapshot.btcPriceInEuro
                )}
              </strong>
            </span>
            <span>
              Total Monthly Fees:{' '}
              <strong>
                {formatNumber(lastPlatformSnapshot.btcFeeTotal, {
                  decimals: 4,
                })}{' '}
                ₿
              </strong>
            </span>
            <span>
              Monthly Yield:{' '}
              <strong>
                {formatNumber(lastPlatformSnapshot.platformMonthlyYieldBtc, {
                  decimals: 4,
                })}{' '}
                ₿
              </strong>
            </span>
            <span>
              Total Users:{' '}
              <strong>{fmt(lastPlatformSnapshot.totalUsers)}</strong>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/***********************************
 * Fullscreen Chart Components
 ***********************************/
const FullscreenChart: React.FC<{
  isOpen: boolean;
  data: any[];
  onClose: () => void;
  title: string;
}> = ({ isOpen, data, onClose, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 md:inset-10 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <Button
            type="button"
            className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
            onClick={onClose}
            aria-label="Close fullscreen"
            title="Close fullscreen"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 p-4">
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => fmt(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => formatNumber(v, { decimals: 4 })}
                />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name.includes('BTC') || name.includes('₿'))
                      return [formatNumber(v, { decimals: 4 }), name];
                    return [fmt(v), name];
                  }}
                  contentStyle={{
                    background: '#0b1220',
                    color: '#e5e7eb',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="btcValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="BTC Value (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcHolding"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="BTC Holdings (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalPlatformFees"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  name="Platform Fees (₿)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalInvestment"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="3 1"
                  name="Total Investment (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const FullscreenPlatformChart: React.FC<{
  isOpen: boolean;
  data: any[];
  onClose: () => void;
  title: string;
}> = ({ isOpen, data, onClose, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 md:inset-10 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <Button
            type="button"
            className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
            onClick={onClose}
            aria-label="Close fullscreen"
            title="Close fullscreen"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 p-4">
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => fmt(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => formatNumber(v, { decimals: 4 })}
                />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name.includes('BTC') || name.includes('₿'))
                      return [formatNumber(v, { decimals: 4 }), name];
                    return [fmt(v), name];
                  }}
                  contentStyle={{
                    background: '#0b1220',
                    color: '#e5e7eb',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="platformCapitalInEuro"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                  name="Platform Capital (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="platformPrincipalEndBtc"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e' }}
                  name="Platform Capital (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="btcFeeTotal"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#06b6d4' }}
                  name="Monthly Fees (₿)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="platformMonthlyYieldBtc"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                  name="Monthly Yield (₿)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

/***********************************
 * Main Component
 ***********************************/
const BtcPensionCalculatorV3: React.FC = () => {
  const {
    userInput,
    platformCfg,
    userSeries,
    platformSeries,
    platformWithInvestmentSeries,
  } = useBTCPension();

  // fullscreen state for charts
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);
  const [isPlatformFullscreen, setIsPlatformFullscreen] = useState(false);

  // compute a stable pixel height for the charts
  const portfolioHeight = useMemo(() => {
    return 420; // fixed height for full-width chart
  }, []);

  // Enhanced user series for fullscreen
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

  // Enhanced platform series for fullscreen
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
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-gray-100">
        <motion.div
          className="max-w-7xl mx-auto px-6 py-12 space-y-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Header />

          <ModelSnapshot />

          <GlobalParametersCard />

          <PortfolioChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={() => setIsPortfolioFullscreen(true)}
          />

          <PlatformChart
            portfolioHeight={portfolioHeight}
            onFullscreenClick={() => setIsPlatformFullscreen(true)}
          />

          <FullscreenChart
            isOpen={isPortfolioFullscreen}
            data={enhancedUserSeries}
            onClose={() => setIsPortfolioFullscreen(false)}
            title="User BTC Accumulation & Platform Fees — Fullscreen"
          />

          <FullscreenPlatformChart
            isOpen={isPlatformFullscreen}
            data={enhancedPlatformSeries}
            onClose={() => setIsPlatformFullscreen(false)}
            title="Platform Revenue & Capital Growth — Fullscreen"
          />
        </motion.div>
      </div>
    </TooltipProvider>
  );
};

export default BtcPensionCalculatorV3;
