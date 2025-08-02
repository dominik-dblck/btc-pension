/******************************************************
 * ====================================================
 *  ROZSZERZENIE: symulacja przychodów z referrals
 * ====================================================
 ******************************************************/

import {
  monthlyRate,
  simulateUser,
  SNAPSHOT_STEP,
  UserSimulationInput,
  UserSimulationPoint,
} from './simulateUserPension';

/**
 * Konfiguracja uproszczona dla referrals.
 */
export interface ReferralSettings {
  /** Liczba poleconych */
  count: number;
  /** Udział w yieldu poleconego (np. 5 = 5 %) */
  sharePct: number;
  /** Parametry przeciętnego poleconego */
  referralInput: UserSimulationInput;
}

/**
 * Dodatkowe pola w snapshotach: ile BTC/EUR z referrals.
 */
export type UserWithRefPoint = UserSimulationPoint & {
  btcFromReferrals: number;
  eurFromReferrals: number;
};

/**
 * Symuluje użytkownika **wraz z** przychodami od poleconych.
 * ─ bazuje na `simulateUser` (user) + `simulateUser` (polecony, snapshot co miesiąc).
 * ─ w każdym **miesiącu** pobiera `sharePct × count × yieldGross (EUR)` z poleconych,
 *   natychmiast kupuje za to BTC i dodaje do portfela.
 *
 * **Kluczowa poprawka** ➜ pobrana kwota kredytu (delta‑draw),
 *   która podnosi LTV do celu, **nie** jest zamieniana na BTC.
 *   Te środki „żyją” poza portfelem BTC i generują tylko yield.
 */
export function simulateUserWithReferrals(
  userInput: UserSimulationInput,
  ref: ReferralSettings,
  opts: { autoDrawToTarget?: boolean } = {}
): UserWithRefPoint[] {
  /* ----------------------------------------------------------------------
   * 1) Symulacja jednego poleconego w trybie miesięcznym (snapshotStep = 1)
   * --------------------------------------------------------------------*/
  const refMonthlySeries = simulateUser(ref.referralInput, {
    autoDrawToTarget: opts.autoDrawToTarget,
    snapshotStep: 1, // 1 mies. ⇒ yieldEarned jest miesięczne, nie kwartalne
  });
  const refYieldByMonth = new Map<number, number>();
  for (const pt of refMonthlySeries)
    refYieldByMonth.set(pt.month, pt.yieldEarned);

  /* ----------------------------------------------------------------------
   * 2) Główna pętla – niemal kopia simulateUser, ale BEZ kupowania BTC
   *    za świeżo zaciągnięty kredyt (💡 core‑fix).
   * --------------------------------------------------------------------*/
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
  } = userInput;
  const autoDrawToTarget = opts.autoDrawToTarget ?? true;
  const monthsTotal = years * 12;

  const out: UserWithRefPoint[] = [];
  let btcHolding = 0;
  let loanOutstanding = 0;
  let cashBalance = 0;
  let totalContrib = 0;
  let totalContribReal = 0;
  let qInterest = 0;
  let qYield = 0;
  let lastContribution = 0;
  let btcFromRef = 0;
  let eurFromRef = 0;

  for (let m = 0; m <= monthsTotal; m++) {
    /* === 1. Cena BTC + inflacja ================================================= */
    const price = initialPrice * Math.pow(1 + cagr, m / 12);
    const inflationIndex = Math.pow(1 + cpiRate, m / 12);

    /* === 2. Wpłata DCA ========================================================= */
    if (m > 0) {
      const nominal = enableIndexing
        ? monthlyContribution * inflationIndex
        : monthlyContribution;
      const feeEx = nominal * (exchangeFeePct / 100);
      const net = nominal - feeEx;

      totalContrib += nominal;
      totalContribReal += nominal / inflationIndex;
      lastContribution = net;

      btcHolding += net / price;
    }

    /* === 3. Odsetki + yield od ZACIĄGNIĘTEGO kredytu =========================== */
    if (m > 0) {
      const intM = monthlyRate(loanRate);
      const yM = monthlyRate(yieldRate);
      const interest = loanOutstanding * intM;
      const yieldGross = loanOutstanding * yM;
      qInterest += interest;
      qYield += yieldGross;

      const yieldFee = yieldGross * (feePct / 100);
      const netYield = yieldGross - yieldFee - interest;

      if (netYield >= 0)
        btcHolding += netYield / price; // reinwestycja ↓
      else {
        let deficit = -netYield;
        if (cashBalance >= deficit) cashBalance -= deficit;
        else {
          deficit -= cashBalance;
          cashBalance = 0;
          btcHolding = Math.max(0, btcHolding - deficit / price);
        }
      }
    }

    /* === 4. Referral – udział w yieldu poleconych ============================== */
    const refYieldG = (refYieldByMonth.get(m) ?? 0) * ref.count;
    if (refYieldG > 0) {
      const shareEur = refYieldG * (ref.sharePct / 100);
      eurFromRef += shareEur;
      const shareBtc = shareEur / price;
      btcFromRef += shareBtc;
      btcHolding += shareBtc;
    }

    /* === 5. Rebalans LTV co SNAPSHOT_STEP mies. ================================ */
    const isSnapshot = m === 0 || m % SNAPSHOT_STEP === 0 || m === monthsTotal;
    if (isSnapshot) {
      const btcValue = btcHolding * price;
      const targetLoan = ltv * btcValue;
      if (autoDrawToTarget) {
        const delta = targetLoan - loanOutstanding;
        if (delta > 0) {
          // 🔄 DOBIERAMY kredyt, ALE nie kupujemy za to BTC (funds poza modelem)
          loanOutstanding += delta;
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
          loanOutstanding += draw; // ⚠️ draw nie trafia w BTC
        }
      }
    }

    /* === 6. Snapshot (co kwartał + start + koniec) ============================ */
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
        btcFromReferrals: btcFromRef,
        eurFromReferrals: eurFromRef,
      });

      qInterest = 0;
      qYield = 0;
    }
  }
  return out;
}
