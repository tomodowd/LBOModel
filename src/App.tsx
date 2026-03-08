import { ModelProvider, useModel } from './context/ModelContext';
import { Sidebar } from './components/Sidebar';
import { DealOverview } from './components/sections/DealOverview';
import { SourcesUses } from './components/sections/SourcesUses';
import { OperatingModel } from './components/sections/OperatingModel';
import { DebtSchedule } from './components/sections/DebtSchedule';
import { ReturnsAnalysis } from './components/sections/ReturnsAnalysis';
import { SensitivityAnalysis } from './components/sections/SensitivityAnalysis';
import { Dashboard } from './components/sections/Dashboard';
import { Export } from './components/sections/Export';

function AppContent() {
  const { activeSection } = useModel();

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
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderSection()}
      </main>
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
