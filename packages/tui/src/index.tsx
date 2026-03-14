#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { initNodePlatform } from '@openbunny/shared/platform/node';
import type { IPlatformStorage } from '@openbunny/shared/platform';
import { detectNodeOS } from '@openbunny/shared/platform/detect';
import { registerZustandAIRuntimeAdapters } from '@openbunny/shared/stores/aiRuntimeAdapters';
import Conf from 'conf';
import { useSessionStore } from '@openbunny/shared/stores/session';
import App from './App.js';

const store = new Conf({ projectName: 'openbunny' });
const storage: IPlatformStorage = {
  getItem: (key: string) => (store.get(key) as string) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
};

initNodePlatform(
  { type: 'tui', os: detectNodeOS(), isBrowser: false, isDesktop: false, isMobile: false, isCLI: false, isTUI: true },
  storage,
);
registerZustandAIRuntimeAdapters();

const args = process.argv.slice(2);
let model = 'gpt-4';
let provider: 'openai' | 'anthropic' = 'openai';
let apiKey = process.env.OPENBUNNY_API_KEY || '';
let baseUrl: string | undefined;
let systemPrompt: string | undefined;
let temperature = 0.7;
let maxTokens = 4096;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-m': case '--model': model = args[++i]; break;
    case '-p': case '--provider': provider = args[++i] as 'openai' | 'anthropic'; break;
    case '-k': case '--api-key': apiKey = args[++i]; break;
    case '-b': case '--base-url': baseUrl = args[++i]; break;
    case '-s': case '--system': systemPrompt = args[++i]; break;
    case '-t': case '--temperature': temperature = parseFloat(args[++i]); break;
    case '--max-tokens': maxTokens = parseInt(args[++i]); break;
    case '-h': case '--help':
      console.log(`
openbunny-tui - Interactive terminal UI for OpenBunny

Options:
  -m, --model <model>       Model to use (default: gpt-4)
  -p, --provider <provider> Provider: openai|anthropic (default: openai)
  -k, --api-key <key>       API key (or set OPENBUNNY_API_KEY env)
  -b, --base-url <url>      Custom API base URL
  -s, --system <prompt>     System prompt
  -t, --temperature <temp>  Temperature (default: 0.7)
  --max-tokens <tokens>     Max tokens (default: 4096)
  -h, --help                Show help

Commands inside TUI:
  /quit, /exit              Exit
  /clear                    Clear chat history
`);
      process.exit(0);
  }
}

if (!apiKey) {
  apiKey = useSessionStore.getState().llmConfig.apiKey;
}

if (!apiKey) {
  console.error('Error: API key required. Use --api-key or set OPENBUNNY_API_KEY env.');
  process.exit(1);
}

const config = { provider, apiKey, model, baseUrl, temperature, maxTokens };

render(React.createElement(App, { config, systemPrompt }));
