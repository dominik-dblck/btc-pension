import {
  monthlyRate,
  ParticipantConfig,
  SimulationInput,
  SimulationSnapshot,
  SNAPSHOT_STEP,
} from './simulateUserTypesV2';

interface ParticipantState {
  cfg: ParticipantConfig;
  btcHolding: number;

  // skumulowane fee
  exchangeFeePaidTotal: number;
  yieldFeePaidTotal: number;
  referralOutPaidTotal: number;

  // bieżący cykl (resetowane przy snapshot)
  exchangeFeeCycle: number;
  yieldFeeCycle: number;

  totalContribution: number;
  referralBtcGenerated: number; // BTC otrzymane z downstream
  joinDelay: number;
}

const makeState = (
  cfg: ParticipantConfig,
  joinDelay = 0
): ParticipantState => ({
  cfg,
  btcHolding: 0,
  exchangeFeePaidTotal: 0,
  yieldFeePaidTotal: 0,
  referralOutPaidTotal: 0,
  exchangeFeeCycle: 0,
  yieldFeeCycle: 0,
  totalContribution: 0,
  referralBtcGenerated: 0,
  joinDelay,
});

/* ---------------------------------------------
 * 3.2  Funkcja główna
 * -------------------------------------------*/
export function simulateUser(input: SimulationInput): SimulationSnapshot[] {
  const { market, user: userCfg } = input;
  const {
    initialPrice,
    cagr,
    years,
    cpiRate,
    snapshotStep = SNAPSHOT_STEP,
  } = market;

  const monthsTotal = years * 12;

  /* === Walidacje === */
  const validate = (p: ParticipantConfig) => {
    const allocSum = p.tiers.reduce((s, t) => s + t.allocationPct, 0);
    if (allocSum > 1 + 1e-6) throw new Error('allocationPct sum > 1');
    if (p.fees.platformFeePct + p.fees.upstreamRefPct > 1 + 1e-6)
      throw new Error('platformFeePct + upstreamRefPct must ≤ 1');
  };
  validate(userCfg);
  userCfg.referrals?.forEach(validate);

  /* === Inicjalizacja stanów === */
  const userState = makeState(userCfg, 0);
  const referralStates = (userCfg.referrals ?? []).map(r =>
    makeState(r, r.joinDelayMonths)
  );

  const snaps: SimulationSnapshot[] = [];

  // Akumulatory cyklu (user perspective)
  let cycleGrossBtc = 0;
  let cycleNetBtc = 0;

  /* === Pętla miesięczna === */
  for (let m = 0; m <= monthsTotal; m++) {
    const price = initialPrice * Math.pow(1 + cagr, m / 12);
    const inflationIndex = Math.pow(1 + cpiRate, m / 12);

    /* --- 1) Wpłaty DCA -------------------------------------- */
    const handleDca = (state: ParticipantState) => {
      const {
        monthlyContribution,
        enableIndexing,
        exchangeFeePct = 0,
      } = state.cfg.contribution;
      if (m === 0 || m < state.joinDelay) return 0;

      const nominal = enableIndexing
        ? monthlyContribution * inflationIndex
        : monthlyContribution;
      const exchFee = nominal * exchangeFeePct;
      const netEur = nominal - exchFee;
      const btcBought = netEur / price;

      state.btcHolding += btcBought;
      state.exchangeFeePaidTotal += exchFee;
      state.exchangeFeeCycle += exchFee;
      state.totalContribution += nominal;

      return nominal;
    };

    const userMonthContrib = handleDca(userState);
    referralStates.forEach(handleDca);

    /* --- 2) Yield ------------------------------------------- */
    const handleYield = (
      state: ParticipantState,
      upstream?: ParticipantState
    ) => {
      if (m === 0 || m < state.joinDelay) return;

      let grossBtc = 0;
      for (const tier of state.cfg.tiers) {
        const tierBtc = state.btcHolding * tier.allocationPct;
        grossBtc += tierBtc * monthlyRate(tier.apy);
      }
      if (grossBtc === 0) return;

      const { platformFeePct, upstreamRefPct } = state.cfg.fees;
      const platformBtc = grossBtc * platformFeePct;
      const upstreamBtc = grossBtc * upstreamRefPct;
      const netBtc = grossBtc - platformBtc - upstreamBtc;

      state.btcHolding += netBtc;
      const platformEur = platformBtc * price;
      state.yieldFeePaidTotal += platformEur;
      state.yieldFeeCycle += platformEur;

      const upstreamEur = upstreamBtc * price;
      state.referralOutPaidTotal += upstreamEur;

      if (upstream && upstreamBtc > 0) {
        upstream.btcHolding += upstreamBtc;
        upstream.referralBtcGenerated += upstreamBtc;
      }

      if (state === userState) {
        cycleGrossBtc += grossBtc;
        cycleNetBtc += netBtc;
      }
    };

    referralStates.forEach(r => handleYield(r, userState));
    handleYield(userState);

    /* --- 3) Snapshot ---------------------------------------- */
    const isSnap = m === 0 || m % snapshotStep === 0 || m === monthsTotal;
    if (isSnap) {
      const btcValueEur = userState.btcHolding * price;
      const referralValueEur = userState.referralBtcGenerated * price;

      snaps.push({
        month: m,
        year: Math.floor(m / 12),

        totalBtc: userState.btcHolding,
        btcPrice: price,
        btcValueEur,

        referralBtc: userState.referralBtcGenerated,
        referralValueEur,

        monthlyContributionEur: userMonthContrib ?? 0,
        totalContributionEur: userState.totalContribution,

        realNetWorth: btcValueEur / inflationIndex,

        // ! todo przemyslec
        yieldFeePaidCycle:
          userState.yieldFeeCycle +
          referralStates.reduce((s, r) => s + r.yieldFeeCycle, 0),
        exchangeFeePaidCycle:
          userState.exchangeFeeCycle +
          referralStates.reduce((s, r) => s + r.exchangeFeeCycle, 0),

        yieldFeePaidTotal:
          userState.yieldFeePaidTotal +
          referralStates.reduce((s, r) => s + r.yieldFeePaidTotal, 0),
        exchangeFeePaidTotal:
          userState.exchangeFeePaidTotal +
          referralStates.reduce((s, r) => s + r.exchangeFeePaidTotal, 0),

        inflationIndex,
        referralOutPaidTotal: userState.referralOutPaidTotal,
        grossYieldEarnedCycle: cycleGrossBtc,
        netYieldEarnedCycle: cycleNetBtc,
      });

      // reset cyklicznych akumulatorów
      [userState, ...referralStates].forEach(s => {
        s.exchangeFeeCycle = 0;
        s.yieldFeeCycle = 0;
      });
      cycleGrossBtc = 0;
      cycleNetBtc = 0;
    }
  }

  return snaps;
}
