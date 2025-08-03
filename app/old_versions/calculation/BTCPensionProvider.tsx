'use client';
// ================================================================
// BTCPensionProvider.tsx
// ------------------------------------------------
//  React‑owy context korzystający z funkcji domenowych z btcPensionUser.ts:
//    – simulateUser
//    – simulateUserWithReferrals
//    – simulatePlatformAnnual
// ================================================================

import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  simulateUser,
  UserSimulationInput,
  UserSimulationPoint,
} from './simulateUserPension';
import {
  ReferralSettings,
  simulateUserWithReferrals,
  UserWithRefPoint,
} from './simulateUserWithReferrals';
import {
  PlatformAnnualPoint,
  SimplePlatformConfig,
  simulatePlatformAnnual,
} from './simulatePlatform';

/******************************************************
 * Typy React‑owego kontekstu
 ******************************************************/
interface BTCPensionContextType {
  /** Wejściowe parametry symulacji dla użytkownika */
  userInput: UserSimulationInput;
  /** Konfiguracja referral (jeśli count = 0 – brak poleconych) */
  referral: ReferralSettings;
  /** Konfiguracja platformy (wymagana do symulacji rocznej) */
  platformCfg: SimplePlatformConfig;

  /** Snapshoty kwartalne użytkownika (bez referrals) */
  userSeries: UserSimulationPoint[];
  /** Snapshoty kwartalne użytkownika + referrals */
  userWithRefSeries: UserWithRefPoint[];
  /** Ostatni snapshot (ułatwia wyświetlanie podsumowań) */
  last: UserWithRefPoint;
  /** Seria roczna przychodów platformy */
  platformAnnual: PlatformAnnualPoint[];

  /** Aktualizatory – proste settery */
  setUserInput: React.Dispatch<React.SetStateAction<UserSimulationInput>>;
  setReferral: React.Dispatch<React.SetStateAction<ReferralSettings>>;
  setPlatformCfg: React.Dispatch<React.SetStateAction<SimplePlatformConfig>>;
}

const BTCPensionContext = createContext<BTCPensionContextType | null>(null);

/******************************************************
 * Provider
 ******************************************************/
export const BTCPensionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // ======= 1. Stan wejściowy
  const [userInput, setUserInput] = useState<UserSimulationInput>({
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
  });

  const [referral, setReferral] = useState<ReferralSettings>({
    count: 0,
    sharePct: 5,
    referralInput: { ...userInput, monthlyContribution: 200 },
  });

  const [platformCfg, setPlatformCfg] = useState<SimplePlatformConfig>({
    avgMonthly: 300,
    feePct: 15,
    exchangeFeePct: 0.1,
    enableIndexing: true,
    usersStart: 50_000,
    usersEnd: 1_000_000,
    usersGrowthMode: 'linear',
    treasuryLtv: 0.3,
    treasuryLoanRate: 0.0,
    treasuryYieldRate: 0.05,
  });

  // ======= 2. Symulacje (pamiętajmy o useMemo, żeby nie liczyć na każdym renderze)
  const userSeries = useMemo(() => simulateUser(userInput), [userInput]);

  const userWithRefSeries = useMemo(
    () =>
      referral.count > 0
        ? simulateUserWithReferrals(userInput, referral)
        : (userSeries as unknown as UserWithRefPoint[]), // cast – brak referrals -> identyczna struktura
    [userInput, referral, userSeries]
  );

  const last = userWithRefSeries[userWithRefSeries.length - 1];

  const platformAnnual = useMemo(
    () => simulatePlatformAnnual(userInput, platformCfg),
    [userInput, platformCfg]
  );

  // ======= 3. Zbudowanie wartości kontekstu
  const value: BTCPensionContextType = {
    userInput,
    referral,
    platformCfg,
    userSeries,
    userWithRefSeries,
    last,
    platformAnnual,
    setUserInput,
    setReferral,
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
