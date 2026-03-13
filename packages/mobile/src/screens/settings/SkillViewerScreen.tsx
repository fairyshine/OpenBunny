import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useSkillStore } from '@openbunny/shared/stores/skills';
import type { SkillViewerRouteProp } from '../../navigation/types';

export default function SkillViewerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const route = useRoute<SkillViewerRouteProp>();
  const { skillId } = route.params;
  const { skills, loadSkills } = useSkillStore();

  useEffect(() => {
    loadSkills();
  }, []);

  const skill = skills.find(s => s.id === skillId);

  if (!skill) {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {t('skills.notFound') || 'Skill not found'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.metaSection, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleMedium">{skill.name}</Text>
        <Text variant="bodySmall" style={{ marginTop: 4 }}>{skill.description}</Text>
      </View>

      <ScrollView style={styles.contentArea}>
        <Text
          variant="bodySmall"
          style={[styles.codeText, { color: theme.colors.onSurface }]}
        >
          {skill.body}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  metaSection: {
    padding: 16,
  },
  contentArea: {
    flex: 1,
    padding: 16,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
});
