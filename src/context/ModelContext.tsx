import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import type {
  LBOModel, LBOModelOutputs, Section, DebtTranche, Covenant,
  YearlyOverrides, DealType, Scenario, ScenarioWithOutputs,
} from '../lib/types';
import { computeModel } from '../lib/lbo-engine';
import { defaultModel, createDefaultScenarios } from '../lib/defaults';
import { generatePresetTranches, resetToMarketRates } from '../lib/deal-presets';

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  // Existing model actions (operate on active scenario's model)
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
  | { type: 'RESET_MODEL' }
  // Navigation
  | { type: 'SET_SECTION'; section: Section }
  // Scenario actions
  | { type: 'SWITCH_SCENARIO'; scenarioId: string }
  | { type: 'ADD_SCENARIO'; scenario: Scenario }
  | { type: 'REMOVE_SCENARIO'; scenarioId: string }
  | { type: 'RENAME_SCENARIO'; scenarioId: string; name: string }
  | { type: 'DUPLICATE_SCENARIO'; sourceId: string; newId: string; newName: string }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'RESET_SCENARIOS' };

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  scenarios: Scenario[];
  activeScenarioId: string;
  activeSection: Section;
  compareMode: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: update the active scenario's model
// ─────────────────────────────────────────────────────────────────────────────

