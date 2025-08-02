// ================================================================
// BTC Staking Simulator – założenia produktowe (TL;DR)
// ------------------------------------------------
// • Symulator modeluje portfel głównego użytkownika ("user") oraz dowolną
//   liczbę poleconych ("referrals") w horyzoncie N lat, z miesięcznym krokiem.
// • Każdy uczestnik wpłaca stałą kwotę DCA w EUR; jeśli włączono indexing,
//   wpłata rośnie co miesiąc o inflację CPI.
// • Saldo BTC każdego uczestnika jest alokowane w ≤ 5 tierach stakingu;
//   każdy tier ma własne APY. Niealokowany BTC pozostaje bierny.
// • Comiesięczny proces:
//   1. Wpłata DCA → zakup BTC (po **exchangeFeePct**).
//   2. Obliczenie brutto yieldu dla każdego tieru.
//   3. Podział yieldu:
//      – **platformFeePct (x %)** → platforma (→ *yieldFee*).
//      – **upstreamRefPct (y %)** → bezpośredni referrer;
//        jeśli brak referrera, kwota trafia do platformy.
//      – pozostałe (1−x−y) reinwestujemy w BTC uczestnika.
//   4. Poleceni działają identycznie, więc użytkownik otrzymuje y % od
//      ich brutto yieldu (pomniejszonego o ich platformFeePct).
// • Polecony zaczyna generować wpłaty i yield dopiero po `joinDelayMonths`.
// • Ceny BTC rosną wg CAGR; CPI służy do indeksacji i obliczeń realnych.
// • Co `snapshotStep` miesięcy zapisujemy stan portfela; w szczególności
//   rozdzielamy opłaty platformy na:
//      – *yieldFee*   – prowizja od yieldu
//      – *exchangeFee* – fee giełdowe od zakupów DCA
//   …i to *zarówno* skumulowane (Total), jak i w bieżącym okresie (Cycle).
// • Silnik jest czysto funkcyjny – bez efektów ubocznych; łatwy w testach
//   i rozszerzeniach (np. kolejne poziomy referral, różne fee).
// ================================================================
// btcStakingUser.ts – pełna implementacja
// ================================================================

/******************************************************
 * 0)  Narzędzia wspólne
 ******************************************************/
export const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;
export const SNAPSHOT_STEP = 3; // kwartalny sampling domyślny

/******************************************************
 * 1)  Definicje typów
 ******************************************************/

/** Warunki makro / rynkowe – wspólne dla wszystkich uczestników. */
export interface MarketConditions {
  initialPrice: number; // cena 1 BTC na starcie [EUR]
  cagr: number; // średnioroczny wzrost ceny BTC (CAGR)
  years: number; // horyzont inwestycyjny [lata]
  cpiRate: number; // roczna inflacja CPI
  snapshotStep?: number; // co ile miesięcy robimy snapshot (domyślnie 3)
}

/** Pojedynczy tier stakingu. */
export interface TierConfig {
  allocationPct: number; // część BTC w tym tierze (0 – 1)
  apy: number; // roczna stopa zwrotu APY (np. 0.05 = 5 %)
}

/** Polityka miesięcznych kontrybucji (DCA). */
export interface ContributionPolicy {
  monthlyContribution: number; // stała miesięczna wpłata [EUR]
  enableIndexing: boolean; // true → wpłaty indeksowane inflacją CPI
  exchangeFeePct?: number; // fee giełdowe przy zakupie BTC – ułamek (np. 0.001)
}

/** Polityka opłat / prowizji. */
export interface FeePolicy {
  platformFeePct: number; // x – część gross yieldu dla platformy (0‑1)
  upstreamRefPct: number; // y – część gross yieldu dla referrera (0‑1)
}

/** Parametry wspólne dla *każdego* uczestnika. */
export interface ParticipantConfig {
  contribution: ContributionPolicy; // zasady wpłat DCA
  tiers: TierConfig[]; // ≤ 5 tierów stakingu
  fees: FeePolicy; // polityka fee (platforma + upstream)
}

/** Konfiguracja poleconego. */
export interface ReferralConfig extends ParticipantConfig {
  joinDelayMonths: number; // opóźnienie startu względem T0 (mies.)
}

/** Konfiguracja użytkownika. */
export interface UserConfig extends ParticipantConfig {
  referrals?: ReferralConfig[]; // zero lub więcej poleconych
}

/** Pełny obiekt wejściowy symulatora. */
export interface SimulationInput {
  market: MarketConditions; // warunki makro
  user: UserConfig; // użytkownik + siatka poleceń
}

/******************************************************
 * 2)  Struktura pojedynczego punktu serii (snapshot)
 ******************************************************/
export interface SimulationSnapshot {
  month: number; // licznik miesięcy od startu (0 = T0)
  year: number; // rok kalendarzowy (0 = rok startu)

  totalBtc: number; // saldo BTC użytkownika (łącznie z referral‑BTC)
  btcPrice: number; // cena 1 BTC [EUR]
  btcValueEur: number; // totalBtc × btcPrice

  referralBtc: number; // skumulowany BTC uzyskany z poleceń
  referralValueEur: number; // powyższe w EUR

  monthlyContributionEur: number; // nominalna wpłata EUR w danym miesiącu (przed fee)
  totalContributionEur: number; // skumulowane wpłaty EUR (przed fee)

  realNetWorth: number; // btcValueEur zdyskontowane o inflację (ceny T0)

  /* --- Opłaty platformowe --- */
  yieldFeePaidCycle: number; // prowizja od yieldu w *tym* cyklu [EUR]
  exchangeFeePaidCycle: number; // fee giełdowe w *tym* cyklu [EUR]

  yieldFeePaidTotal?: number; // skumulowana prowizja od yieldu [EUR]
  exchangeFeePaidTotal?: number; // skumulowane fee giełdowe [EUR]

  /* --- Dodatkowa diagnostyka (opc.) --- */
  inflationIndex?: number;
  referralOutPaidTotal?: number; // ile user zapłacił upstreamowi (skumul.) [EUR]
  grossYieldEarnedCycle?: number; // brutto yield (BTC) w cyklu
  netYieldEarnedCycle?: number; // netto yield (BTC) reinwestowany w cyklu
}

/******************************************************
 * 3)  Implementacja symulacji
 ******************************************************/

/* ---------------------------------------------
 * 3.1  Struktury runtime
 * -------------------------------------------*/
export interface ParticipantState {
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
