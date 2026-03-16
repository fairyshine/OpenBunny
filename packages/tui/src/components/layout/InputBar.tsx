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
  const borderColor = disabled ? T.borderLight : T.borderFocus;

  return (
    <Box paddingX={1} marginTop={1} flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        flexDirection="column"
        width={Math.max(24, width - 4)}
      >
        <Box justifyContent="space-between">
          <Text color={disabled ? T.fgMuted : T.accent} bold>Prompt</Text>
          <Text color={T.fgSubtle}>{disabled ? disabledReason || 'busy' : 'Enter send'}</Text>
        </Box>

        <Box marginTop={1}>
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

        <Box marginTop={1}>
          <Text color={T.fgSubtle}>Slash commands: </Text>
          <Text color={T.fgMuted}>/help</Text>
          <Text color={T.fgSubtle}> · </Text>
          <Text color={T.fgMuted}>/sessions</Text>
          <Text color={T.fgSubtle}> · </Text>
          <Text color={T.fgMuted}>/tools</Text>
        </Box>
      </Box>
    </Box>
  );
}
