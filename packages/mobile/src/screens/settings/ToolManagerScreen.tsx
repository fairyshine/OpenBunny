import React from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  List,
  Switch,
  Text,
  useTheme,
  Chip,
  Button,
  IconButton,
} from 'react-native-paper';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useToolStore, type MCPConnection } from '@openbunny/shared/stores/tools';
import { discoverMCPConnection } from '@openbunny/shared/services/ai/mcp';
import { builtinTools } from '@openbunny/shared/services/ai/tools';
import { detectPlatform } from '@openbunny/shared/platform/detect';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import type { SettingsStackNavigationProp } from '../../navigation/types';

const toolDisplayInfo: Record<string, { name: string; icon: string; description: string }> = {
  python: { name: 'Python', icon: 'language-python', description: 'Execute Python code' },
  web_search: { name: 'Web Search', icon: 'magnify', description: 'Search the web' },
  file_manager: { name: 'File Manager', icon: 'folder', description: 'Manage files' },
  memory: { name: 'Memory', icon: 'brain', description: 'Persistent memory' },
  exec: { name: 'Shell Exec', icon: 'console', description: 'Execute shell commands (Desktop only)' },
  mind: { name: 'Mind', icon: 'head-sync', description: 'Internal self-dialogue' },
  chat: { name: 'Chat', icon: 'forum-outline', description: 'Agent-to-agent conversation' },
  cron: { name: 'Cron', icon: 'clock-outline', description: 'Schedule periodic tasks' },
  heartbeat: { name: 'Heartbeat', icon: 'heart-pulse', description: 'Periodic watchlist' },
};

export default function ToolManagerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<SettingsStackNavigationProp>();
  const { proxyUrl } = useSettingsStore();
  const { enabledTools, toggleTool } = useAgentConfig();
  const {
    mcpConnections,
    removeMCPConnection,
    updateMCPStatus,
    setMCPTools,
    setMCPError,
  } = useToolStore();

  const allToolIds = Object.keys(builtinTools);
  const platform = detectPlatform();
  const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');

  const refreshConnection = async (connection: Pick<MCPConnection, 'id' | 'name' | 'url' | 'transport'>) => {
    updateMCPStatus(connection.id, 'connecting');
    setMCPError(connection.id, null);

    try {
      const { descriptors } = await discoverMCPConnection(connection, { proxyUrl });
      setMCPTools(connection.id, descriptors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateMCPStatus(connection.id, 'disconnected');
      setMCPError(connection.id, message);
      Alert.alert('MCP Error', message);
    }
  };

  const handleRemoveConnection = (connection: MCPConnection) => {
    Alert.alert(
      t('tools.mcp.title') || 'Custom MCP Tools',
      t('tools.mcp.removeConfirm', { name: connection.name }) || `Remove ${connection.name}?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            connection.tools.forEach((tool) => {
              if (enabledTools.includes(tool.id)) {
                toggleTool(tool.id);
              }
            });
            removeMCPConnection(connection.id);
          },
        },
      ],
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <>
          <View style={styles.header}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {allToolIds.length + mcpConnections.flatMap((connection) => connection.tools).length} tools | {enabledTools.length} enabled
            </Text>
            <View style={styles.headerActions}>
              <Chip compact onPress={() => navigation.navigate('AddToolSource')}>
                {t('tools.addSource') || 'Add MCP'}
              </Chip>
            </View>
          </View>

          <List.Section>
            <List.Subheader>{t('tools.builtin.title') || 'Built-in tools'}</List.Subheader>
            {allToolIds.map((toolId) => {
              const info = toolDisplayInfo[toolId] || { name: toolId, icon: 'wrench', description: '' };
              const isExecDisabled = toolId === 'exec' && !execAvailable;
              return (
                <List.Item
                  key={toolId}
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
            })}
          </List.Section>

          <List.Section>
            <List.Subheader>{t('tools.mcp.title') || 'Custom MCP tools'}</List.Subheader>
            {mcpConnections.length === 0 ? (
              <List.Item
                title={t('tools.mcp.empty') || 'No custom MCP server added yet'}
                description={t('tools.mcp.desc') || 'Add your own MCP server from the tools page.'}
                left={(p) => <List.Icon {...p} icon="lan-connect" />}
              />
            ) : (
              mcpConnections.map((connection) => (
                <View key={connection.id} style={styles.connectionCard}>
                  <List.Item
                    title={connection.name}
                    description={`${connection.transport.toUpperCase()} · ${connection.url}`}
                    left={(p) => <List.Icon {...p} icon="lan-connect" />}
                    right={() => (
                      <View style={styles.connectionActions}>
                        <Chip compact>{connection.status}</Chip>
                        <IconButton icon="refresh" size={18} onPress={() => refreshConnection(connection)} />
                        <IconButton icon="delete" size={18} onPress={() => handleRemoveConnection(connection)} />
                      </View>
                    )}
                  />
                  {connection.lastError ? (
                    <Text variant="bodySmall" style={styles.errorText}>{connection.lastError}</Text>
                  ) : null}
                  {connection.tools.length === 0 ? (
                    <Text variant="bodySmall" style={styles.emptyText}>
                      {t('tools.mcp.noTools') || 'No tools discovered yet. Tap refresh to load them.'}
                    </Text>
                  ) : (
                    connection.tools.map((tool) => (
                      <List.Item
                        key={tool.id}
                        title={tool.title || tool.name}
                        description={tool.description || tool.name}
                        titleStyle={styles.mcpToolTitle}
                        descriptionStyle={styles.mcpToolDesc}
                        left={(p) => <List.Icon {...p} icon="plug" />}
                        right={() => (
                          <Switch
                            value={enabledTools.includes(tool.id)}
                            onValueChange={() => toggleTool(tool.id)}
                          />
                        )}
                      />
                    ))
                  )}
                </View>
              ))
            )}
          </List.Section>

          <View style={styles.footerHint}>
            <Text variant="bodySmall" style={styles.hintText}>
              {t('tools.mcp.hint') || 'Use HTTP for localhost/proxy scenarios. On a real device, replace localhost with your computer LAN IP.'}
            </Text>
            <Button mode="outlined" onPress={() => navigation.navigate('AddToolSource')}>
              {t('tools.addSource') || 'Add MCP Server'}
            </Button>
          </View>
        </>
      )}
      data={[]}
      renderItem={() => null}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  connectionCard: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d4d4d8',
    overflow: 'hidden',
  },
  connectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: '#dc2626',
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    opacity: 0.7,
  },
  mcpToolTitle: {
    fontSize: 13,
  },
  mcpToolDesc: {
    fontSize: 11,
  },
  footerHint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  hintText: {
    opacity: 0.7,
  },
});
