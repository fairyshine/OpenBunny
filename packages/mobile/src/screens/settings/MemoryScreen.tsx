import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
  SegmentedButtons,
  Button,
  FAB,
  List,
  Divider,
  useTheme,
  Card,
  IconButton,
} from 'react-native-paper';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import Markdown from 'react-native-markdown-display';

const MEMORY_PATH = '/root/memory/MEMORY.md';
const DIARY_DIR = '/root/memory/diary';

export default function MemoryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tab, setTab] = useState<'memory' | 'diary'>('memory');

  // Memory state
  const [memoryContent, setMemoryContent] = useState('');
  const [originalMemory, setOriginalMemory] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Diary state
  const [diaryEntries, setDiaryEntries] = useState<{ date: string; path: string }[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<string | null>(null);
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryEditing, setDiaryEditing] = useState(false);

  useEffect(() => {
    loadMemory();
    loadDiaryList();
  }, []);

  const loadMemory = async () => {
    try {
      await fileSystem.initialize();
      const content = await fileSystem.readFileText(MEMORY_PATH);
      setMemoryContent(content || '');
      setOriginalMemory(content || '');
    } catch {
      setMemoryContent('');
      setOriginalMemory('');
    }
  };

  const saveMemory = async () => {
    setSaving(true);
    try {
      await fileSystem.writeFile(MEMORY_PATH, memoryContent);
      setOriginalMemory(memoryContent);
      setEditing(false);
    } catch (error) {
      Alert.alert('Error', `Failed to save: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const loadDiaryList = async () => {
    try {
      await fileSystem.initialize();
      const exists = await fileSystem.exists(DIARY_DIR);
      if (!exists) {
        await fileSystem.mkdir(DIARY_DIR);
        return;
      }

      const entries = await fileSystem.readdir(DIARY_DIR);
      const diaryFiles = entries
        .filter((e) => e.type === 'file' && e.name.endsWith('.md'))
        .map((e) => ({
          date: e.name.replace('.md', ''),
          path: e.path,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setDiaryEntries(diaryFiles);
    } catch {
      setDiaryEntries([]);
    }
  };

  const loadDiary = async (path: string) => {
    try {
      const content = await fileSystem.readFileText(path);
      setDiaryContent(content || '');
      setSelectedDiary(path);
      setDiaryEditing(false);
    } catch {
      setDiaryContent('');
    }
  };

  const saveDiary = async () => {
    if (!selectedDiary) return;
    try {
      await fileSystem.writeFile(selectedDiary, diaryContent);
      setDiaryEditing(false);
    } catch (error) {
      Alert.alert('Error', `Failed to save: ${error}`);
    }
  };

  const createNewDiary = async () => {
    const today = new Date().toISOString().split('T')[0];
    const path = `${DIARY_DIR}/${today}.md`;

    try {
      const exists = await fileSystem.exists(path);
      if (!exists) {
        await fileSystem.writeFile(path, `# ${today}\n\n`);
      }
      await loadDiaryList();
      await loadDiary(path);
    } catch (error) {
      Alert.alert('Error', `Failed to create diary: ${error}`);
    }
  };

  const memoryDirty = memoryContent !== originalMemory;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as 'memory' | 'diary')}
        buttons={[
          { value: 'memory', label: t('memory.memory') || 'Memory', icon: 'brain' },
          { value: 'diary', label: t('memory.diary') || 'Diary', icon: 'book-open-variant' },
        ]}
        style={styles.segmented}
      />

      {tab === 'memory' ? (
        <View style={styles.content}>
          <View style={styles.toolbar}>
            <Button
              mode={editing ? 'contained' : 'outlined'}
              onPress={() => setEditing(!editing)}
              compact
            >
              {editing ? t('memory.preview') || 'Preview' : t('memory.edit') || 'Edit'}
            </Button>
            {memoryDirty && (
              <Button mode="contained" onPress={saveMemory} loading={saving} compact>
                {t('common.save') || 'Save'}
              </Button>
            )}
          </View>

          {editing ? (
            <ScrollView style={styles.editorScroll}>
              <TextInput
                value={memoryContent}
                onChangeText={setMemoryContent}
                multiline
                mode="flat"
                style={styles.editor}
                contentStyle={{ fontFamily: 'monospace', fontSize: 13 }}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
              />
            </ScrollView>
          ) : (
            <ScrollView style={styles.previewScroll}>
              {memoryContent ? (
                <Markdown
                  style={{
                    body: { color: theme.colors.onSurface, paddingHorizontal: 16 },
                    code_inline: { backgroundColor: theme.colors.surfaceVariant },
                  }}
                >
                  {memoryContent}
                </Markdown>
              ) : (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('memory.empty') || 'No memory notes yet. Click Edit to start.'}
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.diaryLayout}>
            {/* Diary list */}
            <View style={styles.diaryList}>
              <View style={styles.toolbar}>
                <Text variant="titleSmall">{t('memory.entries') || 'Entries'}</Text>
                <IconButton icon="plus" size={20} onPress={createNewDiary} />
              </View>
              <FlatList
                data={diaryEntries}
                keyExtractor={(item) => item.path}
                renderItem={({ item }) => (
                  <List.Item
                    title={item.date}
                    onPress={() => loadDiary(item.path)}
                    style={[
                      selectedDiary === item.path && {
                        backgroundColor: theme.colors.secondaryContainer,
                      },
                    ]}
                    titleStyle={{ fontSize: 13 }}
                  />
                )}
                ListEmptyComponent={
                  <Text variant="bodySmall" style={styles.emptyText}>
                    {t('memory.noDiary') || 'No diary entries'}
                  </Text>
                }
              />
            </View>

            {/* Diary content */}
            <View style={styles.diaryContent}>
              {selectedDiary ? (
                <>
                  <View style={styles.toolbar}>
                    <Button
                      mode={diaryEditing ? 'contained' : 'outlined'}
                      onPress={() => setDiaryEditing(!diaryEditing)}
                      compact
                    >
                      {diaryEditing ? 'Preview' : 'Edit'}
                    </Button>
                    {diaryEditing && (
                      <Button mode="contained" onPress={saveDiary} compact>
                        Save
                      </Button>
                    )}
                  </View>

                  <ScrollView style={{ flex: 1 }}>
                    {diaryEditing ? (
                      <TextInput
                        value={diaryContent}
                        onChangeText={setDiaryContent}
                        multiline
                        mode="flat"
                        style={{ minHeight: 300 }}
                        contentStyle={{ fontFamily: 'monospace', fontSize: 13 }}
                        underlineColor="transparent"
                      />
                    ) : (
                      <Markdown
                        style={{
                          body: { color: theme.colors.onSurface, padding: 8 },
                        }}
                      >
                        {diaryContent || '(empty)'}
                      </Markdown>
                    )}
                  </ScrollView>
                </>
              ) : (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('memory.selectEntry') || 'Select or create a diary entry'}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmented: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  editorScroll: {
    flex: 1,
    paddingHorizontal: 8,
  },
  editor: {
    minHeight: 400,
  },
  previewScroll: {
    flex: 1,
  },
  diaryLayout: {
    flex: 1,
  },
  diaryList: {
    maxHeight: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  diaryContent: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
});
