import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { consoleLogger, LogEntry, LogCategory, LogLevel } from '@shared/services/console/logger';
import { X } from '../icons';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';

interface ConsolePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEVEL_STYLES: Record<LogLevel, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  info:    { variant: 'default', label: 'INFO' },
  success: { variant: 'secondary', label: 'OK' },
  warning: { variant: 'outline', label: 'WARN' },
  error:   { variant: 'destructive', label: 'ERR' },
  debug:   { variant: 'outline', label: 'DBG' },
};

const CATEGORY_STYLES: Record<LogCategory, { label: string }> = {
  llm:      { label: 'LLM' },
  tool:     { label: 'TOOL' },
  file:     { label: 'FILE' },
  settings: { label: 'SET' },
  mcp:      { label: 'MCP' },
  python:   { label: 'PY' },
  system:   { label: 'SYS' },
};

const ALL_CATEGORIES: LogCategory[] = ['llm', 'tool', 'file', 'settings', 'mcp', 'python', 'system'];

export default function ConsolePanel({ isOpen, onClose }: ConsolePanelProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(consoleLogger.getLogs());
    const unsubscribe = consoleLogger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (autoScroll && isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isOpen]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filter !== 'all') {
      result = result.filter(log => log.category === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(q) ||
        (typeof log.details === 'string' && log.details.toLowerCase().includes(q))
      );
    }
    return result;
  }, [logs, filter, search]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const text = consoleLogger.exportText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openbunny-console-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);

  const formatDetails = (details: any): string => {
    if (details === undefined || details === null) return '';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col border-t border-border bg-card h-48 md:h-[280px]">
      <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 border-b border-border bg-muted/50 text-xs shrink-0">
        <span className="font-semibold mr-1 hidden sm:inline">{t('console.title')}</span>

        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className="h-6 px-2 text-xs"
        >
          {t('console.all')}
        </Button>
        {ALL_CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={filter === cat ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(cat)}
            className="h-6 px-1.5 md:px-2 text-xs"
            title={CATEGORY_STYLES[cat].label}
          >
            <span className="hidden sm:inline">{CATEGORY_STYLES[cat].label}</span>
            <span className="sm:hidden">{CATEGORY_STYLES[cat].label.slice(0, 1)}</span>
          </Button>
        ))}

        <div className="flex-1" />

        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('console.search')}
          className="w-20 md:w-32 h-6 text-xs"
        />

        <div className="flex items-center gap-1">
          <Switch
            checked={autoScroll}
            onCheckedChange={setAutoScroll}
            className="scale-75"
          />
          <span className="text-xs text-muted-foreground">{t('console.autoScroll')}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          className="h-6 px-2"
          title={t('console.exportLog')}
        >
          ↗
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => consoleLogger.clear()}
          className="h-6 px-2"
          title={t('console.clearLog')}
        >
          ⊘
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="font-mono text-xs leading-5 px-1">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground py-8">
              {t('console.noLogs')}
            </div>
          ) : (
            filteredLogs.map(log => {
              const levelStyle = LEVEL_STYLES[log.level];
              const catStyle = CATEGORY_STYLES[log.category];
              const hasDetails = log.details !== undefined && log.details !== null;
              const isExpanded = expandedIds.has(log.id);

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-1.5 px-2 py-0.5 hover:bg-muted/50 ${
                    log.level === 'error' ? 'bg-destructive/5' : ''
                  }`}
                >
                  <span className="text-muted-foreground shrink-0 select-none">
                    {formatTime(log.timestamp)}
                  </span>

                  <Badge variant={levelStyle.variant} className="shrink-0 text-[10px] px-1 py-0">
                    {levelStyle.label}
                  </Badge>

                  <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0">
                    {catStyle.label}
                  </Badge>

                  <span className="flex-1 min-w-0">
                    <span
                      className={`${hasDetails ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => hasDetails && toggleExpand(log.id)}
                    >
                      {log.message}
                      {hasDetails && (
                        <span className="text-muted-foreground ml-1">{isExpanded ? '▼' : '▶'}</span>
                      )}
                    </span>

                    {hasDetails && isExpanded && (
                      <pre className="mt-1 p-2 rounded bg-muted text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                        {formatDetails(log.details)}
                      </pre>
                    )}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-3 px-3 py-1 border-t border-border bg-muted/50 text-[10px] text-muted-foreground shrink-0">
        <span>{t('console.logCount', { count: filteredLogs.length })}</span>
        <span>{t('console.errorCount', { count: logs.filter(l => l.level === 'error').length })}</span>
        <span>{t('console.warningCount', { count: logs.filter(l => l.level === 'warning').length })}</span>
      </div>
    </div>
  );
}
