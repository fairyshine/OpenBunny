#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { initTerminal, resolveLLMConfig, resolveSystemPrompt, resolveWorkspace } from '@openbunny/shared/terminal';
import { getProviderMeta } from '@openbunny/shared/services/ai';
import App from './App.js';

const args = process.argv.slice(2);
let model: string | undefined;
let provider: string | undefined;
let apiKey: string | undefined;
let baseUrl: string | undefined;
let systemPrompt: string | undefined;
let temperature: number | undefined;
let maxTokens: number | undefined;
let workspace: string | undefined;
let resumeIdPrefix: string | undefined;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-m': case '--model': model = args[++i]; break;
    case '-p': case '--provider': provider = args[++i] as 'openai' | 'anthropic'; break;
    case '-k': case '--api-key': apiKey = args[++i]; break;
    case '-b': case '--base-url': baseUrl = args[++i]; break;
    case '-s': case '--system': systemPrompt = args[++i]; break;
    case '-t': case '--temperature': temperature = parseFloat(args[++i]); break;
    case '--max-tokens': maxTokens = parseInt(args[++i]); break;
    case '-w': case '--workspace': workspace = args[++i]; break;
    case '--resume': resumeIdPrefix = args[++i]; break;
    case '-h': case '--help':
      console.log(`
openbunny-tui - Interactive terminal UI for OpenBunny

Options:
  -m, --model <model>       Model to use
  -p, --provider <provider> Provider ID from shared registry
  -k, --api-key <key>       API key (or set OPENBUNNY_API_KEY env)
  -b, --base-url <url>      Custom API base URL
  -s, --system <prompt>     System prompt
  -t, --temperature <temp>  Temperature
  --max-tokens <tokens>     Max tokens
  -w, --workspace <dir>     Workspace directory
  --resume <id>             Resume a previous session by ID prefix
  -h, --help                Show help

Commands inside TUI:
  /quit, /exit              Exit
  /clear                    Clear chat history
  /help                     Show config info and commands
  /config                   Show current runtime config
  /model <name>             Set model for this TUI session
  /provider <id>            Set provider for this TUI session
  /save-config              Persist current runtime config
  /agents                   Show available agents
  /agent <id>               Switch current agent
  /agent-new <name>         Create a new agent
  /new                      Create a new session
  /delete <id>              Permanently delete a session
  /tools                    Show enabled tools
  /tool on|off <id>         Toggle a tool
  /skills                   Show enabled skills
  /skill on|off <id>        Toggle a skill
  /mcp                      List MCP connections
  /mcp add <n> <u> [t]      Add and sync an MCP connection
  /mcp sync <id>            Refresh an MCP connection
  /mcp remove <id>          Remove an MCP connection
  /stop                     Stop the current response
  /shell <command>          Run a shell command in the workspace
  /shell reset              Reset the persistent shell session
  /history                  Show session info
  /sessions                 List available sessions
  /resume <id>              Resume a previous session
  /save                     Force-flush messages to disk
  /providers                List supported providers

Panel keys:
  Esc / Tab                 Open panel (when input empty)
  Tab                       Switch section tab (when panel open)
  Up / Down / j / k         Navigate panel items
  Left / Right              Cycle selected setting values
  Enter                     Select or open inline editor
  Space                     Toggle selected toggle/action item
  1-6                       Jump to panel sections
  Ctrl+G / Ctrl+L           Focus General / LLM
  Ctrl+T / Ctrl+K           Focus Tools / Skills
  Ctrl+P                    Focus Network (agents + MCP)
  Esc                       Close panel
`);
      process.exit(0);
  }
}

const { configDir } = initTerminal({ type: 'tui' });

const config = resolveLLMConfig({ apiKey, baseUrl, maxTokens, model, provider, temperature });
const providerMeta = getProviderMeta(config.provider);
const resolvedSystemPrompt = resolveSystemPrompt(systemPrompt);
const resolvedWorkspace = resolveWorkspace(workspace);
const startupNotice = (providerMeta?.requiresApiKey ?? true) && !config.apiKey
  ? `Provider "${config.provider}" requires an API key. Use /api-key <key>, switch with /provider <id>, or restart with --api-key.`
  : undefined;
const instance = render(React.createElement(App, {
  config,
  systemPrompt: resolvedSystemPrompt,
  workspace: resolvedWorkspace,
  configDir,
  resumeIdPrefix,
  startupNotice,
}));
instance.waitUntilExit().catch(() => {});
