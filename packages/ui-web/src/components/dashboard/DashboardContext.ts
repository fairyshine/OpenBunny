import { createContext, useContext } from 'react';

interface DashboardContextValue {
  onStart: () => void;
  showStartButton: boolean;
}

export const DashboardContext = createContext<DashboardContextValue>({
  onStart: () => {},
  showStartButton: true,
});

export function useDashboardContext() {
  return useContext(DashboardContext);
}
