import { useState, useRef, useEffect, useCallback } from 'react';
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

/** Persisted scroll positions per session (survives component re-mounts within the same page session) */
const scrollPositions = new Map<string, number>();

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  /** Whether the initial scroll position has been restored for this session */
  const restoredRef = useRef(false);

  // Load messages from IndexedDB when session becomes active
  useEffect(() => {
    loadSessionMessages(sessionId);
  }, [sessionId, loadSessionMessages]);

  // Reset restored flag when sessionId changes (non-tab mode where component is reused)
  useEffect(() => {
    restoredRef.current = false;
  }, [sessionId]);

  // Restore saved scroll position once messages are loaded
  useEffect(() => {
    if (restoredRef.current) return;
    const el = scrollContainerRef.current;
    const msgCount = session?.messages?.length ?? 0;
    if (!el || msgCount === 0) return;

    const saved = scrollPositions.get(sessionId);
    if (saved != null) {
      // Use rAF to ensure DOM has rendered the messages before scrolling
      requestAnimationFrame(() => {
        el.scrollTop = saved;
        // Re-evaluate isNearBottom after restoring
        isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      });
    }
    // For sessions with no saved position (brand new), stay at bottom (default)
    restoredRef.current = true;
    prevMessageCountRef.current = msgCount;
  }, [sessionId, session?.messages]);

  // Track whether user is near the bottom & persist scroll position
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    scrollPositions.set(sessionId, el.scrollTop);
  }, [sessionId]);

  // Auto-scroll: only trigger on new messages (length change), not content updates
  const messageCount = session?.messages?.length ?? 0;

  useEffect(() => {
    if (!restoredRef.current) return;
    const isNewMessage = messageCount > prevMessageCountRef.current;
    prevMessageCountRef.current = messageCount;

    // When user sends a new message, always scroll to bottom
    if (isNewMessage && messageCount > 0) {
      const lastMsg = session!.messages[messageCount - 1];
      if (lastMsg.role === 'user') {
        isNearBottomRef.current = true;
      }
    }

    if (isNewMessage && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageCount]);

  // During streaming, keep scroll pinned to bottom without smooth animation
  useEffect(() => {
    if (!isNearBottomRef.current || !isLoading) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });

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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use session-level tools/skills if configured, otherwise fall back to global
      const effectiveTools = session?.sessionTools ?? enabledTools;
      const effectiveSkills = session?.sessionSkills ?? undefined;

      const systemPrompt = await runAgentLoop(
        content.trim(),
        sessionId,
        llmConfig,
        effectiveTools,
        callbacks,
        t,
        proxyUrl,
        toolExecutionTimeout,
        abortController.signal,
        session?.projectId,
        effectiveSkills,
      );
      // Save system prompt to session
      useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
    } catch (error) {
      // Don't show error message if user aborted
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error:', error);
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('chat.error', { error: error instanceof Error ? error.message : String(error) }),
        timestamp: Date.now(),
      });
    } finally {
      abortControllerRef.current = null;
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
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-end gap-2 px-3 py-1.5 pointer-events-none min-h-[36px]">
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
        {/* Bottom padding to prevent messages from being hidden behind floating input */}
        <div className="h-36" />
        <div ref={messagesEndRef} />
      </div>

      {session.sessionType === 'agent' ? (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-center text-xs text-muted-foreground">
          {t('sidebar.readOnly')}
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            onStop={handleStop}
          />
        </div>
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
