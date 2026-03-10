import { useState, useRef, useEffect } from 'react';
import { useScenarios } from '../context/ModelContext';
import { defaultModel } from '../lib/defaults';

export function ScenarioBar() {
  const { scenarios, activeScenarioId, compareMode, dispatch } = useScenarios();

  const handleAdd = () => {
    if (scenarios.length >= 6) return;
    const name = window.prompt('Scenario name (max 20 characters):', 'New Scenario');
    if (!name?.trim()) return;
    dispatch({
      type: 'ADD_SCENARIO',
      scenario: {
        id: `scenario-${Date.now()}`,
        name: name.trim().slice(0, 20),
        model: structuredClone(defaultModel),
      },
    });
  };

  return (
    <div className="h-10 min-h-10 w-full bg-bg-secondary border-b border-border flex items-center px-3 gap-1.5">
      <span className="text-[9px] text-text-muted uppercase tracking-widest mr-2 select-none">
        Scenarios
      </span>

      {/* Scenario tabs */}
      {scenarios.map(s => (
        <ScenarioTab
          key={s.id}
          id={s.id}
          name={s.name}
          isActive={s.id === activeScenarioId}
          onSwitch={() => dispatch({ type: 'SWITCH_SCENARIO', scenarioId: s.id })}
          onRename={(newName) => dispatch({ type: 'RENAME_SCENARIO', scenarioId: s.id, name: newName })}
          onDuplicate={() => dispatch({
            type: 'DUPLICATE_SCENARIO',
            sourceId: s.id,
            newId: `scenario-${Date.now()}`,
            newName: `${s.name} Copy`.slice(0, 20),
          })}
          onDelete={() => dispatch({ type: 'REMOVE_SCENARIO', scenarioId: s.id })}
          canDelete={scenarios.length > 1}
          canDuplicate={scenarios.length < 6}
        />
      ))}

      {/* Add button */}
      {scenarios.length < 6 && (
        <button
          onClick={handleAdd}
          className="scenario-tab"
          title="Add new scenario"
        >
          +
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Compare toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_COMPARE' })}
        className={`h-7 px-3 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          compareMode
            ? 'bg-accent-blue/20 border border-accent-blue/40 text-accent-blue'
            : 'border border-border text-text-muted hover:text-text-primary hover:border-text-muted'
        }`}
      >
        Compare
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioTabProps {
  id: string;
  name: string;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
  canDuplicate: boolean;
}

function ScenarioTab({
  name, isActive, onSwitch, onRename, onDuplicate, onDelete, canDelete, canDuplicate,
}: ScenarioTabProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleRename = () => {
    setMenuOpen(false);
    const newName = window.prompt('Rename scenario:', name);
    if (newName?.trim()) onRename(newName.trim().slice(0, 20));
  };

  const handleDuplicate = () => {
    setMenuOpen(false);
    onDuplicate();
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm(`Delete scenario "${name}"?`)) onDelete();
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center">
        <button
          onClick={onSwitch}
          className={`scenario-tab ${isActive ? 'active' : ''}`}
        >
          {name}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="h-7 px-1 text-text-muted hover:text-text-primary text-xs transition-colors"
          title="Scenario options"
        >
          ⋯
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="scenario-menu">
          <button onClick={handleRename}>Rename</button>
          {canDuplicate && <button onClick={handleDuplicate}>Duplicate</button>}
          {canDelete && (
            <button className="destructive" onClick={handleDelete}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}
