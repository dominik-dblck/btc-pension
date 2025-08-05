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
  /** Dane rynkowe (BTC, inflacja) */
  marketData: MarketData;
  /** Dane użytkownika */
  userData: UserData;
  /** Dane platformy */
  platformData: PlatformData;
  /** Ustawienia symulacji */
  simulationSettings: SimulationSettings;
  /** Dane zysków */
  yieldData: YieldData;

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
  setMarketData: React.Dispatch<React.SetStateAction<MarketData>>;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  setPlatformData: React.Dispatch<React.SetStateAction<PlatformData>>;
  setSimulationSettings: React.Dispatch<
    React.SetStateAction<SimulationSettings>
  >;
  setYieldData: React.Dispatch<React.SetStateAction<YieldData>>;
}

interface MarketData {
  initialBtcPriceInEuro: number;
  btcCagrToday: number;
  btcCagrAsymptote: number;
  settleYears: number;
  settleEpsilon: number;
  cpi: number;
  enableIndexing: boolean;
}

interface UserData {
  monthlyDcaInEuro: number;
  startMonth: number;
  initialBtcHolding: number;
}

interface PlatformData {
  userStarts: number;
  userEnds: number;
  growthType: GrowthType;
  platformFeeFromYieldPct: number;
  platformExchangeFeePct: number;
}

interface SimulationSettings {
  numberOfYears: number;
}

interface YieldData {
  userYearlyYieldPct: number;
  platformYearlyYieldPct: number;
}

const BTCPensionContext = createContext<BTCPensionContextType | null>(null);

/******************************************************
 * Provider
 ******************************************************/
export const BtcTreasuryGrowthSimulationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // ======= 1. Stan wejściowy - podzielony według typów danych
  const [marketData, setMarketData] = useState<MarketData>({
    initialBtcPriceInEuro: 100_000,
    btcCagrToday: 0.35,
    btcCagrAsymptote: 0.14,
    settleYears: 8,
    settleEpsilon: 0.05,
    cpi: 0.03,
    enableIndexing: false,
  });

  const [userData, setUserData] = useState<UserData>({
    monthlyDcaInEuro: 100,
    startMonth: 0,
    initialBtcHolding: 0,
  });

  const [platformData, setPlatformData] = useState<PlatformData>({
    userStarts: 50_000,
    userEnds: 100_0000,
    growthType: GrowthType.Exponential,
    platformFeeFromYieldPct: 0.1,
    platformExchangeFeePct: 0.001,
  });

  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettings>({
      numberOfYears: 25,
    });

  const [yieldData, setYieldData] = useState<YieldData>({
    userYearlyYieldPct: 0.02,
    platformYearlyYieldPct: 0.02,
  });

  // ======= 2. Budowanie UserTreasuryGrowthInput z rozdzielonych stanów
  const userInput = useMemo(
    (): UserTreasuryGrowthInput => ({
      marketData: {
        ...marketData,
        numberOfYears: simulationSettings.numberOfYears,
      },
      userData,
      platformData: {
        platformFeeFromYieldPct: platformData.platformFeeFromYieldPct,
        platformExchangeFeePct: platformData.platformExchangeFeePct,
      },
      earnData: {
        yearlyYieldPct: yieldData.userYearlyYieldPct,
      },
    }),
    [marketData, userData, platformData, simulationSettings, yieldData]
  );

  // ======= 3. Symulacje (pamiętajmy o useMemo, żeby nie liczyć na każdym renderze)
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
          userStarts: platformData.userStarts,
          userEnds: platformData.userEnds,
          growthType: platformData.growthType,
          years: simulationSettings.numberOfYears,
        },
        userTreasuryGrowthInput: userInput,
      }),
    [platformData, simulationSettings, userInput]
  );

  const platformSeries = useMemo(
    () => buildPlatformMonthlySnapshots(aggregatedPlatformSnapshots),
    [aggregatedPlatformSnapshots]
  );

  const platformWithInvestmentSeries = useMemo(
    () =>
      simulatePlatformTreasuryGrowth({
        platformUsersData: {
          userStarts: platformData.userStarts,
          userEnds: platformData.userEnds,
          growthType: platformData.growthType,
          years: simulationSettings.numberOfYears,
        },
        userTreasuryGrowthInput: userInput,
        platformTreasuryGrowthData: {
          yearlyYieldPct: yieldData.platformYearlyYieldPct,
        },
      }),
    [platformData, simulationSettings, userInput, yieldData]
  );

  const lastPlatformSnapshot =
    platformWithInvestmentSeries[platformWithInvestmentSeries.length - 1];

  // ======= 4. Zbudowanie wartości kontekstu
  const value: BTCPensionContextType = {
    marketData,
    userData,
    platformData,
    simulationSettings,
    yieldData,
    userSeries,
    lastUserSnapshot,
    platformSeries,
    platformWithInvestmentSeries,
    lastPlatformSnapshot,
    setMarketData,
    setUserData,
    setPlatformData,
    setSimulationSettings,
    setYieldData,
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
