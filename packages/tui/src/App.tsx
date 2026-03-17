import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { flushAllSessionPersistence } from '@openbunny/shared/services/storage/sessionPersistence';
import type { AppProps } from './types.js';
import { useAppState } from './hooks/useAppState.js';
import { useNotices } from './hooks/useNotices.js';
import { useRuntimeConfig } from './hooks/useRuntimeConfig.js';
import { useAgentLoop } from './hooks/useAgentLoop.js';
import { useCommandHandler } from './hooks/useCommandHandler.js';
import { useFileBrowser } from './hooks/useFileBrowser.js';
import { usePanel } from './hooks/usePanel.js';
import { useMessageViewport } from './hooks/useMessageViewport.js';
import { resolveSessionOnStartup } from './utils/session.js';
import { MessageList } from './components/chat/MessageList.js';
import { NoticePanel } from './components/notices/NoticePanel.js';
import { AppHeader } from './components/layout/AppHeader.js';
import { SessionStrip } from './components/layout/SessionStrip.js';
import { FooterBar } from './components/layout/FooterBar.js';
import { HintBar } from './components/layout/HintBar.js';
import { InputBar } from './components/layout/InputBar.js';
import { Panel } from './components/panel/Panel.js';
import { getAvailableToolEntries } from './utils/toolPresentation.js';
import {
  getEffectiveSessionSkills,
  getEffectiveSessionTools,
  getSessionConfigScopeLabel,
  isReadOnlySession,
  isSessionConfigLocked,
} from './utils/sessionPresentation.js';
import type { MessageSearchResults } from './hooks/useMessageViewport.js';

