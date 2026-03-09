import type { LBOModel, Covenant } from './types';
import { generatePresetTranches } from './deal-presets';

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
