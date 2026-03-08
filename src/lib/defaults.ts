import type { LBOModel, DebtTranche, Covenant } from './types';

const defaultTranches: DebtTranche[] = [
  {
    id: 'tla',
    name: 'Senior Term Loan A',
    amount: 120,
    amountAsPctOfEV: false,
    amountPct: 0,
    rateType: 'floating',
    fixedRate: 0,
    floatingSpread: 350,    // bps
    baseRate: 4.5,           // SONIA
    amortisationPct: 5,      // 5% annual
    cashSweepPct: 0,
    isPIK: false,
    tenor: 5,
  },
  {
    id: 'tlb',
    name: 'Senior Term Loan B',
    amount: 90,
    amountAsPctOfEV: false,
    amountPct: 0,
    rateType: 'floating',
    fixedRate: 0,
    floatingSpread: 425,
    baseRate: 4.5,
    amortisationPct: 1,
    cashSweepPct: 75,
    isPIK: false,
    tenor: 7,
  },
  {
    id: 'mezz',
    name: 'Mezzanine (PIK)',
    amount: 25,
    amountAsPctOfEV: false,
    amountPct: 0,
    rateType: 'fixed',
    fixedRate: 10,
    floatingSpread: 0,
    baseRate: 0,
    amortisationPct: 0,
    cashSweepPct: 0,
    isPIK: true,
    tenor: 7,
  },
];

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
  debtTranches: defaultTranches,
  covenants: defaultCovenants,
  yearlyOverrides: {},
  circularDebtSchedule: true,
};