function App({ config, systemPrompt, workspace, configDir, resumeIdPrefix, startupNotice }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const state = useAppState();
  const { notices, error, setError, addNotice, clearNotices } = useNotices();
  const [isInitializing, setIsInitializing] = useState(true);
  const [termSize, setTermSize] = useState({ cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
  const [searchResults, setSearchResults] = useState<MessageSearchResults | null>(null);
  const fileBrowser = useFileBrowser({ rootPath: workspace });

  useEffect(() => {
    const onResize = () => {
      setTermSize({ cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    };

    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const { runtimeConfig, runtimeConfigRef, applyRuntimeConfig, saveRuntimeConfig } = useRuntimeConfig({
    initialConfig: config,
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    globalLLMConfig: state.globalLLMConfig,
    currentAgentLLMConfig: state.currentAgent?.llmConfig,
    setGlobalLLMConfig: state.setGlobalLLMConfig,
    setAgentLLMConfig: state.setAgentLLMConfig,
  });

  const agentLoop = useAgentLoop({
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    proxyUrl: state.proxyUrl,
    toolExecutionTimeout: state.toolExecutionTimeout,
    addMessage: state.addMessage,
    updateMessage: state.updateMessage,
    addAgentMessage: state.addAgentMessage,
    updateAgentMessage: state.updateAgentMessage,
    setSessionStreaming: state.setSessionStreaming,
    setAgentSessionStreaming: state.setAgentSessionStreaming,
    setSessionSystemPrompt: state.setSessionSystemPrompt,
    setAgentSessionSystemPrompt: state.setAgentSessionSystemPrompt,
    flushMessages: state.flushMessages,
    flushAgentMessages: state.flushAgentMessages,
    renameSession: state.renameSession,
    renameAgentSession: state.renameAgentSession,
    enabledTools: state.enabledTools,
    enabledSkills: state.enabledSkills,
  });

  const cmd = useCommandHandler({
    workspace,
    configDir,
    systemPrompt,
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    currentAgent: state.currentAgent,
    globalSessions: state.globalSessions,
    globalOpenSessionIds: state.globalOpenSessionIds,
    sessions: state.sessions,
    enabledTools: state.enabledTools,
    enabledSkills: state.enabledSkills,
    execLoginShell: state.execLoginShell,
    toolExecutionTimeout: state.toolExecutionTimeout,
    proxyUrl: state.proxyUrl,
    exit,
    createSession: state.createSession,
    createAgentSession: state.createAgentSession,
    setSessionSystemPrompt: state.setSessionSystemPrompt,
    setSessionTools: state.setSessionTools,
    setSessionSkills: state.setSessionSkills,
    deleteSession: state.deleteSession,
    restoreSession: state.restoreSession,
    clearTrash: state.clearTrash,
    setAgentSessionSystemPrompt: state.setAgentSessionSystemPrompt,
    setAgentSessionTools: state.setAgentSessionTools,
    setAgentSessionSkills: state.setAgentSessionSkills,
    clearAgentSessionMessages: state.clearAgentSessionMessages,
    clearSessionMessages: state.clearSessionMessages,
    loadSessionMessages: state.loadSessionMessages,
    openSession: state.openSession,
    closeSession: state.closeSession,
    loadAgentSessionMessages: state.loadAgentSessionMessages,
    setAgentCurrentSession: state.setAgentCurrentSession,
    flushMessages: state.flushMessages,
    flushAgentMessages: state.flushAgentMessages,
    permanentlyDeleteSession: state.permanentlyDeleteSession,
    deleteAgentSession: state.deleteAgentSession,
    agents: state.agents,
    setCurrentAgent: state.setCurrentAgent,
    agentSessions: state.agentSessions,
    createAgent: state.createAgent,
    toggleGlobalTool: state.toggleGlobalTool,
    setAgentEnabledTools: state.setAgentEnabledTools,
    toggleGlobalSkill: state.toggleGlobalSkill,
    setAgentEnabledSkills: state.setAgentEnabledSkills,
    skills: state.skills,
    mcpConnections: state.mcpConnections,
    addMCPConnection: state.addMCPConnection,
    removeMCPConnection: state.removeMCPConnection,
    updateMCPStatus: state.updateMCPStatus,
    setMCPTools: state.setMCPTools,
    setMCPError: state.setMCPError,
    addNotice,
    clearNotices,
    setIsLoading: agentLoop.setIsLoading,
    setActivityLabel: agentLoop.setActivityLabel,
    runtimeConfigRef,
    applyRuntimeConfig,
    saveRuntimeConfig,
    fileBrowser,
    showSearchResults: setSearchResults,
    handleStop: agentLoop.handleStop,
    sendMessage: agentLoop.sendMessage,
  });

  const currentSession = state.currentSession;
  const messages = currentSession?.messages || [];
  const readOnlySession = isReadOnlySession(currentSession);
  const sessionConfigScope = getSessionConfigScopeLabel(currentSession);
  const sessionConfigState = readOnlySession
    ? 'read-only'
    : isSessionConfigLocked(currentSession)
      ? 'locked'
      : 'editable';
  const effectiveToolCount = getEffectiveSessionTools(currentSession, state.enabledTools)
    .filter((id) => id !== 'file_manager')
    .length;
  const effectiveSkillCount = getEffectiveSessionSkills(currentSession, state.enabledSkills).length;
  const availableToolCount = getAvailableToolEntries(state.builtinToolIds, state.mcpConnections).length;
  const agentName = state.currentAgent?.isDefault ? 'OpenBunny' : (state.currentAgent?.name || 'OpenBunny');

  useEffect(() => {
    let cancelled = false;

    void state.loadSkills()
      .catch(() => {})
      .finally(async () => {
        try {
          const session = await resolveSessionOnStartup('TUI Chat', systemPrompt, resumeIdPrefix);
          if (cancelled) return;
          if (resumeIdPrefix) {
            addNotice(`Resumed session ${session.id.slice(0, 8)} (${session.name}) — ${session.messages.length} message(s)`, 'success');
          }
          if (startupNotice) {
            addNotice(startupNotice, 'info');
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        } finally {
          if (!cancelled) {
            setIsInitializing(false);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.loadSkills, resumeIdPrefix, startupNotice, systemPrompt, addNotice, setError]);

  useEffect(() => {
    if (isInitializing || state.isDefaultAgent || state.currentSession) {
      return;
    }

    const next = state.createAgentSession(state.currentAgentId, 'TUI Chat');
    if (systemPrompt) {
      state.setAgentSessionSystemPrompt(state.currentAgentId, next.id, systemPrompt);
    }
  }, [
    isInitializing,
    state.createAgentSession,
    state.currentAgentId,
    state.currentSession,
    state.isDefaultAgent,
    state.setAgentSessionSystemPrompt,
    systemPrompt,
  ]);

  const handleExit = useCallback(() => {
    void flushAllSessionPersistence().finally(() => {
      exit();
    });
  }, [exit]);

  const handleSubmit = useCallback((value: string) => {
    const trimmed = value.trim();

    if (agentLoop.isLoading && trimmed && !trimmed.startsWith('/stop')) {
      addNotice('Model is still replying. Keep typing, or run /stop before sending the next message.', 'info');
      return;
    }

    void cmd.handleSubmit(value);
  }, [addNotice, agentLoop.isLoading, cmd.handleSubmit]);

  const panel = usePanel({
    terminalWidth: termSize.cols,
    terminalHeight: termSize.rows,
    sessions: state.sessions,
    globalSessions: state.globalSessions,
    currentSession,
    currentSessionId: state.currentSessionId,
    currentAgent: state.currentAgent,
    agents: state.agents,
    enabledTools: state.enabledTools,
    enabledSkills: state.enabledSkills,
    builtinToolIds: state.builtinToolIds,
    skills: state.skills,
    mcpConnections: state.mcpConnections,
    execLoginShell: state.execLoginShell,
    toolExecutionTimeout: state.toolExecutionTimeout,
    searchProvider: state.searchProvider,
    proxyUrl: state.proxyUrl,
    runtimeConfig,
    workspace,
    capabilities: state.capabilities,
    connectedMcpCount: state.connectedMcpCount,
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    systemPrompt,
    addNotice,
    createSession: state.createSession,
    deleteSession: state.deleteSession,
    restoreSession: state.restoreSession,
    clearTrash: state.clearTrash,
    loadSessionMessages: state.loadSessionMessages,
    openSession: state.openSession,
    setSessionSystemPrompt: state.setSessionSystemPrompt,
    setSessionTools: state.setSessionTools,
    setSessionSkills: state.setSessionSkills,
    loadAgentSessionMessages: state.loadAgentSessionMessages,
    setAgentCurrentSession: state.setAgentCurrentSession,
    setCurrentAgent: state.setCurrentAgent,
    agentSessions: state.agentSessions,
    createAgentSession: state.createAgentSession,
    deleteAgentSession: state.deleteAgentSession,
    setAgentSessionSystemPrompt: state.setAgentSessionSystemPrompt,
    setAgentSessionTools: state.setAgentSessionTools,
    setAgentSessionSkills: state.setAgentSessionSkills,
    toggleGlobalTool: state.toggleGlobalTool,
    setAgentEnabledTools: state.setAgentEnabledTools,
    toggleGlobalSkill: state.toggleGlobalSkill,
    setAgentEnabledSkills: state.setAgentEnabledSkills,
    syncMCPConnection: cmd.syncMCPConnection,
    setExecLoginShell: state.setExecLoginShell,
    setToolExecutionTimeout: state.setToolExecutionTimeout,
    setSearchProvider: state.setSearchProvider,
    applyRuntimeConfig,
    saveRuntimeConfig,
    fileBrowser,
    setIsLoading: agentLoop.setIsLoading,
    setActivityLabel: agentLoop.setActivityLabel,
    input: cmd.input,
    isInitializing,
    isLoading: agentLoop.isLoading,
    showSearchResults: setSearchResults,
  });

  const width = Math.max(24, termSize.cols);

  const messageViewport = useMessageViewport({
    sessionId: currentSession?.id || null,
    session: currentSession,
    messages,
    preferredVisibleCount: Math.max(6, termSize.rows - (notices.length > 0 || error ? 16 : 13)),
    panelVisible: panel.panelVisible,
    contentWidth: Math.max(20, width - 4),
  });

  useEffect(() => {
    messageViewport.applySearchResults(searchResults);
  }, [messageViewport.applySearchResults, searchResults]);

  const statusLabel = isInitializing
    ? 'Initializing...'
    : agentLoop.currentStatus || (agentLoop.isLoading ? agentLoop.activityLabel : '');
  const activeSessions = useMemo(() => {
    if (!state.isDefaultAgent) {
      return state.sessions;
    }

    const byId = new Map(state.globalSessions.map((session) => [session.id, session]));
    return state.globalOpenSessionIds
      .map((sessionId) => byId.get(sessionId))
      .filter((session): session is NonNullable<typeof session> => Boolean(session && !session.deletedAt));
  }, [state.globalOpenSessionIds, state.globalSessions, state.isDefaultAgent, state.sessions]);

  return (
    <Box width={termSize.cols} height={termSize.rows} flexDirection="column" overflow="hidden">
      <Box width={termSize.cols} height={termSize.rows} flexDirection="column" overflow="hidden">
        <AppHeader
          agentName={agentName}
          runtimeConfig={runtimeConfig}
          workspace={workspace}
          width={width}
          totalMessageCount={messages.length}
          isLoading={agentLoop.isLoading}
          panelVisible={panel.panelVisible}
        />
        <SessionStrip
          sessions={activeSessions}
          currentSessionId={state.currentSessionId}
          width={width}
          modeLabel={state.isDefaultAgent ? 'workspace' : `agent:${state.currentAgent?.name || state.currentAgentId}`}
        />
        <NoticePanel notices={notices} error={error} width={width} />
        <MessageList
          messages={messages}
          visibleLines={messageViewport.visibleLines}
          hiddenBefore={messageViewport.hiddenBefore}
          hiddenAfter={messageViewport.hiddenAfter}
          rangeStart={messageViewport.rangeStart}
          rangeEnd={messageViewport.rangeEnd}
          totalLines={messageViewport.totalLines}
          searchState={messageViewport.searchState}
          isInitializing={isInitializing}
          isLoading={agentLoop.isLoading}
          currentStatus={statusLabel}
          activityLabel={agentLoop.activityLabel}
          width={width}
        />
        <InputBar
          input={cmd.input}
          setInput={cmd.setInput}
          onSubmit={handleSubmit}
          onExit={handleExit}
          onHistoryPrev={cmd.showPreviousInput}
          onHistoryNext={cmd.showNextInput}
          disabled={isInitializing || panel.panelVisible}
          isLoading={agentLoop.isLoading}
          readOnly={readOnlySession}
          session={currentSession}
          sessionConfigScope={sessionConfigScope}
          sessionConfigState={sessionConfigState}
          enabledToolCount={effectiveToolCount}
          availableToolCount={availableToolCount}
          enabledSkillCount={effectiveSkillCount}
          totalSkillCount={state.skills.length}
          width={width}
          disabledReason={panel.panelEditor
            ? `Editing ${panel.panelEditor.label}`
            : panel.panelVisible
              ? 'Panel navigation active'
              : 'Initializing session'}
        />
        <FooterBar
          runtimeConfig={runtimeConfig}
          currentSessionId={state.currentSessionId}
          workspace={workspace}
          isLoading={agentLoop.isLoading}
          sessionConfigScope={sessionConfigScope}
          sessionConfigState={sessionConfigState}
          width={width}
          totalMessageCount={messages.length}
        />
        <HintBar panelVisible={panel.panelVisible} panelEditing={Boolean(panel.panelEditor)} width={width} />
      </Box>

      {panel.panelVisible && (
        <Box
          position="absolute"
          width={termSize.cols}
          height={termSize.rows}
          flexDirection="column"
          overflow="hidden"
        >
          <Box
            marginLeft={Math.max(0, panel.panelLeft - 1)}
            marginTop={Math.max(0, panel.panelTop - 1)}
          >
            <Panel
              section={panel.panelSection}
              items={panel.currentItems}
              selectedItemKey={panel.selectedItemKey}
              panelWidth={panel.panelWidth}
              panelHeight={panel.panelHeight}
              hiddenBefore={panel.window.hiddenBefore}
              hiddenAfter={panel.window.hiddenAfter}
              agentName={agentName}
              runtimeConfig={runtimeConfig}
              sessionCount={state.sessions.length}
              sessionConfigScope={sessionConfigScope}
              sessionConfigState={sessionConfigState}
              enabledToolCount={effectiveToolCount}
              availableToolCount={availableToolCount}
              connectedMcpCount={state.connectedMcpCount}
              mcpCount={state.mcpConnections.length}
              builtinToolCount={state.builtinToolIds.length}
              skillCount={state.skills.length}
              enabledSkillCount={effectiveSkillCount}
              execLoginShell={state.execLoginShell}
              toolExecutionTimeout={state.toolExecutionTimeout}
              searchProvider={state.searchProvider}
              fileBrowserPath={fileBrowser.currentDisplayPath}
              fileEntryCount={fileBrowser.entries.length}
              statsTotalInteractions={panel.stats.totalInteractions}
              statsTotalTokens={panel.stats.totalTokens}
              statsErrorCount={panel.stats.errorCount}
              editor={panel.panelEditor}
              onEditorChange={(value) => panel.setPanelEditor((prev) => (prev ? { ...prev, value } : prev))}
              onEditorSubmit={panel.submitPanelEditor}
              previewTitle={panel.previewTitle}
              previewMeta={panel.previewMeta}
              previewLines={panel.previewLines}
              previewTone={panel.previewTone}
              previewBodyHeight={panel.previewBodyHeight}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default App;
