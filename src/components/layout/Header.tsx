import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Plus, Menu } from '../icons';
import { useSessionStore } from '../../stores/session';
import SettingsModal from '../settings/SettingsModal';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface HeaderProps {
  onToggleConsole?: () => void;
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleConsole, onToggleSidebar }: HeaderProps) {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { createSession } = useSessionStore();

  return (
    <>
      <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 shadow-elegant">
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center text-background text-sm">
              🐰
            </div>
            <h1 className="font-semibold text-foreground tracking-tight">CyberBunny</h1>
          </div>
        </div>

        <TooltipProvider>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => createSession(t('header.newSession'))}
              size="sm"
              variant="ghost"
              className="flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.newSession')}</span>
            </Button>

            {onToggleConsole && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleConsole}
                    variant="ghost"
                    size="icon"
                  >
                    <span className="font-mono text-sm font-medium">&gt;_</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('header.console')}</TooltipContent>
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
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('header.settings')}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
