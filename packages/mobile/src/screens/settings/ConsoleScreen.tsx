import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Text,
  Searchbar,
  Chip,
  IconButton,
  useTheme,
  Button,
  Divider,
} from 'react-native-paper';
import { consoleLogger } from '@openbunny/shared/services/console/logger';
import type { LogEntry, LogCategory, LogLevel } from '@openbunny/shared/services/console/logger';

const CATEGORIES: LogCategory[] = ['system', 'llm', 'tool', 'file', 'settings', 'mcp', 'python'];

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#2196F3',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  debug: '#9E9E9E',
};

export default function ConsoleScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<LogCategory>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Load initial logs
    setLogs(consoleLogger.getLogs());

    // Subscribe to updates
    const unsubscribe = consoleLogger.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs.length, autoScroll]);

  const toggleCategory = (cat: LogCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedCategories.size > 0 && !selectedCategories.has(log.category)) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.category.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleExport = async () => {
    try {
      const text = consoleLogger.exportText();
      await Share.share({
        message: text,
        title: 'console-logs.txt',
      });
    } catch {
      // User cancelled
    }
  };

  const handleClear = () => {
    consoleLogger.clear();
    setLogs([]);
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <Searchbar
        placeholder={t('console.search') || 'Search logs...'}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
        inputStyle={{ fontSize: 13 }}
      />

      {/* Category filter chips */}
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            selected={selectedCategories.has(cat)}
            onPress={() => toggleCategory(cat)}
            compact
            style={styles.chip}
            textStyle={{ fontSize: 11 }}
          >
            {cat}
          </Chip>
        ))}
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {filteredLogs.length} / {logs.length} entries
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="export-variant" size={18} onPress={handleExport} />
          <IconButton icon="delete-sweep" size={18} onPress={handleClear} />
          <IconButton
            icon={autoScroll ? 'arrow-down-bold' : 'arrow-down-bold-outline'}
            size={18}
            onPress={() => setAutoScroll(!autoScroll)}
          />
        </View>
      </View>

      <Divider />

      {/* Log list */}
      <FlatList
        ref={flatListRef}
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item: log }) => (
          <View style={styles.logEntry}>
            <View style={styles.logHeader}>
              <Text
                variant="labelSmall"
                style={{ color: LEVEL_COLORS[log.level], fontWeight: 'bold', width: 50 }}
              >
                {log.level.toUpperCase()}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary, width: 55, textAlign: 'center' }}
              >
                {log.category}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatTime(log.timestamp)}
              </Text>
            </View>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurface }} numberOfLines={3}>
              {log.message}
            </Text>
            {log.details && (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant, fontFamily: 'monospace', fontSize: 10 }}
                numberOfLines={2}
              >
                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('console.noLogs') || 'No log entries'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: 8,
    marginTop: 8,
    height: 36,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chip: {
    height: 26,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logEntry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e020',
  },
  logHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
});
