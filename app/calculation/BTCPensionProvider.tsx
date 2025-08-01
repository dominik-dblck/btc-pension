'use client';

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

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

interface PlatformConfig {
  avgMonthly: number;
  feePct: number;
  exchangeFeePct: number;
  enableIndexing: boolean;
  usersStart: number;
  usersEnd: number;
  usersGrowthMode: 'linear' | 'cagr';
}

interface ReferralConfig {
  count: number;
  avgMonthly: number;
  maxRefs: number;
  refChartAvgMonthly: number;
}

interface CollateralConfig {
  amount: number;
  ltvPct: number;
}

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

/**
 * NEW: Loan Outstanding (AUM‑eligible) per user by "age" year (end‑of‑year snapshot)
 * Only deployed capital (loanOutstanding) generating yield is counted as Assets Under Management.
 */
function loanOutstandingPerUserByAgeYear(
  p: SimulationInput & { exchangeFeePct?: number },
  autoDrawToTarget: boolean,
  enableIndexingOverride?: boolean
): Map<number, number> {
  const months = p.years * 12;
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0;
  const out = new Map<number, number>();

  for (let m = 1; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const inflationIndex = Math.pow(1 + p.cpiRate, m / 12);
    const indexing = enableIndexingOverride ?? p.enableIndexing;
    const gross = indexing
      ? p.monthlyContribution * inflationIndex
      : p.monthlyContribution;
    const contribution = gross * (1 - (p.exchangeFeePct ?? 0) / 100);

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Monthly accruals
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // Quarterly rebalance
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

    // End‑of‑year snapshot
    if (m % 12 === 0) {
      const ageYear = m / 12; // 1‑based
      out.set(ageYear, loanOutstanding);
    }
  }

  return out;
}

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
    const contribution = gross * (1 - exchangeFeePct / 100);

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
    const contribution = gross * (1 - (p.exchangeFeePct ?? 0) / 100);

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
    const contribution = gross * (1 - exchangeFeePct / 100);

    // DCA
    const btcBought = contribution / price;
    btcHolding += btcBought;

    // Exchange fee: one‑off na wartość miesięcznej kontrybucji (EUR → BTC)
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

/***********************************
 * Context and Provider
 ***********************************/
interface BTCPensionContextType {
  // State
  inp: SimulationInput;
  autoDrawToTarget: boolean;
  platformConfig: PlatformConfig;
  referralConfig: ReferralConfig;
  collateralConfig: CollateralConfig;

  // Computed values
  sim: SimulationPoint[];
  simWithRef: (SimulationPoint & {
    netWorthWithRef: number;
    realNetWorthWithRef: number;
  })[];
  last: SimulationPoint;
  refSeries: { n: number; earnings: number }[];
  platformAnnualSeries: {
    year: number;
    users: number;
    newUsers: number;
    total: number;
    totalYieldFee: number;
    totalExchangeFee: number;
    avgPerUser: number;
    totalAum: number;
  }[];
  platformFeePU: number;
  exchangeFeePU: number;
  collM: number | null;
  collateralLtv: number;

  // Warnings
  spreadWarn: boolean;
  ltvWarn: boolean;

  // Actions
  setInp: React.Dispatch<React.SetStateAction<SimulationInput>>;
  setAutoDrawToTarget: React.Dispatch<React.SetStateAction<boolean>>;
  updateK: (k: keyof SimulationInput, v: string, mult?: number) => void;
  updatePlatformConfig: (updates: Partial<PlatformConfig>) => void;
  updateReferralConfig: (updates: Partial<ReferralConfig>) => void;
  updateCollateralConfig: (updates: Partial<CollateralConfig>) => void;
}

const BTCPensionContext = createContext<BTCPensionContextType | undefined>(
  undefined
);

interface BTCPensionProviderProps {
  children: ReactNode;
}

