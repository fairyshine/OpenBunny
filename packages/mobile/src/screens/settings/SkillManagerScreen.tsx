import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSkillStore } from '@shared/stores/skills';

export default function SkillManagerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { skills, loadSkills } = useSkillStore();

  useEffect(() => {
    loadSkills();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {skills.length} skills available
        </Text>
      </View>

      <FlatList
        data={skills}
        keyExtractor={(item) => item.id}
        renderItem={({ item: skill }) => (
          <Card style={styles.card} mode="elevated">
            <Card.Title
              title={skill.name}
              subtitle={skill.description}
              subtitleNumberOfLines={2}
              titleStyle={{ fontSize: 14 }}
              subtitleStyle={{ fontSize: 12 }}
            />
          </Card>
        )}
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('skills.empty') || 'No skills loaded'}
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
});
