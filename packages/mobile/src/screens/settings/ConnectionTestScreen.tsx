import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, Card, useTheme } from 'react-native-paper';
import { useSessionStore } from '@shared/stores/session';
import { testConnection } from '@shared/services/ai/provider';

export default function ConnectionTestScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { llmConfig } = useSessionStore();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');

  const appendLog = (line: string) => {
    setResult((prev) => prev + line + '\n');
  };

  const handleTest = async () => {
    setResult('');
    setTesting(true);

    try {
      appendLog('=== Connection Test ===');
      appendLog(`Provider: ${llmConfig.provider}`);
      appendLog(`Model: ${llmConfig.model}`);
      appendLog(`Base URL: ${llmConfig.baseUrl || '(default)'}`);
      appendLog(`API Key: ${llmConfig.apiKey ? '***' + llmConfig.apiKey.slice(-4) : '(not set)'}`);
      appendLog('');

      if (!llmConfig.apiKey) {
        appendLog('ERROR: No API key configured');
        return;
      }

      appendLog('Sending test request via AI SDK...');

      const text = await testConnection(llmConfig);

      appendLog('');
      appendLog('SUCCESS!');
      appendLog('');
      appendLog(`Response: ${text}`);
    } catch (error) {
      appendLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      appendLog('');
      appendLog('The request failed. Check your network and configuration.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        mode="contained"
        onPress={handleTest}
        loading={testing}
        disabled={testing}
        style={styles.button}
        icon="connection"
      >
        {testing ? t('settings.testing') || 'Testing...' : t('settings.testConnection') || 'Test Connection'}
      </Button>

      <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <ScrollView style={styles.logScroll}>
            <Text
              variant="bodySmall"
              style={[styles.logText, { color: theme.colors.onSurface }]}
            >
              {result || 'Press "Test Connection" to start'}
            </Text>
          </ScrollView>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  button: {
    marginBottom: 16,
  },
  card: {
    flex: 1,
  },
  logScroll: {
    maxHeight: 500,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
