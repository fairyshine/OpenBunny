import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { T } from '../../theme.js';

interface InputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  width: number;
  disabledReason?: string;
}

export function InputBar({ input, setInput, onSubmit, disabled, width, disabledReason }: InputBarProps) {
  return (
    <Box paddingX={1} marginTop={1} flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={disabled ? T.borderLight : T.borderFocus}
        paddingX={1}
        flexDirection="column"
        width={Math.max(24, width - 2)}
      >
        <Box>
          <Text color={disabled ? T.fgMuted : T.accent} bold>
            {disabled ? '◌ ' : '❯ '}
          </Text>
          {!disabled ? (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              placeholder="Type a message or /help"
            />
          ) : (
            <Text color={T.fgMuted} italic>{disabledReason || 'Waiting...'}</Text>
          )}
        </Box>

        <Text color={T.border}>{'─'.repeat(Math.max(1, width - 8))}</Text>

        <Box>
          <Text color={T.fgSubtle}>
            {disabled ? (disabledReason || 'busy') : 'Enter send'}
            {' · '}
            /help
            {' · '}
            /sessions
            {' · '}
            /tools
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
