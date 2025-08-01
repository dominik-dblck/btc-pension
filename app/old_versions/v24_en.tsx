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
  m === null ? '—' : `${(m / 12).toFixed(1)} yrs`;

/***********************************
 * Types
 ***********************************/
interface SimulationInput {
  monthlyContribution: number; // EUR
  initialPrice: number; // EUR
  cagr: number; // annual growth rate (0-1)
  years: number;
  ltv: number; // target/maximum LTV for borrowing (0-1)
  loanRate: number; // APR (0-1)
  yieldRate: number; // APY (0-1)
  cpiRate: number; // annual inflation rate (0-1)
  enableIndexing: boolean; // whether to index contributions and costs to inflation
  /** One‑off exchange fee on each EUR→BTC purchase (%, 0‑100). Optional; default 0. */
  exchangeFeePct?: number;
}
interface SimulationPoint {
  month: number;
  price: number;
  contribution: number; // NEW: nominal contribution at this month (0 for m=0)
  btcBought: number;
  btcHolding: number;
  btcValue: number;
  loanOutstanding: number; // principal
  interestAccrued: number; // this step
  yieldEarned: number; // this step
  cashBalance: number; // cash from spreads and rebalances/purchases
  totalContrib: number; // cumulative fiat DCA
  totalContribReal: number; // cumulative DCA deflated to real terms
  netWorth: number; // btcValue - loanOutstanding + cashBalance
  pnlNet: number; // netWorth - totalContrib
  inflationIndex: number; // cumulative inflation factor
  realNetWorth: number; // netWorth adjusted for inflation
  realPnlNet: number; // realNetWorth - totalContribReal
}

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
 * Core simulation (monthly accruals, quarterly sampling)
 ***********************************/
