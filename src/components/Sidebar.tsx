import { useModel } from '../context/ModelContext';
import type { Section } from '../lib/types';

const sections: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Deal Overview', icon: '◈' },
  { id: 'sources-uses', label: 'Sources & Uses', icon: '⇄' },
  { id: 'operating-model', label: 'Operating Model', icon: '▤' },
  { id: 'debt-schedule', label: 'Debt Schedule', icon: '▦' },
  { id: 'returns', label: 'Returns Analysis', icon: '◉' },
  { id: 'sensitivity', label: 'Sensitivity', icon: '▩' },
  { id: 'dashboard', label: 'Dashboard', icon: '◧' },
  { id: 'export', label: 'Export', icon: '↗' },
];

export function Sidebar() {
  const { activeSection, dispatch, model, outputs } = useModel();
  const currSymbol = model.deal.currency === 'GBP' ? '£' : '$';

  return (
    <div className="w-52 min-w-52 h-full bg-bg-secondary border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="text-xs font-semibold tracking-widest text-text-muted uppercase">LBO Model</div>
        <div className="text-sm font-bold text-text-primary mt-1 truncate">{model.deal.companyName}</div>
        <div className="text-xs text-text-muted mt-0.5">{model.deal.sector}</div>
      </div>

      {/* Quick stats */}
      <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-text-muted uppercase tracking-wider">EV</div>
          <div className="text-xs font-mono font-semibold text-text-primary">
            {currSymbol}{outputs.sourcesUses.purchasePrice.toFixed(1)}m
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-muted uppercase tracking-wider">IRR</div>
          <div className={`text-xs font-mono font-semibold ${outputs.returns.sponsor.irr >= 20 ? 'text-positive' : outputs.returns.sponsor.irr >= 15 ? 'text-warning' : 'text-negative'}`}>
            {outputs.returns.sponsor.irr.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-muted uppercase tracking-wider">MoM</div>
          <div className="text-xs font-mono font-semibold text-text-primary">
            {outputs.returns.sponsor.mom.toFixed(2)}×
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-muted uppercase tracking-wider">Hold</div>
          <div className="text-xs font-mono font-semibold text-text-primary">
            {model.deal.holdPeriod}yr
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => dispatch({ type: 'SET_SECTION', section: s.id })}
            className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors border-l-2 ${
              activeSection === s.id
                ? 'bg-bg-tertiary text-text-primary border-accent-blue font-semibold'
                : 'text-text-secondary border-transparent hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <span className="text-sm opacity-60">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => dispatch({ type: 'RESET_MODEL' })}
          className="w-full text-[10px] text-text-muted hover:text-accent-red uppercase tracking-wider py-1 transition-colors"
        >
          Reset to Default
        </button>
      </div>
    </div>
  );
}
