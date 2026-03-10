// ─────────────────────────────────────────────────────────────────────────────
// LBO Model — Core TypeScript Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type Currency = 'GBP' | 'USD';
export type DealType = 'mid-market-bsl' | 'large-cap-bsl' | 'direct-lending';

export interface DealOverview {
  companyName: string;
  sector: string;
  dealDate: string;
  currency: Currency;
  dealType: DealType;
  entryEBITDA: number;       // £m
  entryMultiple: number;     // x
  enterpriseValue: number;   // auto-calc: entryEBITDA × entryMultiple
  equityPct: number;         // % of EV
  debtPct: number;           // % of EV (100 - equityPct)
  managementRolloverPct: number; // % of sponsor equity
  transactionFeesPct: number;    // % of EV
  financingFeesPct: number;      // % of total debt
  cashToBS: number;              // £m
  holdPeriod: number;        // 3–7 years
  exitMultiple: number;      // x
  linkExitToEntry: boolean;
  revenueCAGR: number;       // %
  entryEBITDAMargin: number; // %
  exitEBITDAMargin: number;  // %
  entryRevenue: number;      // £m, derived from EBITDA / margin
  grossMargin: number;       // %
  taxRate: number;            // %
  daPercent: number;          // D&A as % of revenue
  capexPercent: number;       // Capex as % of revenue
  nwcPercent: number;         // NWC change as % of revenue delta
}

export type RateType = 'fixed' | 'floating';

export interface DebtTranche {
  id: string;
  name: string;
  amount: number;           // £m
  amountAsPctOfEV: boolean; // toggle: absolute vs % of EV
  amountPct: number;        // if amountAsPctOfEV, this is the %
  rateType: RateType;
  fixedRate: number;        // % (used if rateType === 'fixed')
  floatingSpread: number;   // bps (used if rateType === 'floating')
  baseRate: number;         // % (SOFR/SONIA reference rate)
  amortisationPct: number;  // % per year mandatory amort
  cashSweepPct: number;     // 0–100% of excess cash
  isPIK: boolean;           // PIK interest toggle
  tenor: number;            // years
  isUndrawn: boolean;       // RCF: committed but undrawn at close
  commitmentFeePct: number; // % commitment fee for undrawn facilities
}

export interface SourcesUses {
  // Uses
  purchasePrice: number;    // EV
  transactionFees: number;
  financingFees: number;
  cashToBS: number;
  totalUses: number;
  // Sources
  debtTranches: DebtTranche[];  // drawn only
  rcfTranches: DebtTranche[];   // committed-undrawn, shown separately
  totalDebt: number;            // drawn only
  sponsorEquity: number;
  managementRollover: number;
  totalEquity: number;
  totalSources: number;
  isBalanced: boolean;
  // Gap tracking
  targetDebt: number;   // EV × debtPct — what capital structure implies
  debtGap: number;      // targetDebt − totalDebt (positive = underlevered)
}

export interface YearlyProjection {
  year: number;             // 0 = LTM, 1–7
  // Income Statement
  revenue: number;
  revenueGrowth: number;    // %
  grossProfit: number;
  grossMargin: number;      // %
  ebitda: number;
  ebitdaMargin: number;     // %
  da: number;               // depreciation & amortisation
  ebit: number;
  interestExpense: number;  // from debt schedule
  pikInterest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  // Cash Flow
  capex: number;
  nwcChange: number;
  cashTaxes: number;
  unleveredFCF: number;
  interestPaid: number;     // cash interest only
  debtRepayment: number;    // mandatory amort
  cashSweep: number;        // optional
  leveredFCF: number;
  // Balance Sheet (simplified)
  cash: number;
  netDebt: number;
  impliedEquityValue: number;
}

export interface DebtTrancheSchedule {
  trancheId: string;
  trancheName: string;
  years: DebtTrancheYear[];
}

export interface DebtTrancheYear {
  year: number;
  openingBalance: number;
  cashInterest: number;
  pikInterest: number;
  mandatoryAmort: number;
  cashSweepRepayment: number;
  closingBalance: number;
}