function updateActiveModel(state: State, updater: (model: LBOModel) => LBOModel): State {
  return {
    ...state,
    scenarios: state.scenarios.map(s =>
      s.id === state.activeScenarioId
        ? { ...s, model: updater(s.model) }
        : s
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {

    // ── Model mutations (all via updateActiveModel) ──────────────────────

    case 'SET_DEAL_FIELD':
      return updateActiveModel(state, model => {
        const deal = { ...model.deal, [action.field]: action.value };
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
          if (deal.dealType) {
            const newTranches = generatePresetTranches(deal.dealType, deal.debtPct);
            return { ...model, deal, debtTranches: newTranches };
          }
        }
        if (action.field === 'debtPct') {
          deal.equityPct = 100 - (action.value as number);
        }
        if (action.field === 'linkExitToEntry' && action.value === true) {
          deal.exitMultiple = deal.entryMultiple;
        }
        return { ...model, deal };
      });

    case 'SET_DEBT_TRANCHE':
      return updateActiveModel(state, model => {
        const debtTranches = model.debtTranches.map(t => {
          if (t.id !== action.trancheId) return t;
          const updated = { ...t, [action.field]: action.value };
          if (action.field === 'amount') updated.amountAsPctOfEV = false;
          if (action.field === 'amountPct') updated.amountAsPctOfEV = true;
          return updated;
        });
        return { ...model, debtTranches };
      });

    case 'ADD_DEBT_TRANCHE':
      return updateActiveModel(state, model => ({
        ...model,
        debtTranches: [...model.debtTranches, action.tranche],
      }));

    case 'REMOVE_DEBT_TRANCHE':
      return updateActiveModel(state, model => ({
        ...model,
        debtTranches: model.debtTranches.filter(t => t.id !== action.trancheId),
      }));

    case 'SET_YEARLY_OVERRIDE':
      return updateActiveModel(state, model => {
        const yearlyOverrides = { ...model.yearlyOverrides };
        if (!yearlyOverrides[action.year]) yearlyOverrides[action.year] = {};
        if (action.value === undefined) {
          delete yearlyOverrides[action.year]![action.field];
        } else {
          yearlyOverrides[action.year] = {
            ...yearlyOverrides[action.year],
            [action.field]: action.value,
          };
        }
        return { ...model, yearlyOverrides };
      });

    case 'SET_COVENANT':
      return updateActiveModel(state, model => ({
        ...model,
        covenants: model.covenants.map(c =>
          c.id === action.covenantId ? { ...c, [action.field]: action.value } : c
        ),
      }));

    case 'ADD_COVENANT':
      return updateActiveModel(state, model => ({
        ...model,
        covenants: [...model.covenants, action.covenant],
      }));

    case 'REMOVE_COVENANT':
      return updateActiveModel(state, model => ({
        ...model,
        covenants: model.covenants.filter(c => c.id !== action.covenantId),
      }));

    case 'SET_CIRCULAR':
      return updateActiveModel(state, model => ({
        ...model,
        circularDebtSchedule: action.value,
      }));

    case 'SET_DEAL_TYPE':
      return updateActiveModel(state, model => {
        const deal = { ...model.deal, dealType: action.dealType };
        const newTranches = generatePresetTranches(action.dealType, deal.debtPct);
        return { ...model, deal, debtTranches: newTranches };
      });

    case 'APPLY_DEAL_PRESET':
      return updateActiveModel(state, model => {
        const newTranches = generatePresetTranches(model.deal.dealType, model.deal.debtPct);
        return { ...model, debtTranches: newTranches };
      });

    case 'RESET_MARKET_RATES':
      return updateActiveModel(state, model => ({
        ...model,
        debtTranches: resetToMarketRates(model.debtTranches),
      }));

    case 'RESET_MODEL':
      return updateActiveModel(state, () => structuredClone(defaultModel));

    // ── Navigation ───────────────────────────────────────────────────────

    case 'SET_SECTION':
      return { ...state, activeSection: action.section };

    // ── Scenario actions ─────────────────────────────────────────────────

    case 'SWITCH_SCENARIO':
      return { ...state, activeScenarioId: action.scenarioId };

    case 'ADD_SCENARIO': {
      if (state.scenarios.length >= 6) return state;
      return { ...state, scenarios: [...state.scenarios, action.scenario] };
    }

    case 'REMOVE_SCENARIO': {
      if (state.scenarios.length <= 1) return state;
      const filtered = state.scenarios.filter(s => s.id !== action.scenarioId);
      const newActiveId = state.activeScenarioId === action.scenarioId
        ? filtered[0].id
        : state.activeScenarioId;
      return { ...state, scenarios: filtered, activeScenarioId: newActiveId };
    }

    case 'RENAME_SCENARIO':
      return {
        ...state,
        scenarios: state.scenarios.map(s =>
          s.id === action.scenarioId
            ? { ...s, name: action.name.slice(0, 20) }
            : s
        ),
      };

    case 'DUPLICATE_SCENARIO': {
      if (state.scenarios.length >= 6) return state;
      const source = state.scenarios.find(s => s.id === action.sourceId);
      if (!source) return state;
      const newScenario: Scenario = {
        id: action.newId,
        name: action.newName.slice(0, 20),
        model: structuredClone(source.model),
      };
      return { ...state, scenarios: [...state.scenarios, newScenario] };
    }

    case 'TOGGLE_COMPARE':
      return { ...state, compareMode: !state.compareMode };

    case 'RESET_SCENARIOS': {
      const defaults = createDefaultScenarios();
      return {
        ...state,
        scenarios: defaults,
        activeScenarioId: defaults[0].id,
        compareMode: false,
      };
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage persistence
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lbo-scenarios';

function loadInitialState(): State {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0 && parsed.activeScenarioId) {
        return {
          scenarios: parsed.scenarios,
          activeScenarioId: parsed.activeScenarioId,
          activeSection: 'overview' as Section,
          compareMode: false,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  const defaults = createDefaultScenarios();
  return {
    scenarios: defaults,
    activeScenarioId: defaults[0].id,
    activeSection: 'overview' as Section,
    compareMode: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────────

interface ModelContextValue {
  model: LBOModel;
  outputs: LBOModelOutputs;
  activeSection: Section;
  dispatch: React.Dispatch<Action>;
}

interface ScenarioContextValue {
  scenarios: Scenario[];
  activeScenarioId: string;
  compareMode: boolean;
  allOutputs: ScenarioWithOutputs[];
  dispatch: React.Dispatch<Action>;
}

const ModelContext = createContext<ModelContextValue | null>(null);
const ScenarioContext = createContext<ScenarioContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  const activeScenario = state.scenarios.find(s => s.id === state.activeScenarioId)!;
  const outputs = useMemo(() => computeModel(activeScenario.model), [activeScenario.model]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
      }));
    } catch {
      // Ignore quota errors
    }
  }, [state.scenarios, state.activeScenarioId]);

  // Compute all scenario outputs for compare mode
  const allOutputs = useMemo<ScenarioWithOutputs[]>(() => {
    if (!state.compareMode) return [];
    return state.scenarios.map(s => ({
      ...s,
      outputs: computeModel(s.model),
    }));
  }, [state.compareMode, state.scenarios]);

  const modelValue = useMemo(
    () => ({
      model: activeScenario.model,
      outputs,
      activeSection: state.activeSection,
      dispatch,
    }),
    [activeScenario.model, outputs, state.activeSection, dispatch]
  );

  const scenarioValue = useMemo(
    () => ({
      scenarios: state.scenarios,
      activeScenarioId: state.activeScenarioId,
      compareMode: state.compareMode,
      allOutputs,
      dispatch,
    }),
    [state.scenarios, state.activeScenarioId, state.compareMode, allOutputs, dispatch]
  );

  return (
    <ScenarioContext.Provider value={scenarioValue}>
      <ModelContext.Provider value={modelValue}>
        {children}
      </ModelContext.Provider>
    </ScenarioContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useModel(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error('useModel must be used within ModelProvider');
  return ctx;
}

export function useScenarios(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenarios must be used within ModelProvider');
  return ctx;
}
