import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { getProviderMeta } from '@openbunny/shared/services/ai';
import { callLLM } from '@openbunny/shared/services/llm/streaming';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { resolveNodeConfigDir } from '@openbunny/shared/platform/nodeConfig';
import { flushAllSessionPersistence } from '@openbunny/shared/services/storage/sessionPersistence';
import type { ModelMessage } from 'ai';
import { resolveLLMConfig, resolveSystemPrompt, resolveWorkspace } from '../config/store.js';

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use (defaults to configured model or gpt-4o)')
  .option('-p, --provider <provider>', 'Provider ID from `openbunny providers`')
  .option('-k, --api-key <key>', 'API key (or set OPENBUNNY_API_KEY env)')
  .option('-b, --base-url <url>', 'Custom API base URL')
  .option('-t, --temperature <temp>', 'Temperature')
  .option('--max-tokens <tokens>', 'Max tokens')
  .option('--system <prompt>', 'System prompt')
  .option('--resume <id>', 'Resume a previous session by ID (prefix match)')
  .action(async (opts) => {
    const config = resolveLLMConfig({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      maxTokens: opts.maxTokens,
      model: opts.model,
      provider: opts.provider,
      temperature: opts.temperature,
    });
    const providerMeta = getProviderMeta(config.provider);

    if ((providerMeta?.requiresApiKey ?? true) && !config.apiKey) {
      console.error(chalk.red('Error: API key required. Use --api-key, OPENBUNNY_API_KEY env, or `openbunny config set apiKey <key>`'));
      process.exit(1);
    }

    const systemPrompt = resolveSystemPrompt(opts.system);
    const workspace = resolveWorkspace(opts.parent?.workspace);
    const configDir = resolveNodeConfigDir();

    // Wait a tick for Zustand rehydration
    await new Promise((r) => setTimeout(r, 100));

    const store = useSessionStore.getState();
    let sessionId: string;
    let history: ModelMessage[];

    if (opts.resume) {
      // Resume existing session
      const match = store.sessions.find((s) => s.id.startsWith(opts.resume));
      if (!match) {
        console.error(chalk.red(`No session found matching "${opts.resume}"`));
        process.exit(1);
      }

      sessionId = match.id;

      // Load messages if not already in memory
      if (match.messages.length === 0) {
        await store.loadSessionMessages(sessionId);
      }

      const loaded = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      const msgs = loaded?.messages ?? [];

      history = systemPrompt ? [{ role: 'system', content: systemPrompt } satisfies ModelMessage] : [];
      for (const msg of msgs) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          history.push({ role: msg.role, content: msg.content });
        }
      }

      console.log(chalk.green(`Resumed session ${sessionId.slice(0, 8)} (${match.name}) — ${msgs.length} message(s)`));
    } else {
      // Create new session
      const session = store.createSession('CLI Chat');
      sessionId = session.id;
      history = systemPrompt ? [{ role: 'system', content: systemPrompt } satisfies ModelMessage] : [];
      console.log(chalk.green('OpenBunny Chat') + chalk.gray(` [session ${sessionId.slice(0, 8)}]`));
    }

    const initialHistory = systemPrompt ? [{ role: 'system', content: systemPrompt } satisfies ModelMessage] : [];
    let isLoading = false;

    console.log(chalk.gray('Type your message and press Enter. Commands: /help, /clear, /history, /save, /quit\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue('> '),
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input === '/quit' || input === '/exit') {
        rl.close();
        return;
      }

      if (input === '/help') {
        console.log('');
        console.log(chalk.cyan('  Configuration'));
        console.log(chalk.gray(`    Provider:    ${config.provider}`));
        console.log(chalk.gray(`    Model:       ${config.model}`));
        console.log(chalk.gray(`    Temperature: ${config.temperature}`));
        console.log(chalk.gray(`    Max tokens:  ${config.maxTokens}`));
        if (workspace) {
          console.log(chalk.gray(`    Workspace:   ${workspace}`));
        }
        console.log(chalk.gray(`    Config dir:  ${configDir}`));
        console.log(chalk.gray(`    Session:     ${sessionId.slice(0, 8)}`));
        console.log('');
        console.log(chalk.cyan('  Commands'));
        console.log(chalk.gray('    /help       Show this help'));
        console.log(chalk.gray('    /clear      Clear conversation history'));
        console.log(chalk.gray('    /history    Show session info'));
        console.log(chalk.gray('    /save       Force-flush messages to disk'));
        console.log(chalk.gray('    /quit       Exit chat'));
        console.log('');
        rl.prompt();
        return;
      }

      if (input === '/clear') {
        history = [...initialHistory];
        console.log(chalk.gray('Conversation history cleared.'));
        rl.prompt();
        return;
      }

      if (input === '/history') {
        const messageCount = history.filter((message) => message.role !== 'system').length;
        console.log(chalk.gray(`Session ${sessionId.slice(0, 8)} — ${messageCount} message(s) in history.`));
        rl.prompt();
        return;
      }

      if (input === '/save') {
        await store.flushMessages(sessionId);
        console.log(chalk.gray('Messages flushed to disk.'));
        rl.prompt();
        return;
      }

      if (isLoading) {
        console.log(chalk.yellow('A response is still streaming. Wait for it to finish before sending another message.'));
        rl.prompt();
        return;
      }

      history.push({ role: 'user', content: input });

      // Persist user message to session store
      useSessionStore.getState().addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        timestamp: Date.now(),
      });

      let lastLen = 0;
      isLoading = true;

      try {
        const result = await callLLM(config, history, {
          onChunk: (full) => {
            const newPart = full.slice(lastLen);
            process.stdout.write(newPart);
            lastLen = full.length;
          },
          onComplete: () => {
            process.stdout.write('\n');
          },
        });

        history.push({ role: 'assistant', content: result });

        // Persist assistant message to session store
        useSessionStore.getState().addMessage(sessionId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        history.pop();
      } finally {
        isLoading = false;
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      // Flush pending messages before exit
      await flushAllSessionPersistence();
      process.stdout.write('\n');
      process.exit(0);
    });
  });
