import { DashboardContext } from '../dashboard/DashboardContext';
import DashboardToolbar from '../dashboard/DashboardToolbar';
import Dashboard from '../dashboard/Dashboard';

interface StatusScreenProps {
  onStart: () => void;
  showStartButton?: boolean;
}

export default function StatusScreen({ onStart, showStartButton = true }: StatusScreenProps) {
  return (
    <DashboardContext.Provider value={{ onStart, showStartButton }}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full p-4 sm:p-6 gradient-bg">
          <div className="max-w-6xl mx-auto animate-fade-in relative">
            <DashboardToolbar />
            <Dashboard />
          </div>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
