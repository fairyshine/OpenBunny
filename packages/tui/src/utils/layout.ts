interface AppHeaderHeightOptions {
  agentName: string;
  currentSessionId: string | null;
  workspace?: string;
}

const APP_HEADER_BASE_CONTENT_LINES = 8;
const APP_HEADER_BORDER_AND_MARGIN_LINES = 3;

export function getAppHeaderHeight(options: AppHeaderHeightOptions): number {
  let contentLines = APP_HEADER_BASE_CONTENT_LINES;

  if (options.agentName !== 'OpenBunny') {
    contentLines += 1;
  }

  if (options.currentSessionId) {
    contentLines += 1;
  }

  if (options.workspace) {
    contentLines += 1;
  }

  return contentLines + APP_HEADER_BORDER_AND_MARGIN_LINES;
}

export function getPanelTopOffset(options: AppHeaderHeightOptions): number {
  return getAppHeaderHeight(options) + 1;
}
