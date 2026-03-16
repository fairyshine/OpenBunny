import { useEffect, useState } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import type { AppProps } from './types.js';
import { useAppState } from './hooks/useAppState.js';
import { useNotices } from './hooks/useNotices.js';
import { useRuntimeConfig } from './hooks/useRuntimeConfig.js';
import { useAgentLoop } from './hooks/useAgentLoop.js';
import { useCommandHandler } from './hooks/useCommandHandler.js';
import { usePanel } from './hooks/usePanel.js';
import { resolveSessionOnStartup } from './utils/session.js';
import { AppHeader } from './components/layout/AppHeader.js';
import { FooterBar } from './components/layout/FooterBar.js';
import { HintBar } from './components/layout/HintBar.js';
import { InputBar } from './components/layout/InputBar.js';
import { MessageList } from './components/chat/MessageList.js';
import { NoticePanel } from './components/notices/NoticePanel.js';
import { Panel } from './components/panel/Panel.js';
import { T } from './theme.js';
import { getPanelTopOffset } from './utils/layout.js';

const MIN_TERM_COLS = 88;

function App({ config, systemPrompt, workspace, configDir, resumeIdPrefix, startupNotice }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const state = useAppState();
  const { notices, error, setError, addNotice, clearNotices } = useNotices();
  const [isInitializing, setIsInitializing] = useState(true);

  /* ── Track terminal size for fullscreen layout ───── */
  const [termSize, setTermSize] = useState({ cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
  useEffect(() => {
    const onResize = () => setTermSize({ cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
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
    workspace, configDir, systemPrompt,
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    currentAgent: state.currentAgent,
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
    setAgentSessionSystemPrompt: state.setAgentSessionSystemPrompt,
    clearSessionMessages: state.clearSessionMessages,
    loadSessionMessages: state.loadSessionMessages,
    openSession: state.openSession,
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
    addNotice, clearNotices,
    setIsLoading: agentLoop.setIsLoading,
    setActivityLabel: agentLoop.setActivityLabel,
    runtimeConfigRef,
    applyRuntimeConfig,
    saveRuntimeConfig,
    handleStop: agentLoop.handleStop,
    sendMessage: agentLoop.sendMessage,
  });

  const agentName = state.currentAgent?.name || 'OpenBunny';
  const panelTop = getPanelTopOffset({
    agentName,
    currentSessionId: state.currentSessionId,
    workspace,
  });

  const panel = usePanel({
    terminalWidth: termSize.cols,
    panelTop,
    sessions: state.sessions,
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
    runtimeConfig,
    workspace,
    capabilities: state.capabilities,
    connectedMcpCount: state.connectedMcpCount,
    isDefaultAgent: state.isDefaultAgent,
    currentAgentId: state.currentAgentId,
    systemPrompt,
    addNotice,
    createSession: state.createSession,
    loadSessionMessages: state.loadSessionMessages,
    openSession: state.openSession,
    setSessionSystemPrompt: state.setSessionSystemPrompt,
    loadAgentSessionMessages: state.loadAgentSessionMessages,
    setAgentCurrentSession: state.setAgentCurrentSession,
    setCurrentAgent: state.setCurrentAgent,
    agentSessions: state.agentSessions,
    createAgentSession: state.createAgentSession,
    setAgentSessionSystemPrompt: state.setAgentSessionSystemPrompt,
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
    input: cmd.input,
    isInitializing,
    isLoading: agentLoop.isLoading,
  });

  /* ── Startup ───────────────────────────────────────── */
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
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (!cancelled) setIsInitializing(false);
        }
      });
    return () => { cancelled = true; };
  }, [state.loadSkills, resumeIdPrefix, startupNotice, systemPrompt, addNotice, setError]);

  /* ── Auto-create agent session ─────────────────────── */
  useEffect(() => {
    if (isInitializing || state.isDefaultAgent || state.currentSession) return;
    const next = state.createAgentSession(state.currentAgentId, 'TUI Chat');
    if (systemPrompt) state.setAgentSessionSystemPrompt(state.currentAgentId, next.id, systemPrompt);
  }, [state.createAgentSession, state.currentAgentId, state.currentSession, state.isDefaultAgent, isInitializing, state.setAgentSessionSystemPrompt, systemPrompt]);

  const messages = state.currentSession?.messages || [];
  const totalMessageCount = messages.length;
  const disabled = agentLoop.isLoading || isInitializing || panel.panelVisible;
  const tooSmall = termSize.cols < MIN_TERM_COLS;
  const disabledReason = isInitializing
    ? 'Initializing'
    : agentLoop.isLoading
      ? agentLoop.activityLabel || 'Streaming response'
      : panel.panelEditor
        ? `Editing ${panel.panelEditor.label}`
      : panel.panelVisible
        ? 'Panel navigation active'
        : undefined;

  if (tooSmall) {
    return (
      <Box
        flexDirection="column"
        width={termSize.cols}
        height={termSize.rows}
        justifyContent="center"
        alignItems="center"
        paddingX={2}
      >
        <Box borderStyle="round" borderColor={T.warn} paddingX={2} flexDirection="column">
          <Text color={T.warn} bold>Terminal too small for TUI layout</Text>
          <Text color={T.fgDim}>Current: {termSize.cols}x{termSize.rows}</Text>
          <Text color={T.fgDim}>Recommended width: {MIN_TERM_COLS}+ columns</Text>
          <Text color={T.fgSubtle}>Resize the terminal to restore the full panel and chat layout.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termSize.cols} minHeight={termSize.rows}>
      <AppHeader
        agentName={agentName}
        runtimeConfig={runtimeConfig}
        workspace={workspace}
        width={termSize.cols}
        totalMessageCount={totalMessageCount}
        currentSessionId={state.currentSessionId}
        isLoading={agentLoop.isLoading}
        panelVisible={panel.panelVisible}
      />

      <Box flexDirection="column" flexGrow={1}>
        {panel.panelVisible ? (
          <Box flexDirection="column" alignItems="center">
            <Panel
              section={panel.panelSection}
              items={panel.currentItems}
              selectedItemKey={panel.selectedItemKey}
              panelWidth={panel.panelWidth}
              hiddenBefore={panel.window.hiddenBefore}
              hiddenAfter={panel.window.hiddenAfter}
              agentName={agentName}
              runtimeConfig={runtimeConfig}
              sessionCount={state.sessions.length}
              enabledToolCount={state.enabledTools.filter((id) => id !== 'file_manager').length}
              connectedMcpCount={state.connectedMcpCount}
              mcpCount={state.mcpConnections.length}
              builtinToolCount={state.builtinToolIds.length}
              execLoginShell={state.execLoginShell}
              skillCount={state.skills.length}
              enabledSkillCount={state.enabledSkills.length}
              toolExecutionTimeout={state.toolExecutionTimeout}
              searchProvider={state.searchProvider}
              editor={panel.panelEditor}
              onEditorChange={(value) => panel.setPanelEditor((prev) => (prev ? { ...prev, value } : prev))}
              onEditorSubmit={panel.submitPanelEditor}
            />
          </Box>
        ) : (
          <>
            <MessageList
              messages={messages}
              isInitializing={isInitializing}
              isLoading={agentLoop.isLoading}
              currentStatus={agentLoop.currentStatus}
              activityLabel={agentLoop.activityLabel}
              width={termSize.cols}
            />

            <NoticePanel notices={notices} error={error} width={termSize.cols} />
          </>
        )}
      </Box>

      <InputBar
        input={cmd.input}
        setInput={cmd.setInput}
        onSubmit={cmd.handleSubmit}
        disabled={disabled}
        width={termSize.cols}
        disabledReason={disabledReason}
      />

      <FooterBar
        runtimeConfig={runtimeConfig}
        currentSessionId={state.currentSessionId}
        workspace={workspace}
        isLoading={agentLoop.isLoading}
        width={termSize.cols}
        totalMessageCount={totalMessageCount}
        panelVisible={panel.panelVisible}
      />

      <HintBar panelVisible={panel.panelVisible} panelEditing={Boolean(panel.panelEditor)} width={termSize.cols} />
    </Box>
  );
}

export default App;
