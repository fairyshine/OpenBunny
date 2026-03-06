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
  const { sessions, addMessage, updateMessage, llmConfig, loadSessionMessages } = useSessionStore();
  const { enabledTools, proxyUrl, toolExecutionTimeout } = useSettingsStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const session = sessions.find((s) => s.id === sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from IndexedDB when session becomes active
  useEffect(() => {
    loadSessionMessages(sessionId);
  }, [sessionId, loadSessionMessages]);

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
      const systemPrompt = await runAgentLoop(
        content.trim(),
        sessionId,
        llmConfig,
        enabledTools,
        callbacks,
        t,
        proxyUrl,
        toolExecutionTimeout
      );
      // Save system prompt to session
      useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
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
      // Force-flush messages to IndexedDB after agent loop completes
      useSessionStore.getState().flushMessages(sessionId);
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
      <div className="flex-1 overflow-y-auto relative">
        <div className="sticky top-0 z-10 flex items-center justify-end gap-2 px-3 py-1.5 pointer-events-none">
          {currentStatus && (
            <Badge variant="secondary" className="animate-pulse pointer-events-auto shadow-sm">
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
                  className="h-8 w-8 pointer-events-auto opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.exportConversation')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <MessageList messages={session.messages} />
        <div ref={messagesEndRef} />
      </div>

      {session.sessionType === 'agent' ? (
        <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground bg-muted/30">
          {t('sidebar.readOnly')}
        </div>
      ) : (
        <ChatInput
          onSend={handleSendMessage}
          isLoading={isLoading}
          onStop={handleStop}
        />
      )}

      <ExportDialog
        messages={session.messages}
        systemPrompt={session.systemPrompt}
        sessionId={session.id}
        sessionName={session.name}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
