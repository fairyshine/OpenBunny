import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { callLLM } from '@openbunny/shared/services/llm/streaming';
import { useSessionStore } from '@openbunny/shared/stores/session';
import type { ModelMessage } from 'ai';

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use', 'gpt-4')
  .option('-p, --provider <provider>', 'Provider (openai|anthropic)', 'openai')
  .option('-k, --api-key <key>', 'API key (or set OPENBUNNY_API_KEY env)')
  .option('-b, --base-url <url>', 'Custom API base URL')
  .option('-t, --temperature <temp>', 'Temperature', '0.7')
  .option('--max-tokens <tokens>', 'Max tokens', '4096')
  .option('--system <prompt>', 'System prompt')
  .action(async (opts) => {
    const apiKey = opts.apiKey || process.env.OPENBUNNY_API_KEY || useSessionStore.getState().llmConfig.apiKey;

    if (!apiKey) {
      console.error(chalk.red('Error: API key required. Use --api-key, OPENBUNNY_API_KEY env, or `openbunny config set apiKey <key>`'));
      process.exit(1);
    }

    const config = {
      provider: opts.provider as 'openai' | 'anthropic',
      apiKey,
      model: opts.model,
      baseUrl: opts.baseUrl,
      temperature: parseFloat(opts.temperature),
      maxTokens: parseInt(opts.maxTokens),
    };

    const history: ModelMessage[] = [];
    if (opts.system) {
      history.push({ role: 'system', content: opts.system });
    }

    console.log(chalk.green('OpenBunny Chat'));
    console.log(chalk.gray('Type your message and press Enter. Ctrl+C to exit.\n'));

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

      history.push({ role: 'user', content: input });
      let lastLen = 0;

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
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        history.pop();
      }

      rl.prompt();
    });

    rl.on('close', () => {
      process.stdout.write('\n');
      process.exit(0);
    });
  });
