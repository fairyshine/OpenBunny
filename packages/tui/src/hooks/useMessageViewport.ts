import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInput } from 'ink';
import type { Message } from '@openbunny/shared/types';
import { MAX_VISIBLE_MESSAGES } from '../constants.js';
import { getSlidingWindow } from '../utils/formatting.js';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface MessageSearchResults {
  sessionId: string;
  query: string;
  caseSensitive: boolean;
  searchInToolOutput: boolean;
  matchIds: string[];
  activeIndex?: number;
}

interface UseMessageViewportOptions {
  sessionId: string | null;
  messages: Message[];
  preferredVisibleCount: number;
  panelVisible: boolean;
}

interface SearchState extends MessageSearchResults {
  activeIndex: number;
}

export function useMessageViewport({
  sessionId,
  messages,
  preferredVisibleCount,
  panelVisible,
}: UseMessageViewportOptions) {
  const visibleCount = clamp(preferredVisibleCount, 3, MAX_VISIBLE_MESSAGES);
  const [focusedIndex, setFocusedIndex] = useState(Math.max(0, messages.length - 1));
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const previousSessionIdRef = useRef<string | null>(sessionId);
  const previousMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (previousSessionIdRef.current !== sessionId) {
      previousSessionIdRef.current = sessionId;
      previousMessageCountRef.current = messages.length;
      setFocusedIndex(Math.max(0, messages.length - 1));
      setSearchState(null);
      return;
    }

    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    const lastIndex = Math.max(0, messages.length - 1);

    setFocusedIndex((current) => {
      if (messages.length === 0) {
        return 0;
      }

      if (current >= previousCount - 1) {
        return lastIndex;
      }

      return clamp(current, 0, lastIndex);
    });
  }, [messages.length, sessionId]);

  useEffect(() => {
    if (!searchState) {
      return;
    }

    if (searchState.sessionId !== sessionId) {
      setSearchState(null);
      return;
    }

    const messageIds = new Set(messages.map((message) => message.id));
    const nextMatchIds = searchState.matchIds.filter((messageId) => messageIds.has(messageId));

    if (nextMatchIds.length === searchState.matchIds.length) {
      return;
    }

    if (nextMatchIds.length === 0) {
      setSearchState(null);
      return;
    }

    setSearchState({
      ...searchState,
      matchIds: nextMatchIds,
      activeIndex: clamp(searchState.activeIndex, 0, nextMatchIds.length - 1),
    });
  }, [messages, searchState, sessionId]);

  useEffect(() => {
    if (!searchState) {
      return;
    }

    const activeMessageId = searchState.matchIds[searchState.activeIndex];
    if (!activeMessageId) {
      return;
    }

    const activeMessageIndex = messages.findIndex((message) => message.id === activeMessageId);
    if (activeMessageIndex >= 0 && activeMessageIndex !== focusedIndex) {
      setFocusedIndex(activeMessageIndex);
    }
  }, [focusedIndex, messages, searchState]);

  const applySearchResults = useCallback((results: MessageSearchResults | null) => {
    if (!results || results.matchIds.length === 0) {
      setSearchState(null);
      return;
    }

    if (!sessionId || results.sessionId !== sessionId) {
      return;
    }

    const activeIndex = clamp(results.activeIndex ?? (results.matchIds.length - 1), 0, results.matchIds.length - 1);
    setSearchState({ ...results, activeIndex });

    const targetMessageId = results.matchIds[activeIndex];
    const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
    if (targetIndex >= 0) {
      setFocusedIndex(targetIndex);
    }
  }, [messages, sessionId]);

  const moveFocus = useCallback((delta: number) => {
    setFocusedIndex((current) => clamp(current + delta, 0, Math.max(0, messages.length - 1)));
  }, [messages.length]);

  const jumpToIndex = useCallback((nextIndex: number) => {
    setFocusedIndex(clamp(nextIndex, 0, Math.max(0, messages.length - 1)));
  }, [messages.length]);

  const jumpSearchMatch = useCallback((delta: number) => {
    setSearchState((current) => {
      if (!current || current.matchIds.length === 0) {
        return current;
      }

      const nextActiveIndex = (current.activeIndex + delta + current.matchIds.length) % current.matchIds.length;
      const targetMessageId = current.matchIds[nextActiveIndex];
      const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
      if (targetIndex >= 0) {
        setFocusedIndex(targetIndex);
      }

      return {
        ...current,
        activeIndex: nextActiveIndex,
      };
    });
  }, [messages]);

  useInput((input, key) => {
    if (panelVisible || messages.length === 0) {
      return;
    }

    const pageStep = Math.max(1, visibleCount - 1);

    if (key.pageUp || (key.ctrl && input === 'u')) {
      moveFocus(-pageStep);
      return;
    }

    if (key.pageDown || (key.ctrl && input === 'd')) {
      moveFocus(pageStep);
      return;
    }

    if (key.home) {
      jumpToIndex(0);
      return;
    }

    if (key.end) {
      jumpToIndex(messages.length - 1);
      return;
    }

    if (key.ctrl && input === 'b') {
      jumpSearchMatch(-1);
      return;
    }

    if (key.ctrl && input === 'n') {
      jumpSearchMatch(1);
    }
  }, { isActive: true });

  const window = useMemo(
    () => getSlidingWindow(messages, focusedIndex, visibleCount),
    [focusedIndex, messages, visibleCount],
  );

  const visibleMessages = useMemo(
    () => window.items.map((message, index) => ({
      message,
      absoluteIndex: window.startIndex + index,
    })),
    [window.items, window.startIndex],
  );

  const focusedMessage = messages[focusedIndex] || null;
  const focusedMessageId = focusedMessage?.id || null;
  const activeSearchMessageId = searchState?.matchIds[searchState.activeIndex] || null;

  return {
    applySearchResults,
    visibleMessages,
    visibleCount,
    focusedMessageId,
    focusedIndex,
    activeSearchMessageId,
    hiddenBefore: window.hiddenBefore,
    hiddenAfter: window.hiddenAfter,
    rangeStart: visibleMessages.length > 0 ? window.startIndex + 1 : 0,
    rangeEnd: visibleMessages.length > 0 ? window.startIndex + visibleMessages.length : 0,
    searchState,
  };
}
