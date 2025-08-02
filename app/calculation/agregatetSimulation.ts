// ================================================================
// btcPensionUser.ts
// ------------------------------------------------
//  Samowystarczalny, czysto funkcyjny moduł TypeScript
//  z całą logiką symulacji planu „BTC‑pension” dla pojedynczego
//  użytkownika.  Zależności zewnętrzne – brak.
//
//  Możesz:
//    1. zaimportować „simulateUser” w testach/jednostkowych lub UI
//    2. przygotować dowolny obiekt „UserSimulationInput”
//    3. uruchomić:
//         const series = simulateUser(input)
//    4. zweryfikować poprawność danych w „series” albo napisać testy
//       oczekujące na konkretne wartości.
// ================================================================

/******************************************************
 * Pomocnicze narzędzia
 ******************************************************/
/**
 * Konwersja rocznej stopy (APR/APY) na miesięczną stopę efektywną.
 * Przyjmuje parametr w postaci ułamka (np. 0.14 = 14 %).
 */
export const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

/******************************************************
 * Stałe globalne
 ******************************************************/
/**
 * Liczba miesięcy pomiędzy snapshotami wyników.
 * Wartość „3” oznacza kwartalny sampling (m=0,3,6…).
 */
export const SNAPSHOT_STEP = 3;

/******************************************************
 * Typy wejścia i wyjścia
 ******************************************************/

/**
 * Parametry wejściowe symulacji pojedynczego użytkownika.
 */
export interface UserSimulationInput {
  /**
   * Miesięczna kwota dokupowania BTC (DCA) [EUR].
   */
  monthlyContribution: number;

  /**
   * Początkowa cena 1 BTC [EUR].
   */
  initialPrice: number;

  /**
   * Oczekiwany średnioroczny wzrost ceny BTC (CAGR).
   * 0.14 = 14 % r/r.
   */
  cagr: number;

  /**
   * Horyzont inwestycyjny w latach.
   */
  years: number;

  /**
   * Docelowy (maksymalny) Loan‑to‑Value przy zaciąganiu kredytu pod zastaw BTC.
   * 0.3 = 30 %.
   */
  ltv: number;

  /**
   * Oprocentowanie kredytu (APR) – koszt długu.
   */
  loanRate: number;

  /**
   * Roczna stopa zwrotu (APY) z inwestowania wypłaconego kredytu.
   */
  yieldRate: number;

  /**
   * Roczna inflacja konsumencka CPI.
   */
  cpiRate: number;

  /**
   * Jeżeli true – miesięczna kontrybucja i koszty są indeksowane inflacją.
   */
  enableIndexing: boolean;

  /**
   * Opcjonalna, jednorazowa opłata giełdowa przy wymianie EUR→BTC
   * (podawana w %, np. 0.1 = 0.1 %).
   */
  exchangeFeePct?: number;

  /**
   * Opcjonalna prowizja platformy pobierana od BRUTTO zysku z yieldu
   * (podawana w %, np. 15 = 15 %).
   */
  feePct?: number;
}

/**
 * Rekord wyjściowy – pojedynczy snapshot stanu portfela.
 */
