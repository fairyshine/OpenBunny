import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextInput, Text, Button, Divider, List, Menu } from 'react-native-paper';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { providerRegistry, getProviderMeta } from '@openbunny/shared/services/ai';

export default function LLMSettingsScreen() {
  const { t } = useTranslation();
  const { llmConfig, setLLMConfig } = useAgentConfig();

  const [provider, setProvider] = useState(llmConfig.provider);
  const [apiKey, setApiKey] = useState(llmConfig.apiKey);
  const [model, setModel] = useState(llmConfig.model);
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl || '');
  const [temperature, setTemperature] = useState(String(llmConfig.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(llmConfig.maxTokens ?? 4096));
  const [providerMenuVisible, setProviderMenuVisible] = useState(false);
  const [modelMenuVisible, setModelMenuVisible] = useState(false);

  const handleSave = () => {
    setLLMConfig({
      provider,
      apiKey,
      model,
      baseUrl: baseUrl || undefined,
      temperature: parseFloat(temperature) || 0.7,
      maxTokens: parseInt(maxTokens) || 4096,
    });
  };

  const handleProviderChange = (newProvider: string) => {
    const meta = getProviderMeta(newProvider);
    if (meta) {
      setProvider(newProvider);
      setModel(meta.models[0] || model);
      setBaseUrl(meta.defaultBaseUrl || '');
      setProviderMenuVisible(false);
    }
  };

  const currentProviderMeta = getProviderMeta(provider);
  const currentProviderName = currentProviderMeta?.name || provider;
  const availableModels = currentProviderMeta?.models || [];
  const apiKeyPlaceholder = currentProviderMeta?.apiKeyPlaceholder || 'API Key';

  return (
    <ScrollView style={styles.container}>
      <List.Section>
        <List.Subheader>{t('settings.provider') || 'Provider'}</List.Subheader>
        <View style={styles.inputContainer}>
          <Menu
            visible={providerMenuVisible}
            onDismiss={() => setProviderMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setProviderMenuVisible(true)}
                style={styles.menuButton}
                contentStyle={styles.menuButtonContent}
              >
                {currentProviderName}
              </Button>
            }
          >
            {providerRegistry.map((p) => (
              <Menu.Item
                key={p.id}
                onPress={() => handleProviderChange(p.id)}
                title={p.name}
              />
            ))}
          </Menu>
        </View>
      </List.Section>

      <TextInput
        label={t('settings.apiKey')}
        value={apiKey}
        onChangeText={setApiKey}
        onBlur={handleSave}
        secureTextEntry
        mode="outlined"
        style={styles.input}
        placeholder={apiKeyPlaceholder}
      />

      <List.Section>
        <List.Subheader>{t('settings.model') || 'Model'}</List.Subheader>
        <View style={styles.inputContainer}>
          <Menu
            visible={modelMenuVisible}
            onDismiss={() => setModelMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setModelMenuVisible(true)}
                style={styles.menuButton}
                contentStyle={styles.menuButtonContent}
              >
                {model}
              </Button>
            }
          >
            {availableModels.map((m) => (
              <Menu.Item
                key={m}
                onPress={() => {
                  setModel(m);
                  setModelMenuVisible(false);
                }}
                title={m}
              />
            ))}
          </Menu>
        </View>
      </List.Section>

      <TextInput
        label={t('settings.model') + ' (Custom)'}
        value={model}
        onChangeText={setModel}
        onBlur={handleSave}
        mode="outlined"
        style={styles.input}
        placeholder="or type custom model"
      />

      <TextInput
        label={t('settings.baseUrl')}
        value={baseUrl}
        onChangeText={setBaseUrl}
        onBlur={handleSave}
        mode="outlined"
        style={styles.input}
        placeholder={currentProviderMeta?.defaultBaseUrl || 'https://api.example.com/v1'}
      />

      <Divider style={{ marginVertical: 8 }} />

      <TextInput
        label={t('settings.temperature') || 'Temperature'}
        value={temperature}
        onChangeText={setTemperature}
        onBlur={handleSave}
        mode="outlined"
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="0.7"
      />

      <TextInput
        label={t('settings.maxTokens') || 'Max Tokens'}
        value={maxTokens}
        onChangeText={setMaxTokens}
        onBlur={handleSave}
        mode="outlined"
        style={styles.input}
        keyboardType="number-pad"
        placeholder="4096"
      />

      <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
        {t('common.save') || 'Save'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  input: {
    marginVertical: 8,
  },
  saveButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  menuButton: {
    width: '100%',
  },
  menuButtonContent: {
    justifyContent: 'flex-start',
  },
});