const simulate = (
  p: SimulationInput & { exchangeFeePct?: number },
  autoDrawToTarget: boolean
): SimulationPoint[] => {
  const months = p.years * 12;
  const out: SimulationPoint[] = [];

  let btcHolding = 0;
  let loanOutstanding = 0; // principal
  let cashBalance = 0; // cash from net spreads and rebalances
  let totalContrib = 0;
  let totalContribReal = 0; // NEW: real-terms contributions accumulator
  let lastContribution = 0; // NEW: keep last nominal monthly contribution for sampling

  for (let m = 0; m <= months; m++) {
    // deterministic price path
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);

    // inflation index (cumulative)
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);

    // DCA: buy BTC monthly (indexed if enabled)
    if (m > 0) {
      const gross = p.enableIndexing
        ? p.monthlyContribution * inflationIndex
        : p.monthlyContribution;
      const fee = gross * ((p.exchangeFeePct ?? 0) / 100);
      const contribution = gross - fee; // NET amount swapped into BTC

      totalContrib += gross; // user really wpłaca pełną kwotę
      // deflate each month's nominal contribution to "real" terms at the moment it occurs
      totalContribReal += gross / inflationIndex; // NEW: include exchange fee in real contributions
      lastContribution = contribution; // NEW
      const btcBought = contribution / price;
      btcHolding += btcBought;
    }

    // accruals (monthly)
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // quarterly rebalance
    const isQuarterEnd = (m % 3 === 0 && m !== 0) || m === months;
    if (isQuarterEnd) {
      const btcValue = btcHolding * price;
      const targetLoan = p.ltv * btcValue;

      if (autoDrawToTarget) {
        // symmetric: draw or repay to reach target
        const delta = targetLoan - loanOutstanding; // >0 draw; <0 repay
        if (delta > 0) {
          loanOutstanding += delta;
          cashBalance += delta;
        } else if (delta < 0) {
          const repay = Math.min(-delta, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        // conservative: only repay if above target (e.g., after price drop)
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(loanOutstanding - targetLoan, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      }
    }

    // state snapshot (quarterly sampling + m=0)
    if (m === 0 || m % 3 === 0 || m === months) {
      const btcValue = btcHolding * price;
      const netWorth = btcValue - loanOutstanding + cashBalance;
      const pnlNet = netWorth - totalContrib;
      const realNetWorth = netWorth / inflationIndex;
      const realPnlNet = realNetWorth - totalContribReal; // NEW: correct real P&L
      out.push({
        month: m,
        price,
        contribution: m > 0 ? lastContribution : 0, // NEW
        btcBought: m > 0 ? lastContribution / price : 0,
        btcHolding,
        btcValue,
        loanOutstanding,
        interestAccrued: interest,
        yieldEarned,
        cashBalance,
        totalContrib,
        totalContribReal, // NEW
        netWorth,
        pnlNet,
        inflationIndex,
        realNetWorth,
        realPnlNet,
      });
    }
  }

  return out;
};

/***********************************
 * Referral fee series helper (5% of yield earned)
 ***********************************/
const computeReferralFeeSeries = (
  series: SimulationPoint[],
  refCount: number
) => {
  let cum = 0;
  return series.map(pt => {
    const feeStep = pt.yieldEarned * 0.05 * refCount;
    cum += feeStep;
    return { month: pt.month, feeStep, feeCum: cum };
  });
};

/** Collateral loan threshold:
 * returns earliest month when capacity >= desiredAmount
 * capacity = (chosenCollateralLtv) * btcValue - loanOutstanding
 */
const firstMonthForCollateralLoan = (
  series: SimulationPoint[],
  desiredAmount: number,
  collateralLtv: number
) => {
  for (const pt of series)
    if (collateralLtv * pt.btcValue - pt.loanOutstanding >= desiredAmount)
      return pt.month;
  return null;
};

/**
 * ===========================
 * Platform fee helpers (YIELD-ONLY)
 * ===========================
 * Platform charges X% exclusively from gross yield (earn) accrued on deployed capital (loanOutstanding).
 * No fees from BTC price growth / P&L.
 */
function feePerUserFromYield(
  p: SimulationInput & { exchangeFeePct?: number },
  feePct: number, // e.g. 10 (%)
  autoDrawToTarget: boolean,
  enableIndexingOverride?: boolean
): number {
  const months = p.years * 12;
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0; // not used for fee calculation, but maintaining simulation consistency
  let feePU = 0;

  for (let m = 1; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);
    const indexing = enableIndexingOverride ?? p.enableIndexing;
    const gross = indexing
      ? p.monthlyContribution * inflationIndex
      : p.monthlyContribution;
    const fee = gross * ((p.exchangeFeePct ?? 0) / 100);
    const contribution = gross - fee;

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Monthly accruals
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // Fee = % of GROSS yield
    feePU += yieldEarned * (feePct / 100);

    // Quarterly rebalance to target LTV
    const isQuarterEnd = m % 3 === 0 || m === months;
    if (isQuarterEnd) {
      const btcValue = btcHolding * price;
      const targetLoan = p.ltv * btcValue;
      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          loanOutstanding += delta;
          cashBalance += delta;
        } else if (delta < 0) {
          const repay = Math.min(-delta, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(loanOutstanding - targetLoan, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      }
    }
  }
  return feePU;
}

function exchangeFeePerUser(
  p: SimulationInput & { exchangeFeePct?: number },
  exchangeFeePct: number, // e.g. 0.1 (%)
  autoDrawToTarget: boolean,
  enableIndexingOverride?: boolean
): number {
  const months = p.years * 12;
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0;
  let exchangeFeePU = 0;

  for (let m = 1; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);
    const indexing = enableIndexingOverride ?? p.enableIndexing;
    const gross = indexing
      ? p.monthlyContribution * inflationIndex
      : p.monthlyContribution;
    const fee = gross * ((p.exchangeFeePct ?? 0) / 100);
    const contribution = gross - fee;

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Exchange fee: one‑off on every DCA purchase (EUR → BTC)
    exchangeFeePU += gross * (exchangeFeePct / 100);

    // Monthly accruals
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // Quarterly rebalance to target LTV
    const isQuarterEnd = m % 3 === 0 || m === months;
    if (isQuarterEnd) {
      const btcValue = btcHolding * price; // potrzebne do obliczeń LTV
      const targetLoan = p.ltv * btcValue;
      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          loanOutstanding += delta;
          cashBalance += delta;
        } else if (delta < 0) {
          const repay = Math.min(-delta, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(loanOutstanding - targetLoan, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      }
    }
  }
  return exchangeFeePU;
}

function feePerUserByAgeYearFromYield(
  p: SimulationInput & { exchangeFeePct?: number },
  feePct: number,
  autoDrawToTarget: boolean,
  enableIndexingOverride?: boolean
): Map<number, number> {
  const months = p.years * 12;
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0;
  const out = new Map<number, number>(); // ageYear -> fee

  for (let m = 1; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);
    const indexing = enableIndexingOverride ?? p.enableIndexing;
    const gross = indexing
      ? p.monthlyContribution * inflationIndex
      : p.monthlyContribution;
    const fee = gross * ((p.exchangeFeePct ?? 0) / 100);
    const contribution = gross - fee;

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Monthly accruals
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // Aggregate fee by "age" year
    const ageYear = Math.floor((m - 1) / 12) + 1;
    const add = yieldEarned * (feePct / 100);
    out.set(ageYear, (out.get(ageYear) ?? 0) + add);

    // Quarterly rebalance to target LTV
    const isQuarterEnd = m % 3 === 0 || m === months;
    if (isQuarterEnd) {
      const btcValue = btcHolding * price;
      const targetLoan = p.ltv * btcValue;
      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          loanOutstanding += delta;
          cashBalance += delta;
        } else if (delta < 0) {
          const repay = Math.min(-delta, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(loanOutstanding - targetLoan, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      }
    }
  }
  return out;
}

function exchangeFeePerUserByAgeYear(
  p: SimulationInput & { exchangeFeePct?: number },
  exchangeFeePct: number,
  autoDrawToTarget: boolean,
  enableIndexingOverride?: boolean
): Map<number, number> {
  const months = p.years * 12;
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0;
  const out = new Map<number, number>(); // ageYear -> exchange fee

  for (let m = 1; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);
    const indexing = enableIndexingOverride ?? p.enableIndexing;
    const gross = indexing
      ? p.monthlyContribution * inflationIndex
      : p.monthlyContribution;
    const fee = gross * ((p.exchangeFeePct ?? 0) / 100);
    const contribution = gross - fee;

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Exchange fee: one‑off na wartość miesięcznej kontrybucji (EUR → BTC)
    const btcValue = btcHolding * price;
    const ageYear = Math.floor((m - 1) / 12) + 1;
    const add = gross * (exchangeFeePct / 100);
    out.set(ageYear, (out.get(ageYear) ?? 0) + add);

    // Monthly accruals
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // Quarterly rebalance to target LTV
    const isQuarterEnd = m % 3 === 0 || m === months;
    if (isQuarterEnd) {
      const targetLoan = p.ltv * btcValue;
      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          loanOutstanding += delta;
          cashBalance += delta;
        } else if (delta < 0) {
          const repay = Math.min(-delta, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(loanOutstanding - targetLoan, cashBalance);
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      }
    }
  }
  return out;
}

