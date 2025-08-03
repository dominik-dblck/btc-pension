/******************************************************
 * ====================================================
 *  ROZSZERZENIE: metryki dla PLATFORMY (agregacja cohort)
 *                + własny „treasury” platformy
 *                  (X % LTV ‑> yield ‑> BTC)
 * ====================================================
 *  • Logika klientów dalej korzysta z simulateUser() –
 *    dzięki temu algorytm LTV/cred/yield jest spójny.
 *
 *  • NOWOŚĆ (v3):
 *    ────────────────────────────────────────────────
 *    Platforma może mieć **własne** parametry treasury
 *    (ltv, loanRate, yieldRate) – niezależne od tych,
 *    które obowiązują użytkowników.
 ******************************************************/

import {
  simulateUser,
  monthlyRate,
  UserSimulationInput,
} from './simulateUserPension';

/**
 *  Konfiguracja przychodowa (co pochodzi z UI → PlatformConfig)
 */
export interface SimplePlatformConfig {
  // —— parametry klientów ——
  avgMonthly: number; // EUR / user / m
  feePct: number; // % od brutto yieldu klientów
  exchangeFeePct: number; // % od zakupu BTC przez klienta
  enableIndexing: boolean; // CPI‑indexing dla klientów
  usersStart: number;
  usersEnd: number;
  usersGrowthMode: 'linear' | 'cagr';

  // —— parametry treasury platformy ——
  treasuryLtv: number; // np. 0.30 = 30 %
  treasuryLoanRate: number; // APR
  treasuryYieldRate: number; // APY na zainwestowanym kapitale
}

/**
 *  Rekord roczny z perspektywy platformy.
 */
export interface PlatformAnnualPoint {
  year: number;
  users: number;
  newUsers: number;
  totalYieldFee: number; // € (brutto – od klientów)
  totalExchangeFee: number; // € (od klientów)
  total: number; // € (łączny przychód „fiat”)
  avgPerUser: number; // € / user
  totalAum: number; // € – łączny loanOutstanding klientów
  totalBtcHeld: number; // BTC klientów
  platBtcHolding: number; // BTC platformy (po reinwestycji)
  platBtcValue: number; // € – wartość powyższego
  platLoanOutstanding: number; // € – dług platformy
  usersBtcValue: number; // € – wartość BTC klientów
  priceBtcEur: number; // € – cena BTC (koniec roku)
}

/******************************************************
 * Helper – statystyki „per‑user per year” (bez zmian)
 ******************************************************/
interface PerUserYearStats {
  year: number;
  yieldFee: number;
  exchangeFee: number;
  loanOutstanding: number;
  btcHeld: number;
}

function perUserStatsByYear(
  baseUserInput: UserSimulationInput,
  feePct: number,
  exchangeFeePct: number,
  opts: { autoDrawToTarget?: boolean }
): PerUserYearStats[] {
  const series = simulateUser(baseUserInput, {
    autoDrawToTarget: opts.autoDrawToTarget,
    snapshotStep: 1, // miesięczny snapshot -> fee co miesiąc
  });

  const map = new Map<number, PerUserYearStats>();
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    const month = curr.month;
    const ageYear = Math.floor((month - 1) / 12) + 1;

    const yieldFeeMonth = curr.yieldEarned * (feePct / 100);
    const grossContr = curr.totalContrib - prev.totalContrib;
    const exchFeeMonth = grossContr * (exchangeFeePct / 100);

    const rec = map.get(ageYear) ?? {
      year: ageYear,
      yieldFee: 0,
      exchangeFee: 0,
      loanOutstanding: 0,
      btcHeld: 0,
    };
    rec.yieldFee += yieldFeeMonth;
    rec.exchangeFee += exchFeeMonth;

    if (month % 12 === 0) {
      rec.loanOutstanding = curr.loanOutstanding;
      rec.btcHeld = curr.btcHolding;
    }
    map.set(ageYear, rec);
  }
  return Array.from(map.values()).sort((a, b) => a.year - b.year);
}

/******************************************************
 *  GŁÓWNA FUNKCJA  –  roczna seria przychodów platformy
 *  + własny treasury (X % LTV, yield → BTC)
 ******************************************************/
