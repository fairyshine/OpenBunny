import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Text,
  List,
  SegmentedButtons,
  Divider,
  IconButton,
  useTheme,
  Menu,
  TextInput,
  Button,
  Portal,
  Modal,
} from 'react-native-paper';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useSessionStore, selectActiveSessions, selectDeletedSessions } from '@shared/stores/session';
import type { ChatStackNavigationProp } from '../../navigation/types';
import FileTreeMobile from './FileTreeMobile';

export default function DrawerContent(props: any) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<ChatStackNavigationProp>();
  const [view, setView] = useState<'sessions' | 'files'>('sessions');
  const [showTrash, setShowTrash] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const { createSession, deleteSession, renameSession, restoreSession, permanentlyDeleteSession, clearTrash, setCurrentSession } = useSessionStore();
  const activeSessions = useSessionStore(selectActiveSessions);
  const deletedSessions = useSessionStore(selectDeletedSessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  const handleNewSession = () => {
    const session = createSession(t('header.newSession'));
    navigation.navigate('ChatTab', { screen: 'Chat', params: { sessionId: session.id } } as any);
    props.navigation.closeDrawer();
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSession(sessionId);
    navigation.navigate('ChatTab', { screen: 'Chat', params: { sessionId } } as any);
    props.navigation.closeDrawer();
  };

  const handleRenameStart = (sessionId: string, currentName: string) => {
    setMenuSessionId(null);
    setRenameId(sessionId);
    setRenameText(currentName);
  };

  const handleRenameConfirm = () => {
    if (renameId && renameText.trim()) {
      renameSession(renameId, renameText.trim());
    }
    setRenameId(null);
    setRenameText('');
  };

  const handleDeleteSession = (sessionId: string) => {
    setMenuSessionId(null);
    deleteSession(sessionId);
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>OpenBunny</Text>
        <IconButton icon="plus" size={20} onPress={handleNewSession} />
      </View>

      <SegmentedButtons
        value={view}
        onValueChange={(v) => setView(v as 'sessions' | 'files')}
        buttons={[
          { value: 'sessions', label: t('sidebar.sessions') || 'Sessions', icon: 'message-text' },
          { value: 'files', label: t('sidebar.files') || 'Files', icon: 'folder' },
        ]}
        style={styles.segmented}
      />

      <Divider style={{ marginVertical: 4 }} />

      {view === 'sessions' ? (
        <View style={styles.content}>
          {activeSessions.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('chat.noSessionHint')}
            </Text>
          ) : (
            activeSessions.map((session) => (
              <View key={session.id}>
                {renameId === session.id ? (
                  <View style={styles.renameRow}>
                    <TextInput
                      value={renameText}
                      onChangeText={setRenameText}
                      mode="outlined"
                      dense
                      style={{ flex: 1 }}
                      autoFocus
                      onSubmitEditing={handleRenameConfirm}
                    />
                    <IconButton icon="check" size={18} onPress={handleRenameConfirm} />
                  </View>
                ) : (
                  <List.Item
                    title={session.name}
                    description={`${session.messages.length} msgs`}
                    onPress={() => handleSelectSession(session.id)}
                    onLongPress={() => setMenuSessionId(session.id)}
                    style={[
                      currentSessionId === session.id && {
                        backgroundColor: theme.colors.secondaryContainer,
                        borderRadius: 8,
                      },
                    ]}
                    left={(p) => <List.Icon {...p} icon="message-outline" />}
                    right={() =>
                      menuSessionId === session.id ? (
                        <View style={{ flexDirection: 'row' }}>
                          <IconButton
                            icon="pencil"
                            size={16}
                            onPress={() => handleRenameStart(session.id, session.name)}
                          />
                          <IconButton
                            icon="delete"
                            size={16}
                            onPress={() => handleDeleteSession(session.id)}
                          />
                          <IconButton
                            icon="close"
                            size={16}
                            onPress={() => setMenuSessionId(null)}
                          />
                        </View>
                      ) : null
                    }
                  />
                )}
              </View>
            ))
          )}

          <Divider style={{ marginVertical: 8 }} />

          <List.Accordion
            title={t('sidebar.trash') || 'Trash'}
            left={(p) => <List.Icon {...p} icon="delete-outline" />}
            description={`${deletedSessions.length} items`}
            expanded={showTrash}
            onPress={() => setShowTrash(!showTrash)}
          >
            {deletedSessions.map((session) => (
              <List.Item
                key={session.id}
                title={session.name}
                right={() => (
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="restore" size={16} onPress={() => restoreSession(session.id)} />
                    <IconButton
                      icon="delete-forever"
                      size={16}
                      onPress={() => {
                        Alert.alert(
                          t('sidebar.permanentDelete') || 'Delete permanently?',
                          '',
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('common.delete') || 'Delete', style: 'destructive', onPress: () => permanentlyDeleteSession(session.id) },
                          ]
                        );
                      }}
                    />
                  </View>
                )}
              />
            ))}
            {deletedSessions.length > 0 && (
              <Button
                mode="text"
                onPress={() => {
                  Alert.alert(
                    t('sidebar.clearTrash') || 'Clear trash?',
                    '',
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.confirm') || 'OK', onPress: () => clearTrash() },
                    ]
                  );
                }}
                style={{ marginHorizontal: 16 }}
              >
                {t('sidebar.clearTrash') || 'Clear Trash'}
              </Button>
            )}
          </List.Accordion>
        </View>
      ) : (
        <FileTreeMobile
          onFileSelect={(filePath, fileName) => {
            navigation.navigate('ChatTab', {
              screen: 'FileEditor',
              params: { filePath, fileName },
            } as any);
            props.navigation.closeDrawer();
          }}
        />
      )}
    </DrawerContentScrollView>
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
  segmented: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  content: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    opacity: 0.5,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
