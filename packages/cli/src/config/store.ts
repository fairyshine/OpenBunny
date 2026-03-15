import Conf from 'conf';
import { resolveNodeConfigDir } from '@openbunny/shared/platform/nodeConfig';
import { createNodeConfigFunctions } from '@openbunny/shared/config/nodeConfigStore';

type OpenBunnyConfig = Record<string, string | number | boolean | null | undefined>;

const conf = new Conf<OpenBunnyConfig>({
  configName: 'config',
  cwd: resolveNodeConfigDir(),
  projectName: 'openbunny',
});

export const {
  getConfigValue,
  getAllConfig,
  setConfigValue,
  deleteConfigValue,
  clearConfig,
  createConfigStorage,
  resolveLLMConfig,
  resolveSystemPrompt,
  resolveWorkspace,
} = createNodeConfigFunctions({
  get: (k) => conf.get(k),
  set: (k, v) => conf.set(k, v),
  delete: (k) => conf.delete(k),
  clear: () => conf.clear(),
  all: () => ({ ...conf.store }),
}, process.env as Record<string, string | undefined>);
