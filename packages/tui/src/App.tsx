import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { callLLM } from '@openbunny/shared/services/llm/streaming';
import { useSessionStore, selectActiveSessions } from '@openbunny/shared/stores/session';
import { flushAllSessionPersistence } from '@openbunny/shared/services/storage/sessionPersistence';
import type { LLMConfig } from '@openbunny/shared/types';
import type { ModelMessage } from 'ai';

interface AppProps {
  config: LLMConfig;
  systemPrompt?: string;
  workspace?: string;
  configDir?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function App({ config, systemPrompt, workspace, configDir }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ModelMessage[]>(
    systemPrompt ? [{ role: 'system', content: systemPrompt }] : []
  );
  const [streaming, setStreaming] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const sessionIdRef = useRef<string | null>(null);

  // Create session on mount
  useEffect(() => {
    const session = useSessionStore.getState().createSession('TUI Chat');
    sessionIdRef.current = session.id;
  }, []);

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    if (trimmed === '/quit' || trimmed === '/exit') {
      await flushAllSessionPersistence();
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

    if (trimmed === '/help') {
      const helpLines = [
        '',
        '  Configuration',
        `    Provider:    ${config.provider}`,
        `    Model:       ${config.model}`,
        `    Temperature: ${config.temperature}`,
        `    Max tokens:  ${config.maxTokens}`,
        ...(workspace ? [`    Workspace:   ${workspace}`] : []),
        ...(configDir ? [`    Config dir:  ${configDir}`] : []),
        ...(sessionIdRef.current ? [`    Session:     ${sessionIdRef.current.slice(0, 8)}`] : []),
        '',
        '  Commands',
        '    /help       Show this help',
        '    /clear      Clear conversation history',
        '    /history    Show session info',
        '    /sessions   List available sessions',
        '    /resume <id> Resume a previous session',
        '    /quit       Exit',
        '',
      ];
      setMessages(prev => [...prev, { role: 'system', content: helpLines.join('\n') }]);
      setInput('');
      return;
    }

    if (trimmed === '/history') {
      const messageCount = history.filter((m) => m.role !== 'system').length;
      const sid = sessionIdRef.current?.slice(0, 8) ?? '—';
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Session ${sid} — ${messageCount} message(s) in history.`,
      }]);
      setInput('');
      return;
    }

    if (trimmed === '/sessions') {
      const sessions = selectActiveSessions(useSessionStore.getState());
      if (sessions.length === 0) {
        setMessages(prev => [...prev, { role: 'system', content: 'No sessions found.' }]);
      } else {
        const lines = sessions.map((s) => {
          const shortId = s.id.slice(0, 8);
          const date = new Date(s.createdAt).toLocaleString();
          const msgCount = s.messages.length;
          return `  ${shortId}  ${s.name}  ${msgCount} msg(s)  ${date}`;
        });
        setMessages(prev => [...prev, {
          role: 'system',
          content: `${sessions.length} session(s):\n${lines.join('\n')}`,
        }]);
      }
      setInput('');
      return;
    }

    if (trimmed.startsWith('/resume ')) {
      const idPrefix = trimmed.slice('/resume '.length).trim();
      if (!idPrefix) {
        setMessages(prev => [...prev, { role: 'system', content: 'Usage: /resume <session-id-prefix>' }]);
        setInput('');
        return;
      }

      const store = useSessionStore.getState();
      const match = store.sessions.find((s) => s.id.startsWith(idPrefix));
      if (!match) {
        setMessages(prev => [...prev, { role: 'system', content: `No session found matching "${idPrefix}"` }]);
        setInput('');
        return;
      }

      // Load messages if needed
      if (match.messages.length === 0) {
        await store.loadSessionMessages(match.id);
      }

      const loaded = useSessionStore.getState().sessions.find((s) => s.id === match.id);
      const msgs = loaded?.messages ?? [];

      // Rebuild history and display messages
      const newHistory: ModelMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }]
        : [];
      const newMessages: ChatMessage[] = [];

      for (const msg of msgs) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          newHistory.push({ role: msg.role, content: msg.content });
          newMessages.push({ role: msg.role, content: msg.content });
        }
      }

      sessionIdRef.current = match.id;
      setHistory(newHistory);
      setMessages(newMessages);
      setError('');
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Resumed session ${match.id.slice(0, 8)} (${match.name}) — ${msgs.length} message(s)`,
      }]);
      setInput('');
      return;
    }

    setInput('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);

    // Persist user message
    if (sessionIdRef.current) {
      useSessionStore.getState().addMessage(sessionIdRef.current, {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      });
    }

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

      // Persist assistant message
      if (sessionIdRef.current) {
        useSessionStore.getState().addMessage(sessionIdRef.current, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      setStreaming('');
      setError(err instanceof Error ? err.message : String(err));
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [config, history, isLoading, systemPrompt, workspace, configDir, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">OpenBunny TUI</Text>
        <Text color="gray"> | {config.model} | {config.provider}</Text>
        {workspace && <Text color="gray"> | {workspace}</Text>}
        <Text color="gray"> | /help</Text>
      </Box>

      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          <Text bold color={msg.role === 'user' ? 'green' : msg.role === 'assistant' ? 'blue' : 'gray'}>
            {msg.role === 'user' ? '> ' : msg.role === 'assistant' ? '🐰 ' : '  '}
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
