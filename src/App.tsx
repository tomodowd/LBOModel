import { useState, useCallback } from 'react';
import { ModelProvider, useModel, useScenarios } from './context/ModelContext';
import { Sidebar } from './components/Sidebar';
import { ScenarioBar } from './components/ScenarioBar';
import { CompareView } from './components/CompareView';
import { DealOverview } from './components/sections/DealOverview';
import { SourcesUses } from './components/sections/SourcesUses';
import { OperatingModel } from './components/sections/OperatingModel';
import { DebtSchedule } from './components/sections/DebtSchedule';
import { ReturnsAnalysis } from './components/sections/ReturnsAnalysis';
import { SensitivityAnalysis } from './components/sections/SensitivityAnalysis';
import { Dashboard } from './components/sections/Dashboard';
import { Export } from './components/sections/Export';
import { exportToExcel } from './lib/excel-export';

function DemoBanner() {
  const { isDemo } = useScenarios();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  return (
    <div className="bg-accent-blue/10 border-b border-accent-blue/30 px-4 py-2 flex items-center justify-between text-xs">
      <span className="text-text-secondary">
        <span className="mr-1.5">&#x1F4CA;</span>
        Demo deal pre-loaded — edit any input to build your own model
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-text-muted hover:text-text-primary ml-4 text-sm leading-none"
        aria-label="Dismiss"
      >
        &#x2715;
      </button>
    </div>
  );
}

function HeaderActions() {
  const { model, outputs } = useModel();
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleExcel = useCallback(() => {
    exportToExcel(model, outputs);
  }, [model, outputs]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExcel}
        className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-accent-green/15 border border-accent-green/40 text-accent-green hover:bg-accent-green/25 transition-colors"
      >
        &#x2193; Export Excel
      </button>
      <button
        onClick={copyLink}
        className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-accent-blue/15 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/25 transition-colors"
      >
        {copied ? '\u2713 Copied!' : '\u{1F4CB} Copy Link'}
      </button>
    </div>
  );
}

function AppContent() {
  const { activeSection } = useModel();
  const { compareMode } = useScenarios();

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <DealOverview />;
      case 'sources-uses': return <SourcesUses />;
      case 'operating-model': return <OperatingModel />;
      case 'debt-schedule': return <DebtSchedule />;
      case 'returns': return <ReturnsAnalysis />;
      case 'sensitivity': return <SensitivityAnalysis />;
      case 'dashboard': return <Dashboard />;
      case 'export': return <Export />;
      default: return <DealOverview />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <DemoBanner />
      <ScenarioBar headerActions={<HeaderActions />} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {compareMode ? <CompareView /> : renderSection()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ModelProvider>
      <AppContent />
    </ModelProvider>
  );
}

export default App;
