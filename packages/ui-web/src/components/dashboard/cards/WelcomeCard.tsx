import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { useDashboardContext } from '../DashboardContext';

export default function WelcomeCard() {
  const { t } = useTranslation();
  const { onStart, showStartButton } = useDashboardContext();
  const [, setStep] = useState(0);

  const handleStart = () => {
    setStep(1);
    onStart();
  };

  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground text-background mb-4 shadow-elegant-lg">
        <span className="text-3xl">🐰</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
        OpenBunny
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed mb-4">
        {t('status.subtitle')}
      </p>
      {showStartButton && (
        <div className="space-y-2">
          <Button
            onClick={handleStart}
            size="lg"
            className="px-8 py-5 text-base font-medium shadow-elegant-lg hover-lift"
          >
            {t('status.startButton')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('status.configHint')}
          </p>
        </div>
      )}
    </div>
  );
}
