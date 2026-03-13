import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { heartbeatManager } from '@openbunny/shared/services/heartbeat';
import type { HeartbeatItem, HeartbeatInterval } from '@openbunny/shared/services/heartbeat';
import { getToolIcon } from '../ToolIcon';

interface HeartbeatViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTERVAL_OPTIONS: HeartbeatInterval[] = [30, 60, 120];

export function HeartbeatViewer({ isOpen, onClose }: HeartbeatViewerProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<HeartbeatItem[]>([]);
  const [interval, setInterval_] = useState<HeartbeatInterval>(60);
  const [newText, setNewText] = useState('');
  const [error, setError] = useState('');

  const HeartbeatIcon = getToolIcon('heartbeat');

  const refresh = useCallback(() => {
    setItems(heartbeatManager.list());
    setInterval_(heartbeatManager.getInterval());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const unsub = heartbeatManager.subscribe(refresh);
    return () => { unsub(); };
  }, [isOpen, refresh]);

  const handleAdd = () => {
    setError('');
    const text = newText.trim();
    if (!text) {
      setError(t('tools.heartbeat.addError'));
      return;
    }
    heartbeatManager.add(text);
    setNewText('');
  };

  const handleRemove = (id: string) => {
    heartbeatManager.remove(id);
  };

  const handleClearAll = () => {
    heartbeatManager.clear();
  };

  const handleIntervalChange = (value: string) => {
    const v = Number(value) as HeartbeatInterval;
    heartbeatManager.setInterval(v);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <HeartbeatIcon className="w-4 h-4" />
              {t('tools.heartbeat.title')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('tools.heartbeat.interval')}</span>
              <Select value={String(interval)} onValueChange={handleIntervalChange}>
                <SelectTrigger className="h-7 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((v) => (
                    <SelectItem key={v} value={String(v)} className="text-xs">
                      {v} {t('tools.heartbeat.intervalUnit')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Add form */}
        <div className="flex gap-2">
          <Input
            placeholder={t('tools.heartbeat.addPlaceholder')}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            className="h-8 text-xs flex-1"
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t('tools.heartbeat.add')}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <ScrollArea className="max-h-[60vh]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HeartbeatIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t('tools.heartbeat.empty')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('tools.heartbeat.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('tools.heartbeat.createdAt')}: {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(item.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {items.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge variant="secondary" className="text-xs">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('tools.heartbeat.clearAll')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
