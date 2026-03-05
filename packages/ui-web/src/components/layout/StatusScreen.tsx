import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileCode, Globe, Calculator, FolderOpen } from '../icons';

interface StatusScreenProps {
  onStart: () => void;
  showStartButton?: boolean;
}

export default function StatusScreen({ onStart, showStartButton = true }: StatusScreenProps) {
  const { t } = useTranslation();
  const [, setStep] = useState(0);

  const features: { icon: ReactNode; title: string; description: string }[] = [
    {
      icon: <FileCode className="w-7 h-7" />,
      title: t('status.feature.python.title'),
      description: t('status.feature.python.desc'),
    },
    {
      icon: <Globe className="w-7 h-7" />,
      title: t('status.feature.search.title'),
      description: t('status.feature.search.desc'),
    },
    {
      icon: <Calculator className="w-7 h-7" />,
      title: t('status.feature.calc.title'),
      description: t('status.feature.calc.desc'),
    },
    {
      icon: <FolderOpen className="w-7 h-7" />,
      title: t('status.feature.file.title'),
      description: t('status.feature.file.desc'),
    },
  ];

  const handleStart = () => {
    setStep(1);
    onStart();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-6 sm:p-8 gradient-bg">
      <div className="max-w-3xl w-full animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-foreground text-background mb-6 shadow-elegant-lg">
            <span className="text-4xl">🐰</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
            CyberBunny
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t('status.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-elegant hover-lift transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="mb-3 text-foreground/80">{feature.icon}</div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* CTA */}
        {showStartButton && (
          <div className="text-center space-y-4">
            <Button
              onClick={handleStart}
              size="lg"
              className="px-10 py-6 text-base font-medium shadow-elegant-lg hover-lift"
            >
              {t('status.startButton')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('status.configHint')}
            </p>
          </div>
        )}

        {/* Quick Tips */}
        <div className={`${showStartButton ? 'mt-12' : 'mt-0'} p-6 rounded-lg border-elegant bg-muted/30`}>
          <p className="text-sm font-medium mb-3 text-foreground">
            {t('status.quickStart')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono text-xs border-elegant">
              {t('status.badge.python')}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs border-elegant">
              {t('status.badge.search')}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs border-elegant">
              {t('status.badge.calc')}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs border-elegant">
              {t('status.badge.file')}
            </Badge>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
