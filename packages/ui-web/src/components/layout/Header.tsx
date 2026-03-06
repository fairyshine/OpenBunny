import { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Menu, Brain, Languages, CheckIcon, Keyboard } from '../icons';
import { SquareTerminal, Clock } from 'lucide-react';
import { useSettingsStore } from '@shared/stores/settings';
import type { Language } from '@shared/stores/settings';
import { MemoryViewer } from '../memory/MemoryViewer';
import { CronViewer } from '../cron/CronViewer';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const SettingsModal = lazy(() => import('../settings/SettingsModal'));
const ShortcutsHelp = lazy(() => import('../ShortcutsHelp'));
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface HeaderProps {
  onToggleConsole?: () => void;
  onToggleSidebar?: () => void;
  onLogoClick?: () => void;
}

export default function Header({ onToggleConsole, onToggleSidebar, onLogoClick }: HeaderProps) {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isCronOpen, setIsCronOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { enabledTools, language, setLanguage } = useSettingsStore();
  const isMemoryEnabled = enabledTools.includes('memory');
  const isCronEnabled = enabledTools.includes('cron');

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'system', label: t('settings.language.system') },
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
  ];

  return (
    <>
      <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 shadow-none">
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
            <button
              onClick={onLogoClick}
              className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center text-background text-sm hover:opacity-80 transition-opacity cursor-pointer"
              title={t('status.subtitle')}
            >
              🐰
            </button>
            <h1 className="font-semibold text-foreground tracking-tight">CyberBunny</h1>
          </div>
        </div>

        <TooltipProvider>
          <div className="flex items-center gap-1">
            {isMemoryEnabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsMemoryOpen(true)}
                    variant="ghost"
                    size="icon"
                  >
                    <Brain className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('tools.memory.name')}</TooltipContent>
              </Tooltip>
            )}

            {isCronEnabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsCronOpen(true)}
                    variant="ghost"
                    size="icon"
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('tools.cron.name')}</TooltipContent>
              </Tooltip>
            )}

            {onToggleConsole && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleConsole}
                    variant="ghost"
                    size="icon"
                  >
                    <SquareTerminal className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('header.console')}</TooltipContent>
              </Tooltip>
            )}

            <ThemeToggle />

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                    >
                      <Languages className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('settings.language')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {languageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setLanguage(option.value)}
                    className="flex items-center justify-between min-w-[140px]"
                  >
                    <span>{option.label}</span>
                    {language === option.value && (
                      <CheckIcon className="w-4 h-4 ml-2" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsShortcutsOpen(true)}
                  variant="ghost"
                  size="icon"
                >
                  <Keyboard className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('shortcuts.title')}</TooltipContent>
            </Tooltip>

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

      <Suspense fallback={null}>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <ShortcutsHelp isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      </Suspense>
      <MemoryViewer isOpen={isMemoryOpen} onClose={() => setIsMemoryOpen(false)} />
      <CronViewer isOpen={isCronOpen} onClose={() => setIsCronOpen(false)} />
    </>
  );
}
