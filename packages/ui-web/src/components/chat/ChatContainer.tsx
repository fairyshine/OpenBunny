import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore } from '@openbunny/shared/stores/agent';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { useWorkspaceSession } from '../../hooks/useWorkspaceSession';
import { Message } from '@openbunny/shared/types';
import { logLLM } from '@openbunny/shared/services/console/logger';
import { runAgentLoop } from '@openbunny/shared/services/ai/agent';
import { createAssistantMessage, createUserMessage } from '@openbunny/shared/services/ai/messageFactory';
import { stopMindConversation } from '@openbunny/shared/services/ai/mind';
import { stopChatConversation } from '@openbunny/shared/services/ai/chat';
import type { AgentCallbacks } from '@openbunny/shared/services/ai/agent';
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
  const globalSessions = useSessionStore((s) => s.sessions);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateMessage = useSessionStore((s) => s.updateMessage);
  const loadSessionMessages = useSessionStore((s) => s.loadSessionMessages);
  const setSessionStreaming = useSessionStore((s) => s.setSessionStreaming);
  const addAgentMessage = useAgentStore((s) => s.addAgentMessage);
  const updateAgentMessage = useAgentStore((s) => s.updateAgentMessage);
  const loadAgentSessionMessages = useAgentStore((s) => s.loadAgentSessionMessages);
  const renameAgentSession = useAgentStore((s) => s.renameAgentSession);
  const setAgentSessionStreaming = useAgentStore((s) => s.setAgentSessionStreaming);
  const setAgentSessionSystemPrompt = useAgentStore((s) => s.setAgentSessionSystemPrompt);
  const flushAgentMessages = useAgentStore((s) => s.flushAgentMessages);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const { currentAgentId, isDefaultAgent, sessions } = useWorkspaceSession();
  const { llmConfig, enabledTools, enabledSkills } = useAgentConfig();
  const { proxyUrl, toolExecutionTimeout } = useSettingsStore();
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
    if (isDefaultAgent) {
      loadSessionMessages(sessionId);
    } else {
      loadAgentSessionMessages(currentAgentId, sessionId);
    }
  }, [currentAgentId, isDefaultAgent, loadAgentSessionMessages, loadSessionMessages, sessionId]);

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
    if (isDefaultAgent) {
      useSessionStore.getState().setSessionStreaming(sessionId, false);
      addMessage(sessionId, createAssistantMessage(t('chat.stopped'), { id: crypto.randomUUID() }));
      return;
    }

    setAgentSessionStreaming(currentAgentId, sessionId, false);
    addAgentMessage(currentAgentId, sessionId, createAssistantMessage(t('chat.stopped'), { id: crypto.randomUUID() }));
  };


  const handleStopMind = useCallback(() => {
    if (session?.sessionType !== 'mind' || !session.isStreaming) return;

    if (isDefaultAgent) {
      setSessionStreaming(session.id, false);
    } else {
      setAgentSessionStreaming(currentAgentId, session.id, false);
    }

    stopMindConversation(session.id);
  }, [currentAgentId, isDefaultAgent, session, setAgentSessionStreaming, setSessionStreaming]);

  const handleStopAgent = useCallback(() => {
    if (session?.sessionType !== 'agent' || !session.isStreaming) return;

    if (isDefaultAgent) {
      setSessionStreaming(session.id, false);
    } else {
      setAgentSessionStreaming(currentAgentId, session.id, false);
    }

    stopChatConversation(session.id);
  }, [currentAgentId, isDefaultAgent, session, setAgentSessionStreaming, setSessionStreaming]);

  const appendMessage = useCallback((targetSessionId: string, message: Message) => {
    if (isDefaultAgent) {
      addMessage(targetSessionId, message);
    } else {
      addAgentMessage(currentAgentId, targetSessionId, message);
    }
  }, [addAgentMessage, addMessage, currentAgentId, isDefaultAgent]);

  const patchMessage = useCallback((targetSessionId: string, messageId: string, updates: Partial<Message>) => {
    if (isDefaultAgent) {
      updateMessage(targetSessionId, messageId, updates);
    } else {
      updateAgentMessage(currentAgentId, targetSessionId, messageId, updates);
    }
  }, [currentAgentId, isDefaultAgent, updateAgentMessage, updateMessage]);

  const readSession = useCallback((targetSessionId: string) => {
    const sourceSessions = isDefaultAgent ? globalSessions : (agentSessions[currentAgentId] || []);
    return sourceSessions.find((candidate) => candidate.id === targetSessionId);
  }, [agentSessions, currentAgentId, globalSessions, isDefaultAgent]);

  const callbacks: AgentCallbacks = {
    addMessage: appendMessage,
    updateMessage: patchMessage,
    setStatus: setCurrentStatus,
    generateId: () => crypto.randomUUID(),
    streamToolOutput: (targetSessionId, msgId, chunk) => {
      const targetSession = readSession(targetSessionId);
      if (!targetSession) return;
      const message = targetSession.messages.find(m => m.id === msgId);
      if (!message) return;
      patchMessage(targetSessionId, msgId, {
        content: (message.content || '') + chunk,
        toolOutput: (message.toolOutput || '') + chunk,
      });
    },
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = createUserMessage(content.trim(), { id: crypto.randomUUID() });
    appendMessage(sessionId, userMessage);

    // Auto-rename session with first user message (max 50 chars)
    if (session && session.messages.length === 0) {
      const sessionName = content.trim().slice(0, 50);
      if (isDefaultAgent) {
        useSessionStore.getState().renameSession(sessionId, sessionName);
      } else {
        renameAgentSession(currentAgentId, sessionId, sessionName);
      }
    }

    setIsLoading(true);
    setCurrentStatus('');
    if (isDefaultAgent) {
      useSessionStore.getState().setSessionStreaming(sessionId, true);
    } else {
      setAgentSessionStreaming(currentAgentId, sessionId, true);
    }
    logLLM('info', `User message: ${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}`);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use session-level tools/skills if configured, otherwise fall back to agent config
      const effectiveTools = session?.sessionTools ?? enabledTools;
      const effectiveSkills = session?.sessionSkills ?? enabledSkills;

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
      if (isDefaultAgent) {
        useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
      } else {
        setAgentSessionSystemPrompt(currentAgentId, sessionId, systemPrompt);
      }
    } catch (error) {
      // Don't show error message if user aborted
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error:', error);
      if (!(error && typeof error === 'object' && '__openbunnyHandled' in error)) {
        appendMessage(sessionId, createAssistantMessage(
          t('chat.error', { error: error instanceof Error ? error.message : String(error) }),
          { id: crypto.randomUUID() },
        ));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setCurrentStatus('');
      if (isDefaultAgent) {
        useSessionStore.getState().setSessionStreaming(sessionId, false);
        useSessionStore.getState().flushMessages(sessionId);
      } else {
        setAgentSessionStreaming(currentAgentId, sessionId, false);
        flushAgentMessages(currentAgentId, sessionId);
      }
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
          {session?.interruptedAt && !session.isStreaming && !isLoading && (
            <Badge variant="outline" className="pointer-events-auto border-amber-500/40 text-amber-700 dark:text-amber-300">
              {t('chat.interrupted')}
            </Badge>
          )}
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
        <MessageList messages={session.messages} session={session} />
        {/* Bottom padding to prevent messages from being hidden behind floating input */}
        <div className="h-36" />
        <div ref={messagesEndRef} />
      </div>

      {session.sessionType === 'mind' ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3">
          <div className="flex items-center justify-center gap-3 rounded-lg border bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <span>{t('sidebar.readOnly')}</span>
            <Button
              onClick={handleStopMind}
              size="sm"
              variant={session.isStreaming ? 'destructive' : 'outline'}
              disabled={!session.isStreaming}
            >
              {t('chat.input.stop')}
            </Button>
          </div>
        </div>
      ) : session.sessionType === 'agent' ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3">
          <div className="flex items-center justify-center gap-3 rounded-lg border bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <span>{t('sidebar.readOnly')}</span>
            <Button
              onClick={handleStopAgent}
              size="sm"
              variant={session.isStreaming ? 'destructive' : 'outline'}
              disabled={!session.isStreaming}
            >
              {t('chat.input.stop')}
            </Button>
          </div>
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
        alternateHistories={session.sessionType === 'mind' && session.mindSession ? [
          {
            title: t('export.mindAssistantHistory'),
            systemPrompt: session.mindSession.assistantHistory?.systemPrompt || session.systemPrompt,
            messages: session.mindSession.assistantHistory?.messages || [],
            rawData: session.mindSession.assistantHistory,
          },
          {
            title: t('export.mindUserHistory'),
            systemPrompt: session.mindSession.userHistory?.systemPrompt || session.mindSession.userSystemPrompt,
            messages: session.mindSession.userHistory?.messages || [],
            rawData: session.mindSession.userHistory,
          },
        ] : undefined}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
