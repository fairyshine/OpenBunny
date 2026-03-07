import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader, X, Wrench, Lock } from '../icons';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useSettingsStore } from '@shared/stores/settings';
import { useSkillStore } from '@shared/stores/skills';
import { useSessionStore, selectCurrentSession } from '@shared/stores/session';
import { builtinTools } from '@shared/services/ai/tools';
import { detectPlatform } from '@shared/platform/detect';
import { ToolIcon, toolDisplayInfo } from '../ToolIcon';

const skillIconMap: Record<string, string> = {
  'data-analysis': 'python',
  'web-research': 'search',
};

const platform = detectPlatform();
const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');

type ScopeMode = 'global' | 'session';

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
  const [scopeMode, setScopeMode] = useState<ScopeMode>('session');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { enabledTools, toggleTool } = useSettingsStore();
  const { skills, enabledSkillIds, toggleSkill, loadSkills } = useSkillStore();
  const session = useSessionStore(selectCurrentSession);
  const setSessionTools = useSessionStore((s) => s.setSessionTools);
  const setSessionSkills = useSessionStore((s) => s.setSessionSkills);
  const allToolIds = Object.keys(builtinTools);

  // Whether the session has started (has messages) — tools/skills are locked
  const isSessionStarted = (session?.messages?.length ?? 0) > 0;

  // Determine effective tools/skills based on scope mode
  const effectiveTools = useMemo(() => {
    if (session?.sessionTools != null) return session.sessionTools;
    return enabledTools;
  }, [session?.sessionTools, enabledTools]);

  const effectiveSkills = useMemo(() => {
    if (session?.sessionSkills != null) return session.sessionSkills;
    return enabledSkillIds;
  }, [session?.sessionSkills, enabledSkillIds]);

  // Whether we're viewing session-level overrides
  const hasSessionOverride = session?.sessionTools != null || session?.sessionSkills != null;

  // Default to session mode; only switch to global if user explicitly toggled off overrides
  useEffect(() => {
    if (hasSessionOverride) {
      setScopeMode('session');
    }
    // On session switch, always default to session scope
  }, [session?.id]);

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

  const handleToggleTool = (toolId: string) => {
    if (isSessionStarted) return;
    if (scopeMode === 'global') {
      toggleTool(toolId);
    } else if (session) {
      const current = session.sessionTools ?? [...enabledTools];
      const next = current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId];
      setSessionTools(session.id, next);
      // Also snapshot skills if not yet
      if (session.sessionSkills == null) {
        setSessionSkills(session.id, [...enabledSkillIds]);
      }
    }
  };

  const handleToggleSkill = (skillId: string) => {
    if (isSessionStarted) return;
    if (scopeMode === 'global') {
      toggleSkill(skillId);
    } else if (session) {
      const current = session.sessionSkills ?? [...enabledSkillIds];
      const next = current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId];
      setSessionSkills(session.id, next);
      // Also snapshot tools if not yet
      if (session.sessionTools == null) {
        setSessionTools(session.id, [...enabledTools]);
      }
    }
  };

  const handleScopeChange = (mode: ScopeMode) => {
    if (isSessionStarted) return;
    setScopeMode(mode);
    if (mode === 'session' && session && !hasSessionOverride) {
      // Snapshot current global config to session
      setSessionTools(session.id, [...enabledTools]);
      setSessionSkills(session.id, [...enabledSkillIds]);
    } else if (mode === 'global' && session && hasSessionOverride) {
      // Clear session overrides, revert to global
      setSessionTools(session.id, undefined);
      setSessionSkills(session.id, undefined);
    }
  };

  // Display tools/skills based on current scope
  const displayTools = scopeMode === 'session' ? effectiveTools : enabledTools;
  const displaySkills = scopeMode === 'session' ? effectiveSkills : enabledSkillIds;

  const enabledToolCount = allToolIds.filter((id) => displayTools.includes(id)).length;
  const enabledSkillCount = skills.filter((s) => displaySkills.includes(s.id)).length;
  const enabledCount = enabledToolCount + enabledSkillCount;

  return (
    <div className="p-4 md:p-6 pb-safe">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="relative" ref={panelRef}>
          {/* Tools & Skills Panel */}
          {showPanel && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-background/30 backdrop-blur-sm border border-foreground/20 rounded-xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Scope switch + lock indicator */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleScopeChange(scopeMode === 'global' ? 'session' : 'global')}
                  disabled={isSessionStarted}
                  className={`
                    flex items-center gap-1.5 text-xs transition-colors duration-150
                    ${isSessionStarted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    ${scopeMode === 'session' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
                  `}
                >
                  {/* track */}
                  <span className={`
                    relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200
                    ${scopeMode === 'session' ? 'bg-primary' : 'bg-muted-foreground/30'}
                  `}>
                    {/* thumb */}
                    <span className={`
                      inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200
                      ${scopeMode === 'session' ? 'translate-x-3.5' : 'translate-x-0.5'}
                    `} />
                  </span>
                  <span className="font-medium select-none">
                    {scopeMode === 'session' ? t('chat.input.scopeSession') : t('chat.input.scopeGlobal')}
                  </span>
                </button>
                {isSessionStarted && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                    <Lock className="w-3 h-3" />
                    {t('chat.input.locked')}
                  </span>
                )}
              </div>

              {/* Tools section */}
              <div className="mb-3">
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  {t('chat.input.tools')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allToolIds.map((toolId) => {
                    const info = toolDisplayInfo[toolId] || { name: toolId, description: '', icon: 'wrench' };
                    const isEnabled = displayTools.includes(toolId);
                    const isExecDisabled = toolId === 'exec' && !execAvailable;
                    const isLocked = isSessionStarted;
                    return (
                      <button
                        key={toolId}
                        onClick={() => !isExecDisabled && !isLocked && handleToggleTool(toolId)}
                        title={isExecDisabled ? t('tools.exec.desktopOnly') : info.description}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                          transition-all duration-150 select-none
                          ${isEnabled
                            ? 'text-foreground bg-primary/10 border border-primary/20 shadow-sm'
                            : isLocked
                              ? 'text-muted-foreground/70 border border-transparent'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                          }
                          ${isExecDisabled ? 'opacity-30 cursor-not-allowed' : isLocked ? 'cursor-default' : 'cursor-pointer'}
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
                    {skills.map((skill) => {
                      const isEnabled = displaySkills.includes(skill.id);
                      const isLocked = isSessionStarted;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => !isLocked && handleToggleSkill(skill.id)}
                          title={skill.description}
                          className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                            transition-all duration-150 select-none
                            ${isEnabled
                              ? 'text-foreground bg-primary/10 border border-primary/20 shadow-sm'
                              : isLocked
                                ? 'text-muted-foreground/70 border border-transparent'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                            }
                            ${isLocked ? 'cursor-default' : 'cursor-pointer'}
                          `}
                        >
                          <ToolIcon icon={skillIconMap[skill.id] || 'wrench'} className="w-3.5 h-3.5" />
                          <span>{skill.name}</span>
                        </button>
                      );
                    })}
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
