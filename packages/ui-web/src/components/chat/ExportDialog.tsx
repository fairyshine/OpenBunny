// 消息导出功能组件
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@openbunny/shared/types';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import type { ExportHistoryVariant, ExportOptions } from '@openbunny/shared/utils/messageHistory';
import { getEnabledTools } from '@openbunny/shared/services/ai/tools';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Download } from '../icons';

interface ExportDialogProps {
  messages: Message[];
  systemPrompt?: string;
  sessionId: string;
  sessionName: string;
  alternateHistories?: ExportHistoryVariant[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportDialog({ messages, systemPrompt, sessionId, sessionName, alternateHistories, isOpen, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<'json' | 'markdown' | 'text'>('markdown');
  const { enabledTools: enabledToolIds } = useAgentConfig();

  const exportOpts = useMemo((): ExportOptions => ({
    systemPrompt,
    sessionId,
    sessionName,
    tools: getEnabledTools(enabledToolIds),
    alternateHistories,
  }), [systemPrompt, sessionId, sessionName, enabledToolIds, alternateHistories]);

  const handleExport = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = MessageHistoryManager.exportToJSON(messages, exportOpts);
        filename = `conversation-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = MessageHistoryManager.exportToMarkdown(messages, exportOpts);
        filename = `conversation-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'text':
        content = MessageHistoryManager.exportToText(messages, exportOpts);
        filename = `conversation-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    onClose();
  };

  const rawPreview = useMemo(() => {
    switch (format) {
      case 'json':
        return MessageHistoryManager.exportToJSON(messages, exportOpts);
      case 'markdown':
        return MessageHistoryManager.exportToMarkdown(messages, exportOpts);
      case 'text':
        return MessageHistoryManager.exportToText(messages, exportOpts);
    }
  }, [format, messages, exportOpts]);

  const stats = MessageHistoryManager.getMessageStats(messages);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t('export.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-4 p-3 bg-muted rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">{t('export.totalMessages')}</div>
              <div className="text-lg font-bold">{stats.total}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('export.toolCalls')}</div>
              <div className="text-lg font-bold">{stats.toolCalls}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('export.estimatedTokens')}</div>
              <div className="text-lg font-bold">{stats.tokens}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('export.turns')}</div>
              <div className="text-lg font-bold">
                {MessageHistoryManager.getConversationTurns(messages).length}
              </div>
            </div>
          </div>

          {/* Format selector */}
          <Tabs value={format} onValueChange={(v) => setFormat(v as 'json' | 'markdown' | 'text')}>
            <TabsList>
              <TabsTrigger value="markdown" className="text-xs">Markdown</TabsTrigger>
              <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
              <TabsTrigger value="text" className="text-xs">{t('export.plainText')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Full raw preview — calc subtracts stats/tabs/footer/padding heights */}
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all text-foreground/80 rounded-lg border border-border overflow-y-auto max-h-[calc(85vh-320px)]">
            {rawPreview}
          </pre>

          {/* Footer */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              {t('common.download')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
