import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  List,
  Switch,
  Text,
  useTheme,
  Chip,
} from 'react-native-paper';
import { useSettingsStore } from '@shared/stores/settings';
import { builtinTools } from '@shared/services/ai/tools';
import { detectPlatform } from '@shared/platform/detect';

const toolDisplayInfo: Record<string, { name: string; icon: string; description: string }> = {
  python: { name: 'Python', icon: 'language-python', description: 'Execute Python code' },
  web_search: { name: 'Web Search', icon: 'magnify', description: 'Search the web' },
  file_manager: { name: 'File Manager', icon: 'folder', description: 'Manage files' },
  memory: { name: 'Memory', icon: 'brain', description: 'Persistent memory' },
  exec: { name: 'Shell Exec', icon: 'console', description: 'Execute shell commands (Desktop only)' },
};

export default function ToolManagerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enabledTools, toggleTool, enableAllTools, disableAllTools } = useSettingsStore();

  const allToolIds = Object.keys(builtinTools);
  const platform = detectPlatform();
  const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {allToolIds.length} tools | {enabledTools.length} enabled
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip compact onPress={enableAllTools}>{t('tools.enableAll') || 'All'}</Chip>
          <Chip compact onPress={disableAllTools}>{t('tools.disableAll') || 'None'}</Chip>
        </View>
      </View>

      <FlatList
        data={allToolIds}
        keyExtractor={(item) => item}
        renderItem={({ item: toolId }) => {
          const info = toolDisplayInfo[toolId] || { name: toolId, icon: 'wrench', description: '' };
          const isExecDisabled = toolId === 'exec' && !execAvailable;
          return (
            <List.Item
              title={info.name}
              description={isExecDisabled ? t('tools.exec.desktopOnly') : info.description}
              titleStyle={{ fontSize: 13, opacity: isExecDisabled ? 0.5 : 1 }}
              descriptionStyle={{ fontSize: 11 }}
              descriptionNumberOfLines={2}
              left={(p) => <List.Icon {...p} icon={info.icon} style={{ opacity: isExecDisabled ? 0.5 : 1 }} />}
              right={() => (
                <Switch
                  value={enabledTools.includes(toolId)}
                  onValueChange={() => toggleTool(toolId)}
                  disabled={isExecDisabled}
                />
              )}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