export function simulatePlatformAnnual(
  baseUserInput: UserSimulationInput, // parametry EKONOMICZNE BTC (cena, CPI…)
  platformCfg: SimplePlatformConfig,
  opts: { autoDrawToTarget?: boolean } = {}
): PlatformAnnualPoint[] {
  /* ————————————————————————————————
     1) Statystyki pojedynczego klienta
     ———————————————————————————————— */
  const perUser = perUserStatsByYear(
    {
      ...baseUserInput,
      monthlyContribution: platformCfg.avgMonthly,
      enableIndexing: platformCfg.enableIndexing,
      exchangeFeePct: platformCfg.exchangeFeePct,
      feePct: platformCfg.feePct,
    },
    platformCfg.feePct,
    platformCfg.exchangeFeePct,
    opts
  );

  const years = Math.max(1, baseUserInput.years);

  /* ————————————————————————————————
     2) Krzywa wzrostu użytkowników
     ———————————————————————————————— */
  const steps = Math.max(1, years - 1);
  const usersSeries: number[] = [];
  if (platformCfg.usersGrowthMode === 'linear') {
    for (let i = 0; i < years; i++) {
      const v =
        platformCfg.usersStart +
        ((platformCfg.usersEnd - platformCfg.usersStart) * i) / steps;
      usersSeries.push(Math.round(Math.max(0, v)));
    }
  } else {
    const ratio = Math.pow(
      platformCfg.usersEnd / platformCfg.usersStart,
      1 / steps
    );
    for (let i = 0; i < years; i++) {
      usersSeries.push(
        Math.round(Math.max(0, platformCfg.usersStart * Math.pow(ratio, i)))
      );
    }
  }
  const newUsers = usersSeries.map((u, i) =>
    i === 0 ? u : u - usersSeries[i - 1]
  );

  /* ————————————————————————————————
     3) Zmienne treasury platformy
     ———————————————————————————————— */
  let platBtcHolding = 0; // BTC zgromadzone (zysk + fee)
  let platLoanOutstanding = 0; // € dług zabezpieczony BTC

  const out: PlatformAnnualPoint[] = [];

  for (let Y = 1; Y <= years; Y++) {
    /* === a) Przychód od klientów === */
    let totalYieldFee = 0;
    let totalExchangeFee = 0;
    let totalAum = 0;
    let totalBtcHeld = 0;

    for (let age = 1; age <= Y; age++) {
      const cohortIndex = Y - age;
      const cohortSize = newUsers[cohortIndex] ?? 0;
      const stats = perUser[age - 1];
      if (!stats) continue;

      totalYieldFee += cohortSize * stats.yieldFee;
      totalExchangeFee += cohortSize * stats.exchangeFee;
      totalAum += cohortSize * stats.loanOutstanding;
      totalBtcHeld += cohortSize * stats.btcHeld;
    }
    const totalFeeEUR = totalYieldFee + totalExchangeFee;

    /* === b) Treasury platformy (własne ltv/rates) === */
    const priceYearEnd =
      baseUserInput.initialPrice * Math.pow(1 + baseUserInput.cagr, Y);

    // odpowiednik „rebalance co rok”
    const targetLoan = platformCfg.treasuryLtv * platBtcHolding * priceYearEnd;
    platLoanOutstanding += targetLoan - platLoanOutstanding; // draw / repay

    const intYear = monthlyRate(platformCfg.treasuryLoanRate) * 12;
    const yieldYear = monthlyRate(platformCfg.treasuryYieldRate) * 12;

    const interest = platLoanOutstanding * intYear;
    const yieldGross = platLoanOutstanding * yieldYear;
    const netYield = yieldGross - interest;
    if (netYield > 0) {
      platBtcHolding += netYield / priceYearEnd; // reinwestycja zysku
    }

    /* === c) Fee od klientów → BTC === */
    platBtcHolding += totalFeeEUR / priceYearEnd;

    const platBtcValue = platBtcHolding * priceYearEnd;
    const usersBtcValue = totalBtcHeld * priceYearEnd;

    const users = usersSeries[Y - 1];
    const avgPerUser = users > 0 ? totalFeeEUR / users : 0;

    out.push({
      year: Y,
      users,
      newUsers: newUsers[Y - 1],
      totalYieldFee,
      totalExchangeFee,
      total: totalFeeEUR,
      avgPerUser,
      totalAum,
      totalBtcHeld,
      platBtcHolding,
      platBtcValue,
      platLoanOutstanding,
      usersBtcValue,
      priceBtcEur: priceYearEnd,
    });
  }

  return out;
}
