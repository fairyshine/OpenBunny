import React from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { List, SegmentedButtons, Text, Divider, TextInput, Button } from 'react-native-paper';
import { useSettingsStore } from '@shared/stores/settings';
import { APP_VERSION } from '@shared/version';
import type { Theme, Language } from '@shared/stores/settings';

export default function GeneralSettingsScreen() {
  const { t } = useTranslation();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    proxyUrl,
    setProxyUrl,
    toolExecutionTimeout,
    setToolExecutionTimeout
  } = useSettingsStore();

  return (
    <ScrollView style={styles.container}>
      <List.Section>
        <List.Subheader>{t('settings.language')}</List.Subheader>
        <View style={styles.inputContainer}>
          <SegmentedButtons
            value={language}
            onValueChange={(v) => setLanguage(v as Language)}
            buttons={[
              { value: 'system', label: t('settings.language.system') },
              { value: 'zh-CN', label: '中文' },
              { value: 'en-US', label: 'EN' },
            ]}
          />
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>{t('settings.theme') || 'Theme'}</List.Subheader>
        <View style={styles.inputContainer}>
          <SegmentedButtons
            value={theme}
            onValueChange={(v) => setTheme(v as Theme)}
            buttons={[
              { value: 'system', label: t('settings.theme.system') || 'System' },
              { value: 'light', label: t('settings.theme.light') || 'Light' },
              { value: 'dark', label: t('settings.theme.dark') || 'Dark' },
            ]}
          />
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>{t('settings.proxyUrl')}</List.Subheader>
        <View style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            value={proxyUrl}
            onChangeText={setProxyUrl}
            placeholder="https://your-worker.workers.dev"
            dense
          />
          <View style={styles.proxyRow}>
            <Text variant="bodySmall" style={[styles.hint, styles.proxyHint]}>
              {t('settings.proxyHint')}
            </Text>
            <Button
              mode="outlined"
              compact
              icon="open-in-new"
              onPress={() => Linking.openURL('https://deploy.workers.cloudflare.com/?url=https://github.com/fairyshine/CyberBunny/tree/main/worker')}
            >
              {t('settings.proxyDeploy')}
            </Button>
          </View>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>{t('settings.toolTimeout')}</List.Subheader>
        <View style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            value={String(toolExecutionTimeout)}
            onChangeText={(text) => {
              const value = parseInt(text) || 300000;
              setToolExecutionTimeout(Math.max(10000, Math.min(1800000, value)));
            }}
            keyboardType="numeric"
            dense
            right={<TextInput.Affix text={`${Math.floor(toolExecutionTimeout / 1000)}s`} />}
          />
          <Text variant="bodySmall" style={styles.hint}>
            {t('settings.toolTimeoutHint')}
          </Text>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>{t('settings.about')}</List.Subheader>
        <List.Item title="CyberBunny Mobile" description={t('settings.version', { version: APP_VERSION })} />
        <List.Item title="" description={t('settings.aboutDesc')} />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hint: {
    marginTop: 4,
    opacity: 0.6,
  },
  proxyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  proxyHint: {
    flex: 1,
    marginTop: 0,
  },
});
