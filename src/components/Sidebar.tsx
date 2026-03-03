import { useState } from 'react';
import { useSessionStore } from '../stores/session';
import { Trash, ChevronLeft, ChevronRight, MessageSquare, Folder } from './icons';
import FileTree from './FileTree';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';

type TabType = 'sessions' | 'files';

interface SidebarProps {
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ selectedFilePath, onSelectFile, isOpen, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const { sessions, currentSession, setCurrentSession, deleteSession } = useSessionStore();

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-background border-r border-border flex-col items-center hidden md:flex">
        <div className="h-14 flex items-center justify-center border-b border-border w-full">
          <Button
            onClick={() => setIsCollapsed(false)}
            variant="ghost"
            size="icon"
            title="展开侧边栏"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex flex-col items-center py-2 gap-1">
          <Button
            onClick={() => {
              setActiveTab('sessions');
              setIsCollapsed(false);
            }}
            variant={activeTab === 'sessions' ? 'default' : 'ghost'}
            size="icon"
            title="会话"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => {
              setActiveTab('files');
              setIsCollapsed(false);
            }}
            variant={activeTab === 'files' ? 'default' : 'ghost'}
            size="icon"
            title="文件"
          >
            <Folder className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  const handleItemClick = () => {
    // 手机端点击后自动关闭抽屉
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* 手机端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`
        w-72 bg-background border-r border-border flex flex-col
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        hidden md:flex
        ${isOpen ? '!flex' : ''}
      `}>
      {/* 顶部标题和收起按钮 */}
      <div className="h-14 border-b border-border flex items-center justify-between px-3">
        <span className="font-medium">
          {activeTab === 'sessions' ? '🗨️ 会话' : '📁 文件'}
        </span>
        <Button
          onClick={() => {
            setIsCollapsed(true);
            if (onClose) onClose();
          }}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="收起侧边栏"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* 标签页切换 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            会话
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <Folder className="w-4 h-4" />
            文件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  暂无会话
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      setCurrentSession(session.id);
                      handleItemClick();
                    }}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      currentSession?.id === session.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.updatedAt)}
                      </p>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive hover:text-destructive"
                      title="删除会话"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="flex-1 mt-0">
          <FileTree
            selectedPath={selectedFilePath}
            onSelectFile={onSelectFile}
            onItemClick={handleItemClick}
          />
        </TabsContent>
      </Tabs>
    </aside>
    </>
  );
}
