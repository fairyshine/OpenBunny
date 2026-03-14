import { Command } from 'commander';
import { initNodePlatform } from '@openbunny/shared/platform/node';
import type { IPlatformStorage } from '@openbunny/shared/platform';
import { detectNodeOS } from '@openbunny/shared/platform/detect';
import { registerZustandAIRuntimeAdapters } from '@openbunny/shared/stores/aiRuntimeAdapters';
import { APP_VERSION } from '@openbunny/shared/version';
import Conf from 'conf';
import { chatCommand } from './commands/chat.js';
import { configCommand } from './commands/config.js';
import { askCommand } from './commands/ask.js';

const store = new Conf({ projectName: 'openbunny' });
const storage: IPlatformStorage = {
  getItem: (key: string) => (store.get(key) as string) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
};

initNodePlatform(
  { type: 'cli', os: detectNodeOS(), isBrowser: false, isDesktop: false, isMobile: false, isCLI: true, isTUI: false },
  storage,
);
registerZustandAIRuntimeAdapters();

const program = new Command();

program
  .name('openbunny')
  .description('OpenBunny personal AI assistant CLI')
  .version(APP_VERSION);

program.addCommand(askCommand);
program.addCommand(chatCommand);
program.addCommand(configCommand);
program.parse();
