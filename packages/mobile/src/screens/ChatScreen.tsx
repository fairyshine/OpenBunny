import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useSessionStore } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { logLLM } from '@shared/services/console/logger';
import { runAgentLoop } from '@shared/services/ai/agent';
import type { AgentCallbacks } from '@shared/services/ai/agent';
import type { Message } from '@shared/types';
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

  const { sessions, addMessage, updateMessage, llmConfig } = useSessionStore();
  const { enabledTools, proxyUrl, toolExecutionTimeout } = useSettingsStore();
  const session = sessions.find((s) => s.id === sessionId);

  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      console.error('[Chat] Agent loop error:', error);
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

      <ChatInput onSend={handleSend} isLoading={isLoading} onStop={handleStop} />

      <ExportSheet
        messages={session.messages}
        systemPrompt={session.systemPrompt}
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
