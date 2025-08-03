import React, { useState } from 'react';
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

/*************************
 * Utility helpers
 *************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: d });

/*************************
 * Types
 *************************/
interface SimulationInput {
  monthlyContribution: number; // € / month
  initialPrice: number; // € per BTC now
  cagr: number; // BTC CAGR (0‑1)
  years: number; // investment horizon
  ltv: number; // collateral LTV (0‑1)
  loanRate: number; // APR on loan (0‑1)
  yieldRate: number; // APR on deployed capital (0‑1)
}
interface SimulationPoint {
  month: number;
  price: number;
  btcBought: number;
  btcHolding: number;
  btcValue: number;
  loan: number;
  interest: number;
  yieldEarned: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

/*************************
 * Core simulation
 *************************/
const simulate = (p: SimulationInput): SimulationPoint[] => {
  const months = p.years * 12;
  const out: SimulationPoint[] = [];
  let btcHolding = 0;
  let cum = 0;

  for (let m = 0; m <= months; m++) {
    if (m % 3 !== 0 && m !== months) continue; // quarterly sampling

    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const btcBought = m === 0 ? 0 : (p.monthlyContribution / price) * 3; // buy 3 months worth per sample
    btcHolding += btcBought;

    const btcValue = btcHolding * price;
    const loan = btcValue * p.ltv;
    const interest = (loan * p.loanRate) / 4; // quarterly interest
    const yieldEarned = (loan * p.yieldRate) / 4;
    const net = yieldEarned - interest;
    cum += net;

    out.push({
      month: m,
      price,
      btcBought,
      btcHolding,
      btcValue,
      loan,
      interest,
      yieldEarned,
      netCashFlow: net,
      cumulativeCashFlow: cum,
    });
  }
  return out;
};

/*************************
 * Main component
 *************************/
const BTC_PensionCalculator: React.FC = () => {
  // -------- state & derived values --------
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

  const sim = simulate(inp);
  const last = sim[sim.length - 1];
  const profitPU = last.cumulativeCashFlow;
  const feePU = profitPU * 0.01;

  // -------- helper series builders --------
  const buildSeries = (count: number) => {
    const step = Math.max(1, Math.ceil(count / 120));
    const arr: { n: number; earnings: number }[] = [];
    for (let n = 0; n <= count; n += step) arr.push({ n, earnings: n * feePU });
    if (arr[arr.length - 1].n !== count)
      arr.push({ n: count, earnings: count * feePU });
    return arr;
  };

  const platformSeries = buildSeries(maxUsers);
  const refSeries = buildSeries(maxRefs);

  // -------- input handler --------
  const upd = (k: keyof SimulationInput, v: string) =>
    setInp({ ...inp, [k]: Number(v) });

  // -------- render --------
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 space-y-8"
    >
      {/* Overview card */}
      <Card className="shadow-xl border border-gray-200">
        <CardHeader>
          <CardTitle className="text-2xl">
            BTC Pension & Passive‑Income Simulator
          </CardTitle>
          <CardDescription>
            Build a long‑term Bitcoin pension while generating fiat cash‑flow
            from a low‑risk collateral strategy. Quarterly sampling &
            max‑120‑point charts keep the UI smooth.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p className="font-medium">Key assumptions:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Monthly fiat contribution buys BTC (DCA). As the BTC price rises (
              <strong>{(inp.cagr * 100).toFixed(1)}% CAGR</strong>), each € buys
              fewer sats.
            </li>
            <li>
              <strong>{(inp.ltv * 100).toFixed(0)}% LTV</strong> loan at{' '}
              {(inp.loanRate * 100).toFixed(1)}% APR; capital redeployed at{' '}
              {(inp.yieldRate * 100).toFixed(1)}% APY.
            </li>
            <li>
              Platform & referrer each collect a{' '}
              <strong>1 % performance fee</strong> on the user’s net profit.
            </li>
            <li>
              All projections span <strong>{inp.years} years</strong>; values
              are before tax.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid gap-8 xl:grid-cols-3 lg:grid-cols-2">
        {/* Inputs */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Parameters</CardTitle>
            <CardDescription>
              Hover fields for hints; press recalculate to apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  [
                    'monthlyContribution',
                    'Monthly € contributed',
                    1,
                    1,
                    'Fiat amount auto‑converted to BTC each month.',
                  ],
                  [
                    'initialPrice',
                    'Initial BTC Price €',
                    1,
                    1,
                    'Spot price today (starting point).',
                  ],
                  [
                    'cagr',
                    'BTC CAGR %',
                    0.1,
                    100,
                    'Expected average annual BTC appreciation.',
                  ],
                  ['years', 'Horizon years', 1, 1, 'Total investment period.'],
                  [
                    'ltv',
                    'Loan‑to‑Value %',
                    0.1,
                    100,
                    '% of BTC value taken as collateralised loan.',
                  ],
                  [
                    'loanRate',
                    'Loan Interest % p.a.',
                    0.1,
                    100,
                    'Annual interest on the fiat loan.',
                  ],
                  [
                    'yieldRate',
                    'Yield Rate % p.a.',
                    0.1,
                    100,
                    'Annual yield on deployed fiat capital.',
                  ],
                ] as [keyof SimulationInput, string, number, number, string][]
              ).map(([k, label, step, mult, tip]) => (
                <div key={k} className="space-y-1">
                  <label className="text-sm font-medium" title={tip}>
                    {label}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={step}
                    value={(inp[k] as number) * mult}
                    onChange={e =>
                      upd(k, String(Number(e.target.value) / mult))
                    }
                    title={tip}
                  />
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setInp({ ...inp })}
            >
              Recalculate
            </Button>
            <hr />
            <div className="grid grid-cols-2 text-sm gap-2">
              <p>
                <strong>Total BTC:</strong> {last.btcHolding.toFixed(4)} BTC
              </p>
              <p>
                <strong>BTC value:</strong> €{fmt(last.btcValue)}
              </p>
              <p>
                <strong>Loan balance:</strong> €{fmt(last.loan)}
              </p>
              <p>
                <strong>User profit:</strong> €{fmt(last.cumulativeCashFlow)}
              </p>
              <p>
                <strong>Fee / user:</strong> €{feePU.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Projection chart */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Portfolio Projection</CardTitle>
            <CardDescription>
              BTC value, loan balance & cumulative cash‑flow
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sim}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={v => (v % 12 === 0 ? String(v / 12) : '')}
                />
                <YAxis tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="btcValue"
                  name="BTC Value (€)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="loan"
                  name="Loan (€)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeCashFlow"
                  name="Cum. Cash‑flow (€)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform earnings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Platform Earnings</CardTitle>
            <CardDescription>
              Total 1 % fee after {inp.years} years vs users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 h-80">
            <div>
              <label
                className="text-sm font-medium"
                title="Size of the overall user base."
              >
                Max Users
              </label>
              <Input
                type="number"
                min={1}
                value={maxUsers}
                onChange={e => setMaxUsers(Number(e.target.value))}
              />
            </div>
            <ResponsiveContainer width="100%" height="70%">
              <LineChart data={platformSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="n" tickFormatter={v => fmt(v)} />
                <YAxis tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
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
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Referrer Earnings</CardTitle>
            <CardDescription>
              Passive 1 % share after {inp.years} years vs referrals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 h-80">
            <div>
              <label
                className="text-sm font-medium"
                title="Number of direct invitees."
              >
                Max Referrals
              </label>
              <Input
                type="number"
                min={1}
                value={maxRefs}
                onChange={e => setMaxRefs(Number(e.target.value))}
              />
            </div>
            <ResponsiveContainer width="100%" height="70%">
              <LineChart data={refSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="n" tickFormatter={v => fmt(v)} />
                <YAxis tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
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
      </div>
    </motion.div>
  );
};

export default BTC_PensionCalculator;
