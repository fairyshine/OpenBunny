import { Command } from 'commander';
import { initNodePlatform } from '@shared/platform/node';
import type { IPlatformStorage } from '@shared/platform';
import { detectNodeOS } from '@shared/platform/detect';
import { APP_VERSION } from '@shared/version';
import Conf from 'conf';
import { chatCommand } from './commands/chat';
import { configCommand } from './commands/config';
import { askCommand } from './commands/ask';

// Initialize platform
const store = new Conf({ projectName: 'cyberbunny' });
const storage: IPlatformStorage = {
  getItem: (key: string) => (store.get(key) as string) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
};
initNodePlatform(
  { type: 'cli', os: detectNodeOS(), isBrowser: false, isDesktop: false, isMobile: false, isCLI: true, isTUI: false },
  storage,
);

const program = new Command();

program
  .name('cyberbunny')
  .description('CyberBunny AI Agent CLI')
  .version(APP_VERSION);

// cyberbunny ask "question" — one-shot question
program.addCommand(askCommand);

// cyberbunny chat — interactive REPL
program.addCommand(chatCommand);

// cyberbunny config — manage configuration
program.addCommand(configCommand);

program.parse();
