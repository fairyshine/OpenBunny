import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Clock, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cronManager } from '@shared/services/cron';
import type { CronJob } from '@shared/services/cron';

interface CronViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScheduleType = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'custom';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// cron weekday: 1=MON ... 7=SUN
const WEEKDAY_CRON = [1, 2, 3, 4, 5, 6, 0];

function buildExpression(
  type: ScheduleType,
  interval: number,
  hour: number,
  minute: number,
  weekday: number,
  customExpr: string,
): string {
  switch (type) {
    case 'minutes':
      return `*/${interval} * * * *`;
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${WEEKDAY_CRON[weekday]}`;
    case 'custom':
      return customExpr.trim();
  }
}

export function CronViewer({ isOpen, onClose }: CronViewerProps) {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Schedule builder state
  const [scheduleType, setScheduleType] = useState<ScheduleType>('minutes');
  const [interval, setInterval_] = useState(5);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(0); // index into WEEKDAYS
  const [customExpr, setCustomExpr] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generatedExpression = useMemo(
    () => buildExpression(scheduleType, interval, hour, minute, weekday, customExpr),
    [scheduleType, interval, hour, minute, weekday, customExpr],
  );

  const refresh = useCallback(() => {
    setJobs(cronManager.list());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const unsub = cronManager.subscribe(refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { unsub(); clearInterval(timer); };
  }, [isOpen, refresh]);

  const resetForm = () => {
    setScheduleType('minutes');
    setInterval_(5);
    setHour(9);
    setMinute(0);
    setWeekday(0);
    setCustomExpr('');
    setDescription('');
    setError('');
    setShowAdvanced(false);
  };

  const handleAdd = () => {
    setError('');
    const desc = description.trim();
    if (!desc) {
      setError(t('tools.cron.addErrorDesc'));
      return;
    }
    const expr = generatedExpression;
    if (!expr) {
      setError(t('tools.cron.addErrorExpr'));
      return;
    }
    try {
      cronManager.add(expr, desc);
      resetForm();
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRemove = (id: string) => {
    cronManager.remove(id);
  };

  const handleClearAll = () => {
    cronManager.clear();
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);
  const intervalOptions = [1, 2, 3, 5, 10, 15, 20, 30];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('tools.cron.title')}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowAdd(!showAdd); if (showAdd) resetForm(); }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('tools.cron.add')}
            </Button>
          </div>
        </DialogHeader>

        {showAdd && (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            {/* Description */}
            <Input
              placeholder={t('tools.cron.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs"
            />

            {/* Schedule type tabs */}
            <div className="flex flex-wrap gap-1">
              {([
                { key: 'minutes' as ScheduleType, label: t('tools.cron.type.minutes') },
                { key: 'hourly' as ScheduleType, label: t('tools.cron.type.hourly') },
                { key: 'daily' as ScheduleType, label: t('tools.cron.type.daily') },
                { key: 'weekly' as ScheduleType, label: t('tools.cron.type.weekly') },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setScheduleType(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    scheduleType === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Schedule config based on type */}
            <div className="flex items-center gap-2 flex-wrap">
              {scheduleType === 'minutes' && (
                <>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.every')}</span>
                  <Select value={String(interval)} onValueChange={(v) => setInterval_(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {intervalOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.minutesUnit')}</span>
                </>
              )}

              {scheduleType === 'hourly' && (
                <>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.everyHourAt')}</span>
                  <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">:{pad(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {scheduleType === 'daily' && (
                <>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.dailyAt')}</span>
                  <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hourOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">{pad(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">:</span>
                  <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">{pad(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {scheduleType === 'weekly' && (
                <>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.weeklyOn')}</span>
                  <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                    <SelectTrigger className="h-7 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)} className="text-xs">{t(`tools.cron.weekday.${d}` as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{t('tools.cron.at')}</span>
                  <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hourOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">{pad(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">:</span>
                  <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v))}>
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((v) => (
                        <SelectItem key={v} value={String(v)} className="text-xs">{pad(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Advanced: custom expression toggle */}
            <button
              onClick={() => {
                setShowAdvanced(!showAdvanced);
                if (!showAdvanced) {
                  setScheduleType('custom');
                  setCustomExpr(generatedExpression);
                } else if (scheduleType === 'custom') {
                  setScheduleType('minutes');
                }
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {t('tools.cron.advanced')}
            </button>

            {showAdvanced && (
              <Input
                placeholder="* * * * *"
                value={scheduleType === 'custom' ? customExpr : generatedExpression}
                onChange={(e) => { setScheduleType('custom'); setCustomExpr(e.target.value); }}
                className="h-7 text-xs font-mono"
              />
            )}

            {/* Preview */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{generatedExpression}</code>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowAdd(false); resetForm(); }}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
                {t('tools.cron.add')}
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[60vh]">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t('tools.cron.empty')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('tools.cron.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{job.description}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(job.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t('tools.cron.schedule')}: <code className="bg-muted px-1 py-0.5 rounded">{job.expression}</code>
                    </span>
                    <span>{t('tools.cron.runCount')}: {job.runCount}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{t('tools.cron.nextRun')}: {formatTime(job.nextRun)}</span>
                    <span>{t('tools.cron.lastRun')}: {formatTime(job.lastRun)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {jobs.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge variant="secondary" className="text-xs">
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('tools.cron.clearAll')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
