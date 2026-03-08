import common from './common';
import header from './header';
import status from './status';
import settings from './settings';
import chat from './chat';
import tools from './tools';
import connTest from './connTest';
import console from './console';
import sidebar from './sidebar';
import files from './files';
import exportSearch from './export';
import misc from './misc';
import memory from './memory';
import skills from './skills';
import dashboard from './dashboard';
import welcome from './welcome';
import agentGraph from './agentGraph';

const zhCN = {
  ...common,
  ...header,
  ...status,
  ...settings,
  ...chat,
  ...tools,
  ...connTest,
  ...console,
  ...sidebar,
  ...files,
  ...exportSearch,
  ...misc,
  ...memory,
  ...skills,
  ...dashboard,
  ...welcome,
  ...agentGraph,
} as const;

export default zhCN;
