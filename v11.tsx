import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Maximize2, X } from "lucide-react";

/************************************************************************************************
 * Embedded meme (Bitcoin tree cartoon) as external URL
 ************************************************************************************************/
const memeSrc = `https://public.bnbstatic.com/image-proxy/rs_lg_webp/static/content/square/images/ea01f73e06f740dd94a7e420888ba115.jpg`;

/******************************************************
 * Utility helpers
 ******************************************************/
const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });
const yrs = (m: number | null) => (m === null ? "—" : `${(m / 12).toFixed(1)} yrs`);

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
  cashBalance: number; // cash from spreads and rebalances/purchases
  totalContrib: number; // cumulative fiat DCA
  netWorth: number; // btcValue - loanOutstanding + cashBalance
  pnlNet: number; // netWorth - totalContrib
}

/***********************************
 * Small UI helper: label with tooltip icon
 ***********************************/
const LabelWithInfo: React.FC<{ text: string; tip: string }> = ({ text, tip }) => (
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
      <TooltipContent side="top" className="max-w-xs text-xs bg-slate-900/95 text-slate-100 border border-slate-700 shadow-xl">
        {tip}
      </TooltipContent>
    </Tooltip>
  </div>
);

/***********************************
 * Core simulation (monthly accruals, quarterly sampling)
 ***********************************/
