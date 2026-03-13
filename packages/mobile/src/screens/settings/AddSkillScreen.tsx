import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useSkillStore } from '@openbunny/shared/stores/skills';
import { generateSkillTemplate } from '@openbunny/shared/services/skills';

export default function AddSkillScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { createSkill, updateSkill } = useSkillStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      if (useTemplate) {
        if (!description.trim()) {
          Alert.alert('Error', 'Description is required');
          setLoading(false);
          return;
        }
        await createSkill(name.trim(), description.trim());
      } else {
        if (!content.trim()) {
          Alert.alert('Error', 'SKILL.md content is required');
          setLoading(false);
          return;
        }
        await updateSkill(name.trim(), content.trim());
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Generate preview when name/description change
  const templatePreview = name && description
    ? generateSkillTemplate(name.trim(), description.trim())
    : '';

  return (
    <ScrollView style={styles.container}>
      <TextInput
        label={t('skills.name')}
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
        placeholder={t('skills.namePlaceholder')}
      />
      <Text variant="bodySmall" style={styles.hint}>
        {t('skills.nameHint')}
      </Text>

      <TextInput
        label={t('skills.description')}
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        style={styles.input}
        placeholder="What this skill does..."
        multiline
        numberOfLines={3}
      />

      {!useTemplate && (
        <TextInput
          label="SKILL.md"
          value={content}
          onChangeText={setContent}
          mode="outlined"
          multiline
          numberOfLines={15}
          style={[styles.input, { minHeight: 300 }]}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      )}

      {useTemplate && templatePreview ? (
        <View style={styles.previewBox}>
          <Text variant="labelSmall" style={styles.previewLabel}>
            {t('skills.preview')}
          </Text>
          <Text variant="bodySmall" style={styles.previewText}>
            {templatePreview}
          </Text>
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={handleAdd}
        loading={loading}
        disabled={loading || !name.trim()}
        style={styles.button}
      >
        {t('skills.create')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    marginVertical: 8,
  },
  hint: {
    marginHorizontal: 4,
    opacity: 0.6,
  },
  button: {
    marginTop: 16,
    marginBottom: 32,
  },
  previewBox: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  previewLabel: {
    marginBottom: 8,
    opacity: 0.6,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
