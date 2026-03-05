import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { Message } from '@shared/types';
import { logLLM } from '@shared/services/console/logger';
import { runAgentLoop } from '@shared/services/ai/agent';
import type { AgentCallbacks } from '@shared/services/ai/agent';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ExportDialog from './ExportDialog';
import ToolBar from '../layout/ToolBar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download } from '../icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ChatContainerProps {
  sessionId: string;
}

export default function ChatContainer({ sessionId }: ChatContainerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { sessions, addMessage, updateMessage, llmConfig } = useSessionStore();
  const { enabledTools, proxyUrl, toolExecutionTimeout } = useSettingsStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const session = sessions.find((s) => s.id === sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, currentStatus]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setCurrentStatus('');
    useSessionStore.getState().setSessionStreaming(sessionId, false);
    addMessage(sessionId, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: t('chat.stopped'),
      timestamp: Date.now(),
    });
  };

  const callbacks: AgentCallbacks = {
    addMessage,
    updateMessage,
    setStatus: setCurrentStatus,
    generateId: () => crypto.randomUUID(),
    streamToolOutput: (sessionId, msgId, chunk) => {
      const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;
      const message = session.messages.find(m => m.id === msgId);
      if (!message) return;
      updateMessage(sessionId, msgId, {
        content: (message.content || '') + chunk,
        toolOutput: (message.toolOutput || '') + chunk,
      });
    },
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMessage);

    // Auto-rename session with first user message (max 50 chars)
    if (session && session.messages.length === 0) {
      const sessionName = content.trim().slice(0, 50);
      useSessionStore.getState().renameSession(sessionId, sessionName);
    }

    setIsLoading(true);
    setCurrentStatus('');
    useSessionStore.getState().setSessionStreaming(sessionId, true);
    logLLM('info', `User message: ${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}`);

    try {
      await runAgentLoop(
        content.trim(),
        sessionId,
        llmConfig,
        enabledTools,
        callbacks,
        t,
        proxyUrl,
        toolExecutionTimeout
      );
    } catch (error) {
      console.error('Error:', error);
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('chat.error', { error: error instanceof Error ? error.message : String(error) }),
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
      setCurrentStatus('');
      useSessionStore.getState().setSessionStreaming(sessionId, false);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>{t('chat.sessionNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ToolBar />

        <div className="flex items-center gap-2">
          {currentStatus && (
            <Badge variant="secondary" className="animate-pulse">
              {currentStatus}
            </Badge>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowExportDialog(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.exportConversation')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MessageList messages={session.messages} />
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        onStop={handleStop}
      />

      <ExportDialog
        messages={session.messages}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