export interface DebtScheduleSummary {
  year: number;
  totalDebt: number;
  totalCashInterest: number;
  totalPIKInterest: number;
  totalAmort: number;
  totalCashSweep: number;
  interestCoverage: number;   // EBITDA / Total Cash Interest
  netLeverage: number;        // Net Debt / EBITDA
}

export interface Covenant {
  id: string;
  name: string;
  type: 'leverage' | 'coverage';
  threshold: number;          // e.g. 5.5 for leverage ≤ 5.5×
  isMaximum: boolean;         // true for leverage (must be below), false for coverage (must be above)
}

export interface CovenantTest {
  covenantId: string;
  year: number;
  actual: number;
  threshold: number;
  inBreach: boolean;
}

export interface ExitWaterfall {
  exitEV: number;
  exitEBITDA: number;
  exitMultiple: number;
  netDebtAtExit: number;
  exitEquityValue: number;
  managementProceeds: number;
  sponsorProceeds: number;
}

export interface Returns {
  sponsor: ReturnMetrics;
  management: ReturnMetrics;
  total: ReturnMetrics;
}

export interface ReturnMetrics {
  equityInvested: number;
  equityReturned: number;
  mom: number;           // Money-on-Money multiple
  irr: number;           // %
  holdPeriod: number;
  dpi: number;           // Distributions to Paid-In
}

export interface SensitivityInput {
  variable: SensitivityVariable;
  values: number[];
}

export type SensitivityVariable =
  | 'entryMultiple'
  | 'exitMultiple'
  | 'revenueCAGR'
  | 'ebitdaMargin'
  | 'leverage'
  | 'interestRate'
  | 'holdPeriod';

export type SensitivityMetric =
  | 'irr'
  | 'mom'
  | 'exitEquityValue'
  | 'netLeverageAtExit';

export interface SensitivityResult {
  rowVariable: SensitivityVariable;
  colVariable: SensitivityVariable;
  metric: SensitivityMetric;
  rowValues: number[];
  colValues: number[];
  results: number[][];    // [row][col]
}

export interface IRRAttribution {
  revenueGrowth: number;      // % contribution
  marginExpansion: number;
  deleveraging: number;
  multipleExpansion: number;
  total: number;              // should ≈ IRR
}

// ─────────────────────────────────────────────────────────────────────────────
// Central Model State
// ─────────────────────────────────────────────────────────────────────────────

export interface LBOModel {
  deal: DealOverview;
  debtTranches: DebtTranche[];
  covenants: Covenant[];
  // Per-year overrides (user can override growth, capex, etc. per year)
  yearlyOverrides: Partial<Record<number, YearlyOverrides>>;
  circularDebtSchedule: boolean;  // ON = iterative avg-debt interest calc
}

export interface YearlyOverrides {
  revenueGrowth?: number;
  ebitdaMargin?: number;
  capexPercent?: number;
  nwcPercent?: number;
  daPercent?: number;
}

// Computed outputs (not stored in state, derived)
export interface LBOModelOutputs {
  sourcesUses: SourcesUses;
  projections: YearlyProjection[];
  debtSchedules: DebtTrancheSchedule[];
  debtSummary: DebtScheduleSummary[];
  covenantTests: CovenantTest[];
  exitWaterfall: ExitWaterfall;
  returns: Returns;
  irrAttribution: IRRAttribution;
  // Circularity convergence metadata
  circularConverged: boolean;
  circularIterations: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Management
// ─────────────────────────────────────────────────────────────────────────────

export interface Scenario {
  id: string;
  name: string;
  model: LBOModel;
}

export interface ScenarioWithOutputs extends Scenario {
  outputs: LBOModelOutputs;
}

// Navigation
export type Section =
  | 'overview'
  | 'sources-uses'
  | 'operating-model'
  | 'debt-schedule'
  | 'returns'
  | 'sensitivity'
  | 'dashboard'
  | 'export';
