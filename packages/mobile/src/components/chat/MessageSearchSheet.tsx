import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Portal,
  Text,
  Searchbar,
  Switch,
  useTheme,
  List,
  Divider,
} from 'react-native-paper';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import type { Message } from '@openbunny/shared/types';

interface MessageSearchSheetProps {
  messages: Message[];
  visible: boolean;
  onDismiss: () => void;
  onNavigateToMessage?: (messageId: string) => void;
}

export default function MessageSearchSheet({
  messages,
  visible,
  onDismiss,
  onNavigateToMessage,
}: MessageSearchSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchToolOutput, setSearchToolOutput] = useState(true);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return MessageHistoryManager.searchMessages(messages, query, {
      caseSensitive,
      searchInToolOutput: searchToolOutput,
    });
  }, [messages, query, caseSensitive, searchToolOutput]);

  const highlightMatch = (text: string, maxLen = 200) => {
    if (!query.trim()) return text.slice(0, maxLen);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen);

    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 80);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    return snippet;
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={styles.title}>
          {t('chat.searchMessages') || 'Search Messages'}
        </Text>

        <Searchbar
          placeholder={t('chat.searchPlaceholder') || 'Search...'}
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          autoFocus
        />

        <View style={styles.optionRow}>
          <View style={styles.option}>
            <Text variant="labelSmall">Aa</Text>
            <Switch
              value={caseSensitive}
              onValueChange={setCaseSensitive}
              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
            />
          </View>
          <View style={styles.option}>
            <Text variant="labelSmall">{t('chat.searchToolOutput') || 'Tool output'}</Text>
            <Switch
              value={searchToolOutput}
              onValueChange={setSearchToolOutput}
              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
            />
          </View>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {results.length} {t('chat.results') || 'results'}
          </Text>
        </View>

        <Divider />

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.resultList}
          renderItem={({ item }) => (
            <List.Item
              title={`${item.role} ${item.toolName ? `(${item.toolName})` : ''}`}
              description={highlightMatch(item.content || item.toolOutput || '')}
              titleStyle={{ fontSize: 12, fontWeight: 'bold' }}
              descriptionStyle={{ fontSize: 11 }}
              descriptionNumberOfLines={3}
              left={(p) => (
                <List.Icon
                  {...p}
                  icon={
                    item.role === 'user' ? 'account' :
                    item.type === 'tool_call' ? 'wrench' :
                    item.type === 'tool_result' ? 'check' :
                    'robot'
                  }
                />
              )}
              right={() => (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatTimestamp(item.timestamp)}
                </Text>
              )}
              onPress={() => {
                onNavigateToMessage?.(item.id);
                onDismiss();
              }}
            />
          )}
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="bodySmall" style={styles.emptyText}>
                {t('chat.noResults') || 'No results found'}
              </Text>
            ) : null
          }
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    maxHeight: '80%',
  },
  title: {
    marginBottom: 8,
  },
  searchbar: {
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultList: {
    maxHeight: 400,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    opacity: 0.5,
  },
});
