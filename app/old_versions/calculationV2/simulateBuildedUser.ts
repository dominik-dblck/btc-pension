/********************************************************************
 *  btcStakingScenarios.ts
 *  ---------------------------------------------------------------
 *  Trzy gotowe scenariusze (conservative / probable / optimistic)
 *  do natychmiastowego odpalania z  simulateUser().
 *
 *    node btcStakingScenarios.ts conservative
 *    node btcStakingScenarios.ts probable
 *    node btcStakingScenarios.ts optimistic
 *
 *  Każdy generator zwraca kompletny obiekt SimulationInput.
 ********************************************************************/

import {
  ParticipantConfig,
  ReferralConfig,
  SimulationInput,
  UserConfig,
} from './simulateUserTypesV2';
import { simulateUser } from './simulateUserV2';

/*──────────────────────────────────────────────────────────────────*/
/*  Helpers                                                         */
/*──────────────────────────────────────────────────────────────────*/

/** Tworzy konfigurację uczestnika na podstawie parametrów */
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

/** Buduje drzewo referrals o głębokości `depth` */
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

/** Szybki wrapper dla najczęstszych setupów */
function buildInput(
  {
    cagr,
    tiers,
    platformFee,
    upstreamFee,
    firstLvl,
    secondLvl,
    delayYears,
  }: {
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
    tiers,
    platformFee,
    upstreamFee
  );

  /* L2 */
  const level2 =
    secondLvl > 0
      ? generateReferralTree(1, secondLvl, delayYears, base, 2)
      : [];

  /* L1 */
  const level1 =
    firstLvl > 0
      ? generateReferralTree(1, firstLvl, 0, base, 1).map(l1 => ({
          ...l1,
          referrals: level2,
        }))
      : [];

  return {
    market: {
      initialPrice: 100_000,
      cagr,
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
/*  Scenarios                                                       */
/*──────────────────────────────────────────────────────────────────*/

export function buildConservativeInput(): SimulationInput {
  return buildInput({
    cagr: 0.08,
    tiers: [
      { allocation: 0.4, apy: 0.03 },
      { allocation: 0.3, apy: 0.04 },
      { allocation: 0.2, apy: 0.06 },
    ],
    platformFee: 0.1,
    upstreamFee: 0.03,
    firstLvl: 5, // 5 poleconych
    secondLvl: 0, // brak L2
    delayYears: 5, // L1 startuje od razu; (gdyby było L2 > 0 → 5 lat opóźn.)
  });
}

export function buildProbableInput(): SimulationInput {
  return buildInput({
    cagr: 0.1,
    tiers: [
      { allocation: 0.4, apy: 0.04 },
      { allocation: 0.3, apy: 0.05 },
      { allocation: 0.2, apy: 0.07 },
    ],
    platformFee: 0.12,
    upstreamFee: 0.04,
    firstLvl: 8, // 8 poleconych L1
    secondLvl: 5, // każdy ma 5 poleconych L2
    delayYears: 4, // L2 wchodzi po 4 latach
  });
}

export function buildOptimisticInput(): SimulationInput {
  return buildInput({
    cagr: 0.14,
    tiers: [
      { allocation: 0.4, apy: 0.06 },
      { allocation: 0.3, apy: 0.08 },
      { allocation: 0.2, apy: 0.12 },
    ],
    platformFee: 0.15,
    upstreamFee: 0.05,
    firstLvl: 10, // 10 poleconych L1
    secondLvl: 10, // każdy po 10 L2
    delayYears: 3, // L2 wchodzi po 3 latach
  });
}

/*──────────────────────────────────────────────────────────────────*/
/*  CLI Quick-Run (node btcStakingScenarios.ts [scenario])         */
/*──────────────────────────────────────────────────────────────────*/
if (require.main === module) {
  const scenarios = [
    { name: 'conservative', input: buildConservativeInput() },
    { name: 'probable', input: buildProbableInput() },
    { name: 'optimistic', input: buildOptimisticInput() },
  ];

  for (const { name, input } of scenarios) {
    const res = simulateUser(input);
    console.log(`Scenario: ${name.toUpperCase()}`);
    console.log(res.at(-1));
    console.log('-----------------------------');
  }
}
