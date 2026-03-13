import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useAgentConfig } from '../hooks/useAgentConfig';
import { logLLM } from '@openbunny/shared/services/console/logger';
import { runAgentLoop } from '@openbunny/shared/services/ai/agent';
import { isAbortError } from '@openbunny/shared/utils/errors';
import type { AgentCallbacks } from '@openbunny/shared/services/ai/agent';
import type { Message } from '@openbunny/shared/types';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ToolStatusBanner from '../components/chat/ToolStatusBanner';
import ExportSheet from '../components/chat/ExportSheet';
import MessageSearchSheet from '../components/chat/MessageSearchSheet';
import type { ChatScreenRouteProp, ChatScreenNavigationProp } from '../navigation/types';

export default function ChatScreen() {
  const { t } = useTranslation();
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { sessionId } = route.params;

  const { sessions, addMessage, updateMessage, loadSessionMessages } = useSessionStore();
  const { llmConfig, enabledTools, enabledSkills } = useAgentConfig();
  const { proxyUrl, toolExecutionTimeout } = useSettingsStore();
  const session = sessions.find((s) => s.id === sessionId);

  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load messages from IndexedDB when session becomes active
  useEffect(() => {
    loadSessionMessages(sessionId);
  }, [sessionId, loadSessionMessages]);

  useEffect(() => {
    if (session) {
      navigation.setOptions({ title: session.name });
    }
  }, [session?.name, navigation]);

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('chat.sessionNotFound')} />
        </Appbar.Header>
      </View>
    );
  }

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

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    if (!llmConfig.apiKey) {
      Alert.alert(t('settings.title'), t('chat.configRequired'));
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMessage);

    // Auto-rename session with first user message
    if (session.messages.length === 0) {
      useSessionStore.getState().renameSession(sessionId, content.trim().slice(0, 50));
    }

    setIsLoading(true);
    setCurrentStatus('');
    useSessionStore.getState().setSessionStreaming(sessionId, true);
    logLLM('info', `User message: ${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}`);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Use session-level tools/skills if configured, otherwise fall back to agent config
      const effectiveTools = session.sessionTools ?? enabledTools;
      const effectiveSkills = session.sessionSkills ?? enabledSkills;

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
        session.projectId,
        effectiveSkills,
      );
      // Save system prompt to session
      useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('[Chat] Agent loop error:', error);
      if (!(error && typeof error === 'object' && '__openbunnyHandled' in error)) {
        addMessage(sessionId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: t('chat.error', { error: error instanceof Error ? error.message : String(error) }),
          timestamp: Date.now(),
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setCurrentStatus('');
      useSessionStore.getState().setSessionStreaming(sessionId, false);
      // Force-flush messages to IndexedDB after agent loop completes
      useSessionStore.getState().flushMessages(sessionId);
    }
  };

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

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={session.name} />
        <Appbar.Action icon="magnify" onPress={() => setShowSearch(true)} />
        <Appbar.Action icon="export-variant" onPress={() => setShowExport(true)} />
      </Appbar.Header>

      <ToolStatusBanner status={currentStatus} />

      <MessageList messages={session.messages} />

      {session.sessionType === 'agent' || session.sessionType === 'mind' ? null : (
        <ChatInput onSend={handleSend} isLoading={isLoading} onStop={handleStop} />
      )}

      <ExportSheet
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
        visible={showExport}
        onDismiss={() => setShowExport(false)}
      />

      <MessageSearchSheet
        messages={session.messages}
        visible={showSearch}
        onDismiss={() => setShowSearch(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
  },
});
