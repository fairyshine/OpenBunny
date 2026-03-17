import { useEffect, useRef, useState } from 'react';
import type { DOMElement } from 'ink';
import { Box, Text, useCursor, useFocus, useFocusManager, useInput } from 'ink';
import type { Session } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { getSessionTypeLabel, isReadOnlySession } from '../../utils/sessionPresentation.js';

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  onExit: () => void;
  disabled: boolean;
  isLoading: boolean;
  readOnly: boolean;
  session: Session | null;
  sessionConfigScope: string;
  sessionConfigState: string;
  enabledToolCount: number;
  availableToolCount: number;
  enabledSkillCount: number;
  totalSkillCount: number;
  width: number;
  disabledReason?: string;
  modeLabel?: string | null;
  contextLabels?: string[];
}

function getAbsolutePosition(node: DOMElement | null) {
  let currentNode = node;
  let x = 0;
  let y = 0;

  while (currentNode?.parentNode) {
    if (!currentNode.yogaNode) {
      return null;
    }

    x += currentNode.yogaNode.getComputedLeft();
    y += currentNode.yogaNode.getComputedTop();
    currentNode = currentNode.parentNode;
  }

  return { x, y };
}

function getDisplayWidth(text: string) {
  let width = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!codePoint || codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }

    width += (
      (codePoint >= 0x1100 && codePoint <= 0x115f)
      || codePoint === 0x2329
      || codePoint === 0x232a
      || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
      || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
      || (codePoint >= 0xf900 && codePoint <= 0xfaff)
      || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
      || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
      || (codePoint >= 0xff00 && codePoint <= 0xff60)
      || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
      || (codePoint >= 0x1f300 && codePoint <= 0x1faf6)
    ) ? 2 : 1;
  }

  return width;
}

