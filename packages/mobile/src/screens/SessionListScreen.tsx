import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { DrawerActions } from '@react-navigation/native';
import { Appbar, List, FAB, IconButton, Text } from 'react-native-paper';
import { deleteChatSessionPair } from '@openbunny/shared/services/ai/chat';
import { DEFAULT_AGENT_ID } from '@openbunny/shared/stores/agent';
import { useSessionStore, selectActiveSessions } from '@openbunny/shared/stores/session';
import type { SessionListScreenNavigationProp } from '../navigation/types';

export default function SessionListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<SessionListScreenNavigationProp>();
  const { createSession, deleteSession } = useSessionStore();
  const sessions = useSessionStore(selectActiveSessions);

  const handleCreateSession = () => {
    const session = createSession(t('header.newSession'));
    navigation.navigate('Chat', { sessionId: session.id });
  };

  const handleSelectSession = (sessionId: string) => {
    navigation.navigate('Chat', { sessionId });
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (session?.sessionType === 'agent' && session.chatSession?.peerSessionId) {
      deleteChatSessionPair(DEFAULT_AGENT_ID, sessionId);
      return;
    }
    deleteSession(sessionId);
  };

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.Action icon="menu" onPress={openDrawer} />
          <Appbar.Content title={t('header.newSession')} />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            {t('chat.noSessionHint')}
          </Text>
        </View>
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleCreateSession}
          label={t('header.newSession')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={openDrawer} />
        <Appbar.Content title="Sessions" />
      </Appbar.Header>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.messages.length} msgs`}
            onPress={() => handleSelectSession(item.id)}
            style={item.isStreaming ? styles.streamingItem : undefined}
            right={(props) => (
              <IconButton
                {...props}
                icon="delete"
                onPress={() => handleDeleteSession(item.id)}
              />
            )}
          />
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={handleCreateSession} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  streamingItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#000',
  },
});
