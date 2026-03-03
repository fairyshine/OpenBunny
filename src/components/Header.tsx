import { useState } from 'react';
import { Settings, Plus, Menu } from './icons';
import { useSessionStore } from '../stores/session';
import SettingsModal from './SettingsModal';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface HeaderProps {
  onToggleConsole?: () => void;
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleConsole, onToggleSidebar }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { createSession } = useSessionStore();

  return (
    <>
      <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <Button
              onClick={onToggleSidebar}
              variant="ghost"
              size="icon"
              className="md:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
            🐰
          </div>
          <h1 className="font-semibold text-foreground">CyberBunny</h1>
        </div>

        <TooltipProvider>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => createSession('新会话')}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新会话</span>
            </Button>

            {onToggleConsole && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleConsole}
                    variant="ghost"
                    size="icon"
                  >
                    <span className="font-mono text-sm">&gt;_</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>控制台</TooltipContent>
              </Tooltip>
            )}

            <ThemeToggle />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsSettingsOpen(true)}
                  variant="ghost"
                  size="icon"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>设置</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
