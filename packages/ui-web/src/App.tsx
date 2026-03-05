import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import ChatContainer from './components/chat/ChatContainer';
import SessionTabs from './components/chat/SessionTabs';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/layout/Header';
import WelcomeScreen from './components/layout/WelcomeScreen';
import { useSessionStore, selectCurrentSession } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { useSkillStore } from '@shared/stores/skills';
import { pythonExecutor } from '@shared/services/python/executor';
import { fileSystem } from '@shared/services/filesystem';
import { logSystem } from '@shared/services/console/logger';
import { applyTheme, setupSystemThemeListener } from './platform/theme';
import { initGlobalShortcuts } from './platform/keyboardShortcuts';

// Lazy load non-critical components
const FileEditor = lazy(() => import('./components/sidebar/FileEditor'));
const ConsolePanel = lazy(() => import('./components/layout/ConsolePanel'));

function App() {
  const { t } = useTranslation();
  const currentSession = useSessionStore(selectCurrentSession);
  const createSession = useSessionStore(s => s.createSession);
  const initializePython = useSettingsStore(s => s.initializePython);
  const theme = useSettingsStore(s => s.theme);
  const loadSkills = useSkillStore(s => s.loadSkills);
  const [showWelcome, setShowWelcome] = useState(!currentSession);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showConsole, setShowConsole] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    // 如果没有会话，显示欢迎页
    if (!currentSession) {
      setShowWelcome(true);
    }

    // 预加载 Python 环境
    if (initializePython) {
      pythonExecutor.initialize().catch(console.error);
    }

    // 初始化 Skills
    loadSkills();
  }, [currentSession, initializePython, loadSkills]);

  // 初始化全局快捷键系统
  useEffect(() => {
    const cleanup = initGlobalShortcuts();
    return cleanup;
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
    createSession(t('header.newSession'));
    setShowWelcome(false);
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
  };

  const handleCloseFile = () => {
    setSelectedFile(null);
    setFileContent('');
  };

  const handleSaveFile = async (content: string) => {
    if (selectedFile) {
      await fileSystem.writeFile(selectedFile, content);
      // 保存后重新从文件系统读取，确保一致性
      const savedContent = await fileSystem.readFileText(selectedFile);
      setFileContent(savedContent || '');
    }
  };

  if (showWelcome) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header
          onToggleConsole={() => setShowConsole(v => !v)}
          onToggleSidebar={() => setIsSidebarOpen(v => !v)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              onSelectFile={handleSelectFile}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
            <WelcomeScreen onStart={handleStart} />
          </div>
          <Suspense fallback={<div />}>
            <ConsolePanel isOpen={showConsole} onClose={() => setShowConsole(false)} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 头部 */}
      <Header
        onToggleConsole={() => setShowConsole(v => !v)}
        onToggleSidebar={() => setIsSidebarOpen(v => !v)}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* 侧边栏 */}
          <Sidebar
            selectedFilePath={selectedFile || undefined}
            onSelectFile={handleSelectFile}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* 主内容区 - 聊天或文件编辑器 */}
          <main className="flex-1 flex flex-col min-w-0">
            {selectedFile ? (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}>
                <FileEditor
                  path={selectedFile}
                  content={fileContent}
                  onClose={handleCloseFile}
                  onSave={handleSaveFile}
                />
              </Suspense>
            ) : (
              <>
                <SessionTabs />
                {currentSession ? (
                  <ChatContainer sessionId={currentSession.id} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>{t('chat.noSessionHint')}</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* 控制台面板 */}
        <Suspense fallback={<div />}>
          <ConsolePanel isOpen={showConsole} onClose={() => setShowConsole(false)} />
        </Suspense>
      </div>
    </div>
  );
}

export default App;
