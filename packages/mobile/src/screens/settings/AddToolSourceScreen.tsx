import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useToolStore } from '@shared/stores/tools';

export default function AddToolSourceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { addMCPConnection } = useToolStore();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) {
      Alert.alert('Error', 'Name and URL are required');
      return;
    }

    addMCPConnection(name.trim(), url.trim());
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="bodyMedium" style={styles.description}>
        {t('tools.addSourceDesc') || 'Connect to an MCP server to add external tools.'}
      </Text>

      <TextInput
        label={t('tools.sourceName') || 'Name'}
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="MCP Server URL"
        value={url}
        onChangeText={setUrl}
        mode="outlined"
        style={styles.input}
        placeholder="http://localhost:3000/mcp"
      />

      <Button
        mode="contained"
        onPress={handleAdd}
        disabled={!name.trim() || !url.trim()}
        style={styles.button}
      >
        {t('tools.addSource') || 'Add MCP Server'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  description: {
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    marginVertical: 8,
  },
  button: {
    marginTop: 16,
    marginBottom: 32,
  },
});
