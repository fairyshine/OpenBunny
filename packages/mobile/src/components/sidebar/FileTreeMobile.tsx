import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Text,
  List,
  Searchbar,
  IconButton,
  useTheme,
  Menu,
  ActivityIndicator,
} from 'react-native-paper';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import type { FileSystemEntry } from '@openbunny/shared/services/filesystem';

interface FileTreeMobileProps {
  onFileSelect: (filePath: string, fileName: string) => void;
}

export default function FileTreeMobile({ onFileSelect }: FileTreeMobileProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [currentPath, setCurrentPath] = useState('/root');
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuEntry, setMenuEntry] = useState<FileSystemEntry | null>(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    try {
      await fileSystem.initialize();
      const items = await fileSystem.readdir(path);
      // Sort: directories first, then by name
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(items);
    } catch (error) {
      console.error('[FileTree] Load error:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const handleNavigate = (entry: FileSystemEntry) => {
    if (entry.type === 'directory') {
      setCurrentPath(entry.path);
    } else {
      onFileSelect(entry.path, entry.name);
    }
  };

  const handleGoUp = () => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    if (parentPath && parentPath.startsWith('/root')) {
      setCurrentPath(parentPath);
    }
  };

  const handleDelete = async (entry: FileSystemEntry) => {
    setMenuEntry(null);
    Alert.alert(
      t('files.delete') || 'Delete',
      `${entry.name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fileSystem.rm(entry.path, true);
              loadDirectory(currentPath);
            } catch (error) {
              Alert.alert('Error', String(error));
            }
          },
        },
      ]
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDirectory(currentPath);
      return;
    }
    setLoading(true);
    try {
      const results = await fileSystem.search(searchQuery);
      setEntries(results);
    } catch (error) {
      console.error('[FileTree] Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = searchQuery.trim()
    ? entries
    : entries;

  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumb = pathParts.length > 1
    ? `/${pathParts.slice(1).join('/')}`
    : '/';

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={t('files.search') || 'Search files...'}
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
        style={styles.searchbar}
        inputStyle={{ fontSize: 13 }}
      />

      {currentPath !== '/root' && (
        <List.Item
          title=".."
          left={(p) => <List.Icon {...p} icon="arrow-up" />}
          onPress={handleGoUp}
          style={styles.parentItem}
        />
      )}

      <Text variant="labelSmall" style={styles.breadcrumb}>
        {breadcrumb}
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : filteredEntries.length === 0 ? (
        <Text variant="bodySmall" style={styles.emptyText}>
          {t('files.empty') || 'Empty directory'}
        </Text>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              description={
                item.type === 'file'
                  ? `${(item.size / 1024).toFixed(1)} KB`
                  : undefined
              }
              left={(p) => (
                <List.Icon
                  {...p}
                  icon={item.type === 'directory' ? 'folder' : 'file-document-outline'}
                />
              )}
              onPress={() => handleNavigate(item)}
              onLongPress={() => setMenuEntry(item)}
              right={() =>
                menuEntry?.path === item.path ? (
                  <View style={{ flexDirection: 'row' }}>
                    {item.type === 'file' && (
                      <IconButton
                        icon="pencil"
                        size={16}
                        onPress={() => {
                          setMenuEntry(null);
                          onFileSelect(item.path, item.name);
                        }}
                      />
                    )}
                    <IconButton
                      icon="delete"
                      size={16}
                      onPress={() => handleDelete(item)}
                    />
                    <IconButton
                      icon="close"
                      size={16}
                      onPress={() => setMenuEntry(null)}
                    />
                  </View>
                ) : null
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: 8,
    marginVertical: 4,
    height: 36,
  },
  breadcrumb: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    opacity: 0.5,
  },
  parentItem: {
    paddingVertical: 0,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
});
