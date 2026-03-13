import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Share, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Appbar, TextInput, Text, useTheme } from 'react-native-paper';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import type { FileEditorRouteProp } from '../navigation/types';

export default function FileEditorScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const route = useRoute<FileEditorRouteProp>();
  const navigation = useNavigation();
  const { filePath, fileName } = route.params;

  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFile();
  }, [filePath]);

  const loadFile = async () => {
    try {
      const text = await fileSystem.readFileText(filePath);
      setContent(text || '');
      setOriginalContent(text || '');
    } catch (error) {
      Alert.alert('Error', `Failed to read file: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fileSystem.writeFile(filePath, content);
      setOriginalContent(content);
    } catch (error) {
      Alert.alert('Error', `Failed to save file: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: content,
        title: fileName,
      });
    } catch (error) {
      // User cancelled
    }
  };

  const isDirty = content !== originalContent;
  const lineCount = content.split('\n').length;
  const charCount = content.length;

  // Detect language from extension
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', json: 'JSON', md: 'Markdown', html: 'HTML', css: 'CSS',
    txt: 'Text', yaml: 'YAML', yml: 'YAML', xml: 'XML', sh: 'Shell',
  };
  const language = languageMap[ext] || ext.toUpperCase() || 'Text';

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => {
          if (isDirty) {
            Alert.alert(
              t('files.unsavedChanges') || 'Unsaved Changes',
              t('files.unsavedChangesDesc') || 'You have unsaved changes. Discard?',
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('files.discard') || 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
                { text: t('files.save') || 'Save', onPress: async () => { await handleSave(); navigation.goBack(); } },
              ]
            );
          } else {
            navigation.goBack();
          }
        }} />
        <Appbar.Content title={fileName} titleStyle={{ fontSize: 14 }} />
        <Appbar.Action icon="share-variant" onPress={handleShare} />
        <Appbar.Action
          icon="content-save"
          onPress={handleSave}
          disabled={!isDirty || saving}
        />
      </Appbar.Header>

      <ScrollView style={styles.editorContainer} keyboardShouldPersistTaps="handled">
        <TextInput
          value={content}
          onChangeText={setContent}
          multiline
          mode="flat"
          style={[styles.editor, { fontFamily: 'monospace', backgroundColor: theme.colors.background }]}
          contentStyle={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />
      </ScrollView>

      <View style={[styles.statusBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {language}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          UTF-8
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {lineCount} lines
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {charCount} chars
        </Text>
        {isDirty && (
          <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            Modified
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
    minHeight: 400,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
