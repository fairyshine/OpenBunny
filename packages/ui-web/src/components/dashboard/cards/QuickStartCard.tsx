import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Play, Settings2, Sparkles, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useDashboardContext } from '../DashboardContext';
import { openSettingsModal } from '../../settings/settingsModalEvents';
import { useAgentConfig } from '../../../hooks/useAgentConfig';

export default function QuickStartCard() {
  const { t } = useTranslation();
  const { llmConfig, enabledTools } = useAgentConfig();
  const { onStart, showStartButton } = useDashboardContext();
  const [open, setOpen] = useState(false);

  const hasModelConfig = Boolean(llmConfig.provider && llmConfig.model && llmConfig.apiKey);
  const hasEnabledTools = enabledTools.length > 0;

  const steps = [
    {
      id: 'model',
      title: t('status.quickStart.step.model.title'),
      description: hasModelConfig
        ? t('status.quickStart.step.model.ready', { provider: llmConfig.provider, model: llmConfig.model })
        : t('status.quickStart.step.model.pending'),
      ready: hasModelConfig,
    },
    {
      id: 'tools',
      title: t('status.quickStart.step.tools.title'),
      description: hasEnabledTools
        ? t('status.quickStart.step.tools.ready', { count: enabledTools.length })
        : t('status.quickStart.step.tools.pending'),
      ready: hasEnabledTools,
    },
    {
      id: 'chat',
      title: t('status.quickStart.step.chat.title'),
      description: showStartButton
        ? t('status.quickStart.step.chat.ready')
        : t('status.quickStart.step.chat.hidden'),
      ready: showStartButton,
    },
  ];
  const readyCount = steps.filter((step) => step.ready).length;

  return (
    <>
      <button
        type="button"
        className="flex h-full w-full flex-col justify-between rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/35"
        onClick={() => setOpen(true)}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t('status.quickStart.kicker')}
            </p>
            <span className="rounded-full bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
              {t('status.quickStart.progress', { ready: readyCount, total: steps.length })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {steps.map((step) => (
              <span
                key={step.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                  step.ready
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'bg-background text-muted-foreground'
                }`}
              >
                {step.ready && <CheckCircle2 className="h-3 w-3" />}
                {step.title}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            {t('status.quickStart.viewDetails')}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('status.quickStart')}</DialogTitle>
            <DialogDescription>{t('status.quickStart.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      0{index + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        step.ready
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.ready && <CheckCircle2 className="h-3 w-3" />}
                      {t(step.ready ? 'status.quickStart.ready' : 'status.quickStart.pending')}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap gap-2">
                {showStartButton && (
                  <Button size="sm" className="shadow-sm" onClick={onStart}>
                    <Play className="h-3.5 w-3.5" />
                    {t('status.quickStart.action.start')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openSettingsModal('llm')}>
                  <Settings2 className="h-3.5 w-3.5" />
                  {t('status.quickStart.action.settings')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openSettingsModal('tools')}>
                  <Wrench className="h-3.5 w-3.5" />
                  {t('status.quickStart.action.tools')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openSettingsModal('skills')}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('status.quickStart.action.skills')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
