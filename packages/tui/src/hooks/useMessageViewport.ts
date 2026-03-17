import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInput } from 'ink';
import type { Message, Session } from '@openbunny/shared/types';
import { MAX_VISIBLE_MESSAGES } from '../constants.js';
import { buildTranscriptDocument } from '../utils/transcript.js';
import { useMouse } from './useMouse.js';

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
  session: Session | null;
  messages: Message[];
  preferredVisibleCount: number;
  panelVisible: boolean;
  contentWidth: number;
}

interface SearchState extends MessageSearchResults {
  activeIndex: number;
}

export function useMessageViewport({
  sessionId,
  session,
  messages,
  preferredVisibleCount,
  panelVisible,
  contentWidth,
}: UseMessageViewportOptions) {
  const visibleCount = clamp(preferredVisibleCount, 3, MAX_VISIBLE_MESSAGES);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const previousSessionIdRef = useRef<string | null>(sessionId);
  const previousMessageCountRef = useRef(messages.length);
  const previousLineCountRef = useRef(0);
  const dragYRef = useRef<number | null>(null);
  const activeSearchMessageId = searchState?.matchIds[searchState.activeIndex] || null;

  const transcript = useMemo(
    () => buildTranscriptDocument({
      session,
      messages,
      width: contentWidth,
      activeSearchMessageId,
    }),
    [activeSearchMessageId, contentWidth, messages, session],
  );

  const maxScrollOffset = Math.max(0, transcript.lines.length - visibleCount);

  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    const previousMessageCount = previousMessageCountRef.current;
    const previousLineCount = previousLineCountRef.current;
    const nextMaxOffset = Math.max(0, transcript.lines.length - visibleCount);

    previousSessionIdRef.current = sessionId;
    previousMessageCountRef.current = messages.length;
    previousLineCountRef.current = transcript.lines.length;

    if (previousSessionId !== sessionId) {
      setScrollOffset(nextMaxOffset);
      setSearchState(null);
      return;
    }

    setScrollOffset((current) => {
      if (transcript.lines.length === 0) {
        return 0;
      }

      const previousMaxOffset = Math.max(0, previousLineCount - visibleCount);
      const wasPinnedToBottom = current >= Math.max(0, previousMaxOffset - 1);

      if (messages.length > previousMessageCount && wasPinnedToBottom) {
        return nextMaxOffset;
      }

      if (transcript.lines.length !== previousLineCount && wasPinnedToBottom) {
        return nextMaxOffset;
      }

      return clamp(current, 0, nextMaxOffset);
    });
  }, [messages.length, sessionId, transcript.lines.length, visibleCount]);

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

  const moveScroll = useCallback((delta: number) => {
    setScrollOffset((current) => clamp(current + delta, 0, Math.max(0, transcript.lines.length - visibleCount)));
  }, [transcript.lines.length, visibleCount]);

  const jumpToOffset = useCallback((nextOffset: number) => {
    setScrollOffset(clamp(nextOffset, 0, Math.max(0, transcript.lines.length - visibleCount)));
  }, [transcript.lines.length, visibleCount]);

  const jumpToMessage = useCallback((messageId: string | null | undefined) => {
    if (!messageId) {
      return;
    }

    const nextOffset = transcript.messageStartIndices.get(messageId);
    if (typeof nextOffset === 'number') {
      jumpToOffset(nextOffset);
    }
  }, [jumpToOffset, transcript.messageStartIndices]);

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
    jumpToMessage(results.matchIds[activeIndex]);
  }, [jumpToMessage, sessionId]);

  const jumpSearchMatch = useCallback((delta: number) => {
    setSearchState((current) => {
      if (!current || current.matchIds.length === 0) {
        return current;
      }

      const nextActiveIndex = (current.activeIndex + delta + current.matchIds.length) % current.matchIds.length;
      jumpToMessage(current.matchIds[nextActiveIndex]);

      return {
        ...current,
        activeIndex: nextActiveIndex,
      };
    });
  }, [jumpToMessage]);

  useInput((input, key) => {
    if (panelVisible || transcript.lines.length === 0) {
      return;
    }

    const pageStep = Math.max(1, visibleCount - 1);

    if (key.pageUp || (key.ctrl && input === 'u')) {
      moveScroll(-pageStep);
      return;
    }

    if (key.pageDown || (key.ctrl && input === 'd')) {
      moveScroll(pageStep);
      return;
    }

    if (key.home) {
      jumpToOffset(0);
      return;
    }

    if (key.end) {
      jumpToOffset(maxScrollOffset);
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

  useMouse((event) => {
    if (panelVisible || transcript.lines.length === 0) {
      dragYRef.current = null;
      return;
    }

    if (event.type === 'wheel') {
      moveScroll(event.button === 'scrollUp' ? -2 : 2);
      return;
    }

    if (event.type === 'press' && event.button === 'left') {
      dragYRef.current = event.y;
      return;
    }

    if (event.type === 'release') {
      dragYRef.current = null;
      return;
    }

    if (event.type !== 'move' || event.button !== 'left' || dragYRef.current === null) {
      return;
    }

    const delta = event.y - dragYRef.current;
    if (delta === 0) {
      return;
    }

    dragYRef.current = event.y;
    moveScroll(delta);
  }, !panelVisible && transcript.lines.length > 0);

  const visibleLines = useMemo(
    () => transcript.lines.slice(scrollOffset, scrollOffset + visibleCount),
    [scrollOffset, transcript.lines, visibleCount],
  );

  const focusedMessageId = useMemo(() => {
    for (const line of visibleLines) {
      if (line.messageId) {
        return line.messageId;
      }
    }

    for (let index = scrollOffset - 1; index >= 0; index -= 1) {
      const messageId = transcript.lines[index]?.messageId;
      if (messageId) {
        return messageId;
      }
    }

    return messages.at(-1)?.id || null;
  }, [messages, scrollOffset, transcript.lines, visibleLines]);

  return {
    applySearchResults,
    visibleLines,
    visibleCount,
    focusedMessageId,
    activeSearchMessageId,
    hiddenBefore: scrollOffset,
    hiddenAfter: Math.max(0, transcript.lines.length - (scrollOffset + visibleLines.length)),
    rangeStart: visibleLines.length > 0 ? scrollOffset + 1 : 0,
    rangeEnd: visibleLines.length > 0 ? scrollOffset + visibleLines.length : 0,
    totalLines: transcript.lines.length,
    searchState,
  };
}
