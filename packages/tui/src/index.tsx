#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { initTerminal, resolveLLMConfig, resolveSystemPrompt, resolveWorkspace } from '@openbunny/shared/terminal';
import { getProviderMeta } from '@openbunny/shared/services/ai';
import App from './App.js';

function installTuiConsoleSilencer() {
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};

  return () => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  };
}

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
openbunny-tui - Streaming terminal chat for OpenBunny

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
  /tabs                     Show current session tabs
  /tab <op>                 Switch or close a workspace tab
  /delete <id>              Move a workspace session to trash
  /trash                    Show workspace trash
  /restore <id>             Restore a trashed workspace session
  /purge <id>               Permanently delete a workspace session
  /empty-trash              Permanently clear workspace trash
  /scope [global|session]   Show or switch current session config scope
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
  /sessions [filter]        List available or trashed sessions
  /resume <id>              Resume a previous session
  /save                     Force-flush messages to disk
  /files                    List workspace files
  /cd <path>                Change current workspace directory
  /open <path>              Preview a workspace file
  /write <p> <txt>          Overwrite a workspace file with escaped text
  /providers                List supported providers
  /search [flags] <query>   Search with --case-sensitive/-c or --content-only and focus matches
  /stats                    Show persisted usage statistics
  /conn-test                Run an LLM connection test

Prompt keys:
  Enter                     Send the current input
  Ctrl+A / Ctrl+E           Move to line start / end
  Left / Right              Move the cursor
  Backspace                 Delete one character
  Ctrl+C                    Exit
`);
      process.exit(0);
  }
}

process.env.OPENBUNNY_DISABLE_CONSOLE_LOGGER = '1';
const restoreConsole = installTuiConsoleSilencer();

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
instance.waitUntilExit()
  .catch(() => {})
  .finally(() => {
    restoreConsole();
  });
