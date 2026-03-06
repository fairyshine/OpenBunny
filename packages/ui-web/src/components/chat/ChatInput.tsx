import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader, X, Wrench } from '../icons';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useSettingsStore } from '@shared/stores/settings';
import { useSkillStore } from '@shared/stores/skills';
import { builtinTools } from '@shared/services/ai/tools';
import { detectPlatform } from '@shared/platform/detect';
import { ToolIcon } from '../ToolIcon';

const toolDisplayInfo: Record<string, { name: string; description: string; icon: string }> = {
  python: { name: 'Python', description: 'Execute Python code', icon: 'python' },
  web_search: { name: 'Web Search', description: 'Search the web', icon: 'search' },
  file_manager: { name: 'File Manager', description: 'Manage files', icon: 'folder' },
  memory: { name: 'Memory', description: 'Persistent memory', icon: 'brain' },
  exec: { name: 'Shell Exec', description: 'Execute shell commands (Desktop only)', icon: 'terminal' },
};

const skillIconMap: Record<string, string> = {
  'data-analysis': 'python',
  'web-research': 'search',
};

const platform = detectPlatform();
const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, onStop, isLoading, disabled, placeholder }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { enabledTools, toggleTool } = useSettingsStore();
  const { skills, loadSkills } = useSkillStore();
  const allToolIds = Object.keys(builtinTools);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPanel]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled && !isLoading) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const enabledCount = allToolIds.filter((id) => enabledTools.includes(id)).length;

  return (
    <div className="p-4 md:p-6 pb-safe">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="relative" ref={panelRef}>
          {/* Tools & Skills Panel */}
          {showPanel && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-background/30 backdrop-blur-sm border border-foreground/20 rounded-xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Tools section */}
              <div className="mb-3">
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  {t('chat.input.tools')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allToolIds.map((toolId) => {
                    const info = toolDisplayInfo[toolId] || { name: toolId, description: '', icon: 'wrench' };
                    const isEnabled = enabledTools.includes(toolId);
                    const isExecDisabled = toolId === 'exec' && !execAvailable;
                    return (
                      <button
                        key={toolId}
                        onClick={() => !isExecDisabled && toggleTool(toolId)}
                        title={isExecDisabled ? t('tools.exec.desktopOnly') : info.description}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                          transition-all duration-150 select-none
                          ${isEnabled
                            ? 'text-foreground bg-primary/10 border border-primary/20 shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                          }
                          ${isExecDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <ToolIcon icon={info.icon} className="w-3.5 h-3.5" />
                        <span>{info.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skills section */}
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  {t('chat.input.skills')}
                </span>
                {skills.length === 0 ? (
                  <span className="text-xs text-muted-foreground/60">{t('chat.input.noSkills')}</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-primary/10 border border-primary/20 shadow-sm"
                      >
                        <ToolIcon icon={skillIconMap[skill.id] || 'wrench'} className="w-3.5 h-3.5" />
                        <span>{skill.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="relative flex items-end gap-2 bg-background/30 backdrop-blur-sm border border-foreground/20 rounded-xl p-2 shadow-lg">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowPanel(!showPanel)}
                    variant="ghost"
                    size="icon"
                    className={`flex-shrink-0 h-9 w-9 relative ${showPanel ? 'bg-muted' : ''}`}
                  >
                    <Wrench className="w-4 h-4" />
                    {enabledCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                        {enabledCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.input.toolsAndSkills')}</TooltipContent>
              </Tooltip>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || (disabled ? t('chat.input.processing') : t('chat.input.placeholder'))}
                disabled={disabled}
                className="flex-1 bg-transparent border-none resize-none outline-none min-h-[24px] max-h-[200px] focus-visible:ring-0 text-sm"
                rows={1}
              />

              {isLoading && onStop ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onStop}
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-9 w-9"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('chat.input.stop')}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() || disabled || isLoading}
                  size="icon"
                  className="flex-shrink-0 h-9 w-9 shadow-elegant"
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
