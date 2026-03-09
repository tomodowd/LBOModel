import React, { createContext, useContext, useReducer, useMemo } from 'react';
import type { LBOModel, LBOModelOutputs, Section, DebtTranche, Covenant, YearlyOverrides, DealType } from '../lib/types';
import { computeModel } from '../lib/lbo-engine';
import { defaultModel } from '../lib/defaults';
import { generatePresetTranches, resetToMarketRates } from '../lib/deal-presets';

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_DEAL_FIELD'; field: string; value: unknown }
  | { type: 'SET_DEBT_TRANCHE'; trancheId: string; field: string; value: unknown }
  | { type: 'ADD_DEBT_TRANCHE'; tranche: DebtTranche }
  | { type: 'REMOVE_DEBT_TRANCHE'; trancheId: string }
  | { type: 'SET_YEARLY_OVERRIDE'; year: number; field: keyof YearlyOverrides; value: number | undefined }
  | { type: 'SET_COVENANT'; covenantId: string; field: string; value: unknown }
  | { type: 'ADD_COVENANT'; covenant: Covenant }
  | { type: 'REMOVE_COVENANT'; covenantId: string }
  | { type: 'SET_CIRCULAR'; value: boolean }
  | { type: 'SET_DEAL_TYPE'; dealType: DealType }
  | { type: 'APPLY_DEAL_PRESET' }
  | { type: 'RESET_MARKET_RATES' }
  | { type: 'SET_SECTION'; section: Section }
  | { type: 'RESET_MODEL' };

interface State {
  model: LBOModel;
  activeSection: Section;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DEAL_FIELD': {
      const deal = { ...state.model.deal, [action.field]: action.value };
      // Auto-calculate dependent fields
      if (action.field === 'entryEBITDA' || action.field === 'entryMultiple') {
        deal.enterpriseValue = deal.entryEBITDA * deal.entryMultiple;
      }
      if (action.field === 'entryEBITDA' || action.field === 'entryEBITDAMargin') {
        deal.entryRevenue = deal.entryEBITDAMargin > 0
          ? deal.entryEBITDA / (deal.entryEBITDAMargin / 100)
          : 0;
      }
      if (action.field === 'equityPct') {
        deal.debtPct = 100 - (action.value as number);
        // Auto-regenerate tranches when leverage changes (if deal type is set)
        if (deal.dealType) {
          const newTranches = generatePresetTranches(deal.dealType, deal.debtPct);
          return { ...state, model: { ...state.model, deal, debtTranches: newTranches } };
        }
      }
      if (action.field === 'debtPct') {
        deal.equityPct = 100 - (action.value as number);
      }
      if (action.field === 'linkExitToEntry' && action.value === true) {
        deal.exitMultiple = deal.entryMultiple;
      }
      return { ...state, model: { ...state.model, deal } };
    }

    case 'SET_DEBT_TRANCHE': {
      const debtTranches = state.model.debtTranches.map(t => {
        if (t.id !== action.trancheId) return t;
        const updated = { ...t, [action.field]: action.value };
        // Auto-toggle amount mode based on which field was edited
        if (action.field === 'amount') {
          updated.amountAsPctOfEV = false;
        }
        if (action.field === 'amountPct') {
          updated.amountAsPctOfEV = true;
        }
        return updated;
      });
      return { ...state, model: { ...state.model, debtTranches } };
    }

    case 'ADD_DEBT_TRANCHE':
      return {
        ...state,
        model: { ...state.model, debtTranches: [...state.model.debtTranches, action.tranche] },
      };

    case 'REMOVE_DEBT_TRANCHE':
      return {
        ...state,
        model: {
          ...state.model,
          debtTranches: state.model.debtTranches.filter(t => t.id !== action.trancheId),
        },
      };

    case 'SET_YEARLY_OVERRIDE': {
      const yearlyOverrides = { ...state.model.yearlyOverrides };
      if (!yearlyOverrides[action.year]) yearlyOverrides[action.year] = {};
      if (action.value === undefined) {
        delete yearlyOverrides[action.year]![action.field];
      } else {
        yearlyOverrides[action.year] = {
          ...yearlyOverrides[action.year],
          [action.field]: action.value,
        };
      }
      return { ...state, model: { ...state.model, yearlyOverrides } };
    }

    case 'SET_COVENANT': {
      const covenants = state.model.covenants.map(c =>
        c.id === action.covenantId ? { ...c, [action.field]: action.value } : c
      );
      return { ...state, model: { ...state.model, covenants } };
    }

    case 'ADD_COVENANT':
      return {
        ...state,
        model: { ...state.model, covenants: [...state.model.covenants, action.covenant] },
      };

    case 'REMOVE_COVENANT':
      return {
        ...state,
        model: {
          ...state.model,
          covenants: state.model.covenants.filter(c => c.id !== action.covenantId),
        },
      };

    case 'SET_CIRCULAR':
      return { ...state, model: { ...state.model, circularDebtSchedule: action.value } };

    case 'SET_DEAL_TYPE': {
      const deal = { ...state.model.deal, dealType: action.dealType };
      const newTranches = generatePresetTranches(action.dealType, deal.debtPct);
      return { ...state, model: { ...state.model, deal, debtTranches: newTranches } };
    }

    case 'APPLY_DEAL_PRESET': {
      const { deal } = state.model;
      const newTranches = generatePresetTranches(deal.dealType, deal.debtPct);
      return { ...state, model: { ...state.model, debtTranches: newTranches } };
    }

    case 'RESET_MARKET_RATES': {
      const updatedTranches = resetToMarketRates(state.model.debtTranches);
      return { ...state, model: { ...state.model, debtTranches: updatedTranches } };
    }

    case 'SET_SECTION':
      return { ...state, activeSection: action.section };

    case 'RESET_MODEL':
      return { model: structuredClone(defaultModel), activeSection: 'overview' };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ModelContextValue {
  model: LBOModel;
  outputs: LBOModelOutputs;
  activeSection: Section;
  dispatch: React.Dispatch<Action>;
}

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    model: structuredClone(defaultModel),
    activeSection: 'overview' as Section,
  });

  const outputs = useMemo(() => computeModel(state.model), [state.model]);

  const value = useMemo(
    () => ({ model: state.model, outputs, activeSection: state.activeSection, dispatch }),
    [state.model, outputs, state.activeSection, dispatch]
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error('useModel must be used within ModelProvider');
  return ctx;
}
