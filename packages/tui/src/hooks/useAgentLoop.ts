import { useState, useCallback, useRef } from 'react';
import type { LLMConfig, Message, Session } from '@openbunny/shared/types';
import { runAgentLoop } from '@openbunny/shared/services/ai';
import { stopChatConversation } from '@openbunny/shared/services/ai/chat';
import {
  createAssistantMessage,
  createUserMessage,
} from '@openbunny/shared/services/ai/messageFactory';
import { stopMindConversation } from '@openbunny/shared/services/ai/mind';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore } from '@openbunny/shared/stores/agent';
import i18n from '@openbunny/shared/i18n';

interface UseAgentLoopOptions {
  isDefaultAgent: boolean;
  currentAgentId: string;
  proxyUrl: string;
  toolExecutionTimeout: number;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  addAgentMessage: (agentId: string, sessionId: string, message: Message) => void;
  updateAgentMessage: (agentId: string, sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setSessionStreaming: (sessionId: string, streaming: boolean) => void;
  setAgentSessionStreaming: (agentId: string, sessionId: string, streaming: boolean) => void;
  setSessionSystemPrompt: (sessionId: string, prompt: string) => void;
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, prompt: string) => void;
  flushMessages: (sessionId: string) => Promise<void>;
  flushAgentMessages: (agentId: string, sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => void;
  renameAgentSession: (agentId: string, sessionId: string, name: string) => void;
  enabledTools: string[];
  enabledSkills: string[];
}

export function useAgentLoop(options: UseAgentLoopOptions) {
  const {
    isDefaultAgent, currentAgentId, proxyUrl, toolExecutionTimeout,
    addMessage, updateMessage, addAgentMessage, updateAgentMessage,
    setSessionStreaming, setAgentSessionStreaming,
    setSessionSystemPrompt, setAgentSessionSystemPrompt,
    flushMessages, flushAgentMessages,
    renameSession, renameAgentSession,
    enabledTools, enabledSkills,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [activityLabel, setActivityLabel] = useState('Thinking...');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = useCallback((currentSessionId: string | null) => {
    if (!currentSessionId) return;

    const currentSession = isDefaultAgent
      ? useSessionStore.getState().sessions.find((session) => session.id === currentSessionId)
      : (useAgentStore.getState().agentSessions[currentAgentId] || []).find((session) => session.id === currentSessionId);

    const clearStreamingState = () => {
      if (isDefaultAgent) {
        setSessionStreaming(currentSessionId, false);
      } else {
        setAgentSessionStreaming(currentAgentId, currentSessionId, false);
      }
    };

    if (currentSession?.sessionType === 'mind') {
      clearStreamingState();
      setIsLoading(false);
      setCurrentStatus('');
      stopMindConversation(currentSessionId);
      return;
    }

    if (currentSession?.sessionType === 'agent') {
      clearStreamingState();
      setIsLoading(false);
      setCurrentStatus('');
      stopChatConversation(currentSessionId);
      return;
    }

    if (!abortControllerRef.current) return;

    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setCurrentStatus('');
    clearStreamingState();
    if (isDefaultAgent) {
      addMessage(currentSessionId, createAssistantMessage(i18n.t('chat.stopped')));
    } else {
      addAgentMessage(currentAgentId, currentSessionId, createAssistantMessage(i18n.t('chat.stopped')));
    }
  }, [addAgentMessage, addMessage, currentAgentId, isDefaultAgent, setAgentSessionStreaming, setSessionStreaming]);

  const sendMessage = useCallback(async (
    trimmed: string,
    session: Session,
    runtimeConfig: LLMConfig,
  ) => {
    if (session.messages.length === 0) {
      if (isDefaultAgent) {
        renameSession(session.id, trimmed.slice(0, 50));
      } else {
        renameAgentSession(currentAgentId, session.id, trimmed.slice(0, 50));
      }
    }

    if (isDefaultAgent) {
      addMessage(session.id, createUserMessage(trimmed));
    } else {
      addAgentMessage(currentAgentId, session.id, createUserMessage(trimmed));
    }

    setIsLoading(true);
    setActivityLabel('Thinking...');
    setCurrentStatus('');

    if (isDefaultAgent) {
      setSessionStreaming(session.id, true);
    } else {
      setAgentSessionStreaming(currentAgentId, session.id, true);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const callbacks = {
      addMessage: (targetSessionId: string, message: Message) => {
        if (isDefaultAgent) {
          addMessage(targetSessionId, message);
        } else {
          addAgentMessage(currentAgentId, targetSessionId, message);
        }
      },
      updateMessage: (targetSessionId: string, messageId: string, updates: Partial<Message>) => {
        if (isDefaultAgent) {
          updateMessage(targetSessionId, messageId, updates);
        } else {
          updateAgentMessage(currentAgentId, targetSessionId, messageId, updates);
        }
      },
      setStatus: (status: string) => setCurrentStatus(status),
      generateId: () => crypto.randomUUID(),
      streamToolOutput: (targetSessionId: string, messageId: string, chunk: string) => {
        const liveSession = isDefaultAgent
          ? useSessionStore.getState().sessions.find((c) => c.id === targetSessionId)
          : (useAgentStore.getState().agentSessions[currentAgentId] || []).find((c) => c.id === targetSessionId);
        const existingMessage = liveSession?.messages.find((m) => m.id === messageId);
        if (!existingMessage) return;
        const updates = {
          content: `${existingMessage.content || ''}${chunk}`,
          toolOutput: `${existingMessage.toolOutput || ''}${chunk}`,
        };
        if (isDefaultAgent) {
          updateMessage(targetSessionId, messageId, updates);
        } else {
          updateAgentMessage(currentAgentId, targetSessionId, messageId, updates);
        }
      },
    };

    try {
      const effectiveTools = (session.sessionTools ?? enabledTools).filter((id) => id !== 'file_manager');
      const effectiveSkills = session.sessionSkills ?? enabledSkills;

      const returnedPrompt = await runAgentLoop(
        trimmed,
        session.id,
        runtimeConfig,
        effectiveTools,
        callbacks,
        i18n.t.bind(i18n),
        proxyUrl,
        toolExecutionTimeout,
        abortController.signal,
        session.projectId,
        effectiveSkills,
      );

      if (returnedPrompt) {
        if (isDefaultAgent) {
          setSessionSystemPrompt(session.id, returnedPrompt);
        } else {
          setAgentSessionSystemPrompt(currentAgentId, session.id, returnedPrompt);
        }
      }
    } catch (agentError) {
      if (agentError instanceof Error && agentError.name === 'AbortError') return;
      if (!(agentError && typeof agentError === 'object' && '__openbunnyHandled' in agentError)) {
        const errorMessage = createAssistantMessage(
          i18n.t('chat.error', {
            error: agentError instanceof Error ? agentError.message : String(agentError),
          }),
        );
        if (isDefaultAgent) {
          addMessage(session.id, errorMessage);
        } else {
          addAgentMessage(currentAgentId, session.id, errorMessage);
        }
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setCurrentStatus('');
      if (isDefaultAgent) {
        setSessionStreaming(session.id, false);
        await flushMessages(session.id);
      } else {
        setAgentSessionStreaming(currentAgentId, session.id, false);
        await flushAgentMessages(currentAgentId, session.id);
      }
    }
  }, [
    addAgentMessage, addMessage, currentAgentId, enabledSkills, enabledTools,
    flushAgentMessages, flushMessages, isDefaultAgent, proxyUrl,
    renameAgentSession, renameSession, setAgentSessionStreaming,
    setAgentSessionSystemPrompt, setSessionStreaming, setSessionSystemPrompt,
    toolExecutionTimeout, updateAgentMessage, updateMessage,
  ]);

  return {
    isLoading, setIsLoading,
    currentStatus, setCurrentStatus,
    activityLabel, setActivityLabel,
    handleStop, sendMessage,
  };
}
