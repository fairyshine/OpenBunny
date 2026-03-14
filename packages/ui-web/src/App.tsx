import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import ChatContainer from './components/chat/ChatContainer';
import SessionTabs from './components/chat/SessionTabs';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/layout/Header';
import GlobalStatsPage from './components/layout/GlobalStatsPage';
import StatusScreen from './components/layout/StatusScreen';
import { AgentConfigPanel } from './components/settings/AgentConfigPanel';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@openbunny/shared/stores/agent';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useSkillStore } from '@openbunny/shared/stores/skills';
import { pythonExecutor } from '@openbunny/shared/services/python/executor';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import { logSystem } from '@openbunny/shared/services/console/logger';
import { applyTheme, setupSystemThemeListener } from './platform/theme';
import { initGlobalShortcuts } from './platform/keyboardShortcuts';
import { addOpenConsolePanelListener } from './components/layout/consolePanelEvents';
import { useWorkspaceSession } from './hooks/useWorkspaceSession';

// Lazy load non-critical components
const FileEditor = lazy(() => import('./components/sidebar/FileEditor'));
const ConsolePanel = lazy(() => import('./components/layout/ConsolePanel'));
const AgentGraph = lazy(() => import('./components/agent-graph/AgentGraphDialog').then((module) => ({ default: module.AgentGraph })));

