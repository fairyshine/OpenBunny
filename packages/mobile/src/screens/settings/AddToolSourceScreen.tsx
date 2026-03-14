import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { TextInput, Button, Text, SegmentedButtons } from 'react-native-paper';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useToolStore, type MCPTransportType } from '@openbunny/shared/stores/tools';

export default function AddToolSourceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { proxyUrl } = useSettingsStore();
  const { addMCPConnection, updateMCPStatus, setMCPTools, setMCPError } = useToolStore();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('http://localhost:3000/mcp');
  const [transport, setTransport] = useState<MCPTransportType>('http');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) {
      Alert.alert('Error', t('tools.mcp.validation') || 'Name and URL are required');
      return;
    }

    setSaving(true);
    const id = addMCPConnection(name.trim(), url.trim(), transport);
    const connection = { id, name: name.trim(), url: url.trim(), transport };

    try {
      updateMCPStatus(id, 'connecting');
      setMCPError(id, null);
      const { discoverMCPConnection } = await import('@openbunny/shared/services/ai/mcp');
      const { descriptors } = await discoverMCPConnection(connection, { proxyUrl });
      setMCPTools(id, descriptors);
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateMCPStatus(id, 'disconnected');
      setMCPError(id, message);
      Alert.alert('MCP Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={styles.description}>
        {t('tools.mcp.desc') || 'Connect to your own MCP server and expose its tools to the app.'}
      </Text>

      <TextInput
        label={t('tools.sourceName') || 'Name'}
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
        placeholder={t('tools.mcp.namePlaceholder') || 'Local Search'}
      />

      <TextInput
        label="MCP Server URL"
        value={url}
        onChangeText={setUrl}
        mode="outlined"
        style={styles.input}
        placeholder="http://localhost:3000/mcp"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.segmentBlock}>
        <Text variant="labelMedium" style={styles.segmentLabel}>
          {t('tools.mcp.transport') || 'Transport'}
        </Text>
        <SegmentedButtons
          value={transport}
          onValueChange={(value) => setTransport(value as MCPTransportType)}
          buttons={[
            { value: 'http', label: 'HTTP' },
            { value: 'sse', label: 'SSE' },
          ]}
        />
      </View>

      <Text variant="bodySmall" style={styles.hint}>
        {t('tools.mcp.hint') || 'If you run the mobile app on a real device, replace localhost with your computer LAN IP.'}
      </Text>

      <Button
        mode="contained"
        onPress={handleAdd}
        disabled={saving || !name.trim() || !url.trim()}
        style={styles.button}
      >
        {saving ? (t('settings.testing') || 'Testing...') : (t('tools.addSource') || 'Add MCP Server')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  description: {
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    marginVertical: 8,
  },
  segmentBlock: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  segmentLabel: {
    opacity: 0.8,
  },
  hint: {
    marginTop: 8,
    opacity: 0.7,
  },
  button: {
    marginTop: 20,
    marginBottom: 32,
  },
});
