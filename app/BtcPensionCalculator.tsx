'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { Info, Maximize2, X } from 'lucide-react';
import { useBTCPensionCalculator } from '@/app/calculation/BTCPensionProvider';

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

/** Months between state‑snapshot points
 *  (must match `FREQ_CORR` used in simulation engine) */
export const SNAPSHOT_STEP = 3; //‑‑ quarterly

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
        Bitcoin Pension & Passive‑Income Planner
      </h1>
      <p className="text-sm md:text-base text-gray-300 max-w-3xl mx-auto">
        Deterministic DCA → LTV‑loan → yield model under ideal conditions.
        Earned yield is automatically converted back to BTC and added to
        holdings. Nominal vs. real results with optional referral uplift.
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
  const { inp, platformConfig, autoDrawToTarget, spreadWarn, ltvWarn } =
    useBTCPensionCalculator();

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
              at fixed CAGR {(inp.cagr * 100).toFixed(1)}% (no volatility).
            </li>
            <li>
              <strong>Inflation</strong>: CPI rate{' '}
              {(inp.cpiRate * 100).toFixed(1)}% annually.{' '}
              <strong>Indexing {inp.enableIndexing ? 'ON' : 'OFF'}</strong> —
              when ON: contributions and purchase costs increase with inflation.
            </li>
            <li>
              <strong>Collateral</strong>: loan capacity ={' '}
              <em>LTV × BTC value − loan balance</em>.
            </li>
            <li>
              <strong>Rebalancing</strong>: quarterly to target LTV{' '}
              {(inp.ltv * 100).toFixed(0)}%. <em>Auto‑draw</em>{' '}
              {autoDrawToTarget ? 'ON' : 'OFF'} — ON: uses capacity as it grows;
              OFF: capacity accumulates until purchase.
            </li>
            <li>
              <strong>Referrals</strong>: 5% fee from <em>yield earned</em> by
              referred users (used only for "Referrer Earnings").
            </li>
            <li>
              <strong>Financing</strong>: interest APR{' '}
              {(inp.loanRate * 100).toFixed(1)}% and yield APY{' '}
              {(inp.yieldRate * 100).toFixed(1)}% accrue monthly on loan
              balance.{' '}
              <strong>
                Net yield (yield - interest) is automatically converted back to
                BTC and added to holdings
              </strong>
              .
            </li>
            <li>
              <strong>Platform fees & profit</strong>: yield fee{' '}
              {platformConfig.feePct}% from <em>gross yield</em> on deployed
              capital (loan) + one‑off exchange fee{' '}
              {platformConfig.exchangeFeePct}%. <br />
              Annual platform profit is presented <em>in EUR</em>{' '}
              <u>and simultaneously</u> in BTC, assuming immediate conversion of
              all net profit to BTC at year-end price.
            </li>
            <li>
              <strong>Cadence</strong>: interest, yield, inflation are
              calculated <em>monthly</em>, while full portfolio state is
              captured in data series every <code>{SNAPSHOT_STEP}</code>
              &nbsp;months (quarterly). Values in charts and tables are already
              scaled to full months/years.
            </li>
          </ul>

          {/* --- opcjonalna sekcja "Formulas" ------------------------- */}
          <details className="mt-3">
            <summary className="cursor-pointer text-amber-400/90 hover:underline text-xs">
              Show core formulas
            </summary>
            <pre className="mt-2 text-[10px] leading-snug whitespace-pre-wrap text-gray-400">
              {`capacity        = LTV × BTC_value − loan
net_yield       = yield − interest − platform_fee
real_contrib    = nominal_contrib / inflation_index
real_net_worth  = net_worth       / inflation_index`}
            </pre>
          </details>
        </div>
        {(spreadWarn || ltvWarn) && (
          <div className="text-xs text-amber-300">
            {spreadWarn && (
              <p>
                Warning: Spread ≤ 0 (yield ≤ interest). Under ideal conditions,
                spread income won't cover loan cost.
              </p>
            )}
            {ltvWarn && (
              <p>
                Warning: LTV &gt; 80% — high operational risk (ignored here, but
                flagged).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/***********************************
 * Global Parameters Card Component
 ***********************************/
const GlobalParametersCard: React.FC = () => {
  const { inp, autoDrawToTarget, setInp, setAutoDrawToTarget, updateK } =
    useBTCPensionCalculator();

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
                value={inp.initialPrice}
                onChange={e => updateK('initialPrice', e.target.value, 1)}
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
                value={inp.cagr * 100}
                onChange={e => updateK('cagr', e.target.value, 100)}
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
                value={inp.years}
                onChange={e => updateK('years', e.target.value, 1)}
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
                value={inp.cpiRate * 100}
                onChange={e => updateK('cpiRate', e.target.value, 100)}
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
          </div>
        </div>

        {/* Earning */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">Earning</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <LabelWithInfo
                text="Max/Target LTV (%)"
                tip="Target/max LTV used to calculate loan capacity"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={inp.ltv * 100}
                onChange={e => updateK('ltv', e.target.value, 100)}
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Loan Interest (APR, %)"
                tip="Annual loan interest rate"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={inp.loanRate * 100}
                onChange={e => updateK('loanRate', e.target.value, 100)}
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Yield Rate (APY, %)"
                tip="Annual yield rate on deployed capital (on the loan)"
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={inp.yieldRate * 100}
                onChange={e => updateK('yieldRate', e.target.value, 100)}
                className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
              />
            </div>
            <div className="space-y-1">
              <LabelWithInfo
                text="Auto‑draw to Target LTV"
                tip="Automatically draw loan balance to target LTV at quarter end. When OFF — loan capacity accumulates until purchase."
              />
              <Button
                type="button"
                className={`w-full ${autoDrawToTarget ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => setAutoDrawToTarget((v: boolean) => !v)}
              >
                {autoDrawToTarget ? 'ON' : 'OFF'}
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
  const {
    inp,
    referralConfig,
    collateralConfig,
    last,
    simWithRef,
    collM,
    collateralLtv,
    setInp,
    updateK,
    updateReferralConfig,
    updateCollateralConfig,
  } = useBTCPensionCalculator();

  /* ------- 1. METADANE SERII --------------- */
  const SERIES = [
    { key: 'btcValue', name: 'BTC Value (€)', color: '#f59e0b' },
    { key: 'loanOutstanding', name: 'Loan (€)', color: '#ef4444' },
    { key: 'netWorth', name: 'Net Worth (no refs) (€)', color: '#22c55e' },
    {
      key: 'netWorthWithRef',
      name: 'Net Worth + Referrals (€)',
      color: '#06b6d4',
    },
    {
      key: 'realNetWorth',
      name: 'Real Net Worth (no refs) (€)',
      color: '#94a3b8',
    },
    {
      key: 'realNetWorthWithRef',
      name: 'Real Net Worth + Refs (€)',
      color: '#60a5fa',
    },
    {
      key: 'contribution',
      name: 'Monthly Contribution (net €)',
      color: '#a78bfa',
    },
    { key: 'totalContrib', name: 'Total Contributions (€)', color: '#f472b6' },
  ] as const;

  /* ------- 2. STAN WIDOCZNOŚCI -------------- */
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(SERIES.map(s => [s.key, true])) as Record<
        string,
        boolean
      >
  );

  const toggle = (k: string) =>
    setVisibleSeries(prev => ({ ...prev, [k]: !prev[k] }));

  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg relative">
      <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg text-white text-left">
          Pension & Passive Income Projection
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
          {/* Contributions */}
          <div className="space-y-1">
            <LabelWithInfo
              text="Monthly Contribution (EUR, gross)"
              tip="EUR you send every month *before* exchange fee; fee is deducted and only the remainder buys BTC."
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={inp.monthlyContribution}
              onChange={e => updateK('monthlyContribution', e.target.value, 1)}
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          {/* Collateral loan */}
          <div className="space-y-1">
            <LabelWithInfo
              text="Collateral Loan Amount (EUR)"
              tip="Amount of BTC-collateralized loan, full coverage according to selected LTV."
            />
            <Input
              type="number"
              min={0}
              step={100}
              value={collateralConfig.amount}
              onChange={e =>
                updateCollateralConfig({ amount: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Collateral Loan LTV (%)"
              tip="LTV used to assess capacity: capacity = LTV × BTC value − existing debt."
            />
            <Input
              type="number"
              min={0}
              step={0.5}
              value={collateralConfig.ltvPct}
              onChange={e =>
                updateCollateralConfig({ ltvPct: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          {/* Referrals */}
          <div className="space-y-1">
            <LabelWithInfo
              text="Referrals — Count"
              tip="Number of direct referred users, saving with the same parameters (except their own monthly deposit)."
            />
            <Input
              type="number"
              min={0}
              value={referralConfig.count}
              onChange={e =>
                updateReferralConfig({ count: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          <div className="space-y-1">
            <LabelWithInfo
              text="Referrals — Avg Monthly (EUR)"
              tip="Average monthly deposit per referral — affects the 1% fee added to your portfolio."
            />
            <Input
              type="number"
              min={0}
              value={referralConfig.avgMonthly}
              onChange={e =>
                updateReferralConfig({ avgMonthly: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>

          {/* Inflation Indexing */}
          <div className="space-y-1">
            <LabelWithInfo
              text="Enable Inflation Indexing"
              tip="When ON: monthly contributions and purchase costs increase with inflation over time"
            />
            <Button
              type="button"
              className={`w-full ${inp.enableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              onClick={() =>
                setInp((prev: any) => ({
                  ...prev,
                  enableIndexing: !prev.enableIndexing,
                }))
              }
            >
              {inp.enableIndexing ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>

        {/* Chart */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            BTC value, loan & net worth over {inp.years} yrs + referral uplift +
            inflation adjustment
          </p>
          <div className="w-full" style={{ height: portfolioHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simWithRef}>
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
                  tickFormatter={v => fmt(v)}
                />
                <RechartsTooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{
                    background: '#0b1220',
                    color: '#e5e7eb',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                  }}
                />
                {/* DOMYŚLNY Legend ukrywamy — używamy chipów ↓ */}
                {/* <Legend /> */}
                <Line
                  hide={!visibleSeries.btcValue}
                  yAxisId="left"
                  type="monotone"
                  dataKey="btcValue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="BTC Value (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="loanOutstanding"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Loan (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Net Worth (no refs) (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netWorthWithRef"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  name="Net Worth + Referrals (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="realNetWorth"
                  stroke="#94a3b8"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                  name="Real Net Worth (no refs) (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="realNetWorthWithRef"
                  stroke="#60a5fa"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                  strokeDasharray="1 3"
                  name="Real Net Worth + Referrals (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="contribution"
                  stroke="#a78bfa"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  name="Monthly Contribution (net €)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalContrib"
                  stroke="#f472b6"
                  strokeWidth={1.8}
                  name="Total Contributions (€)"
                />
                {collM !== null && (
                  <ReferenceLine
                    yAxisId="left"
                    x={collM}
                    stroke="#eab308"
                    strokeDasharray="3 3"
                    label="Collateral ready"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">Summary</h4>
          <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
            <span>
              Real Contributions (deflated):{' '}
              <strong>€{fmt(last.totalContribReal)}</strong>
            </span>
            <span>
              Total BTC: <strong>{last.btcHolding.toFixed(4)}</strong>
            </span>
            <span>
              BTC Value: <strong>€{fmt(last.btcValue)}</strong>
            </span>
            <span>
              Loan (principal): <strong>€{fmt(last.loanOutstanding)}</strong>
            </span>
            <span>
              Cash Balance: <strong>€{fmt(last.cashBalance)}</strong>
            </span>
            <span>
              Total Contributions: <strong>€{fmt(last.totalContrib)}</strong>
            </span>
            <span>
              Net Worth (no refs): <strong>€{fmt(last.netWorth)}</strong>
            </span>
            <span>
              Real Net Worth (no refs):{' '}
              <strong>€{fmt(last.realNetWorth)}</strong>
            </span>
            <span>
              Total Referral Income:{' '}
              <strong>
                €
                {fmt(
                  simWithRef[simWithRef.length - 1]?.netWorthWithRef -
                    last.netWorth || 0
                )}
              </strong>
            </span>
            <span>
              Collateral loan readiness: <strong>{yrs(collM)}</strong>{' '}
              <span className="text-gray-400">
                for €{fmt(collateralConfig.amount)} @{' '}
                {(collateralLtv * 100).toFixed(0)}% LTV
              </span>
            </span>
            <span>
              Net Worth + Referrals:{' '}
              <strong>
                €
                {fmt(
                  simWithRef[simWithRef.length - 1]?.netWorthWithRef ||
                    last.netWorth
                )}
              </strong>
            </span>
            <span>
              Real Net Worth + Referrals:{' '}
              <strong>
                €
                {fmt(
                  simWithRef[simWithRef.length - 1]?.realNetWorthWithRef ||
                    last.realNetWorth
                )}
              </strong>
            </span>
            <span>
              Net P&L vs. Contributions: <strong>€{fmt(last.pnlNet)}</strong>
            </span>
            <span>
              Real P&L vs. Contributions:{' '}
              <strong>€{fmt(last.realPnlNet)}</strong>
            </span>
            <span>
              Inflation Index:{' '}
              <strong>{last.inflationIndex.toFixed(2)}x</strong>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/***********************************
 * Fullscreen Chart Component
 ***********************************/
const FullscreenChart: React.FC<{
  isOpen: boolean;
  simWithRef: any[];
  collM: number | null;
  onClose: () => void;
}> = ({ isOpen, simWithRef, collM, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 md:inset-10 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">
            Pension & Passive Income Projection — Fullscreen
          </h2>
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
              <LineChart data={simWithRef}>
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
                  tickFormatter={v => fmt(v)}
                />
                <RechartsTooltip
                  formatter={(v: number) => fmt(v)}
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
                  yAxisId="left"
                  type="monotone"
                  dataKey="loanOutstanding"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Loan (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Net Worth (no refs) (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netWorthWithRef"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  name="Net Worth + Referrals (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="realNetWorth"
                  stroke="#94a3b8"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                  name="Real Net Worth (no refs) (€)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="realNetWorthWithRef"
                  stroke="#60a5fa"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                  strokeDasharray="1 3"
                  name="Real Net Worth + Referrals (€)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="contribution"
                  stroke="#a78bfa"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  name="Monthly Contribution (net €)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalContrib"
                  stroke="#f472b6"
                  strokeWidth={1.8}
                  name="Total Contributions (€)"
                />
                {collM !== null && (
                  <ReferenceLine
                    yAxisId="left"
                    x={collM}
                    stroke="#eab308"
                    strokeDasharray="3 3"
                    label={
                      <span>
                        <div style={{ fontSize: '1.1em' }}>📌</div>Collateral
                        ready
                      </span>
                    }
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

/***********************************
 * Fullscreen Platform Chart Component
 ***********************************/
const FullscreenPlatformChart: React.FC<{
  isOpen: boolean;
  platformAnnualSeries: any[];
  inp: any;
  onClose: () => void;
  platformChartLines: any[];
}> = ({ isOpen, platformAnnualSeries, inp, onClose, platformChartLines }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-4 md:inset-10 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">
            Platform Revenue & AUM — Fullscreen
          </h2>
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
              <LineChart data={platformAnnualSeries}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => fmt(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => fmt(v)}
                />
                <RechartsTooltip
                  formatter={(val: number, name: string) => {
                    if (name === 'Users' || name === 'New Users')
                      return [fmt(val), name];
                    if (name.includes('Platform BTC'))
                      return [`₿${fmt(Math.round(val))}`, name];
                    if (name.includes('Platform AUM'))
                      return [`€${fmt(val)}`, name];
                    if (name.includes('BTC Price'))
                      return [`€${fmt(val)}`, name];
                    return [`€${fmt(val)}`, name];
                  }}
                  labelFormatter={(y, payload) => {
                    const row = Array.isArray(payload)
                      ? payload[0]?.payload
                      : undefined;
                    const users = row?.users ? fmt(row.users) : '-';
                    const nu = row?.newUsers ? fmt(row.newUsers) : '-';
                    return `Year: ${y} • Users: ${users} • New Users: ${nu}`;
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

                {/* Renderowanie linii z tablicy */}
                {platformChartLines.map((lineConfig, index) => (
                  <Line
                    key={index}
                    yAxisId={lineConfig.yAxisId}
                    type="monotone"
                    dataKey={lineConfig.dataKey}
                    strokeWidth={lineConfig.strokeWidth}
                    stroke={lineConfig.stroke}
                    strokeDasharray={lineConfig.strokeDasharray}
                    name={lineConfig.name}
                  />
                ))}

                {/* Platform AUM - zawsze wyświetlany */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalAum"
                  strokeWidth={2}
                  stroke="#8b5cf6"
                  strokeDasharray="3 3"
                  name={`Platform AUM (€) - ${(inp.ltv * 100).toFixed(0)}% LTV`}
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
 * Platform Revenue Card Component
 ***********************************/
const PlatformRevenueCard: React.FC<{
  platformConfig: any;
  platformAnnualSeries: any[];
  updatePlatformConfig: any;
  portfolioHeight: number;
  inp: any;
  onFullscreenClick: () => void;
  platformChartLines: any[];
}> = ({
  platformConfig,
  platformAnnualSeries,
  updatePlatformConfig,
  portfolioHeight,
  inp,
  onFullscreenClick,
  platformChartLines,
}) => {
  return (
    <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
      <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg text-white text-left">
          Platform Revenue & AUM — Annual (Cohorts & User Growth)
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
      <CardContent className="px-6 pb-8 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <LabelWithInfo
              text="Users — Start (Year 1)"
              tip="Number of users in the first year (e.g. 50,000)."
            />
            <Input
              type="number"
              min={0}
              value={platformConfig.usersStart}
              onChange={e =>
                updatePlatformConfig({ usersStart: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Users — End (Year N)"
              tip="Target number of users in the last year (e.g. 1,000,000)."
            />
            <Input
              type="number"
              min={0}
              value={platformConfig.usersEnd}
              onChange={e =>
                updatePlatformConfig({ usersEnd: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Growth Mode"
              tip="Linear vs CAGR (exponential) user growth."
            />
            <Button
              type="button"
              className={`w-full ${platformConfig.usersGrowthMode === 'linear' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              onClick={() =>
                updatePlatformConfig({
                  usersGrowthMode:
                    platformConfig.usersGrowthMode === 'linear'
                      ? 'cagr'
                      : 'linear',
                })
              }
            >
              {platformConfig.usersGrowthMode === 'linear' ? 'Linear' : 'CAGR'}
            </Button>
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Yield Fee (%)"
              tip="Percentage charged by the platform from GROSS yield (earn) generated on deployed capital (loan). No fees from BTC price / P&L."
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              value={platformConfig.feePct}
              onChange={e =>
                updatePlatformConfig({ feePct: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Exchange Fee (%)"
              tip="Percentage charged once on the EUR amount exchanged into BTC during each DCA purchase."
            />
            <Input
              type="number"
              min={0}
              step={0.01}
              value={platformConfig.exchangeFeePct}
              onChange={e =>
                updatePlatformConfig({ exchangeFeePct: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Users — Avg Monthly (EUR)"
              tip="Average monthly deposit of platform user (affects P&amp;L, and therefore fees)."
            />
            <Input
              type="number"
              min={0}
              value={platformConfig.avgMonthly}
              onChange={e =>
                updatePlatformConfig({ avgMonthly: Number(e.target.value) })
              }
              className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
            />
          </div>
          <div className="space-y-1">
            <LabelWithInfo
              text="Platform Indexing (CPI)"
              tip="When ON — platform user contributions grow with inflation (affects P&amp;L path and fees over years)."
            />
            <Button
              type="button"
              className={`w-full ${platformConfig.enableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              onClick={() =>
                updatePlatformConfig({
                  enableIndexing: !platformConfig.enableIndexing,
                })
              }
            >
              {platformConfig.enableIndexing ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400 pt-1">
          Chart: <em>Total (€/year)</em>, <em>Yield Fee (€/year)</em>,{' '}
          <em>Exchange Fee (€/year)</em>, <em>Avg per user (€/year)</em>,{' '}
          <em>Users BTC Value (€)</em>, <em>Platform BTC Value (€)</em>,{' '}
          <em>Users</em>, <em>Users BTC (₿)</em>, <em>Platform BTC (₿)</em>,{' '}
          <em>BTC Price (€)</em> (right axis),{' '}
          <em>
            Platform AUM (€) - ${(inp.ltv * 100).toFixed(0)}% LTV deployed
            capital
          </em>
          . Fees calculated from yield (earn) + one‑off exchange fees (EUR→BTC
          purchases) — cohort convolution (users join over time). Platform AUM =
          deployed capital (loan balance) at ${(inp.ltv * 100).toFixed(0)}% LTV
          across all users.
        </p>
        <div className="w-full" style={{ height: portfolioHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={platformAnnualSeries}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                tickFormatter={v => fmt(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                tickFormatter={v => fmt(v)}
              />
              <RechartsTooltip
                formatter={(val: number, name: string) => {
                  if (name === 'Users' || name === 'New Users')
                    return [fmt(val), name];
                  if (name.includes('Users BTC'))
                    return [`₿${fmt(Math.round(val))}`, name];
                  if (name.includes('Platform BTC'))
                    return [`₿${fmt(Math.round(val))}`, name];
                  if (name.includes('Platform AUM'))
                    return [`€${fmt(val)}`, name];
                  if (name.includes('BTC Price')) return [`€${fmt(val)}`, name];
                  return [`€${fmt(val)}`, name];
                }}
                labelFormatter={(y, payload) => {
                  const row = Array.isArray(payload)
                    ? payload[0]?.payload
                    : undefined;
                  const users = row?.users ? fmt(row.users) : '-';
                  const nu = row?.newUsers ? fmt(row.newUsers) : '-';
                  return `Year: ${y} • Users: ${users} • New Users: ${nu}`;
                }}
                contentStyle={{
                  background: '#0b1220',
                  color: '#e5e7eb',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />

              {/* Renderowanie linii z tablicy */}
              {platformChartLines.map((lineConfig, index) => (
                <Line
                  key={index}
                  yAxisId={lineConfig.yAxisId}
                  type="monotone"
                  dataKey={lineConfig.dataKey}
                  strokeWidth={lineConfig.strokeWidth}
                  stroke={lineConfig.stroke}
                  strokeDasharray={lineConfig.strokeDasharray}
                  name={lineConfig.name}
                />
              ))}

              {/* Platform AUM - zawsze wyświetlany */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalAum"
                strokeWidth={2}
                stroke="#8b5cf6"
                strokeDasharray="3 3"
                name={`Platform AUM (€) - ${(inp.ltv * 100).toFixed(0)}% LTV`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

/***********************************
 * Main Component
 ***********************************/
const BtcPensionCalculator: React.FC = () => {
  const {
    inp,
    autoDrawToTarget,
    platformConfig,
    referralConfig,
    collateralConfig,
    simWithRef,
    last,
    platformAnnualSeries,
    collM,
    collateralLtv,
    spreadWarn,
    ltvWarn,
    setInp,
    setAutoDrawToTarget,
    updateK,
    updatePlatformConfig,
    updateReferralConfig,
    updateCollateralConfig,
  } = useBTCPensionCalculator();

  // fullscreen state for portfolio chart
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);
  // fullscreen state for platform chart
  const [isPlatformFullscreen, setIsPlatformFullscreen] = useState(false);

  // compute a stable pixel height for the portfolio chart so ResponsiveContainer always has non-zero height
  const portfolioHeight = useMemo(() => {
    return 420; // fixed height for full-width chart
  }, []);

  // Array z definicjami linii - reużywalny między wykresami platformy
  const platformChartLines = useMemo(
    () => [
      {
        yAxisId: 'left',
        dataKey: 'usersBtcValue',
        strokeWidth: 3,
        stroke: '#fbbf24',
        strokeDasharray: '2 4',
        name: 'Users BTC Value (€)',
      },
      {
        yAxisId: 'left',
        dataKey: 'platBtcValue',
        strokeWidth: 3,
        stroke: '#10b981',
        strokeDasharray: '4 2',
        name: 'Platform BTC Value (€)',
      },
      {
        yAxisId: 'left',
        dataKey: 'totalYieldFee',
        strokeWidth: 2,
        stroke: '#22c55e',
        name: 'Yield Fee (€/year)',
      },
      {
        yAxisId: 'left',
        dataKey: 'total',
        strokeWidth: 2,
        stroke: '#06b6d4',
        name: 'Total Revenue (€/year)',
      },
      {
        yAxisId: 'left',
        dataKey: 'totalExchangeFee',
        strokeWidth: 2,
        stroke: '#f59e0b',
        name: 'Exchange Fee (€/year)',
      },
      {
        yAxisId: 'right',
        dataKey: 'totalBtcHeld',
        strokeWidth: 2,
        stroke: '#fbbf24',
        name: 'Users BTC (₿)',
      },
      {
        yAxisId: 'right',
        dataKey: 'platBtcHolding',
        strokeWidth: 2,
        stroke: '#10b981',
        name: 'Platform BTC (₿ cum)',
      },
      {
        yAxisId: 'right',
        dataKey: 'priceBtcEur',
        strokeWidth: 1.5,
        stroke: '#f59e0b',
        strokeDasharray: '1 3',
        name: 'BTC Price (€)',
      },
      {
        yAxisId: 'right',
        dataKey: 'users',
        strokeWidth: 1.8,
        stroke: '#f472b6',
        name: 'Users',
      },
      {
        yAxisId: 'right',
        dataKey: 'newUsers',
        strokeWidth: 2,
        stroke: '#06b6d4',
        strokeDasharray: '4 2',
        name: 'New Users',
      },
      {
        yAxisId: 'left',
        dataKey: 'avgPerUser',
        strokeWidth: 2,
        strokeDasharray: '4 2',
        stroke: '#a78bfa',
        name: 'Avg per user (€/year)',
      },
    ],
    []
  );

  /* ---------------- render ---------------- */
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

          <PlatformRevenueCard
            platformConfig={platformConfig}
            platformAnnualSeries={platformAnnualSeries}
            updatePlatformConfig={updatePlatformConfig}
            portfolioHeight={portfolioHeight}
            inp={inp}
            onFullscreenClick={() => setIsPlatformFullscreen(true)}
            platformChartLines={platformChartLines}
          />

          <FullscreenChart
            isOpen={isPortfolioFullscreen}
            simWithRef={simWithRef}
            collM={collM}
            onClose={() => setIsPortfolioFullscreen(false)}
          />

          <FullscreenPlatformChart
            isOpen={isPlatformFullscreen}
            platformAnnualSeries={platformAnnualSeries}
            inp={inp}
            onClose={() => setIsPlatformFullscreen(false)}
            platformChartLines={platformChartLines}
          />
        </motion.div>
      </div>
    </TooltipProvider>
  );
};

export default BtcPensionCalculator;