function ManagedInput({
  input,
  setInput,
  onSubmit,
  disabled,
  placeholder,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const { focus } = useFocusManager();
  const { setCursorPosition } = useCursor();
  const { isFocused } = useFocus({
    id: 'chat-input',
    autoFocus: true,
    isActive: !disabled,
  });
  const wasDisabledRef = useRef(disabled);
  const inputRef = useRef<DOMElement | null>(null);
  const [cursorOffset, setCursorOffset] = useState(input.length);
  const [cursorBasePosition, setCursorBasePosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (wasDisabledRef.current && !disabled) {
      focus('chat-input');
    }

    wasDisabledRef.current = disabled;
  }, [disabled, focus]);

  useEffect(() => {
    setCursorOffset((current) => Math.min(current, input.length));
  }, [input]);

  useEffect(() => {
    const nextPosition = getAbsolutePosition(inputRef.current);
    setCursorBasePosition((current) => {
      if (!nextPosition && !current) {
        return current;
      }

      if (!nextPosition || !current) {
        return nextPosition;
      }

      if (nextPosition.x === current.x && nextPosition.y === current.y) {
        return current;
      }

      return nextPosition;
    });
  });

  useInput((value, key) => {
    if (key.upArrow || key.downArrow || key.tab || (key.ctrl && value === 'c')) {
      return;
    }

    if (key.return) {
      onSubmit(input);
      return;
    }

    if (key.leftArrow) {
      setCursorOffset((current) => Math.max(0, current - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorOffset((current) => Math.min(input.length, current + 1));
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorOffset === 0) {
        return;
      }

      const nextValue = input.slice(0, cursorOffset - 1) + input.slice(cursorOffset);
      setInput(nextValue);
      setCursorOffset((current) => Math.max(0, current - 1));
      return;
    }

    if (key.ctrl && value === 'a') {
      setCursorOffset(0);
      return;
    }

    if (key.ctrl && value === 'e') {
      setCursorOffset(input.length);
      return;
    }

    if (!value) {
      return;
    }

    const nextValue = input.slice(0, cursorOffset) + value + input.slice(cursorOffset);
    setInput(nextValue);
    setCursorOffset((current) => current + value.length);
  }, { isActive: !disabled && isFocused });

  if (!disabled && isFocused && cursorBasePosition) {
    setCursorPosition({
      x: cursorBasePosition.x + getDisplayWidth(input.slice(0, cursorOffset)),
      y: cursorBasePosition.y + 1,
    });
  } else {
    setCursorPosition(undefined);
  }

  const displayValue = input.length > 0 ? input : placeholder;
  const displayColor = input.length > 0 ? undefined : T.fgMuted;

  return (
    <Box ref={inputRef}>
      <Text color={displayColor}>{displayValue}</Text>
    </Box>
  );
}

export function InputBar({
  input,
  setInput,
  onSubmit,
  onExit,
  disabled,
  isLoading,
  readOnly,
  session,
  sessionConfigScope,
  sessionConfigState,
  enabledToolCount,
  availableToolCount,
  enabledSkillCount,
  totalSkillCount,
  width,
  disabledReason,
  modeLabel,
  contextLabels = [],
}: InputBarProps) {
  const readOnlySession = isReadOnlySession(session);
  const readOnlyHint = readOnlySession
    ? `${getSessionTypeLabel(session)} is read-only. Slash commands still work.`
    : null;

  useInput((value, key) => {
    if (key.ctrl && value === 'c') {
      onExit();
    }
  });

  return (
    <Box paddingX={1} marginTop={1} flexDirection="column" flexShrink={0}>
      <Box
        borderStyle="round"
        borderColor={disabled ? T.borderLight : T.borderFocus}
        paddingX={1}
        flexDirection="column"
        width={Math.max(24, width - 2)}
      >
        {readOnly && !disabled && readOnlyHint && (
          <Text color={T.warn}>{readOnlyHint}</Text>
        )}

        <Box flexDirection="column" marginBottom={1}>
          <Text color={T.fgSubtle}>
            Tools <Text color={T.sTools}>{enabledToolCount}/{availableToolCount}</Text>
            <Text color={T.fgSubtle}> · </Text>
            Skills <Text color={T.sSkills}>{enabledSkillCount}/{totalSkillCount}</Text>
          </Text>
          {modeLabel && (
            <Text color={T.info}>{modeLabel}</Text>
          )}
          {contextLabels.map((label) => (
            <Text key={label} color={T.fgMuted} wrap="truncate-end">
              {label}
            </Text>
          ))}
        </Box>

        <Box>
          <Text color={disabled ? T.fgMuted : T.accent} bold>
            {disabled ? '◌ ' : '❯ '}
          </Text>
          <ManagedInput
            input={input}
            setInput={setInput}
            onSubmit={onSubmit}
            disabled={disabled}
            placeholder={disabled
              ? (disabledReason || 'Waiting...')
              : isLoading
                ? (readOnly ? 'Use /stop while replying' : 'Type while OpenBunny replies. Enter sends after /stop')
              : readOnly
                ? 'Use /stop, /export, /search, or /help'
                : 'Ask anything, use @file for context, !cmd for shell, or /help'}
          />
        </Box>

        <Text color={T.border}>{'─'.repeat(Math.max(1, width - 8))}</Text>

        <Box>
          <Text color={T.fgSubtle}>
            {disabled
              ? (disabledReason || 'busy')
              : isLoading
                ? (readOnly ? 'Replying · Enter run /stop' : 'Replying · keep typing · Enter waits')
                : (readOnly ? 'Enter run command' : 'Enter send')}
            {' · '}
            {sessionConfigScope}
            {'/'}
            {sessionConfigState}
            {' · '}
            {enabledToolCount} tool
            {' · '}
            {enabledSkillCount} skill
            {' · '}
            {isLoading ? '/stop' : '/search'}
            {' · '}
            /export
            {' · '}
            /help
            {' · '}
            /tabs
            {' · '}
            PgUp/PgDn
            {' · '}
            {readOnly ? '/stop' : '/files'}
            {' · '}
            /write
            {' · '}
            Ctrl+C
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
