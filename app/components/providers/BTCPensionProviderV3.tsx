'use client';
// ================================================================
// BTCPensionProviderV3.tsx
// ------------------------------------------------
//  React‑owy context korzystający z nowego modelu:
//    – userMarketSimulation
//    – buildAggregatedPlatformSnapshots
//    – buildPlatformMonthlySnapshots
//    – buildPlatformMonthlySnapshotsWithInvestment
// ================================================================

import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  UserTreasuryGrowthInput,
  UserPensionSimulationSnapshot,
  simulateUserTreasuryGrowth,
} from '../../calculation/simulateUserTreasuryGrowth';
import {
  simulatePlatformTreasuryGrowth,
  PlatformMonthlySnapshot,
  SimulatePlatformTreasuryGrowthResult,
} from '../../calculation/simulatePlatformTreasuryGrowth';
import { GrowthType } from '../../calculation/utils/getPlatformUsersTimeline';
import { buildPlatformMonthlySnapshots } from '@/app/calculation/utils/buildPlatformMonthlySnapshots';
import { buildCohortSimulationSet } from '@/app/calculation/utils/buildCohortSimulationSet';

/******************************************************
 * Typy React‑owego kontekstu
 ******************************************************/
interface BTCPensionContextType {
  /** Wejściowe parametry symulacji dla użytkownika */
  userInput: UserTreasuryGrowthInput;
  /** Konfiguracja platformy */
  platformCfg: PlatformConfig;

  /** Snapshoty miesięczne użytkownika */
  userSeries: UserPensionSimulationSnapshot[];
  /** Ostatni snapshot użytkownika (ułatwia wyświetlanie podsumowań) */
  lastUserSnapshot: UserPensionSimulationSnapshot;

  /** Snapshoty miesięczne platformy (bez inwestycji) */
  platformSeries: PlatformMonthlySnapshot[];
  /** Snapshoty miesięczne platformy (z inwestycjami) */
  platformWithInvestmentSeries: SimulatePlatformTreasuryGrowthResult[];
  /** Ostatni snapshot platformy (ułatwia wyświetlanie podsumowań) */
  lastPlatformSnapshot: SimulatePlatformTreasuryGrowthResult;

  /** Aktualizatory – proste settery */
  setUserInput: React.Dispatch<React.SetStateAction<UserTreasuryGrowthInput>>;
  setPlatformCfg: React.Dispatch<React.SetStateAction<PlatformConfig>>;
}

interface PlatformConfig {
  userStarts: number;
  userEnds: number;
  growthType: GrowthType;
  years: number;
  platformYearlyYieldPct: number;
}

const BTCPensionContext = createContext<BTCPensionContextType | null>(null);

/******************************************************
 * Provider
 ******************************************************/
export const BTCPensionProviderV3: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // ======= 1. Stan wejściowy
  const [userInput, setUserInput] = useState<UserTreasuryGrowthInput>({
    marketData: {
      initialBtcPriceInEuro: 100_000,
      btcCagrToday: 0.14,
      btcCagrAsymptote: 0.08,
      settleYears: 5,
      settleEpsilon: 0.05,
      cpi: 0.03,
      numberOfYears: 21,
      enableIndexing: false,
    },
    userData: {
      monthlyDcaInEuro: 100,
      startMonth: 0,
      initialBtcHolding: 0,
    },
    platformData: {
      platformFeeFromYieldPct: 0.1,
      platformExchangeFeePct: 0.001,
    },
    earnData: {
      yearlyYieldPct: 0.02,
    },
  });

  const [platformCfg, setPlatformCfg] = useState<PlatformConfig>({
    userStarts: 50_000,
    userEnds: 100_0000,
    growthType: GrowthType.Exponential,
    years: 21,
    platformYearlyYieldPct: 0.02,
  });

  // ======= 2. Symulacje (pamiętajmy o useMemo, żeby nie liczyć na każdym renderze)
  const userSeries = useMemo(
    () => simulateUserTreasuryGrowth(userInput),
    [userInput]
  );

  const lastUserSnapshot = userSeries[userSeries.length - 1];

  // Platform simulations
  const aggregatedPlatformSnapshots = useMemo(
    () =>
      buildCohortSimulationSet({
        platformUsersData: {
          userStarts: platformCfg.userStarts,
          userEnds: platformCfg.userEnds,
          growthType: platformCfg.growthType,
          years: platformCfg.years,
        },
        userTreasuryGrowthInput: userInput,
      }),
    [platformCfg, userInput]
  );

  const platformSeries = useMemo(
    () => buildPlatformMonthlySnapshots(aggregatedPlatformSnapshots),
    [aggregatedPlatformSnapshots]
  );

  const platformWithInvestmentSeries = useMemo(
    () =>
      simulatePlatformTreasuryGrowth({
        platformUsersData: {
          userStarts: platformCfg.userStarts,
          userEnds: platformCfg.userEnds,
          growthType: platformCfg.growthType,
          years: platformCfg.years,
        },
        userTreasuryGrowthInput: userInput,
        platformTreasuryGrowthData: {
          yearlyYieldPct: platformCfg.platformYearlyYieldPct,
        },
      }),
    [platformCfg, userInput]
  );

  const lastPlatformSnapshot =
    platformWithInvestmentSeries[platformWithInvestmentSeries.length - 1];

  // ======= 3. Zbudowanie wartości kontekstu
  const value: BTCPensionContextType = {
    userInput,
    platformCfg,
    userSeries,
    lastUserSnapshot,
    platformSeries,
    platformWithInvestmentSeries,
    lastPlatformSnapshot,
    setUserInput,
    setPlatformCfg,
  };

  return (
    <BTCPensionContext.Provider value={value}>
      {children}
    </BTCPensionContext.Provider>
  );
};

/******************************************************
 * Hook ułatwiający konsumpcję kontekstu
 ******************************************************/
export const useBTCPension = (): BTCPensionContextType => {
  const ctx = useContext(BTCPensionContext);
  if (!ctx)
    throw new Error('useBTCPension must be used within BTCPensionProvider');
  return ctx;
};