export const BTCPensionProvider = ({ children }: BTCPensionProviderProps) => {
  // Core simulation inputs
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

  const [autoDrawToTarget, setAutoDrawToTarget] = useState(true);

  // Platform configuration
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    avgMonthly: 300,
    feePct: 15,
    exchangeFeePct: 0.1,
    enableIndexing: true,
    usersStart: 50_000,
    usersEnd: 1_000_000,
    usersGrowthMode: 'linear',
  });

  // Referral configuration
  const [referralConfig, setReferralConfig] = useState<ReferralConfig>({
    count: 0,
    avgMonthly: 200,
    maxRefs: 2_000,
    refChartAvgMonthly: 200,
  });

  // Collateral configuration
  const [collateralConfig, setCollateralConfig] = useState<CollateralConfig>({
    amount: 10_000,
    ltvPct: 30,
  });

  // Main simulation
  const sim = useMemo(
    () =>
      simulate(
        { ...inp, exchangeFeePct: platformConfig.exchangeFeePct },
        autoDrawToTarget
      ),
    [inp, platformConfig.exchangeFeePct, autoDrawToTarget]
  );
  const last = sim[sim.length - 1];

  // Referral simulation
  const refSim = useMemo(
    () =>
      simulate(
        {
          ...inp,
          monthlyContribution: referralConfig.avgMonthly,
          exchangeFeePct: platformConfig.exchangeFeePct,
        },
        autoDrawToTarget
      ),
    [
      inp,
      referralConfig.avgMonthly,
      platformConfig.exchangeFeePct,
      autoDrawToTarget,
    ]
  );
  const refFeeSeries = useMemo(
    () => computeReferralFeeSeries(refSim, referralConfig.count),
    [refSim, referralConfig.count]
  );
  const refFeeByMonth = useMemo(
    () =>
      new Map(
        refFeeSeries.map(
          (x: { month: number; feeCum: number }) => [x.month, x.feeCum] as const
        )
      ),
    [refFeeSeries]
  );

  // Simulation with referrals
  const simWithRef = useMemo(() => {
    return sim.map((pt: SimulationPoint) => ({
      ...pt,
      netWorthWithRef: pt.netWorth + (refFeeByMonth.get(pt.month) ?? 0),
      realNetWorthWithRef:
        (pt.netWorth + (refFeeByMonth.get(pt.month) ?? 0)) / pt.inflationIndex,
    }));
  }, [sim, refFeeByMonth]);

  // Platform fees
  const platformFeePU = useMemo(() => {
    return feePerUserFromYield(
      {
        ...inp,
        monthlyContribution: platformConfig.avgMonthly,
        enableIndexing: platformConfig.enableIndexing,
        exchangeFeePct: platformConfig.exchangeFeePct,
      },
      platformConfig.feePct,
      autoDrawToTarget,
      platformConfig.enableIndexing
    );
  }, [inp, platformConfig, autoDrawToTarget]);

  const exchangeFeePU = useMemo(() => {
    return exchangeFeePerUser(
      {
        ...inp,
        monthlyContribution: platformConfig.avgMonthly,
        enableIndexing: platformConfig.enableIndexing,
        exchangeFeePct: platformConfig.exchangeFeePct,
      },
      platformConfig.exchangeFeePct,
      autoDrawToTarget,
      platformConfig.enableIndexing
    );
  }, [inp, platformConfig, autoDrawToTarget]);

  // Referrer earnings chart
  const refChartSim = useMemo(
    () =>
      simulate(
        {
          ...inp,
          monthlyContribution: referralConfig.refChartAvgMonthly,
          exchangeFeePct: platformConfig.exchangeFeePct,
        },
        autoDrawToTarget
      ),
    [
      inp,
      referralConfig.refChartAvgMonthly,
      platformConfig.exchangeFeePct,
      autoDrawToTarget,
    ]
  );
  const refChartFeePU =
    refChartSim.reduce(
      (sum: number, pt: SimulationPoint) => sum + pt.yieldEarned,
      0
    ) * 0.05;

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
    () => buildSeries(referralConfig.maxRefs, refChartFeePU),
    [referralConfig.maxRefs, refChartFeePU]
  );

  // Platform annual revenue
  const platformAnnualSeries = useMemo(() => {
    const feePUByAge = feePerUserByAgeYearFromYield(
      {
        ...inp,
        monthlyContribution: platformConfig.avgMonthly,
        enableIndexing: platformConfig.enableIndexing,
        exchangeFeePct: platformConfig.exchangeFeePct,
      },
      platformConfig.feePct,
      autoDrawToTarget,
      platformConfig.enableIndexing
    );
    const exchangeFeePUByAge = exchangeFeePerUserByAgeYear(
      {
        ...inp,
        monthlyContribution: platformConfig.avgMonthly,
        enableIndexing: platformConfig.enableIndexing,
        exchangeFeePct: platformConfig.exchangeFeePct,
      },
      platformConfig.exchangeFeePct,
      autoDrawToTarget,
      platformConfig.enableIndexing
    );
    const loanPUByAge = loanOutstandingPerUserByAgeYear(
      {
        ...inp,
        monthlyContribution: platformConfig.avgMonthly,
        enableIndexing: platformConfig.enableIndexing,
        exchangeFeePct: platformConfig.exchangeFeePct,
      },
      autoDrawToTarget,
      platformConfig.enableIndexing
    );

    const years = Math.max(1, inp.years);
    const steps = Math.max(1, years - 1);
    const ratio =
      platformConfig.usersEnd > 0 && platformConfig.usersStart > 0
        ? Math.pow(
            platformConfig.usersEnd / platformConfig.usersStart,
            1 / steps
          )
        : 1;
    const usersAt = (i: number) => {
      if (platformConfig.usersGrowthMode === 'linear') {
        const val =
          platformConfig.usersStart +
          ((platformConfig.usersEnd - platformConfig.usersStart) * i) / steps;
        return Math.max(0, Math.round(val));
      } else {
        const val = platformConfig.usersStart * Math.pow(ratio, i);
        return Math.max(0, Math.round(val));
      }
    };
    const usersSeries = Array.from({ length: years }, (_, i) => usersAt(i));
    const newUsersSeries = usersSeries.map((u, i) =>
      Math.max(0, u - (i > 0 ? usersSeries[i - 1] : 0))
    );

    const out = Array.from({ length: years }, (_, i) => {
      const Y = i + 1;
      let totalYieldFee = 0;
      let totalExchangeFee = 0;
      let totalAum = 0;
      for (let age = 1; age <= Y; age++) {
        const cohortIndex = Y - age;
        const cohortSize = newUsersSeries[cohortIndex] ?? 0;
        const yieldFeeAge = feePUByAge.get(age) ?? 0;
        const exchangeFeeAge = exchangeFeePUByAge.get(age) ?? 0;
        const aumAge = loanPUByAge.get(age) ?? 0;
        totalYieldFee += cohortSize * yieldFeeAge;
        totalExchangeFee += cohortSize * exchangeFeeAge;
        totalAum += cohortSize * aumAge;
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
        totalAum,
      };
    });
    return out;
  }, [inp, platformConfig, autoDrawToTarget]);

  // Collateral calculations
  const collateralLtv = useMemo(
    () => Math.max(0, Math.min(100, collateralConfig.ltvPct)) / 100,
    [collateralConfig.ltvPct]
  );
  const collM = useMemo(
    () =>
      firstMonthForCollateralLoan(sim, collateralConfig.amount, collateralLtv),
    [sim, collateralConfig.amount, collateralLtv]
  );

  // Warnings
  const spread = inp.yieldRate - inp.loanRate;
  const spreadWarn = spread <= 0;
  const ltvWarn = inp.ltv > 0.8;

  // Utility functions
  const updateK = (k: keyof SimulationInput, v: string, mult = 1) =>
    setInp((prev: SimulationInput) => ({ ...prev, [k]: Number(v) / mult }));

  const updatePlatformConfig = (updates: Partial<PlatformConfig>) =>
    setPlatformConfig((prev: PlatformConfig) => ({ ...prev, ...updates }));

  const updateReferralConfig = (updates: Partial<ReferralConfig>) =>
    setReferralConfig((prev: ReferralConfig) => ({ ...prev, ...updates }));

  const updateCollateralConfig = (updates: Partial<CollateralConfig>) =>
    setCollateralConfig((prev: CollateralConfig) => ({ ...prev, ...updates }));

  const value: BTCPensionContextType = {
    // State
    inp,
    autoDrawToTarget,
    platformConfig,
    referralConfig,
    collateralConfig,

    // Computed values
    sim,
    simWithRef,
    last,
    refSeries,
    platformAnnualSeries,
    platformFeePU,
    exchangeFeePU,
    collM,
    collateralLtv,

    // Warnings
    spreadWarn,
    ltvWarn,

    // Actions
    setInp,
    setAutoDrawToTarget,
    updateK,
    updatePlatformConfig,
    updateReferralConfig,
    updateCollateralConfig,
  };

  return (
    <BTCPensionContext.Provider value={value}>
      {children}
    </BTCPensionContext.Provider>
  );
};

/***********************************
 * Custom Hook for using the context
 ***********************************/
export const useBTCPensionCalculator = () => {
  const context = useContext(BTCPensionContext);
  if (context === undefined) {
    throw new Error(
      'useBTCPensionCalculator must be used within a BTCPensionProvider'
    );
  }
  return context;
};