export interface UserSimulationPoint {
  /** Licznik miesięcy od startu */
  month: number;
  /** Symulowana cena BTC w danym miesiącu */
  price: number;
  /** Nominalna, zindeksowana (jeśli włączono) składka EUR w tym miesiącu */
  contribution: number;
  /** Kupione w danym miesiącu BTC (po pobraniu fee giełdowej) */
  btcBought: number;
  /** Łączne BTC w portfelu */
  btcHolding: number;
  /** Wartość BTC w EUR */
  btcValue: number;
  /** Bieżące zadłużenie (kapitał) */
  loanOutstanding: number;
  /** Odsetki naliczone OD ostatniego snapshota */
  interestAccrued: number;
  /** Zarobiony yield (brutto) OD ostatniego snapshota */
  yieldEarned: number;
  /** Saldo gotówkowe (powstałe przy rebalance, nadwyżki, deficyty) */
  cashBalance: number;
  /** Skumulowane nominalne wpłaty (EUR) */
  totalContrib: number;
  /** Skumulowane REALNE wpłaty, zdyskontowane inflacją */
  totalContribReal: number;
  /** Wartość netto = btcValue − loanOutstanding + cashBalance */
  netWorth: number;
  /** P/L netto (nominalnie) = netWorth − totalContrib */
  pnlNet: number;
  /** Skumulowany wskaźnik inflacji od startu */
  inflationIndex: number;
  /** Realna wartość netto (w cenach bieżących na starcie) */
  realNetWorth: number;
  /** Realny P/L netto = realNetWorth − totalContribReal */
  realPnlNet: number;
}

/******************************************************
 * Główna funkcja symulacyjna
 ******************************************************/

/**
 * Symuluje strategię „BTC-pension” dla pojedynczego użytkownika.
 * @param input  Parametry wejściowe (UserSimulationInput).
 * @param opts   Ustawienia opcji pomocniczych.
 *               – autoDrawToTarget: jeżeli true (domyślnie) co kwartał
 *                 dociągamy/zwracamy kredyt tak, by LTV trzymać przy celu.
 *               – snapshotStep: ile miesięcy między snapshotami (domyślnie 3).
 * @returns      Tablica snapshotów (UserSimulationPoint[]).
 */
export function simulateUser(
  input: UserSimulationInput,
  opts: { autoDrawToTarget?: boolean; snapshotStep?: number } = {}
): UserSimulationPoint[] {
  const snapshotStep = opts.snapshotStep ?? SNAPSHOT_STEP;
  const {
    monthlyContribution,
    initialPrice,
    cagr,
    years,
    ltv,
    loanRate,
    yieldRate,
    cpiRate,
    enableIndexing,
    exchangeFeePct = 0,
    feePct = 0,
  } = input;
  const autoDrawToTarget = opts.autoDrawToTarget ?? true;

  const monthsTotal = years * 12;
  const out: UserSimulationPoint[] = [];

  // Zmienne stanu w czasie symulacji
  let btcHolding = 0;
  let loanOutstanding = 0; // kapitał
  let cashBalance = 0; // nadwyżki gotówkowe
  let totalContrib = 0; // nominalnie
  let totalContribReal = 0; // w cenach stałych

  // Akumulatory kwartalne (resetowane przy snapshocie)
  let qInterest = 0;
  let qYield = 0;
  let lastContribution = 0;

  for (let m = 0; m <= monthsTotal; m++) {
    // =====================================
    // 1)  Ścieżka ceny BTC & inflacji
    // =====================================
    const price = initialPrice * Math.pow(1 + cagr, m / 12);
    const inflationIndex = Math.pow(1 + cpiRate, m / 12);

    // =====================================
    // 2)  Comiesięczne DCA (od m=1)
    // =====================================
    if (m > 0) {
      const nominal = enableIndexing
        ? monthlyContribution * inflationIndex
        : monthlyContribution;
      const feeExchange = nominal * (exchangeFeePct / 100);
      const contributionNet = nominal - feeExchange;

      totalContrib += nominal;
      totalContribReal += nominal / inflationIndex;
      lastContribution = contributionNet;

      btcHolding += contributionNet / price;
    }

    // =====================================
    // 3)  Miesięczne naliczenie odsetek i yieldu
    // =====================================
    if (m > 0) {
      const intM = monthlyRate(loanRate);
      const yieldM = monthlyRate(yieldRate);

      const interest = loanOutstanding * intM;
      const yieldGross = loanOutstanding * yieldM;

      qInterest += interest;
      qYield += yieldGross;

      // Prowizja platformy od GROSS yieldu
      const yieldFee = yieldGross * (feePct / 100);
      const netYield = yieldGross - yieldFee - interest;

      if (netYield >= 0) {
        btcHolding += netYield / price; // reinwestycja w BTC
      } else {
        let deficit = -netYield;
        if (cashBalance >= deficit) {
          cashBalance -= deficit;
        } else {
          deficit -= cashBalance;
          cashBalance = 0;
          btcHolding = Math.max(0, btcHolding - deficit / price);
        }
      }
    }

    // =====================================
    // 4)  Rebalance do docelowego LTV (co snapshotStep mies.)
    // =====================================
    const isSnapshot = m === 0 || m % snapshotStep === 0 || m === monthsTotal;
    if (isSnapshot) {
      const btcValue = btcHolding * price;
      const targetLoan = ltv * btcValue;

      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          loanOutstanding += delta; // kredyt zwiększa się, ale NIE kupujemy za niego BTC
        } else if (delta < 0) {
          const repay = Math.min(-delta, Math.max(cashBalance, 0));
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
      } else {
        if (loanOutstanding > targetLoan) {
          const repay = Math.min(
            loanOutstanding - targetLoan,
            Math.max(cashBalance, 0)
          );
          loanOutstanding -= repay;
          cashBalance -= repay;
        }
        if (loanOutstanding < targetLoan) {
          const draw = targetLoan - loanOutstanding;
          loanOutstanding += draw; // kredyt zwiększa się, ale NIE kupujemy za niego BTC
        }
      }
    }

    // =====================================
    // 5)  Snapshot stanu
    // =====================================
    if (isSnapshot) {
      const btcValue = btcHolding * price;
      const netWorth = btcValue - loanOutstanding + cashBalance;
      const pnlNet = netWorth - totalContrib;
      const realNetWorth = netWorth / inflationIndex;
      const realPnlNet = realNetWorth - totalContribReal;

      out.push({
        month: m,
        price,
        contribution: m > 0 ? lastContribution : 0,
        btcBought: m > 0 ? lastContribution / price : 0,
        btcHolding,
        btcValue,
        loanOutstanding,
        interestAccrued: qInterest,
        yieldEarned: qYield,
        cashBalance,
        totalContrib,
        totalContribReal,
        netWorth,
        pnlNet,
        inflationIndex,
        realNetWorth,
        realPnlNet,
      });

      qInterest = 0;
      qYield = 0;
    }
  }

  return out;
}

