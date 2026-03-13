import React, { useState } from 'react';
import { View, StyleSheet, Share, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Portal, Text, Button, RadioButton, Divider, useTheme } from 'react-native-paper';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import type { ExportHistoryVariant } from '@openbunny/shared/utils/messageHistory';
import type { Message } from '@openbunny/shared/types';

interface ExportSheetProps {
  messages: Message[];
  systemPrompt?: string;
  sessionId: string;
  sessionName: string;
  alternateHistories?: ExportHistoryVariant[];
  visible: boolean;
  onDismiss: () => void;
}

type ExportFormat = 'json' | 'markdown' | 'text';

export default function ExportSheet({ messages, systemPrompt, sessionId, sessionName, alternateHistories, visible, onDismiss }: ExportSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [format, setFormat] = useState<ExportFormat>('markdown');

  const stats = MessageHistoryManager.getMessageStats(messages);

  const handleExport = async () => {
    let content: string;
    let title: string;

    const opts = { systemPrompt, sessionId, sessionName, alternateHistories };
    switch (format) {
      case 'json':
        content = MessageHistoryManager.exportToJSON(messages, opts);
        title = 'conversation.json';
        break;
      case 'markdown':
        content = MessageHistoryManager.exportToMarkdown(messages, opts);
        title = 'conversation.md';
        break;
      case 'text':
        content = MessageHistoryManager.exportToText(messages, opts);
        title = 'conversation.txt';
        break;
    }

    try {
      await Share.share({
        message: content,
        title,
      });
      onDismiss();
    } catch (error) {
      if (error instanceof Error && error.message !== 'User did not share') {
        Alert.alert('Export Error', error.message);
      }
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={styles.title}>
          {t('chat.exportConversation')}
        </Text>

        <View style={styles.statsContainer}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('chat.totalMessages')}: {stats.total} | Tokens: ~{stats.tokens} | {t('chat.toolCalls')}: {stats.toolCalls}
          </Text>
        </View>

        <Divider style={styles.divider} />

        <RadioButton.Group onValueChange={(v) => setFormat(v as ExportFormat)} value={format}>
          <RadioButton.Item label="JSON" value="json" />
          <RadioButton.Item label="Markdown" value="markdown" />
          <RadioButton.Item label={t('chat.plainText') || 'Plain Text'} value="text" />
        </RadioButton.Group>

        <View style={styles.actions}>
          <Button mode="outlined" onPress={onDismiss} style={styles.button}>
            {t('common.cancel')}
          </Button>
          <Button mode="contained" onPress={handleExport} style={styles.button}>
            {t('chat.export') || 'Export'}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  title: {
    marginBottom: 8,
  },
  statsContainer: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  button: {
    minWidth: 80,
  },
});