function App() {
  const { t } = useTranslation();
  const openSessionIds = useSessionStore(s => s.openSessionIds);
  const createSession = useSessionStore(s => s.createSession);
  const initializePython = useSettingsStore(s => s.initializePython);
  const theme = useSettingsStore(s => s.theme);
  const enableSessionTabs = useSettingsStore(s => s.enableSessionTabs);
  const loadSkills = useSkillStore(s => s.loadSkills);
  const currentAgentId = useAgentStore(s => s.currentAgentId);
  const createAgentSession = useAgentStore(s => s.createAgentSession);
  const { currentSession, currentSessionId, isDefaultAgent, sessions } = useWorkspaceSession();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showConsole, setShowConsole] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(280);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStatusPage, setShowStatusPage] = useState(false);
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphGroupId, setGraphGroupId] = useState<string | undefined>(undefined);
  const [sidebarTab, setSidebarTab] = useState<'agents' | 'sessions' | 'files' | 'stats'>('agents');

  // Apply theme on mount
  useEffect(() => {
    // Initialize theme on mount
    applyTheme(theme);

    // Listen for system theme changes if theme is 'system'
    if (theme === 'system') {
      const cleanup = setupSystemThemeListener((systemTheme) => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(systemTheme);
      });
      return cleanup;
    }
  }, [theme]);

  // 启动日志（只执行一次）
  const startupLogged = useRef(false);
  useEffect(() => {
    if (!startupLogged.current) {
      startupLogged.current = true;
      logSystem('info', t('logger.startup'));
    }
  }, []);

  // 初始化
  useEffect(() => {
    // 预加载 Python 环境
    if (initializePython) {
      pythonExecutor.initialize().catch(console.error);
    }

    // 初始化 Skills
    loadSkills();
  }, [initializePython, loadSkills]);

  // 初始化全局快捷键系统
  useEffect(() => {
    const cleanup = initGlobalShortcuts();
    return cleanup;
  }, []);

  useEffect(() => {
    return addOpenConsolePanelListener(() => {
      setShowConsole(true);
    });
  }, []);

  // 键盘快捷键: Ctrl+` 切换控制台
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setShowConsole(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 加载文件内容
  useEffect(() => {
    if (selectedFile) {
      fileSystem.readFileText(selectedFile).then(content => {
        setFileContent(content || '');
      });
    }
  }, [selectedFile]);

  const handleStart = () => {
    if (currentAgentId === DEFAULT_AGENT_ID) {
      createSession(t('header.newSession'));
    } else {
      createAgentSession(currentAgentId, t('header.newSession'));
    }
    setSidebarTab('sessions');
    setShowStatusPage(false);
    setShowAgentConfig(false);
  };

  const handleLogoClick = () => {
    setSidebarTab('agents');
    setShowStatusPage(true);
    setShowAgentConfig(false);
    setSelectedFile(null);
    setShowGraph(false);
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    setShowGraph(false);
    setShowStatusPage(false);
    setShowAgentConfig(false);
  };

  const handleCloseFile = () => {
    setSelectedFile(null);
    setFileContent('');
    setShowStatusPage(true);
    setShowAgentConfig(false);
  };

  const handleFileBlankClick = () => {
    setSelectedFile(null);
    setFileContent('');
    setShowStatusPage(true);
    setShowAgentConfig(false);
  };

  const handleSaveFile = async (content: string) => {
    if (selectedFile) {
      await fileSystem.writeFile(selectedFile, content);
      // 保存后重新从文件系统读取，确保一致性
      const savedContent = await fileSystem.readFileText(selectedFile);
      setFileContent(savedContent || '');
    }
  };

  // 判断是否应该显示状态页
  const shouldShowStatusScreen = () => {
    if (sidebarTab === 'stats') {
      return false;
    }

    if (sidebarTab === 'agents' && !showAgentConfig && !showGraph && !selectedFile) {
      return true;
    }

    if (enableSessionTabs) {
      return showStatusPage || (isDefaultAgent ? openSessionIds.length === 0 : !currentSessionId);
    }

    // 传统模式：手动控制或没有当前会话时显示状态页
    return showStatusPage || !currentSession;
  };

  // 判断状态页是否显示开始按钮
  const shouldShowStartButton = () => {
    if (enableSessionTabs) {
      // 标签栏模式：没有任何会话时显示开始按钮
      return sessions.length === 0;
    } else {
      // 传统模式：总是显示开始按钮
      return true;
    }
  };

  const handleOpenGraph = (groupId?: string) => {
    setShowGraph(true);
    setGraphGroupId(groupId);
    setSelectedFile(null);
    setShowStatusPage(false);
    setShowAgentConfig(false);
  };

  const handleCloseGraph = () => {
    setShowGraph(false);
    setShowStatusPage(true);
  };

  const handleSidebarTabChange = (tab: 'agents' | 'sessions' | 'files' | 'stats') => {
    setSidebarTab(tab);

    if (tab === 'agents') {
      setShowStatusPage(true);
      setShowAgentConfig(false);
      setSelectedFile(null);
      setShowGraph(false);
      return;
    }

    setShowStatusPage(false);
    setShowAgentConfig(false);
  };

  const handleCurrentAgentDeleted = () => {
    setSidebarTab('agents');
    setShowStatusPage(true);
    setShowAgentConfig(false);
    setSelectedFile(null);
    setShowGraph(false);
  };

  const handleAgentSelect = (_agentId: string, _reselected: boolean) => {
    // Just switch agent — close config if open, show chat
    setShowAgentConfig(false);
    setShowStatusPage(false);
    setSelectedFile(null);
    setShowGraph(false);
  };

  const handleAgentConfig = (agentId: string) => {
    // Open config panel for the given agent
    const store = useAgentStore.getState();
    if (store.currentAgentId !== agentId) {
      store.setCurrentAgent(agentId);
    }
    setShowStatusPage(false);
    setShowAgentConfig(true);
    setSelectedFile(null);
    setShowGraph(false);
  };

  // Sidebar props shared across both render paths
  const sidebarProps = {
    activeTab: sidebarTab,
    onSelectFile: handleSelectFile,
    isOpen: isSidebarOpen,
    onClose: () => setIsSidebarOpen(false),
    onSessionSelect: () => { setShowStatusPage(false); setShowGraph(false); setShowAgentConfig(false); },
    onFileBlankClick: handleFileBlankClick,
    onOpenGraph: handleOpenGraph,
    onTabChange: handleSidebarTabChange,
    onAgentSelect: handleAgentSelect,
    onAgentConfig: handleAgentConfig,
    onCurrentAgentDeleted: handleCurrentAgentDeleted,
  };

  // 如果应该显示状态页，直接返回状态页
  if (shouldShowStatusScreen() && !selectedFile && !showGraph && !showAgentConfig) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-x-hidden">
        <Header
          onToggleConsole={() => setShowConsole(v => !v)}
          onToggleSidebar={() => setIsSidebarOpen(v => !v)}
          onLogoClick={handleLogoClick}
        />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <Sidebar {...sidebarProps} />
            <StatusScreen onStart={handleStart} showStartButton={shouldShowStartButton()} />
          </div>
          <Suspense fallback={<div />}>
            <ConsolePanel
              isOpen={showConsole}
              height={consoleHeight}
              onHeightChange={setConsoleHeight}
              onClose={() => setShowConsole(false)}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-x-hidden">
      {/* 头部 */}
      <Header
        onToggleConsole={() => setShowConsole(v => !v)}
        onToggleSidebar={() => setIsSidebarOpen(v => !v)}
        onLogoClick={handleLogoClick}
      />

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* 侧边栏 */}
          <Sidebar
            selectedFilePath={selectedFile || undefined}
            {...sidebarProps}
          />

          {/* 主内容区 - 智能体配置、关系图、文件编辑器或聊天 */}
          <main className="flex-1 min-h-0 flex flex-col min-w-0">
            {showAgentConfig ? (
              <AgentConfigPanel agentId={currentAgentId} />
            ) : showGraph ? (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}><AgentGraph onClose={handleCloseGraph} groupId={graphGroupId} /></Suspense>
            ) : selectedFile ? (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}>
                <FileEditor
                  path={selectedFile}
                  content={fileContent}
                  onClose={handleCloseFile}
                  onSave={handleSaveFile}
                />
              </Suspense>
            ) : sidebarTab === 'stats' ? (
              <GlobalStatsPage />
            ) : (
              <>
                {enableSessionTabs && isDefaultAgent && sidebarTab !== 'agents' && <SessionTabs />}
                {enableSessionTabs && isDefaultAgent ? (
                  <div className="flex-1 min-h-0 relative overflow-hidden">
                    {openSessionIds.map((sessionId) => (
                      <div
                        key={sessionId}
                        className={`absolute inset-0 ${
                          currentSession?.id === sessionId ? 'block' : 'hidden'
                        }`}
                      >
                        <ChatContainer sessionId={sessionId} />
                      </div>
                    ))}
                  </div>
                ) : (
                  currentSession ? (
                    <ChatContainer sessionId={currentSession.id} />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <p>{t('chat.noSessionHint')}</p>
                    </div>
                  )
                )}
              </>
            )}
          </main>
        </div>

        {/* 控制台面板 */}
        <Suspense fallback={<div />}>
          <ConsolePanel
            isOpen={showConsole}
            height={consoleHeight}
            onHeightChange={setConsoleHeight}
            onClose={() => setShowConsole(false)}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default App;