/******************************************************
 * Dodatkowy helper: moment osiągnięcia zdolności
 * na pożyczkę zabezpieczoną (kolateral) o zadanej kwocie.
 ******************************************************/

/**
 * Zwraca pierwszy miesiąc, w którym wolna zdolność kredytowa (capacity)
 * przekracza zadaną „desiredAmount”.  Capacity definiujemy jako:
 *   capacity = (ltvPct * wartość BTC) − loanOutstanding
 * Jeśli przez cały horyzont warunek nie jest spełniony → null.
 */
export function firstMonthForCollateralLoan(
  series: UserSimulationPoint[],
  desiredAmount: number,
  ltvPct: number
): number | null {
  for (const pt of series) {
    if (ltvPct * pt.btcValue - pt.loanOutstanding >= desiredAmount)
      return pt.month;
  }
  return null;
}

/******************************************************
 * Krótka demonstracja (node btcPensionUser.ts) – opcjonalna.
 ******************************************************/
if (require.main === module) {
  const sample: UserSimulationInput = {
    monthlyContribution: 300,
    initialPrice: 100_000,
    cagr: 0.14,
    years: 25,
    ltv: 0.3,
    loanRate: 0.0,
    yieldRate: 0.05,
    cpiRate: 0.03,
    enableIndexing: false,
    exchangeFeePct: 0.1,
    feePct: 15,
  };

  const res = simulateUser(sample);
  console.log(
    'Wartość netto po 25 latach:',
    res[res.length - 1].netWorth.toFixed(2),
    'EUR'
  );
}
