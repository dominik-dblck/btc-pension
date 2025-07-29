import React, { useState } from 'react';
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
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ----------------- Types -----------------
interface SimulationInput {
  monthlyContribution: number; // in fiat (e.g. EUR)
  initialPrice: number; // BTC price today
  cagr: number; // expected CAGR (e.g. 0.14 for 14%)
  years: number; // investment horizon
  ltv: number; // loan‑to‑value, e.g. 0.3
  loanRate: number; // annual loan interest, e.g. 0.06
  yieldRate: number; // annual yield on deployed loan, e.g. 0.12
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

// ----------------- Simulation Logic -----------------
const simulate = (params: SimulationInput): SimulationPoint[] => {
  const {
    monthlyContribution,
    initialPrice,
    cagr,
    years,
    ltv,
    loanRate,
    yieldRate,
  } = params;

  const months = years * 12;
  const data: SimulationPoint[] = [];

  let btcHolding = 0;
  let cumulativeCashFlow = 0;

  for (let m = 0; m <= months; m++) {
    const price = initialPrice * Math.pow(1 + cagr, m / 12); // exponential growth

    // Buy BTC with fixed fiat amount (DCA)
    const btcBought = m === 0 ? 0 : monthlyContribution / price; // no purchase at month 0
    btcHolding += btcBought;

    const btcValue = btcHolding * price;
    const loan = btcValue * ltv;
    const interest = (loan * loanRate) / 12;
    const yieldEarned = (loan * yieldRate) / 12;
    const netCashFlow = yieldEarned - interest;
    cumulativeCashFlow += netCashFlow;

    data.push({
      month: m,
      price,
      btcBought,
      btcHolding,
      btcValue,
      loan,
      interest,
      yieldEarned,
      netCashFlow,
      cumulativeCashFlow,
    });
  }

  return data;
};

// ----------------- Component -----------------
const BTC_PensionCalculator: React.FC = () => {
  const [input, setInput] = useState<SimulationInput>({
    monthlyContribution: 300, // €
    initialPrice: 70000, // € per BTC
    cagr: 0.14,
    years: 25,
    ltv: 0.3,
    loanRate: 0.06,
    yieldRate: 0.12,
  });

  const data = simulate(input);
  const finalPoint = data[data.length - 1];

  const handleChange = (key: keyof SimulationInput, value: string) => {
    setInput({ ...input, [key]: Number(value) });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 grid gap-6 lg:grid-cols-2"
    >
      {/* Inputs */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>BTC Pension Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Monthly Contribution (€)
              </label>
              <Input
                type="number"
                value={input.monthlyContribution}
                onChange={e =>
                  handleChange('monthlyContribution', e.target.value)
                }
                min={0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Initial BTC Price (€)
              </label>
              <Input
                type="number"
                value={input.initialPrice}
                onChange={e => handleChange('initialPrice', e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">BTC CAGR (%)</label>
              <Input
                type="number"
                value={input.cagr * 100}
                onChange={e =>
                  handleChange('cagr', String(Number(e.target.value) / 100))
                }
                min={0}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Investment Horizon (years)
              </label>
              <Input
                type="number"
                value={input.years}
                onChange={e => handleChange('years', e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Loan‑to‑Value (LTV %)
              </label>
              <Input
                type="number"
                value={input.ltv * 100}
                onChange={e =>
                  handleChange('ltv', String(Number(e.target.value) / 100))
                }
                min={0}
                max={90}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Loan Interest (% p.a.)
              </label>
              <Input
                type="number"
                value={input.loanRate * 100}
                onChange={e =>
                  handleChange('loanRate', String(Number(e.target.value) / 100))
                }
                min={0}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Yield Rate (% p.a.)</label>
              <Input
                type="number"
                value={input.yieldRate * 100}
                onChange={e =>
                  handleChange(
                    'yieldRate',
                    String(Number(e.target.value) / 100)
                  )
                }
                min={0}
                step={0.1}
              />
            </div>
          </div>
          <Button
            onClick={() => setInput({ ...input })}
            className="w-full mt-4"
          >
            Recalculate
          </Button>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <p>
              <strong>Total BTC accumulated:</strong>{' '}
              {finalPoint.btcHolding.toFixed(4)} BTC
            </p>
            <p>
              <strong>BTC value at year {input.years}:</strong> €
              {finalPoint.btcValue.toFixed(0)}
            </p>
            <p>
              <strong>Loan balance (30% LTV):</strong> €
              {finalPoint.loan.toFixed(0)}
            </p>
            <p>
              <strong>Cumulative net cash‑flow:</strong> €
              {finalPoint.cumulativeCashFlow.toFixed(0)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Projection</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => value.toFixed(0)} />
              <Line
                type="monotone"
                dataKey="btcValue"
                strokeWidth={2}
                name="BTC Value (€)"
              />
              <Line
                type="monotone"
                dataKey="loan"
                strokeWidth={2}
                name="Loan Balance (€)"
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="cumulativeCashFlow"
                strokeWidth={2}
                name="Cum. Cash‑flow (€)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BTC_PensionCalculator;
