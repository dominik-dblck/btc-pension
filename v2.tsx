import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/*********************
 * Utils
 *********************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });

/*********************
 * Types
 *********************/
interface SimulationInput {
  monthlyContribution: number; // € / month
  initialPrice: number; // € per BTC today
  cagr: number; // BTC CAGR (e.g. 0.14)
  years: number; // horizon
  ltv: number; // loan‑to‑value (0‑1)
  loanRate: number; // APR (0‑1)
  yieldRate: number; // APR (0‑1)
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

/*********************
 * Simulation core
 *********************/
const simulate = (p: SimulationInput): SimulationPoint[] => {
  const months = p.years * 12;
  const stream: SimulationPoint[] = [];
  let btcHolding = 0;
  let cum = 0;

  for (let m = 0; m <= months; m++) {
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);
    const btcBought = m === 0 ? 0 : p.monthlyContribution / price;
    btcHolding += btcBought;

    const btcValue = btcHolding * price;
    const loan = btcValue * p.ltv;
    const interest = (loan * p.loanRate) / 12;
    const yieldEarned = (loan * p.yieldRate) / 12;
    const net = yieldEarned - interest;
    cum += net;

    stream.push({
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
  return stream;
};

/*********************
 * Main component
 *********************/
const BTC_PensionCalculator: React.FC = () => {
  // --- state ---
  const [inp, setInp] = useState<SimulationInput>({
    monthlyContribution: 300,
    initialPrice: 70_000,
    cagr: 0.14,
    years: 25,
    ltv: 0.3,
    loanRate: 0.06,
    yieldRate: 0.12,
  });
  const [maxUsers, setMaxUsers] = useState(100_000);
  const [maxRefs, setMaxRefs] = useState(5_000);

  // --- derived ---
  const sim = simulate(inp);
  const last = sim[sim.length - 1];
  const profitPerUser = last.cumulativeCashFlow;
  const feePU = profitPerUser * 0.01; // 1 % platform/referrer fee

  // helper to build linear datasets for earnings charts
  const buildSeries = (count: number) =>
    Array.from({ length: count + 1 }, (_, n) => ({ n, earnings: n * feePU }));

  const platformSeries = buildSeries(maxUsers);
  const refSeries = buildSeries(maxRefs);

  const updateInp = (k: keyof SimulationInput, v: string) =>
    setInp({ ...inp, [k]: Number(v) });

  /*********************
   * UI
   *********************/
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 grid gap-6 xl:grid-cols-3 lg:grid-cols-2"
    >
      {/* Overview / assumptions */}
      <Card className="w-full xl:col-span-3 lg:col-span-2">
        <CardHeader>
          <CardTitle>BTC Pension & Earnings Simulator</CardTitle>
          <CardDescription>
            Dollar‑cost‑averages monthly fiat into BTC, leverages <strong>{inp.ltv * 100}%</strong> of the
            growing BTC value at <strong>{(inp.loanRate * 100).toFixed(1)}% APR</strong>, and redeploys that
            capital at <strong>{(inp.yieldRate * 100).toFixed(1)}% APY</strong>. Simulation horizon:
            <strong> {inp.years} years</strong>. Platform and referrer each collect a 1% performance fee on
            realised user profit.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Key assumptions:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Monthly contribution starts at €{fmt(inp.monthlyContribution)} and buys fewer BTC over
              time as price rises with a {fmt(inp.cagr * 100, 1)}% CAGR.</li>
            <li>Loan‑to‑value is fixed at {fmt(inp.ltv * 100, 0)}%; margin call threshold not modelled.</li>
            <li>Yield and interest are compounded monthly; no tax/friction costs included.</li>
            <li>All charts below share the same {inp.years}-year timeframe.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Inputs & summary */}
      <Card className="w-full lg:col-span-1">
        <CardHeader>
          <CardTitle>Adjust Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["monthlyContribution", "Monthly Contribution (€)", 0, 1],
                ["initialPrice", "Initial BTC Price (€)", 1, 1],
                ["cagr", "BTC CAGR (%)", 0.1, 100],
                ["years", "Horizon (years)", 1, 1],
                ["ltv", "LTV (%)", 0.1, 100],
                ["loanRate", "Loan Interest (% p.a.)", 0.1, 100],
                ["yieldRate", "Yield Rate (% p.a.)", 0.1, 100],
              ] as [keyof SimulationInput, string, number, number][]
            ).map(([k, label, step, mult]) => (
              <div key={k} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <Input
                  type="number"
                  min={0}
                  step={step}
                  value={(inp[k] as number) * mult}
                  onChange={(e) => updateInp(k, String(Number(e.target.value) / mult))}
                />
              </div>
            ))}
          </div>
          <Button className="w-full" variant="outline" onClick={() => setInp({ ...inp })}>
            Recalculate
          </Button>
          <hr className="my-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p><strong>Total BTC:</strong> {last.btcHolding.toFixed(4)} BTC</p>
            <p><strong>BTC value:</strong> €{fmt(last.btcValue)}</p>
            <p><strong>Loan balance:</strong> €{fmt(last.loan)}</p>
            <p><strong>User cumulative profit:</strong> €{fmt(last.cumulativeCashFlow)}</p>
            <p><strong>Platform fee / user:</strong> €{feePU.toFixed(2)}</p>
            <p><strong>Referrer fee / user:</strong> €{feePU.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Projection chart */}
      <Card className="w-full lg:col-span-1">
        <CardHeader>
          <CardTitle>Portfolio Projection</CardTitle>
          <CardDescription>BTC value, loan balance, and cumulative cash‑flow over time</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sim}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={(v) => (v % 12 === 0 ? v / 12 : "")} />
              <YAxis tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="btcValue" name="BTC Value (€)" strokeWidth={2} />
              <Line type="monotone" dataKey="loan" name="Loan (€)" strokeDasharray="5 5" strokeWidth={2} />
              <Line type="monotone" dataKey="cumulativeCashFlow" name="Cum. Cash‑flow (€)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform earnings */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Platform Earnings</CardTitle>
          <CardDescription>Total fee (€) collected after {inp.years} years vs user count</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 h-96">
          <div>
            <label className="text-sm font-medium">Max Users</label>
            <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} />
          </div>
          <ResponsiveContainer width="100%" height="70%">
            <LineChart data={platformSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="n" tickFormatter={(v) => fmt(v)} />
              <YAxis tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="earnings" strokeWidth={2} name="Earnings (€)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Referrer earnings */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Referrer Earnings</CardTitle>
          <CardDescription>Passive income (€) after {inp.years} years vs referrals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 h-96">
          <div>
            <label className="text-sm font-medium">Max Referrals</label>
            <Input type="number" min={1} value={maxRefs} onChange={(e) => setMaxRefs(Number(e.target.value))} />
          </div>
          <ResponsiveContainer width="100%" height="70%">
            <LineChart data={refSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="n" tickFormatter={(v) => fmt(v)} />
              <YAxis tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="earnings" strokeWidth={2} name="Earnings (€)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BTC_PensionCalculator;
