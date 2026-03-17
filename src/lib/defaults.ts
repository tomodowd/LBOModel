import type { LBOModel, Covenant, Scenario, DebtTranche } from './types';
import { generatePresetTranches, MARKET_RATES } from './deal-presets';

const defaultCovenants: Covenant[] = [
  {
    id: 'lev-cov',
    name: 'Net Leverage Covenant',
    type: 'leverage',
    threshold: 5.5,
    isMaximum: true,
  },
  {
    id: 'ic-cov',
    name: 'Interest Coverage Covenant',
    type: 'coverage',
    threshold: 2.0,
    isMaximum: false,
  },
];

export const defaultModel: LBOModel = {
  deal: {
    companyName: 'Portco HoldCo Ltd',
    sector: 'Business Services',
    dealDate: '2025-06-15',
    currency: 'GBP',
    dealType: 'mid-market-bsl',
    entryEBITDA: 45,
    entryMultiple: 9.5,
    enterpriseValue: 427.5,    // 45 × 9.5
    equityPct: 45,
    debtPct: 55,
    managementRolloverPct: 10,
    transactionFeesPct: 2.5,
    financingFeesPct: 2.0,
    cashToBS: 5,
    holdPeriod: 5,
    exitMultiple: 10.5,
    linkExitToEntry: false,
    revenueCAGR: 8,
    entryEBITDAMargin: 22,
    exitEBITDAMargin: 26,
    entryRevenue: 204.5,       // 45 / 0.22
    grossMargin: 55,
    taxRate: 25,
    daPercent: 3,
    capexPercent: 4,
    nwcPercent: 5,
  },
  debtTranches: generatePresetTranches('mid-market-bsl', 55),
  covenants: defaultCovenants,
  yearlyOverrides: {},
  circularDebtSchedule: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo Deal — loads on first visit so users immediately see a working model
// ─────────────────────────────────────────────────────────────────────────────

const demoDebtTranches: DebtTranche[] = [
  {
    id: 'tlb', name: 'Senior TLB',
    amount: 54.0, amountAsPctOfEV: false, amountPct: 50,
    rateType: 'floating', fixedRate: 0, floatingSpread: 475,
    baseRate: MARKET_RATES.sonia,
    amortisationPct: 1, cashSweepPct: 75, isPIK: false, tenor: 7,
    isUndrawn: false, commitmentFeePct: 0,
  },
  {
    id: 'unitranche', name: 'Unitranche Top-Up',
    amount: 27.0, amountAsPctOfEV: false, amountPct: 25,
    rateType: 'floating', fixedRate: 0, floatingSpread: 625,
    baseRate: MARKET_RATES.sonia,
    amortisationPct: 0, cashSweepPct: 0, isPIK: false, tenor: 8,
    isUndrawn: false, commitmentFeePct: 0,
  },
];

export const demoModel: LBOModel = {
  deal: {
    companyName: 'Fictional MidCo Ltd',
    sector: 'Business Services',
    dealDate: '2026-03-15',
    currency: 'GBP',
    dealType: 'mid-market-bsl',
    entryEBITDA: 18.0,
    entryMultiple: 6.0,
    enterpriseValue: 108.0,    // 18 × 6
    equityPct: 25,             // £27m / £108m ≈ 25%
    debtPct: 75,               // £81m / £108m ≈ 75%
    managementRolloverPct: 0,
    transactionFeesPct: 2.5,
    financingFeesPct: 2.0,
    cashToBS: 2,
    holdPeriod: 5,
    exitMultiple: 6.0,
    linkExitToEntry: false,
    revenueCAGR: 8,
    entryEBITDAMargin: 20,
    exitEBITDAMargin: 20,
    entryRevenue: 90.0,        // 18 / 0.20
    grossMargin: 50,
    taxRate: 25,
    daPercent: 2,
    capexPercent: 2,
    nwcPercent: 5,
  },
  debtTranches: demoDebtTranches,
  covenants: [
    { id: 'lev-cov', name: 'Net Leverage Covenant', type: 'leverage', threshold: 5.0, isMaximum: true },
    { id: 'ic-cov', name: 'Interest Coverage Covenant', type: 'coverage', threshold: 2.0, isMaximum: false },
  ],
  yearlyOverrides: {},
  circularDebtSchedule: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Scenarios
// ─────────────────────────────────────────────────────────────────────────────

export function createDefaultScenarios(baseModel?: LBOModel): Scenario[] {
  const src = baseModel ?? demoModel;

  const base: Scenario = {
    id: 'base',
    name: 'Base Case',
    model: structuredClone(src),
  };

  const upsideModel = structuredClone(src);
  upsideModel.deal.exitMultiple += 1.0;
  upsideModel.deal.revenueCAGR += 2;

  const upside: Scenario = {
    id: 'upside',
    name: 'Upside',
    model: upsideModel,
  };

  const downsideModel = structuredClone(src);
  downsideModel.deal.exitMultiple -= 1.0;
  downsideModel.deal.revenueCAGR -= 2;
  downsideModel.debtTranches = downsideModel.debtTranches.map(t => ({
    ...t,
    baseRate: t.rateType === 'floating' ? t.baseRate + 0.5 : t.baseRate,
  }));

  const downside: Scenario = {
    id: 'downside',
    name: 'Downside',
    model: downsideModel,
  };

  return [base, upside, downside];
}
