import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, List, Icon } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import type { Message } from '@openbunny/shared/types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);

  // Tool call message
  if (message.type === 'tool_call') {
    const isStreaming = message.metadata?.streaming === true;
    return (
      <View style={[styles.container, styles.assistantContainer]}>
        <View style={[styles.toolBubble, { backgroundColor: theme.colors.secondaryContainer }]}>
          <List.Accordion
            title={message.toolName || 'Tool'}
            description={message.content}
            left={(props) => <List.Icon {...props} icon="wrench" />}
            right={(props) => isStreaming ? (
              <View style={styles.streamingIndicator}>
                <Text style={{ fontSize: 8, color: theme.colors.primary }}>●</Text>
              </View>
            ) : undefined}
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
            style={{ backgroundColor: 'transparent', padding: 0 }}
            titleStyle={{ fontSize: 13, fontWeight: '600' }}
            descriptionStyle={{ fontSize: 11 }}
          >
            {message.toolInput && (
              <View style={[styles.codeBlock, { backgroundColor: theme.colors.surface }]}>
                <Text variant="labelSmall" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                  Input {isStreaming && '(streaming...)'}
                </Text>
                <Text
                  variant="bodySmall"
                  style={[styles.codeText, { color: theme.colors.onSurface }]}
                  numberOfLines={expanded ? undefined : 10}
                >
                  {message.toolInput || (isStreaming ? '...' : '')}
                </Text>
              </View>
            )}
          </List.Accordion>
        </View>
      </View>
    );
  }

  // Tool result message
  if (message.type === 'tool_result') {
    const isStreaming = message.metadata?.streaming === true;
    return (
      <View style={[styles.container, styles.assistantContainer]}>
        <View style={[styles.toolBubble, { backgroundColor: theme.colors.tertiaryContainer || theme.colors.surfaceVariant }]}>
          <List.Accordion
            title={`${message.toolName || 'Tool'} Result`}
            left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
            right={(props) => isStreaming ? (
              <View style={styles.streamingIndicator}>
                <Text style={{ fontSize: 8, color: theme.colors.primary }}>●</Text>
              </View>
            ) : undefined}
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
            style={{ backgroundColor: 'transparent', padding: 0 }}
            titleStyle={{ fontSize: 13, fontWeight: '600' }}
          >
            <View style={[styles.codeBlock, { backgroundColor: theme.colors.surface }]}>
              <Text
                variant="bodySmall"
                style={[styles.codeText, { color: theme.colors.onSurface }]}
                numberOfLines={expanded ? undefined : 15}
              >
                {message.toolOutput || message.content}
              </Text>
            </View>
          </List.Accordion>
        </View>
      </View>
    );
  }

  // Thinking message
  if (message.type === 'thought') {
    return (
      <View style={[styles.container, styles.assistantContainer]}>
        <View style={[styles.bubble, { backgroundColor: theme.colors.surfaceVariant, opacity: 0.8 }]}>
          <View style={styles.thinkingHeader}>
            <Icon source="brain" size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
              Thinking
            </Text>
          </View>
          {message.content ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {message.content}
            </Text>
          ) : (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
              ...
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Regular user/assistant message (including type: 'response')
  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.colors.primaryContainer }
            : { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {message.content ? (
          <Markdown
            style={{
              body: {
                color: theme.colors.onSurface,
              },
              code_inline: {
                backgroundColor: theme.colors.surface,
                color: theme.colors.primary,
              },
              code_block: {
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
              },
            }}
          >
            {message.content}
          </Markdown>
        ) : (
          <Text style={{ color: theme.colors.onSurface }}>
            {message.role === 'assistant' ? '...' : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  toolBubble: {
    maxWidth: '90%',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  codeBlock: {
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
});
