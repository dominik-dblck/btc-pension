/********************************************************************
 * btcStakingScenariosWithPlatform.ts   (v3 – platform fee → BTC for ALL users)
 * ------------------------------------------------------------------
 *  • Trzy scenariusze: conservative / probable / optimistic
 *  • Projekcja przychodu i portfela platformy (fee reinwestowane w BTC):
 *       – średni klient wpłaca 100 € / m-c
 *       – baza aktywnych użytkowników rośnie liniowo 0 → 1 000 000 w 25 lat
 *       – CAŁE zebrane fee (od wszystkich userów) konwertujemy na BTC
 *
 *    node btcStakingScenariosWithPlatform.ts           # wszystkie
 *    node btcStakingScenariosWithPlatform.ts probable  # pojedynczy
 ********************************************************************/

import {
  ParticipantConfig,
  ReferralConfig,
  SimulationInput,
  UserConfig,
} from './simulateUserTypesV2';
import { simulateUser } from './simulateUserV2';

/*──────────────────────────────────────────────────────────────────*/
/*  1) Helpers – uczestnik & referral-tree                          */
/*──────────────────────────────────────────────────────────────────*/
function makeParticipant(
  monthlyContribution: number,
  tiers: { allocation: number; apy: number }[],
  platformFeePct: number,
  upstreamRefPct: number
): ParticipantConfig {
  return {
    contribution: {
      monthlyContribution,
      enableIndexing: false,
      exchangeFeePct: 0.1,
    },
    tiers: tiers.map(t => ({ allocationPct: t.allocation, apy: t.apy })),
    fees: { platformFeePct, upstreamRefPct },
  };
}

function generateReferralTree(
  depth: number,
  branching: number,
  delayYears: number,
  baseCfg: ParticipantConfig,
  level = 1
): ReferralConfig[] {
  if (depth === 0) return [];
  const delayMonths = level === 1 ? 0 : delayYears * 12;

  return Array.from({ length: branching }, () => {
    const node: ReferralConfig = {
      ...structuredClone(baseCfg),
      joinDelayMonths: delayMonths,
    };
    const children = generateReferralTree(
      depth - 1,
      branching,
      delayYears,
      baseCfg,
      level + 1
    );
    if (children.length) (node as unknown as UserConfig).referrals = children;
    return node;
  });
}

/*──────────────────────────────────────────────────────────────────*/
/*  2)  Szablon inputu                                              */
/*──────────────────────────────────────────────────────────────────*/
function buildInput(
  cfg: {
    cagr: number;
    tiers: { allocation: number; apy: number }[];
    platformFee: number;
    upstreamFee: number;
    firstLvl: number;
    secondLvl: number;
    delayYears: number;
  },
  years = 25,
  monthlyContribution = 300
): SimulationInput {
  const base = makeParticipant(
    monthlyContribution,
    cfg.tiers,
    cfg.platformFee,
    cfg.upstreamFee
  );

  const level2 =
    cfg.secondLvl > 0
      ? generateReferralTree(1, cfg.secondLvl, cfg.delayYears, base, 2)
      : [];

  const level1 =
    cfg.firstLvl > 0
      ? generateReferralTree(1, cfg.firstLvl, 0, base, 1).map(l1 => ({
          ...l1,
          referrals: level2,
        }))
      : [];

  return {
    market: {
      initialPrice: 100_000,
      cagr: cfg.cagr,
      years,
      cpiRate: 0.03,
      snapshotStep: 3,
    },
    user: {
      ...base,
      referrals: level1,
    },
  };
}

/*──────────────────────────────────────────────────────────────────*/
/*  3) Scenariusze                                                 */
/*──────────────────────────────────────────────────────────────────*/
export const scenarios = {
  conservative: () =>
    buildInput({
      cagr: 0.08,
      tiers: [
        { allocation: 0.4, apy: 0.03 },
        { allocation: 0.3, apy: 0.04 },
        { allocation: 0.2, apy: 0.06 },
      ],
      platformFee: 0.1,
      upstreamFee: 0.03,
      firstLvl: 5,
      secondLvl: 0,
      delayYears: 5,
    }),
  probable: () =>
    buildInput({
      cagr: 0.1,
      tiers: [
        { allocation: 0.4, apy: 0.04 },
        { allocation: 0.3, apy: 0.05 },
        { allocation: 0.2, apy: 0.07 },
      ],
      platformFee: 0.12,
      upstreamFee: 0.04,
      firstLvl: 8,
      secondLvl: 5,
      delayYears: 4,
    }),
  optimistic: () =>
    buildInput({
      cagr: 0.14,
      tiers: [
        { allocation: 0.4, apy: 0.06 },
        { allocation: 0.3, apy: 0.08 },
        { allocation: 0.2, apy: 0.12 },
      ],
      platformFee: 0.15,
      upstreamFee: 0.05,
      firstLvl: 10,
      secondLvl: 10,
      delayYears: 3,
    }),
};

/*──────────────────────────────────────────────────────────────────*/
/*  4) Projekcja makro: revenue + portfel platformy                */
/*──────────────────────────────────────────────────────────────────*/
function projectPlatform(
  inputBuilder: () => SimulationInput,
  years = 25,
  customerDca = 100,
  targetUsers = 1_000_000
) {
  /* fee-profile JEDNEGO klienta */
  const single = inputBuilder();
  single.user.contribution.monthlyContribution = customerDca;

  const snaps = simulateUser(single);
  const totalMonths = years * 12;

  let revenueCum = 0;
  let platformBtc = 0;

  return snaps.map(s => {
    /* liczba aktywnych userów w danym miesiącu */
    const active = (targetUsers * s.month) / totalMonths;

    /* fee-cycle (EUR) jednego usera */
    const feeCycleUser =
      (s.yieldFeePaidCycle ?? 0) + (s.exchangeFeePaidCycle ?? 0);

    /* fee całej bazy userów */
    const feeCycleAll = feeCycleUser * active;
    revenueCum += feeCycleAll;

    /* konwersja całego fee na BTC i staking w portfelu platformy */
    const btcAdded = feeCycleAll / s.btcPrice;
    platformBtc += btcAdded;

    return {
      month: s.month,
      activeUsers: Math.round(active),
      revenueCycleEur: feeCycleAll,
      revenueTotalEur: revenueCum,
      platformBtc,
      platformValueEur: platformBtc * s.btcPrice,
    };
  });
}

/*──────────────────────────────────────────────────────────────────*/
/*  5) CLI                                                         */
/*──────────────────────────────────────────────────────────────────*/
if (require.main === module) {
  const pick = process.argv[2] as
    | 'conservative'
    | 'probable'
    | 'optimistic'
    | undefined;

  const run = (name: keyof typeof scenarios) => {
    console.log(`\n=== ${name.toUpperCase()} SCENARIO ===`);

    /* 5a.  Po­je­dyn­czy użytkownik 300 € / m-c */
    const inv = simulateUser(scenarios[name]());
    console.log('Investor snapshot @ 25y → ', inv.at(-1));

    /* 5b.  Platforma: revenue + portfel (fee→BTC) */
    const macro = projectPlatform(scenarios[name]);
    const last = macro.at(-1)!;

    console.log(`Platform revenue → €${last.revenueTotalEur.toLocaleString()}`);
    console.log(
      `Platform wallet  → ${last.platformBtc.toFixed(2)} BTC  ≈  €${last.platformValueEur.toLocaleString()}`
    );
  };

  if (pick) {
    run(pick);
  } else {
    run('conservative');
    run('probable');
    run('optimistic');
  }
}
