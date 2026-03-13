import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Text, Card, useTheme, Button } from 'react-native-paper';
import { useSessionStore } from '@openbunny/shared/stores/session';
import type { ChatStackNavigationProp } from '../navigation/types';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<ChatStackNavigationProp>();
  const { createSession } = useSessionStore();

  const handleQuickStart = () => {
    const session = createSession(t('header.newSession'));
    navigation.navigate('Chat', { sessionId: session.id });
  };

  const features = [
    {
      icon: '🤖',
      title: t('welcome.chat') || 'AI Chat',
      description: t('welcome.chatDesc') || 'Chat with AI using OpenAI or Anthropic models',
    },
    {
      icon: '🔧',
      title: t('welcome.tools') || 'Tool Calling',
      description: t('welcome.toolsDesc') || 'AI can use tools to search, compute, and more',
    },
    {
      icon: '⚡',
      title: t('welcome.skills') || 'Skills',
      description: t('welcome.skillsDesc') || 'Multi-step workflows that orchestrate multiple tools',
    },
    {
      icon: '📁',
      title: t('welcome.files') || 'File System',
      description: t('welcome.filesDesc') || 'Built-in sandbox filesystem for file operations',
    },
    {
      icon: '🧠',
      title: t('welcome.memory') || 'Memory',
      description: t('welcome.memoryDesc') || 'Persistent notes and diary for context',
    },
    {
      icon: '🔌',
      title: t('welcome.mcp') || 'MCP Support',
      description: t('welcome.mcpDesc') || 'Connect to Model Context Protocol servers',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          OpenBunny
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('welcome.subtitle') || 'Your AI Agent on Mobile'}
        </Text>
      </View>

      <View style={styles.cardGrid}>
        {features.map((feature, index) => (
          <Card key={index} style={styles.card} mode="elevated">
            <Card.Content>
              <Text variant="headlineSmall">{feature.icon}</Text>
              <Text variant="titleSmall" style={{ marginTop: 4 }}>
                {feature.title}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
              >
                {feature.description}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <Button
        mode="contained"
        onPress={handleQuickStart}
        style={styles.startButton}
        icon="message-plus"
      >
        {t('welcome.start') || 'Start Chatting'}
      </Button>

      <View style={styles.tips}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('welcome.tips') || 'Quick Tips'}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {t('welcome.tip1') || '1. Configure your API key in Settings > LLM Configuration'}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('welcome.tip2') || '2. Swipe right to open the sidebar for sessions and files'}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('welcome.tip3') || '3. Enable tools in Settings > Tools to extend AI capabilities'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    fontWeight: 'bold',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 4,
  },
  startButton: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  tips: {
    marginTop: 24,
    padding: 16,
    opacity: 0.8,
  },
});
