import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/app/components/atoms/card';
import { Input } from '@/app/components/atoms/input';
import { Button } from '@/app/components/atoms/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/************************************************************************************************
 * Embedded meme (Bitcoin tree cartoon) as external URL
 ************************************************************************************************/
const memeSrc = `https://public.bnbstatic.com/image-proxy/rs_lg_webp/static/content/square/images/ea01f73e06f740dd94a7e420888ba115.jpg`;

/******************************************************
 * Utility helpers
 ******************************************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d });

/***********************************
 * Types
 ***********************************/
interface SimulationInput {
  monthlyContribution: number; // EUR
  initialPrice: number; // EUR
  cagr: number; // annual growth rate (0-1)
  years: number;
  ltv: number; // target LTV (0-1)
  loanRate: number; // APR (0-1)
  yieldRate: number; // APY (0-1)
}
interface SimulationPoint {
  month: number;
  price: number;
  btcBought: number;
  btcHolding: number;
  btcValue: number;
  loanOutstanding: number; // principal
  interestAccrued: number; // this step
  yieldEarned: number; // this step
  cashBalance: number; // cash from spreads and rebalances
  totalContrib: number; // cumulative fiat DCA
  netWorth: number; // btcValue - loanOutstanding + cashBalance
  pnlNet: number; // netWorth - totalContrib
}

/***********************************
 * Simulation with principal tracking (monthly), quarterly sampling for charts
 * Assumptions (ideal conditions):
 *  - deterministic CAGR (no volatility),
 *  - continuous access to credit/liquidity,
 *  - rebalance to target LTV at END of each quarter,
 *  - yield earned on outstanding principal; interest charged on principal,
 *  - no taxes; fees handled outside via % of user P&L.
 ***********************************/
const simulate = (p: SimulationInput): SimulationPoint[] => {
  const months = p.years * 12;
  const out: SimulationPoint[] = [];

  let btcHolding = 0;
  let loanOutstanding = 0; // principal
  let cashBalance = 0; // cash from net spreads and rebalances
  let totalContrib = 0;

  for (let m = 0; m <= months; m++) {
    // deterministic price path
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);

    // DCA: buy BTC monthly (skip m=0 for contributions if desired; keep as 0)
    if (m > 0) {
      totalContrib += p.monthlyContribution;
      const btcBought = p.monthlyContribution / price;
      btcHolding += btcBought;
    }

    // accruals (monthly)
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += yieldEarned - interest;

    // quarterly rebalance to target LTV at end of quarter or at the very end
    const isQuarterEnd = (m % 3 === 0 && m !== 0) || m === months;
    if (isQuarterEnd) {
      const btcValue = btcHolding * price;
      const targetLoan = p.ltv * btcValue;
      const delta = targetLoan - loanOutstanding; // >0: borrow more; <0: repay part

      if (delta > 0) {
        // draw additional loan and add to cash
        loanOutstanding += delta;
        cashBalance += delta;
      } else if (delta < 0) {
        const repay = Math.min(-delta, cashBalance);
        loanOutstanding -= repay;
        cashBalance -= repay;
        // if cashBalance not enough to reach target exactly, we stop at available cash.
      }
    }

    // state snapshot (quarterly sampling + m=0)
    if (m === 0 || m % 3 === 0 || m === months) {
      const btcValue = btcHolding * price;
      const netWorth = btcValue - loanOutstanding + cashBalance;
      const pnlNet = netWorth - totalContrib;
      out.push({
        month: m,
        price,
        btcBought: m > 0 ? p.monthlyContribution / price : 0,
        btcHolding,
        btcValue,
        loanOutstanding,
        interestAccrued: interest,
        yieldEarned,
        cashBalance,
        totalContrib,
        netWorth,
        pnlNet,
      });
    }
  }

  return out;
};

/***********************************
 * Component
 ***********************************/
