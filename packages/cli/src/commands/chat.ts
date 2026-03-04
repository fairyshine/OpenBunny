import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { callLLM } from '@shared/services/llm/streaming';
import { useSessionStore } from '@shared/stores/session';
import type { ModelMessage } from 'ai';

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use', 'gpt-4')
  .option('-p, --provider <provider>', 'Provider (openai|anthropic)', 'openai')
  .option('-k, --api-key <key>', 'API key (or set CYBERBUNNY_API_KEY env)')
  .option('-b, --base-url <url>', 'Custom API base URL')
  .option('-t, --temperature <temp>', 'Temperature', '0.7')
  .option('--max-tokens <tokens>', 'Max tokens', '4096')
  .option('--system <prompt>', 'System prompt')
  .action(async (opts) => {
    const apiKey = opts.apiKey || process.env.CYBERBUNNY_API_KEY || useSessionStore.getState().llmConfig.apiKey;

    if (!apiKey) {
      console.error(chalk.red('Error: API key required. Use --api-key, CYBERBUNNY_API_KEY env, or `cyberbunny config set apiKey <key>`'));
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

    console.log(chalk.cyan('CyberBunny Chat'));
    console.log(chalk.gray(`Model: ${config.model} | Provider: ${config.provider}`));
    console.log(chalk.gray('Type /quit to exit, /clear to reset history\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question(chalk.green('> '), async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === '/quit' || trimmed === '/exit') {
          console.log(chalk.gray('Bye!'));
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/clear') {
          history.length = 0;
          if (opts.system) {
            history.push({ role: 'system', content: opts.system });
          }
          console.log(chalk.gray('History cleared.\n'));
          prompt();
          return;
        }

        if (trimmed === '/history') {
          const count = history.filter(m => m.role !== 'system').length;
          console.log(chalk.gray(`${count} messages in history.\n`));
          prompt();
          return;
        }

        history.push({ role: 'user', content: trimmed });

        let lastLen = 0;
        process.stdout.write(chalk.blue(''));

        try {
          const result = await callLLM(config, history, {
            onChunk: (full) => {
              const newPart = full.slice(lastLen);
              process.stdout.write(newPart);
              lastLen = full.length;
            },
          });

          process.stdout.write('\n\n');
          history.push({ role: 'assistant', content: result });
        } catch (error) {
          process.stdout.write('\n');
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
          console.log();
          // Remove the failed user message
          history.pop();
        }

        prompt();
      });
    };

    prompt();
  });
