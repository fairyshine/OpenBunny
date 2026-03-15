import { Command } from 'commander';
import path from 'node:path';
import { initNodePlatform } from '@openbunny/shared/platform/node';
import type { IPlatformStorage } from '@openbunny/shared/platform';
import { detectNodeOS } from '@openbunny/shared/platform/detect';
import { resolveNodeConfigDir } from '@openbunny/shared/platform/nodeConfig';
import { registerZustandAIRuntimeAdapters } from '@openbunny/shared/stores/aiRuntimeAdapters';
import { APP_VERSION } from '@openbunny/shared/version';
import { chatCommand } from './commands/chat.js';
import { configCommand } from './commands/config.js';
import { askCommand } from './commands/ask.js';
import { providersCommand } from './commands/providers.js';
import { sessionsCommand } from './commands/sessions.js';
import { createConfigStorage } from './config/store.js';

const storage: IPlatformStorage = createConfigStorage();
const configDir = resolveNodeConfigDir();

let initialized = false;

function initializeCLI(): void {
  if (initialized) {
    return;
  }

  initNodePlatform(
    { type: 'cli', os: detectNodeOS(), isBrowser: false, isDesktop: false, isMobile: false, isCLI: true, isTUI: false },
    storage,
    {
      sessionsDir: path.join(configDir, 'sessions'),
      statsDir: path.join(configDir, 'stats'),
      storeDir: path.join(configDir, 'store'),
    },
  );
  registerZustandAIRuntimeAdapters();
  initialized = true;
}

const program = new Command();

program
  .name('openbunny')
  .description('OpenBunny personal AI assistant CLI')
  .version(APP_VERSION)
  .option('-w, --workspace <dir>', 'Workspace directory');

program.hook('preAction', () => {
  initializeCLI();
});

program.addCommand(askCommand);
program.addCommand(chatCommand);
program.addCommand(configCommand);
program.addCommand(providersCommand);
program.addCommand(sessionsCommand);
program.parse();