const BTC_PensionCalculator: React.FC = () => {
  const [inp, setInp] = useState<SimulationInput>({
    monthlyContribution: 300,
    initialPrice: 70_000,
    cagr: 0.14,
    years: 25,
    ltv: 0.3,
    loanRate: 0.06,
    yieldRate: 0.12,
  });

  const [maxUsers, setMaxUsers] = useState(50_000);
  const [maxRefs, setMaxRefs] = useState(2_000);

  /* ---------------- calculations (memoized) ---------------- */
  const sim = useMemo(() => simulate(inp), [inp]);
  const last = sim[sim.length - 1];

  // platform/referrer fees: 1% of positive user net P&L (after contributions)
  const pnlPerUser = Math.max(0, last.pnlNet);
  const feePU = pnlPerUser * 0.01;

  const buildSeries = (count: number) => {
    const step = Math.max(1, Math.ceil(count / 120));
    const arr: { n: number; earnings: number }[] = [];
    for (let n = 0; n <= count; n += step) arr.push({ n, earnings: n * feePU });
    if (arr[arr.length - 1].n !== count)
      arr.push({ n: count, earnings: count * feePU });
    return arr;
  };

  const platformSeries = useMemo(
    () => buildSeries(maxUsers),
    [maxUsers, feePU]
  );
  const refSeries = useMemo(() => buildSeries(maxRefs), [maxRefs, feePU]);

  // percentage-aware updater (fixes the % bug)
  const updateK = (k: keyof SimulationInput, v: string, mult = 1) =>
    setInp(prev => ({ ...prev, [k]: Number(v) / mult }));

  // derived warnings (basic credibility checks under ideal conditions)
  const spread = inp.yieldRate - inp.loanRate;
  const spreadWarn = spread <= 0;
  const ltvWarn = inp.ltv > 0.8;

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-gray-100">
      <motion.div
        className="max-w-7xl mx-auto px-6 py-12 space-y-14"
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
            Deterministyczny model DCA → LTV‑loan → yield pod idealne warunki.
            Opłaty: 1% platforma & 1% referrer od <em>pozytywnego</em> P&amp;L
            netto użytkownika. Wartości przed podatkiem.
          </p>
        </header>

        <img
          src={memeSrc}
          alt="Bitcoin tree cartoon meme"
          className="mx-auto w-64 md:w-80 my-6 rounded-lg shadow-lg"
        />

        {/* Model snapshot */}
        <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-xl">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-xl">Model Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-8 space-y-6 text-sm">
            <div>
              <h3 className="font-semibold mb-1">
                Kluczowe założenia (idealne warunki)
              </h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-300">
                <li>
                  DCA miesięczne w EUR; deterministyczny CAGR BTC{' '}
                  {(inp.cagr * 100).toFixed(1)}%.
                </li>
                <li>
                  Cel LTV {(inp.ltv * 100).toFixed(0)}%, pożyczka APR{' '}
                  {(inp.loanRate * 100).toFixed(1)}%, yield APY{' '}
                  {(inp.yieldRate * 100).toFixed(1)}%.
                </li>
                <li>
                  Rebalans do docelowego LTV na koniec każdego kwartału; odsetki
                  i yield naliczane miesięcznie.
                </li>
                <li>
                  Fee: 1% platforma + 1% referrer od pozytywnego P&amp;L netto
                  użytkownika.
                </li>
              </ul>
            </div>
            {(spreadWarn || ltvWarn) && (
              <div className="text-xs text-amber-300">
                {spreadWarn && (
                  <p>
                    Uwaga: Spread ≤ 0 (yield ≤ interest). W idealnych warunkach
                    przychód ze spreadu nie pokryje kosztu długu.
                  </p>
                )}
                {ltvWarn && (
                  <p>
                    Uwaga: LTV &gt; 80% — ryzyko operacyjne wysokie (tu
                    ignorowane, ale sygnalizujemy).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid */}
        <section className="grid xl:grid-cols-3 lg:grid-cols-2 gap-10">
          {/* Parameters */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Parametry</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Pola % są wprowadzane jako wartości <em>w procentach</em>; model
                pracuje na ułamkach.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    [
                      'monthlyContribution',
                      'Monthly Contribution (EUR)',
                      1,
                      1,
                      'Miesięczna wpłata w EUR',
                    ],
                    [
                      'initialPrice',
                      'Initial BTC Price (EUR)',
                      1,
                      1,
                      'Cena startowa BTC',
                    ],
                    ['cagr', 'BTC CAGR (%)', 0.1, 100, 'Roczna aprecjacja BTC'],
                    ['years', 'Horizon (yrs)', 1, 1, 'Długość symulacji'],
                    ['ltv', 'Target LTV (%)', 0.1, 100, 'Docelowy LTV'],
                    [
                      'loanRate',
                      'Loan Interest (APR, %)',
                      0.1,
                      100,
                      'Roczna stopa pożyczki',
                    ],
                    [
                      'yieldRate',
                      'Yield Rate (APY, %)',
                      0.1,
                      100,
                      'Roczna stopa lokaty/yieldu',
                    ],
                  ] as [keyof SimulationInput, string, number, number, string][]
                ).map(([k, label, step, mult, tip]) => (
                  <div key={k} className="space-y-1">
                    <label
                      className="text-xs font-semibold text-gray-300"
                      title={tip}
                    >
                      {label}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={step}
                      value={(inp[k] as number) * mult}
                      onChange={e => updateK(k, e.target.value, mult)}
                      className="rounded-lg bg-slate-900/70 border-slate-700 focus:ring-orange-500 text-xs"
                      title={tip}
                    />
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-lg shadow-md"
                onClick={() => setInp({ ...inp })}
              >
                Recalculate
              </Button>
              <div className="grid grid-cols-2 gap-2 pt-4 text-xs text-gray-300">
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
                  Net Worth: <strong>€{fmt(last.netWorth)}</strong>
                </span>
                <span>
                  Net P&L vs. Contributions:{' '}
                  <strong>€{fmt(last.pnlNet)}</strong>
                </span>
                <span>
                  Fee / User (1%): <strong>€{fmt(feePU)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio chart */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Portfolio Projection</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                BTC value, loan & net worth over {inp.years} yrs
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sim}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: '#1e293b',
                      borderRadius: 8,
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="btcValue"
                    strokeWidth={2}
                    name="BTC Value (€)"
                  />
                  <Line
                    type="monotone"
                    dataKey="loanOutstanding"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Loan (€)"
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    strokeWidth={2}
                    name="Net Worth (€)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform earnings */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Platform Earnings</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                1% fee po {inp.years} latach vs liczba użytkowników (od
                pozytywnego P&L)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-4 h-80">
              <div>
                <label
                  className="text-xs font-semibold text-gray-300"
                  title="Łączna liczba aktywnych użytkowników po horyzoncie"
                >
                  Max Users
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxUsers}
                  onChange={e => setMaxUsers(Number(e.target.value))}
                  className="rounded-lg bg-slate-900/70 border-slate-700 text-xs"
                />
              </div>
              <ResponsiveContainer width="100%" height="70%">
                <LineChart data={platformSeries}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis
                    dataKey="n"
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => fmt(v)}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: '#1e293b',
                      borderRadius: 8,
                      border: 'none',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    strokeWidth={2}
                    name="Earnings (€)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Referrer earnings */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Referrer Earnings</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                1% udział po {inp.years} latach vs liczba poleconych (od
                pozytywnego P&L)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-4 h-80">
              <div>
                <label
                  className="text-xs font-semibold text-gray-300"
                  title="Liczba bezpośrednich poleconych"
                >
                  Max Referrals
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxRefs}
                  onChange={e => setMaxRefs(Number(e.target.value))}
                  className="rounded-lg bg-slate-900/70 border-slate-700 text-xs"
                />
              </div>
              <ResponsiveContainer width="100%" height="70%">
                <LineChart data={refSeries}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis
                    dataKey="n"
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => fmt(v)}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: '#1e293b',
                      borderRadius: 8,
                      border: 'none',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    strokeWidth={2}
                    name="Earnings (€)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </motion.div>
    </div>
  );
};

export default BTC_PensionCalculator;
