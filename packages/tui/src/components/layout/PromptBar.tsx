import TextInput from 'ink-text-input';
import { Box, Text, useInput } from 'ink';
import { T } from '../../theme.js';

export function PromptBar({
  input,
  setInput,
  onSubmit,
  onExit,
  isLoading,
  disabled = false,
  statusLabel,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  onExit: () => void;
  isLoading: boolean;
  disabled?: boolean;
  statusLabel?: string;
}) {
  useInput((value, key) => {
    if (key.ctrl && value === 'c') {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={statusLabel ? (isLoading ? T.warn : T.info) : T.fgSubtle}>
        {statusLabel || (isLoading
          ? '回复中，可继续输入；发送新消息前请先 `/stop`。'
          : 'Enter 发送，/help 查看命令，Ctrl+C 退出。')}
      </Text>
      <Box borderStyle="round" borderColor={disabled ? T.borderLight : (isLoading ? T.warn : T.borderFocus)} paddingX={1}>
        <Text color={isLoading ? T.warn : T.accent} bold>
          {disabled ? '◌ ' : isLoading ? '… ' : '› '}
        </Text>
        <Box flexGrow={1}>
          {disabled ? (
            <Text color={input.length > 0 ? T.fg : T.fgMuted}>
              {input.length > 0 ? input : 'Type a message or /help'}
            </Text>
          ) : (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              placeholder="Type a message or /help"
            />
          )}
        </Box>
      </Box>
      <Text color={T.fgSubtle}>
        {disabled
          ? '正在初始化会话和技能...'
          : isLoading
            ? '/stop 中断当前回复 · 继续输入会保留在输入框'
            : '/new 新会话 · /tabs 标签页 · /files 工作区'}
      </Text>
    </Box>
  );
}
