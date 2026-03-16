import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { Session } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import {
  getSessionTypeLabel,
  isReadOnlySession,
} from '../../utils/sessionPresentation.js';

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
  session: Session | null;
  sessionConfigScope: string;
  sessionConfigState: string;
  enabledToolCount: number;
  enabledSkillCount: number;
  width: number;
  disabledReason?: string;
}

export function InputBar({
  input,
  setInput,
  onSubmit,
  disabled,
  readOnly,
  session,
  sessionConfigScope,
  sessionConfigState,
  enabledToolCount,
  enabledSkillCount,
  width,
  disabledReason,
}: InputBarProps) {
  const readOnlySession = isReadOnlySession(session);
  const readOnlyHint = readOnlySession
    ? `${getSessionTypeLabel(session)} is read-only. Slash commands still work.`
    : null;

  return (
    <Box paddingX={1} marginTop={1} flexDirection="column">
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

        <Box>
          <Text color={disabled ? T.fgMuted : T.accent} bold>
            {disabled ? '◌ ' : '❯ '}
          </Text>
          {!disabled ? (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              placeholder={readOnly
                ? 'Use /stop, /export, /search, or /help'
                : 'Type a message or /help'}
            />
          ) : (
            <Text color={T.fgMuted} italic>{disabledReason || 'Waiting...'}</Text>
          )}
        </Box>

        <Text color={T.border}>{'─'.repeat(Math.max(1, width - 8))}</Text>

        <Box>
          <Text color={T.fgSubtle}>
            {disabled ? (disabledReason || 'busy') : (readOnly ? 'Enter run command' : 'Enter send')}
            {' · '}
            {sessionConfigScope}
            {'/'}
            {sessionConfigState}
            {' · '}
            {enabledToolCount} tool
            {' · '}
            {enabledSkillCount} skill
            {' · '}
            /help
            {' · '}
            /sessions
            {' · '}
            {readOnly ? '/stop' : '/files'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