/***********************************
 * Component
 ***********************************/
const BTC_PensionCalculator: React.FC = () => {
  const [inp, setInp] = useState<SimulationInput>({
    monthlyContribution: 300,
    initialPrice: 100_000,
    cagr: 0.14,
    years: 25,
    ltv: 0.3,
    loanRate: 0.0,
    yieldRate: 0.05,
    cpiRate: 0.03, // 3% annual inflation
    enableIndexing: false, // disabled by default
  });

  const [autoDrawToTarget, setAutoDrawToTarget] = useState(true); // OFF to make thresholds meaningful

  // platform/referrer charts inputs (separate from user's own referrals model)
  const [platformAvgMonthly, setPlatformAvgMonthly] = useState(300);
  // Platform fee = % of GROSS yield (earn) — default 10%
  const [platformFeePct, setPlatformFeePct] = useState(15); // %
  // Exchange fee = % of EUR → BTC purchase amount (charged once at DCA) — default 0.1%
  const [exchangeFeePct, setExchangeFeePct] = useState(0.1); // %
  // NEW: platform inflation indexing (independent of inp.enableIndexing)
  const [platformEnableIndexing, setPlatformEnableIndexing] = useState(true);
  // NEW: user growth parameters over time (for annual revenue)
  const [usersStart, setUsersStart] = useState(50_000);
  const [usersEnd, setUsersEnd] = useState(1_000_000);
  const [usersGrowthMode, setUsersGrowthMode] = useState<'linear' | 'cagr'>(
    'linear'
  );
  const [maxRefs, setMaxRefs] = useState(2_000);
  const [refChartAvgMonthly, setRefChartAvgMonthly] = useState(200);

  /* ---------------- calculations (memoized) ---------------- */
  const sim = useMemo(
    () => simulate({ ...inp, exchangeFeePct }, autoDrawToTarget),
    [inp, exchangeFeePct, autoDrawToTarget]
  );
  const last = sim[sim.length - 1];

  // referral modeling inputs (for user's own net worth uplift)
  const [refCount, setRefCount] = useState(0);
  const [refAvgMonthly, setRefAvgMonthly] = useState(200);

  // simulate a representative referral for user's uplift
  const refSim = useMemo(
    () =>
      simulate(
        { ...inp, monthlyContribution: refAvgMonthly, exchangeFeePct },
        autoDrawToTarget
      ),
    [inp, refAvgMonthly, exchangeFeePct, autoDrawToTarget]
  );
  const refFeeSeries = useMemo(
    () => computeReferralFeeSeries(refSim, refCount),
    [refSim, refCount]
  );
  const refFeeByMonth = useMemo(
    () => new Map(refFeeSeries.map(x => [x.month, x.feeCum] as const)),
    [refFeeSeries]
  );

  // merge for chart: net worth with referrals (cash inflows from fees)
  const simWithRef = useMemo(() => {
    return sim.map(pt => ({
      ...pt,
      netWorthWithRef: pt.netWorth + (refFeeByMonth.get(pt.month) ?? 0),
      realNetWorthWithRef:
        (pt.netWorth + (refFeeByMonth.get(pt.month) ?? 0)) / pt.inflationIndex,
    }));
  }, [sim, refFeeByMonth]);

  // per-user fees after full horizon — YIELD-ONLY and EXCHANGE
  const platformFeePU = useMemo(() => {
    return feePerUserFromYield(
      {
        ...inp,
        monthlyContribution: platformAvgMonthly,
        enableIndexing: platformEnableIndexing,
        exchangeFeePct,
      },
      platformFeePct,
      autoDrawToTarget,
      platformEnableIndexing
    );
  }, [
    inp,
    platformAvgMonthly,
    platformEnableIndexing,
    platformFeePct,
    exchangeFeePct,
    autoDrawToTarget,
  ]);

  const exchangeFeePU = useMemo(() => {
    return exchangeFeePerUser(
      {
        ...inp,
        monthlyContribution: platformAvgMonthly,
        enableIndexing: platformEnableIndexing,
        exchangeFeePct,
      },
      exchangeFeePct,
      autoDrawToTarget,
      platformEnableIndexing
    );
  }, [
    inp,
    platformAvgMonthly,
    platformEnableIndexing,
    exchangeFeePct,
    autoDrawToTarget,
  ]);

  // referrer earnings chart series (separate avg monthly)
  const refChartSim = useMemo(
    () =>
      simulate(
        { ...inp, monthlyContribution: refChartAvgMonthly, exchangeFeePct },
        autoDrawToTarget
      ),
    [inp, refChartAvgMonthly, exchangeFeePct, autoDrawToTarget]
  );
  const refChartFeePU =
    refChartSim.reduce((sum, pt) => sum + pt.yieldEarned, 0) * 0.05;

  const buildSeries = (count: number, feePerUser: number) => {
    const step = Math.max(1, Math.ceil(count / 120));
    const arr: { n: number; earnings: number }[] = [];
    for (let n = 0; n <= count; n += step)
      arr.push({ n, earnings: n * feePerUser });
    if (arr[arr.length - 1].n !== count)
      arr.push({ n: count, earnings: count * feePerUser });
    return arr;
  };

  const refSeries = useMemo(
    () => buildSeries(maxRefs, refChartFeePU),
    [maxRefs, refChartFeePU]
  );

  // NEW: annual platform revenue path (cohort model) — YIELD-ONLY fee + EXCHANGE fee
  const platformAnnualSeries = useMemo(() => {
    // 1) fee per "age year" from GROSS yield per user
    const feePUByAge = feePerUserByAgeYearFromYield(
      {
        ...inp,
        monthlyContribution: platformAvgMonthly,
        enableIndexing: platformEnableIndexing,
        exchangeFeePct,
      },
      platformFeePct,
      autoDrawToTarget,
      platformEnableIndexing
    );
    // 1b) exchange fee per "age year" from BTC value per user
    const exchangeFeePUByAge = exchangeFeePerUserByAgeYear(
      {
        ...inp,
        monthlyContribution: platformAvgMonthly,
        enableIndexing: platformEnableIndexing,
        exchangeFeePct,
      },
      exchangeFeePct,
      autoDrawToTarget,
      platformEnableIndexing
    );
    // 2) number of users according to growth model and cohort inflows (newUsers)
    const years = Math.max(1, inp.years);
    const steps = Math.max(1, years - 1);
    const ratio =
      usersEnd > 0 && usersStart > 0
        ? Math.pow(usersEnd / usersStart, 1 / steps)
        : 1;
    const usersAt = (i: number) => {
      if (usersGrowthMode === 'linear') {
        const val = usersStart + ((usersEnd - usersStart) * i) / steps;
        return Math.max(0, Math.round(val));
      } else {
        const val = usersStart * Math.pow(ratio, i);
        return Math.max(0, Math.round(val));
      }
    };
    const usersSeries = Array.from({ length: years }, (_, i) => usersAt(i));
    const newUsersSeries = usersSeries.map((u, i) =>
      Math.max(0, u - (i > 0 ? usersSeries[i - 1] : 0))
    );

    // 3) cohort convolution: in year Y we sum the impact of age=1..Y
    const out = Array.from({ length: years }, (_, i) => {
      const Y = i + 1;
      let totalYieldFee = 0;
      let totalExchangeFee = 0;
      for (let age = 1; age <= Y; age++) {
        const cohortIndex = Y - age; // 0‑based index of inflow year
        const cohortSize = newUsersSeries[cohortIndex] ?? 0;
        const yieldFeeAge = feePUByAge.get(age) ?? 0;
        const exchangeFeeAge = exchangeFeePUByAge.get(age) ?? 0;
        totalYieldFee += cohortSize * yieldFeeAge;
        totalExchangeFee += cohortSize * exchangeFeeAge;
      }
      const users = usersSeries[i] ?? 0;
      const total = totalYieldFee + totalExchangeFee;
      const avgPerUser = users > 0 ? total / users : 0;
      return {
        year: Y,
        users,
        newUsers: newUsersSeries[i] ?? 0,
        total,
        totalYieldFee,
        totalExchangeFee,
        avgPerUser,
      };
    });
    return out;
  }, [
    inp,
    platformAvgMonthly,
    platformEnableIndexing,
    platformFeePct,
    exchangeFeePct,
    autoDrawToTarget,
    usersStart,
    usersEnd,
    usersGrowthMode,
  ]);

  // percentage-aware updater (fixes the % bug)
  const updateK = (k: keyof SimulationInput, v: string, mult = 1) =>
    setInp(prev => ({ ...prev, [k]: Number(v) / mult }));

  // --- Collateral loan threshold inputs ---
  const [collateralAmount, setCollateralAmount] = useState<number>(10_000);
  const [collateralLtvPct, setCollateralLtvPct] = useState<number>(30); // %
  const collateralLtv = useMemo(
    () => Math.max(0, Math.min(100, collateralLtvPct)) / 100,
    [collateralLtvPct]
  );
  const collM = useMemo(
    () => firstMonthForCollateralLoan(sim, collateralAmount, collateralLtv),
    [sim, collateralAmount, collateralLtv]
  );

  // derived warnings (basic credibility checks under ideal conditions)
  const spread = inp.yieldRate - inp.loanRate;
  const spreadWarn = spread <= 0;
  const ltvWarn = inp.ltv > 0.8;

  // fullscreen state for portfolio chart
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);

  // match portfolio card height to parameters card
  const paramsCardRef = useRef<HTMLDivElement | null>(null);
  const [paramsHeight, setParamsHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!paramsCardRef.current || typeof window === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect?.height ?? null;
      if (h && h !== paramsHeight) setParamsHeight(h);
    });
    ro.observe(paramsCardRef.current);
    return () => ro.disconnect();
  }, [paramsHeight]);

  // compute a stable pixel height for the portfolio chart so ResponsiveContainer always has non-zero height
  const portfolioHeight = useMemo(() => {
    const base = 420;
    if (!paramsHeight) return base;
    // subtract approx header + paddings
    return Math.max(360, Math.floor(paramsHeight - 130));
  }, [paramsHeight]);

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
          {/* Header */}
          <header className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-lg">
              Bitcoin Pension & Passive‑Income Planner
            </h1>
            <p className="text-sm md:text-base text-gray-300 max-w-3xl mx-auto">
              Deterministic DCA → LTV‑loan → yield model under ideal conditions.
              Nominal vs. real results with optional referral uplift.
            </p>
            <p className="text-xs md:text-sm text-gray-400 max-w-3xl mx-auto">
              Enter % fields as <em>percent values</em>; the model converts them
              to fractions.
            </p>
          </header>

          <img
            src={memeSrc}
            alt="Bitcoin tree cartoon meme"
            className="mx-auto w-80 md:w-[28rem] my-6 rounded-lg shadow-lg"
          />

          {/* Model snapshot */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-xl">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-xl text-white">
                Model Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-6 text-sm">
              <div>
                <h3 className="font-semibold mb-1 text-white">
                  Key assumptions (ideal conditions)
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                  <li>
                    <strong>Accumulation</strong>: monthly DCA in EUR; BTC price
                    grows at fixed CAGR {(inp.cagr * 100).toFixed(1)}% (no
                    volatility).
                  </li>
                  <li>
                    <strong>Inflation</strong>: CPI rate{' '}
                    {(inp.cpiRate * 100).toFixed(1)}% annually.{' '}
                    <strong>
                      Indexing {inp.enableIndexing ? 'ON' : 'OFF'}
                    </strong>{' '}
                    — when ON: contributions and purchase costs increase with
                    inflation.
                  </li>
                  <li>
                    <strong>Collateral</strong>: loan capacity ={' '}
                    <em>LTV × BTC value − loan balance</em>.
                  </li>
                  <li>
                    <strong>Rebalancing</strong>: quarterly to target LTV{' '}
                    {(inp.ltv * 100).toFixed(0)}%. <em>Auto‑draw</em>{' '}
                    {autoDrawToTarget ? 'ON' : 'OFF'} — ON: uses capacity as it
                    grows; OFF: capacity accumulates until purchase.
                  </li>
                  <li>
                    <strong>Referrals</strong>: 5% fee from{' '}
                    <em>yield earned</em> by referred users (used only for
                    "Referrer Earnings").
                  </li>
                  <li>
                    <strong>Financing</strong>: interest APR{' '}
                    {(inp.loanRate * 100).toFixed(1)}% and yield APY{' '}
                    {(inp.yieldRate * 100).toFixed(1)}% accrue monthly on loan
                    balance.
                  </li>
                  <li>
                    <strong>Platform fees</strong>: yield fee {platformFeePct}%
                    from <em>gross yield</em> on deployed capital (loan) +
                    exchange fee {exchangeFeePct}% charged <em>once</em> on
                    every EUR → BTC purchase. No fees from BTC price growth /
                    P&amp;L.
                  </li>
                </ul>
              </div>
              {(spreadWarn || ltvWarn) && (
                <div className="text-xs text-amber-300">
                  {spreadWarn && (
                    <p>
                      Warning: Spread ≤ 0 (yield ≤ interest). Under ideal
                      conditions, spread income won't cover loan cost.
                    </p>
                  )}
                  {ltvWarn && (
                    <p>
                      Warning: LTV &gt; 80% — high operational risk (ignored
                      here, but flagged).
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two-column layout: Parameters & Portfolio side-by-side */}
          <section className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Parameters with logical sections */}
            <Card
              ref={paramsCardRef}
              className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg"
            >
              <CardHeader className="px-6 pt-6 pb-3">
                <CardTitle className="text-lg text-white">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-8 space-y-6">
                {/* Contributions */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Contributions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onChange={e =>
                          updateK('monthlyContribution', e.target.value, 1)
                        }
                        className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                      />
                    </div>
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
                        onChange={e =>
                          updateK('initialPrice', e.target.value, 1)
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
                  </div>
                </div>

                {/* Inflation */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Inflation & Indexing
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="space-y-1">
                      <LabelWithInfo
                        text="Enable Inflation Indexing"
                        tip="When ON: monthly contributions and purchase costs increase with inflation over time"
                      />
                      <Button
                        type="button"
                        className={`w-full ${inp.enableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        onClick={() =>
                          setInp(prev => ({
                            ...prev,
                            enableIndexing: !prev.enableIndexing,
                          }))
                        }
                      >
                        {inp.enableIndexing ? 'ON' : 'OFF'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Earning */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Earning
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        onChange={e =>
                          updateK('yieldRate', e.target.value, 100)
                        }
                        className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo
                        text="Auto‑draw to Target LTV"
                        tip="Automatically draw loan balance to target LTV at quarter end. When OFF — loan capacity accumulates until purchase."
                      />
                      <Button
                        type="button"
                        className={`w-full ${autoDrawToTarget ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        onClick={() => setAutoDrawToTarget(v => !v)}
                      >
                        {autoDrawToTarget ? 'ON' : 'OFF'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Collateral loan threshold */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Collateral loan (safe emergency credit)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo
                        text="Loan Amount (EUR)"
                        tip="Amount of BTC-collateralized loan, full coverage according to selected LTV."
                      />
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={collateralAmount}
                        onChange={e =>
                          setCollateralAmount(Number(e.target.value))
                        }
                        className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo
                        text="Loan LTV (%)"
                        tip="LTV used to assess capacity: capacity = LTV × BTC value − existing debt."
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={collateralLtvPct}
                        onChange={e =>
                          setCollateralLtvPct(Number(e.target.value))
                        }
                        className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Referrals (user uplift) */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Referrals
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo
                        text="Referrals — Count"
                        tip="Number of direct referred users, saving with the same parameters (except their own monthly deposit)."
                      />
                      <Input
                        type="number"
                        min={0}
                        value={refCount}
                        onChange={e => setRefCount(Number(e.target.value))}
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
                        value={refAvgMonthly}
                        onChange={e => setRefAvgMonthly(Number(e.target.value))}
                        className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Summary
                  </h4>
                  <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
                    <span>
                      Real Contributions (deflated):{' '}
                      <strong>€{fmt(last.totalContribReal)}</strong>
                    </span>{' '}
                    {/* NEW */}
                    <span>
                      Total BTC: <strong>{last.btcHolding.toFixed(4)}</strong>
                    </span>
                    <span>
                      BTC Value: <strong>€{fmt(last.btcValue)}</strong>
                    </span>
                    <span>
                      Loan (principal):{' '}
                      <strong>€{fmt(last.loanOutstanding)}</strong>
                    </span>
                    <span>
                      Cash Balance: <strong>€{fmt(last.cashBalance)}</strong>
                    </span>
                    <span>
                      Total Contributions:{' '}
                      <strong>€{fmt(last.totalContrib)}</strong>
                    </span>
                    <span>
                      Net Worth (no refs):{' '}
                      <strong>€{fmt(last.netWorth)}</strong>
                    </span>
                    <span>
                      Real Net Worth (no refs):{' '}
                      <strong>€{fmt(last.realNetWorth)}</strong>
                    </span>
                    <span>
                      Total Referral Income:{' '}
                      <strong>
                        €{fmt(refFeeByMonth.get(last.month) ?? 0)}
                      </strong>
                    </span>
                    <span>
                      Collateral loan readiness: <strong>{yrs(collM)}</strong>{' '}
                      <span className="text-gray-400">
                        for €{fmt(collateralAmount)} @{' '}
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
                          simWithRef[simWithRef.length - 1]
                            ?.realNetWorthWithRef || last.realNetWorth
                        )}
                      </strong>
                    </span>
                    <span>
                      Net P&L vs. Contributions:{' '}
                      <strong>€{fmt(last.pnlNet)}</strong>
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

            {/* Portfolio chart (right column) */}
            <Card
              className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg relative"
              style={{ minHeight: paramsHeight ?? undefined }}
            >
              <CardHeader className="px-6 pt-6 pb-3 flex items-center justify-between">
                <CardTitle className="text-lg text-white">
                  Portfolio Projection
                </CardTitle>
                <Button
                  type="button"
                  className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
                  onClick={() => setIsPortfolioFullscreen(true)}
                  aria-label="Open fullscreen"
                  title="Show fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-6 pb-8 space-y-3">
                <p className="text-xs text-gray-400">
                  BTC value, loan & net worth over {inp.years} yrs + referral
                  uplift + inflation adjustment
                </p>
                <div className="w-full" style={{ height: portfolioHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simWithRef}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        strokeOpacity={0.15}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickFormatter={v =>
                          v % 12 === 0 ? String(v / 12) : ''
                        }
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
                      />{' '}
                      {/* NEW: secondary axis for contributions */}
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
                      <Legend wrapperStyle={{ fontSize: 10 }} />
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
                        name="Monthly Contribution (€)"
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
              </CardContent>
            </Card>
          </section>

          {/* Fullscreen overlay for Portfolio chart */}
          {isPortfolioFullscreen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
              <div className="absolute inset-4 md:inset-10 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                  <h2 className="text-base font-semibold text-white">
                    Portfolio Projection — Fullscreen
                  </h2>
                  <Button
                    type="button"
                    className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
                    onClick={() => setIsPortfolioFullscreen(false)}
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
                        <CartesianGrid
                          strokeDasharray="3 3"
                          strokeOpacity={0.15}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12 }}
                          tickFormatter={v =>
                            v % 12 === 0 ? String(v / 12) : ''
                          }
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
                        />{' '}
                        {/* NEW */}
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
                          name="Monthly Contribution (€)"
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
                                <div style={{ fontSize: '1.1em' }}>📌</div>
                                Collateral ready
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
          )}

          {/* (REMOVED) old per-cycle chart — entire narrative moved to annual chart with cohorts */}

          {/* Platform revenue (annual, cohorts) — ONE main chart + control inputs */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg text-white">
                Platform Revenue — Annual (Cohorts & User Growth)
              </CardTitle>
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
                    value={usersStart}
                    onChange={e => setUsersStart(Number(e.target.value))}
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
                    value={usersEnd}
                    onChange={e => setUsersEnd(Number(e.target.value))}
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
                    className={`w-full ${usersGrowthMode === 'linear' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                    onClick={() =>
                      setUsersGrowthMode(m =>
                        m === 'linear' ? 'cagr' : 'linear'
                      )
                    }
                  >
                    {usersGrowthMode === 'linear' ? 'Linear' : 'CAGR'}
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
                    value={platformFeePct}
                    onChange={e => setPlatformFeePct(Number(e.target.value))}
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
                    value={exchangeFeePct}
                    onChange={e => setExchangeFeePct(Number(e.target.value))}
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
                    value={platformAvgMonthly}
                    onChange={e =>
                      setPlatformAvgMonthly(Number(e.target.value))
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
                    className={`w-full ${platformEnableIndexing ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                    onClick={() => setPlatformEnableIndexing(v => !v)}
                  >
                    {platformEnableIndexing ? 'ON' : 'OFF'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                Chart: <em>Total (€/year)</em>, <em>Yield Fee (€/year)</em>,{' '}
                <em>Exchange Fee (€/year)</em>, <em>Avg per user (€/year)</em>{' '}
                and <em>Users</em> (right axis). Fees calculated from yield
                (earn) + one‑off exchange fees (EUR→BTC purchases) — cohort
                convolution (users join over time).
              </p>
              <div className="h-[380px] w-full">
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
                        if (name === 'Users' || name === 'New users')
                          return [fmt(val), name];
                        return [`€${fmt(val)}`, name];
                      }}
                      labelFormatter={(y, payload) => {
                        const row = Array.isArray(payload)
                          ? payload[0]?.payload
                          : undefined;
                        const users = row?.users ? fmt(row.users) : '-';
                        const nu = row?.newUsers ? fmt(row.newUsers) : '-';
                        return `Year: ${y} • Users: ${users} • New: ${nu}`;
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
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="total"
                      strokeWidth={2}
                      stroke="#06b6d4"
                      name="Total (€/year)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalYieldFee"
                      strokeWidth={2}
                      stroke="#22c55e"
                      name="Yield Fee (€/year)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalExchangeFee"
                      strokeWidth={2}
                      stroke="#f59e0b"
                      name="Exchange Fee (€/year)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avgPerUser"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      stroke="#a78bfa"
                      name="Avg per user (€/year)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="users"
                      strokeWidth={1.8}
                      stroke="#f472b6"
                      name="Users"
                    />
                    {/* opcjonalnie można dodać nowy napływ: */}
                    {/* <Line yAxisId="right" type="monotone" dataKey="newUsers" strokeWidth={1.4} strokeDasharray="2 2" stroke="#f59e0b" name="New users" /> */}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Referrer earnings — full width with separate inputs */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg text-white">
                Referrer Earnings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-3">
              <p className="text-xs text-gray-400">
                5% share from yield earned over {inp.years} years — control{' '}
                <em>Referrals — Count</em> and <em>Referrals — Avg Monthly</em>{' '}
                independently for this chart.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <LabelWithInfo
                    text="Referrals — Count (chart)"
                    tip="Number of direct referrals used only for the referrer earnings chart."
                  />
                  <Input
                    type="number"
                    min={0}
                    value={maxRefs}
                    onChange={e => setMaxRefs(Number(e.target.value))}
                    className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                  />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo
                    text="Referrals — Avg Monthly (EUR) (chart)"
                    tip="Average monthly deposit per referral used for the referrer earnings chart."
                  />
                  <Input
                    type="number"
                    min={0}
                    value={refChartAvgMonthly}
                    onChange={e =>
                      setRefChartAvgMonthly(Number(e.target.value))
                    }
                    className="rounded-lg bg-slate-900/70 border-slate-700 text-white text-xs p-[2px]"
                  />
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={refSeries}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis
                      dataKey="n"
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => fmt(v)}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => fmt(v)}
                    />
                    <RechartsTooltip
                      formatter={(v: number) => fmt(v)}
                      labelFormatter={v => fmt(Number(v))}
                      contentStyle={{
                        background: '#0b1220',
                        color: '#e5e7eb',
                        borderRadius: 8,
                        border: '1px solid #334155',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="earnings"
                      strokeWidth={2}
                      name="Earnings (€)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </TooltipProvider>
  );
};

/***********************************
 * Minimal self-checks (run in browser dev only)
 ***********************************/
function runSelfCheck() {
  const base: SimulationInput = {
    monthlyContribution: 100,
    initialPrice: 50_000,
    cagr: 0.1,
    years: 2,
    ltv: 0.3,
    loanRate: 0.05,
    yieldRate: 0.08,
    cpiRate: 0.02, // 2% annual inflation
    enableIndexing: false,
  };
  const s = simulate({ ...base, exchangeFeePct: 0 }, false);
  console.assert(s.length > 0, 'simulate should return data');
  console.assert(s[0].month === 0, 'first sample should be month 0');
  console.assert(
    s[s.length - 1].month === base.years * 12,
    'last sample should be last month'
  );

  // --- NEW: CPI / real contributions checks ---
  (function () {
    const months = base.years * 12;
    let expectedReal = 0;
    for (let m = 1; m <= months; m++) {
      const infl = Math.pow(1 + base.cpiRate, m / 12);
      const contrib = base.monthlyContribution; // enableIndexing=false
      expectedReal += contrib / infl;
    }
    const last = s[s.length - 1];
    const diff = Math.abs(last.totalContribReal - expectedReal);
    console.assert(
      diff / Math.max(1, expectedReal) < 1e-9,
      'totalContribReal should match deflated sum of contributions'
    );
    console.assert(
      Math.abs(last.realPnlNet - (last.realNetWorth - last.totalContribReal)) <
        1e-9,
      'realPnlNet should equal realNetWorth - totalContribReal'
    );
  })();

  // Collateral threshold sanity: with zero BTC value, threshold should be null
  const none = firstMonthForCollateralLoan(
    [
      {
        month: 0,
        price: 0,
        contribution: 0,
        btcBought: 0,
        btcHolding: 0,
        btcValue: 0,
        loanOutstanding: 0,
        interestAccrued: 0,
        yieldEarned: 0,
        cashBalance: 0,
        totalContrib: 0,
        totalContribReal: 0,
        netWorth: 0,
        pnlNet: 0,
        inflationIndex: 1,
        realNetWorth: 0,
        realPnlNet: 0,
      },
    ],
    10_000,
    0.3
  );
  console.assert(
    none === null,
    'collateral threshold should be null when btcValue=0'
  );
}
try {
  if (typeof window !== 'undefined') runSelfCheck();
} catch {}

export default BTC_PensionCalculator;

/* ====== EXTRA SELF-CHECK (yield-only fee should be 0 when yieldRate=0) ====== */
try {
  if (typeof window !== 'undefined') {
    const p: SimulationInput = {
      monthlyContribution: 300,
      initialPrice: 100_000,
      cagr: 0.14, // BTC grows, but this shouldn't create fees
      years: 2,
      ltv: 0.3,
      loanRate: 0.0,
      yieldRate: 0.0, // no yield => fee=0
      cpiRate: 0.0,
      enableIndexing: false,
    };
    const fee0 = feePerUserFromYield({ ...p, exchangeFeePct: 0 }, 10, true);
    console.assert(
      Math.abs(fee0) < 1e-8,
      'Platform fee should be 0 when yieldRate=0 (even if BTC price grows).'
    );
  }
} catch {}
