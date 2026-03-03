import { useEffect, useState } from 'react';
import ChatContainer from './components/ChatContainer';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import WelcomeScreen from './components/WelcomeScreen';
import FileEditor from './components/FileEditor';
import ConsolePanel from './components/ConsolePanel';
import { useSessionStore } from './stores/session';
import { useSettingsStore } from './stores/settings';
import { pythonExecutor } from './services/python/executor';
import { fileSystem } from './services/filesystem';
import { logSystem } from './services/console/logger';

function App() {
  const { currentSession, createSession } = useSessionStore();
  const { initializePython } = useSettingsStore();
  const [showWelcome, setShowWelcome] = useState(!currentSession);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showConsole, setShowConsole] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Apply theme on mount
  useEffect(() => {
    // Initialize theme on mount
    const { theme } = useSettingsStore.getState();
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      root.classList.add(theme);
    }
  }, []);

  // 启动日志（只执行一次）
  useEffect(() => {
    logSystem('info', 'CyberBunny 启动');
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
  }, [currentSession, initializePython]);

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
    createSession('新会话');
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
          <ConsolePanel isOpen={showConsole} onClose={() => setShowConsole(false)} />
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
              <FileEditor
                path={selectedFile}
                content={fileContent}
                onClose={handleCloseFile}
                onSave={handleSaveFile}
              />
            ) : currentSession ? (
              <ChatContainer sessionId={currentSession.id} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>创建一个新会话开始聊天，或在侧边栏选择一个文件</p>
              </div>
            )}
          </main>
        </div>

        {/* 控制台面板 */}
        <ConsolePanel isOpen={showConsole} onClose={() => setShowConsole(false)} />
      </div>
    </div>
  );
}

export default App;
