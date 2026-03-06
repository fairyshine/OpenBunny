import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import { builtinTools } from '@shared/services/ai/tools';
import { detectPlatform } from '@shared/platform/detect';
import { ToolIcon } from '../ToolIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Tool metadata for display
const toolDisplayInfo: Record<string, { name: string; description: string; icon: string }> = {
  python: { name: 'Python', description: 'Execute Python code', icon: 'python' },
  web_search: { name: 'Web Search', description: 'Search the web', icon: 'search' },
  file_manager: { name: 'File Manager', description: 'Manage files', icon: 'folder' },
  memory: { name: 'Memory', description: 'Persistent memory', icon: 'brain' },
  exec: { name: 'Shell Exec', description: 'Execute shell commands (Desktop only)', icon: 'terminal' },
};

const platform = detectPlatform();
const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');

export default function ToolBar() {
  const { t } = useTranslation();
  const { enabledTools, toggleTool } = useSettingsStore();
  const allToolIds = Object.keys(builtinTools);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow, allToolIds.length]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative min-w-0 flex-1">
        {/* Left fade mask */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
        )}

        <div
          ref={scrollRef}
          onScroll={checkOverflow}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1 -my-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allToolIds.map((toolId) => {
            const info = toolDisplayInfo[toolId] || { name: toolId, description: '', icon: 'wrench' };
            const isEnabled = enabledTools.includes(toolId);
            const isExecDisabled = toolId === 'exec' && !execAvailable;
            return (
              <Tooltip key={toolId}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !isExecDisabled && toggleTool(toolId)}
                    className={`
                      relative flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                      transition-all duration-200 select-none flex-shrink-0
                      ${isEnabled
                        ? 'text-foreground bg-muted/80 shadow-sm'
                        : 'text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/40'
                      }
                      ${isExecDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <ToolIcon icon={info.icon} className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{info.name}</span>
                    {isEnabled && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isExecDisabled ? t('tools.exec.desktopOnly') : info.description}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Right fade mask */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />
        )}
      </div>
    </TooltipProvider>
  );
}
