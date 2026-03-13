import type { ChatSessionMeta, Message, MindSessionMeta, Session } from '../types';
import { mergeMessageWithPresentation, normalizeMessagePresentation } from '../utils/messagePresentation';

interface SessionMutationOptions {
  skipDeleted?: boolean;
}

interface SessionMutationResult<T extends Session> {
  sessions: T[];
  updatedSession?: T;
}

interface MessageUpdateResult<T extends Session> extends SessionMutationResult<T> {
  previousMessage?: Message;
  nextMessage?: Message;
}

export function stripTransientSessionState<T extends Session>(session: T): T {
  const { isStreaming: _isStreaming, ...rest } = session;
  return rest as T;
}

export function clearStreamingMessageFlags(messages: Message[]): Message[] {
  return messages.map((message) => (
    message.metadata?.streaming
      ? mergeMessageWithPresentation(message, {
          metadata: {
            ...message.metadata,
            streaming: false,
          },
        })
      : normalizeMessagePresentation(message)
  ));
}

export function appendSessionMessageState<T extends Session>(
  sessions: T[],
  sessionId: string,
  message: Message,
  options: SessionMutationOptions = {},
): SessionMutationResult<T> {
  const normalizedMessage = normalizeMessagePresentation(message);
  const updatedAt = Date.now();
  let updatedSession: T | undefined;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    if (options.skipDeleted && session.deletedAt) return session;

    updatedSession = {
      ...session,
      messages: [...session.messages, normalizedMessage],
      updatedAt,
    } as T;

    return updatedSession;
  });

  return { sessions: nextSessions, updatedSession };
}

export function updateSessionMessageState<T extends Session>(
  sessions: T[],
  sessionId: string,
  messageId: string,
  updates: Partial<Message>,
  options: SessionMutationOptions = {},
): MessageUpdateResult<T> {
  let previousMessage: Message | undefined;
  let nextMessage: Message | undefined;
  let updatedSession: T | undefined;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    if (options.skipDeleted && session.deletedAt) return session;

    const nextMessages = session.messages.map((message) => {
      if (message.id !== messageId) return message;
      previousMessage = message;
      nextMessage = mergeMessageWithPresentation(message, updates);
      return nextMessage;
    });

    updatedSession = {
      ...session,
      messages: nextMessages,
    } as T;

    return updatedSession;
  });

  return { sessions: nextSessions, updatedSession, previousMessage, nextMessage };
}

export function updateSessionMindMetaState<T extends Session>(
  sessions: T[],
  sessionId: string,
  mindSession: MindSessionMeta,
): T[] {
  const updatedAt = Date.now();

  return sessions.map((session) => (
    session.id === sessionId
      ? { ...session, mindSession: { ...session.mindSession, ...mindSession }, updatedAt } as T
      : session
  ));
}

export function updateSessionChatMetaState<T extends Session>(
  sessions: T[],
  sessionId: string,
  chatSession: ChatSessionMeta,
): T[] {
  const updatedAt = Date.now();

  return sessions.map((session) => (
    session.id === sessionId
      ? { ...session, chatSession: { ...session.chatSession, ...chatSession }, updatedAt } as T
      : session
  ));
}
