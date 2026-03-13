import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { callLLM } from '@openbunny/shared/services/llm/streaming';
import { useSessionStore } from '@openbunny/shared/stores/session';
import type { ModelMessage } from 'ai';

export const askCommand = new Command('ask')
  .description('Ask a one-shot question')
  .argument('<question>', 'The question to ask')
  .option('-m, --model <model>', 'Model to use', 'gpt-4')
  .option('-p, --provider <provider>', 'Provider (openai|anthropic)', 'openai')
  .option('-k, --api-key <key>', 'API key (or set OPENBUNNY_API_KEY env)')
  .option('-b, --base-url <url>', 'Custom API base URL')
  .option('-t, --temperature <temp>', 'Temperature', '0.7')
  .option('--max-tokens <tokens>', 'Max tokens', '4096')
  .option('--system <prompt>', 'System prompt')
  .option('--no-stream', 'Disable streaming output')
  .action(async (question: string, opts) => {
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

    const messages: ModelMessage[] = [];
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: question });

    if (opts.stream === false) {
      const spinner = ora('Thinking...').start();
      try {
        const result = await callLLM(config, messages);
        spinner.stop();
        console.log(result);
      } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    } else {
      let lastLen = 0;
      try {
        await callLLM(config, messages, {
          onChunk: (full) => {
            const newPart = full.slice(lastLen);
            process.stdout.write(newPart);
            lastLen = full.length;
          },
          onComplete: () => {
            process.stdout.write('\n');
          },
        });
      } catch (error) {
        console.error(chalk.red('\n' + (error instanceof Error ? error.message : String(error))));
        process.exit(1);
      }
    }
  });
