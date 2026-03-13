import { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { callLLM } from '@openbunny/shared/services/llm/streaming';
import type { LLMConfig } from '@openbunny/shared/types';
import type { ModelMessage } from 'ai';

interface AppProps {
  config: LLMConfig;
  systemPrompt?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function App({ config, systemPrompt }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ModelMessage[]>(
    systemPrompt ? [{ role: 'system', content: systemPrompt }] : []
  );
  const [streaming, setStreaming] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    if (trimmed === '/quit' || trimmed === '/exit') {
      exit();
      return;
    }

    if (trimmed === '/clear') {
      setMessages([]);
      setHistory(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []);
      setError('');
      setInput('');
      return;
    }

    setInput('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);

    const newHistory: ModelMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(newHistory);
    setIsLoading(true);
    setStreaming('');

    try {
      const result = await callLLM(config, newHistory, {
        onChunk: (full) => setStreaming(full),
      });

      setStreaming('');
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
      setHistory(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setStreaming('');
      setError(err instanceof Error ? err.message : String(err));
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [config, history, isLoading, systemPrompt, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">OpenBunny TUI</Text>
        <Text color="gray"> | {config.model} | {config.provider} | /quit to exit</Text>
      </Box>

      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
            {msg.role === 'user' ? '> ' : '🐰 '}
          </Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        </Box>
      ))}

      {streaming && (
        <Box marginBottom={1} flexDirection="column">
          <Text bold color="blue">🐰 </Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{streaming}</Text>
          </Box>
        </Box>
      )}

      {isLoading && !streaming && (
        <Box marginBottom={1}>
          <Text color="yellow">
            <Spinner type="dots" />
            {' '}Thinking...
          </Text>
        </Box>
      )}

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      <Box>
        <Text color="green" bold>{isLoading ? '  ' : '> '}</Text>
        {!isLoading && (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type a message..."
          />
        )}
      </Box>
    </Box>
  );
}

export default App;