const simulate = (p: SimulationInput, autoDrawToTarget: boolean): SimulationPoint[] => {
  const months = p.years * 12;
  const out: SimulationPoint[] = [];

  let btcHolding = 0;
  let loanOutstanding = 0; // principal
  let cashBalance = 0; // cash from net spreads and rebalances
  let totalContrib = 0;

  for (let m = 0; m <= months; m++) {
    // deterministic price path
    const price = p.initialPrice * Math.pow(1 + p.cagr, m / 12);

    // DCA: buy BTC monthly
    if (m > 0) {
      totalContrib += p.monthlyContribution;
      const btcBought = p.monthlyContribution / price;
      btcHolding += btcBought;
    }

    // accruals (monthly)
    const interest = loanOutstanding * (p.loanRate / 12);
    const yieldEarned = loanOutstanding * (p.yieldRate / 12);
    cashBalance += (yieldEarned - interest);

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
 * Referral fee series helper (1% of positive P&L increments)
 ***********************************/
const computeReferralFeeSeries = (series: SimulationPoint[], refCount: number) => {
  let prevPnl = 0;
  let cum = 0;
  return series.map((pt) => {
    const pn = Math.max(0, pt.pnlNet);
    const inc = Math.max(0, pn - prevPnl);
    const feeStep = inc * 0.01 * refCount;
    cum += feeStep;
    prevPnl = pn;
    return { month: pt.month, feeStep, feeCum: cum };
  });
};

/***********************************
 * Threshold helpers (affordability via collateral + referral cash)
 * availableCapacity = LTV * btcValue - loanOutstanding + referralCash
 * Returns earliest month (from sampled points) when power >= cost; else null.
 ***********************************/
const firstAffordableMonthWithRef = (
  series: SimulationPoint[],
  cost: number,
  ltv: number,
  refFeeByMonth?: Map<number, number>
) => {
  for (const pt of series) {
    const collateralCapacity = ltv * pt.btcValue - pt.loanOutstanding;
    const referralCash = refFeeByMonth?.get(pt.month) ?? 0;
    const purchasingPower = collateralCapacity + referralCash;
    if (purchasingPower >= cost) return pt.month;
  }
  return null;
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

  const [autoDrawToTarget, setAutoDrawToTarget] = useState(false); // OFF to make thresholds meaningful

  // purchase costs (EUR)
  const [carCost, setCarCost] = useState(30_000);
  const [houseCost, setHouseCost] = useState(400_000);
  const [tuitionCost, setTuitionCost] = useState(60_000);

  // platform/referrer charts inputs (separate from user's own referrals model)
  const [maxUsers, setMaxUsers] = useState(50_000);
  const [platformAvgMonthly, setPlatformAvgMonthly] = useState(300);
  const [maxRefs, setMaxRefs] = useState(2_000);
  const [refChartAvgMonthly, setRefChartAvgMonthly] = useState(200);

  /* ---------------- calculations (memoized) ---------------- */
  const sim = useMemo(() => simulate(inp, autoDrawToTarget), [inp, autoDrawToTarget]);
  const last = sim[sim.length - 1];

  // referral modeling inputs (for user's own net worth uplift)
  const [refCount, setRefCount] = useState(0);
  const [refAvgMonthly, setRefAvgMonthly] = useState(200);

  // simulate a representative referral for user's uplift
  const refSim = useMemo(
    () => simulate({ ...inp, monthlyContribution: refAvgMonthly }, autoDrawToTarget),
    [inp, refAvgMonthly, autoDrawToTarget]
  );
  const refFeeSeries = useMemo(
    () => computeReferralFeeSeries(refSim, refCount),
    [refSim, refCount]
  );
  const refFeeByMonth = useMemo(
    () => new Map(refFeeSeries.map((x) => [x.month, x.feeCum] as const)),
    [refFeeSeries]
  );

  // merge for chart: net worth with referrals (cash inflows from fees)
  const simWithRef = useMemo(() => {
    return sim.map((pt) => ({
      ...pt,
      netWorthWithRef: pt.netWorth + (refFeeByMonth.get(pt.month) ?? 0),
    }));
  }, [sim, refFeeByMonth]);

  // platform earnings series (1% of P&L per user, parametrized by platformAvgMonthly)
  const platformSim = useMemo(
    () => simulate({ ...inp, monthlyContribution: platformAvgMonthly }, autoDrawToTarget),
    [inp, platformAvgMonthly, autoDrawToTarget]
  );
  const platformFeePU = Math.max(0, platformSim[platformSim.length - 1].pnlNet) * 0.01;

  // referrer earnings chart series (separate avg monthly)
  const refChartSim = useMemo(
    () => simulate({ ...inp, monthlyContribution: refChartAvgMonthly }, autoDrawToTarget),
    [inp, refChartAvgMonthly, autoDrawToTarget]
  );
  const refChartFeePU = Math.max(0, refChartSim[refChartSim.length - 1].pnlNet) * 0.01;

  const buildSeries = (count: number, feePerUser: number) => {
    const step = Math.max(1, Math.ceil(count / 120));
    const arr: { n: number; earnings: number }[] = [];
    for (let n = 0; n <= count; n += step) arr.push({ n, earnings: n * feePerUser });
    if (arr[arr.length - 1].n !== count) arr.push({ n: count, earnings: count * feePerUser });
    return arr;
  };

  const platformSeries = useMemo(() => buildSeries(maxUsers, platformFeePU), [maxUsers, platformFeePU]);
  const refSeries = useMemo(() => buildSeries(maxRefs, refChartFeePU), [maxRefs, refChartFeePU]);

  // percentage-aware updater (fixes the % bug)
  const updateK = (k: keyof SimulationInput, v: string, mult = 1) =>
    setInp((prev) => ({ ...prev, [k]: Number(v) / mult }));

  // derived warnings (basic credibility checks under ideal conditions)
  const spread = inp.yieldRate - inp.loanRate;
  const spreadWarn = spread <= 0;
  const ltvWarn = inp.ltv > 0.8;

  // affordability thresholds (now include referral cash)
  const carM = useMemo(() => firstAffordableMonthWithRef(sim, carCost, inp.ltv, refFeeByMonth), [sim, carCost, inp.ltv, refFeeByMonth]);
  const houseM = useMemo(() => firstAffordableMonthWithRef(sim, houseCost, inp.ltv, refFeeByMonth), [sim, houseCost, inp.ltv, refFeeByMonth]);
  const tuitionM = useMemo(() => firstAffordableMonthWithRef(sim, tuitionCost, inp.ltv, refFeeByMonth), [sim, tuitionCost, inp.ltv, refFeeByMonth]);

  // fullscreen state for portfolio chart
  const [isPortfolioFullscreen, setIsPortfolioFullscreen] = useState(false);

  // match portfolio card height to parameters card
  const paramsCardRef = useRef<HTMLDivElement | null>(null);
  const [paramsHeight, setParamsHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!paramsCardRef.current || typeof window === "undefined") return;
    const ro = new ResizeObserver((entries) => {
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
              Deterministyczny model DCA → LTV‑loan → yield pod idealne warunki. Progi dla dużych wydatków (samochód / dom / studia) liczone z dostępnej pojemności długu.
            </p>
            <p className="text-xs md:text-sm text-gray-400 max-w-3xl mx-auto">
              Pola % wpisuj jako wartości <em>w procentach</em>; model przelicza je na ułamki.
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
              <CardTitle className="text-xl">Model Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-6 text-sm">
              <div>
                <h3 className="font-semibold mb-1">Kluczowe założenia (idealne warunki)</h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                  <li><strong>Akumulacja</strong>: miesięczne DCA w EUR; cena BTC rośnie wg stałego CAGR {(inp.cagr * 100).toFixed(1)}% (bez zmienności).</li>
                  <li><strong>Zabezpieczenie</strong>: pojemność długu = <em>LTV × wartość BTC − saldo długu</em>. Zakupy (auto/dom/studia) możliwe, gdy pojemność ≥ koszt.</li>
                  <li><strong>Rebalans</strong>: kwartalnie do docelowego LTV {(inp.ltv * 100).toFixed(0)}%. <em>Auto‑draw</em> {autoDrawToTarget ? "ON" : "OFF"} — ON: wykorzystuje pojemność na bieżąco; OFF: czekamy do zakupu.</li>
                  <li><strong>Referrals</strong>: przyrost <em>pozytywnego</em> P&L poleconych zasila Twoją emeryturę jako 1% fee (parametry ich wpłat: liczba i średnia miesięczna kwota). **Teraz wliczane także do progów zakupu**.</li>
                  <li><strong>Finansowanie</strong>: odsetki APR {(inp.loanRate * 100).toFixed(1)}% i yield APY {(inp.yieldRate * 100).toFixed(1)}% naliczane miesięcznie od salda długu.</li>
                  <li><strong>Wynik</strong>: pokazujemy Net Worth (bez/referrals) i P&L vs. wpłaty; opłaty 1% platforma + 1% referrer od <em>pozytywnego</em> P&L.</li>
                </ul>
              </div>
              {(spreadWarn || ltvWarn) && (
                <div className="text-xs text-amber-300">
                  {spreadWarn && <p>Uwaga: Spread ≤ 0 (yield ≤ interest). W idealnych warunkach przychód ze spreadu nie pokryje kosztu długu.</p>}
                  {ltvWarn && <p>Uwaga: LTV &gt; 80% — ryzyko operacyjne wysokie (tu ignorowane, ale sygnalizujemy).</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two-column layout: Parameters & Portfolio side-by-side */}
          <section className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Parameters with logical sections */}
            <Card ref={paramsCardRef} className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
              <CardHeader className="px-6 pt-6 pb-3">
                <CardTitle className="text-lg">Parametry</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-8 space-y-6">
                {/* Wpłaty */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Wpłaty</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo text="Monthly Contribution (EUR)" tip="Miesięczna wpłata w EUR, kupujemy BTC po cenie z danego miesiąca" />
                      <Input type="number" min={0} step={1} value={inp.monthlyContribution} onChange={(e) => updateK("monthlyContribution", e.target.value, 1)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Initial BTC Price (EUR)" tip="Cena startowa BTC w EUR" />
                      <Input type="number" min={0} step={1} value={inp.initialPrice} onChange={(e) => updateK("initialPrice", e.target.value, 1)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="BTC CAGR (%)" tip="Roczna stopa wzrostu BTC w idealnym scenariuszu (bez zmienności)" />
                      <Input type="number" min={0} step={0.1} value={inp.cagr * 100} onChange={(e) => updateK("cagr", e.target.value, 100)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Horizon (yrs)" tip="Horyzont oszczędzania w latach" />
                      <Input type="number" min={1} step={1} value={inp.years} onChange={(e) => updateK("years", e.target.value, 1)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                  </div>
                </div>

                {/* Zarabianie */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Zarabianie</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo text="Max/Target LTV (%)" tip="Docelowy/maksymalny LTV używany do liczenia pojemności długu" />
                      <Input type="number" min={0} step={0.1} value={inp.ltv * 100} onChange={(e) => updateK("ltv", e.target.value, 100)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Loan Interest (APR, %)" tip="Roczna stopa procentowa pożyczki" />
                      <Input type="number" min={0} step={0.1} value={inp.loanRate * 100} onChange={(e) => updateK("loanRate", e.target.value, 100)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Yield Rate (APY, %)" tip="Roczna stopa zwrotu z ulokowanego kapitału (na długu)" />
                      <Input type="number" min={0} step={0.1} value={inp.yieldRate * 100} onChange={(e) => updateK("yieldRate", e.target.value, 100)} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo text="Auto‑draw to Target LTV" tip="Automatyczne dociąganie salda długu do docelowego LTV na koniec kwartału. Gdy OFF — pojemność długu rośnie do czasu zakupu." />
                      <Button
                        type="button"
                        className={`w-full ${autoDrawToTarget ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-700 hover:bg-slate-600"}`}
                        onClick={() => setAutoDrawToTarget((v) => !v)}
                      >
                        {autoDrawToTarget ? "ON" : "OFF"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Używanie kapitału */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Używanie kapitału (dom / szkoła / samochód)</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo text="Car Cost (EUR)" tip="Budżet na samochód finansowany kredytem pod zastaw zgromadzonego BTC." />
                      <Input type="number" min={0} value={carCost} onChange={(e) => setCarCost(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="House Cost (EUR)" tip="Budżet na dom/mieszkanie; model sprawdza, kiedy pojemność długu osiągnie ten koszt przy danym LTV." />
                      <Input type="number" min={0} value={houseCost} onChange={(e) => setHouseCost(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Tuition Cost (EUR)" tip="Łączny koszt studiów dzieci; moment, gdy można go sfinansować kredytem pod zastaw BTC." />
                      <Input type="number" min={0} value={tuitionCost} onChange={(e) => setTuitionCost(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                  </div>
                </div>

                {/* Referrals (user uplift) */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Referrals</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <LabelWithInfo text="Referrals — Count" tip="Liczba bezpośrednich poleconych użytkowników, którzy oszczędzają wg tych samych parametrów (poza swoją miesięczną wpłatą)." />
                      <Input type="number" min={0} value={refCount} onChange={(e) => setRefCount(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                    <div className="space-y-1">
                      <LabelWithInfo text="Referrals — Avg Monthly (EUR)" tip="Średnia miesięczna wpłata jednego poleconego — wpływa na 1% fee doliczane do Twojego portfela." />
                      <Input type="number" min={0} value={refAvgMonthly} onChange={(e) => setRefAvgMonthly(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Summary</h4>
                  <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
                    <span>Total BTC: <strong>{last.btcHolding.toFixed(4)}</strong></span>
                    <span>BTC Value: <strong>€{fmt(last.btcValue)}</strong></span>
                    <span>Loan (principal): <strong>€{fmt(last.loanOutstanding)}</strong></span>
                    <span>Cash Balance: <strong>€{fmt(last.cashBalance)}</strong></span>
                    <span>Total Contributions: <strong>€{fmt(last.totalContrib)}</strong></span>
                    <span>Net Worth (no refs): <strong>€{fmt(last.netWorth)}</strong></span>
                    <span>Total Referral Income: <strong>€{fmt(refFeeByMonth.get(last.month) ?? 0)}</strong></span>
                    <span>Net Worth + Referrals: <strong>€{fmt((simWithRef[simWithRef.length - 1]?.netWorthWithRef) || last.netWorth)}</strong></span>
                    <span>Net P&L vs. Contributions: <strong>€{fmt(last.pnlNet)}</strong></span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-2 pt-3 text-xs text-gray-300">
                    <span>Car affordable in: <strong>{yrs(carM)}</strong></span>
                    <span>House affordable in: <strong>{yrs(houseM)}</strong></span>
                    <span>Tuition affordable in: <strong>{yrs(tuitionM)}</strong></span>
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
                <CardTitle className="text-lg">Portfolio Projection</CardTitle>
                <Button
                  type="button"
                  className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
                  onClick={() => setIsPortfolioFullscreen(true)}
                  aria-label="Open fullscreen"
                  title="Pokaż na pełnym ekranie"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-6 pb-8 space-y-3">
                <p className="text-xs text-gray-400">BTC value, loan & net worth over {inp.years} yrs + purchase thresholds + referral uplift</p>
                <div className="w-full" style={{ height: portfolioHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simWithRef}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => (v % 12 === 0 ? v / 12 : "")} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                      <RechartsTooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#0b1220", color: "#e5e7eb", borderRadius: 8, border: "1px solid #334155", boxShadow: "0 10px 25px rgba(0,0,0,0.35)" }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="btcValue" strokeWidth={2} name="BTC Value (€)" />
                      <Line type="monotone" dataKey="loanOutstanding" strokeWidth={2} strokeDasharray="5 5" name="Loan (€)" />
                      <Line type="monotone" dataKey="netWorth" strokeWidth={2} name="Net Worth (no refs) (€)" />
                      <Line type="monotone" dataKey="netWorthWithRef" strokeWidth={2} strokeDasharray="2 2" name="Net Worth + Referrals (€)" />
                      {carM !== null && <ReferenceLine x={carM} strokeDasharray="3 3" label="Car" />}
                      {houseM !== null && <ReferenceLine x={houseM} strokeDasharray="3 3" label="House" />}
                      {tuitionM !== null && <ReferenceLine x={tuitionM} strokeDasharray="3 3" label="Tuition" />}
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
                  <h2 className="text-base font-semibold">Portfolio Projection — Fullscreen</h2>
                  <Button
                    type="button"
                    className="h-8 px-2 bg-slate-700 hover:bg-slate-600"
                    onClick={() => setIsPortfolioFullscreen(false)}
                    aria-label="Close fullscreen"
                    title="Zamknij pełny ekran"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 p-4">
                  <div className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={simWithRef}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(v) => (v % 12 === 0 ? v / 12 : "")} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                        <RechartsTooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#0b1220", color: "#e5e7eb", borderRadius: 8, border: "1px solid #334155", boxShadow: "0 10px 25px rgba(0,0,0,0.35)" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="btcValue" strokeWidth={2} name="BTC Value (€)" />
                        <Line type="monotone" dataKey="loanOutstanding" strokeWidth={2} strokeDasharray="5 5" name="Loan (€)" />
                        <Line type="monotone" dataKey="netWorth" strokeWidth={2} name="Net Worth (no refs) (€)" />
                        <Line type="monotone" dataKey="netWorthWithRef" strokeWidth={2} strokeDasharray="2 2" name="Net Worth + Referrals (€)" />
                        {carM !== null && <ReferenceLine x={carM} strokeDasharray="3 3" label="Car" />}
                        {houseM !== null && <ReferenceLine x={houseM} strokeDasharray="3 3" label="House" />}
                        {tuitionM !== null && <ReferenceLine x={tuitionM} strokeDasharray="3 3" label="Tuition" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Platform earnings — full width with separate inputs */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Platform Earnings</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-3">
              <p className="text-xs text-gray-400">1% fee po {inp.years} latach — steruj <em>Users — Count</em> i <em>Users — Avg Monthly</em> niezależnie.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <LabelWithInfo text="Users — Count" tip="Łączna liczba aktywnych użytkowników po horyzoncie." />
                  <Input type="number" min={0} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Users — Avg Monthly (EUR)" tip="Średnia miesięczna wpłata przypadająca na jednego użytkownika platformy (do wyliczania P&L/fee per user)." />
                  <Input type="number" min={0} value={platformAvgMonthly} onChange={(e) => setPlatformAvgMonthly(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={platformSeries}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis dataKey="n" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(v) => fmt(Number(v))} contentStyle={{ background: "#0b1220", color: "#e5e7eb", borderRadius: 8, border: "1px solid #334155", boxShadow: "0 10px 25px rgba(0,0,0,0.35)" }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="earnings" strokeWidth={2} name="Earnings (€)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Referrer earnings — full width with separate inputs */}
          <Card className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700 shadow-lg">
            <CardHeader className="px-6 pt-6 pb-3">
              <CardTitle className="text-lg">Referrer Earnings</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-8 space-y-3">
              <p className="text-xs text-gray-400">1% udział po {inp.years} latach — steruj <em>Referrals — Count</em> i <em>Referrals — Avg Monthly</em> niezależnie dla tego wykresu.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <LabelWithInfo text="Referrals — Count (chart)" tip="Liczba bezpośrednich poleconych używana wyłącznie do wykresu przychodów referenta." />
                  <Input type="number" min={0} value={maxRefs} onChange={(e) => setMaxRefs(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Referrals — Avg Monthly (EUR) (chart)" tip="Średnia miesięczna wpłata jednego poleconego używana do obliczeń na wykresie przychodów referenta." />
                  <Input type="number" min={0} value={refChartAvgMonthly} onChange={(e) => setRefChartAvgMonthly(Number(e.target.value))} className="rounded-lg bg-slate-900/70 border-slate-700 text-xs p-[2px]" />
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={refSeries}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis dataKey="n" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} labelFormatter={(v) => fmt(Number(v))} contentStyle={{ background: "#0b1220", color: "#e5e7eb", borderRadius: 8, border: "1px solid #334155", boxShadow: "0 10px 25px rgba(0,0,0,0.35)" }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="earnings" strokeWidth={2} name="Earnings (€)" />
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
  };
  const s = simulate(base, false);
  console.assert(s.length > 0, "simulate should return data");
  console.assert(s[0].month === 0, "first sample should be month 0");
  console.assert(s[s.length - 1].month === base.years * 12, "last sample should be last month");
  // affordability: impossible huge cost should be null
  const huge = 1e15;
  // without referrals
  console.assert(
    (function () { return (function (series, cost, ltv) { for (const pt of series) { if (ltv * pt.btcValue - pt.loanOutstanding >= cost) return pt.month; } return null; })(s, huge, base.ltv) === null; })(),
    "huge cost should be unaffordable without referrals"
  );
  // with massive referral cash at t=0 should be affordable immediately
  const feesMap = new Map<number, number>([[0, 1e9]]);
  console.assert(firstAffordableMonthWithRef(s, 1e6, base.ltv, feesMap) === 0, "ref fees should improve affordability");
}
try {
  if (typeof window !== "undefined") runSelfCheck();
} catch {}

export default BTC_PensionCalculator;
