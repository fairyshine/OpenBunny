import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@openbunny/shared/stores/agent';
import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';
import { AvatarPicker } from '../ui/avatar-picker';
import { ScrollArea } from '../ui/scroll-area';
import { LLMSection } from './LLMSection';
import { ToolManager } from './ToolManager';
import { SkillManager } from './SkillManager';
import { ChevronRight } from 'lucide-react';

interface AgentConfigPanelProps {
  agentId: string;
}

const AGENT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];
const AGENT_AVATARS = ['🐰', '🤖', '🦾', '🧠', '👾', '🚀', '⚡', '🔮', '💎', '🌟', '🎯', '🎨', '🔥'];

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl bg-muted/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-xl"
      >
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function AgentConfigPanel({ agentId }: AgentConfigPanelProps) {
  const { t } = useTranslation();
  const agents = useAgentStore((s) => s.agents);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const agent = agents.find((a) => a.id === agentId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [mindUserPrompt, setMindUserPrompt] = useState('');
  const [chatActiveAssistantPrompt, setChatActiveAssistantPrompt] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description);
      setSystemPrompt(agent.systemPrompt);
      setMindUserPrompt(agent.mindUserPrompt || '');
      setChatActiveAssistantPrompt(agent.chatActiveAssistantPrompt || '');
      setAvatar(agent.avatar);
      setColor(agent.color);
    }
  }, [agent?.id]);

  const saveBasicInfo = (patch: Partial<{ name: string; description: string; systemPrompt: string; mindUserPrompt: string; chatActiveAssistantPrompt: string; avatar: string; color: string }>) => {
    if (!agent) return;
    updateAgent(agent.id, patch);
  };

  if (!agent) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">

          {/* Hero card — centered large avatar + display name */}
          <div className="rounded-xl bg-muted/30 p-6">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl overflow-hidden"
                style={agent.isDefault ? {
                  backgroundColor: 'hsl(var(--foreground))',
                  color: 'hsl(var(--background))'
                } : {
                  backgroundColor: agent.color + '20',
                  color: agent.color
                }}
              >
                {isImageAvatar(agent.avatar)
                  ? <img src={agent.avatar} alt="avatar" className="w-full h-full object-cover" draggable={false} />
                  : agent.avatar}
              </div>
              <div className="text-center">
                <p className="text-base font-medium">{agent.name}</p>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>
                )}
              </div>
            </div>

            {/* Avatar picker */}
            <div className="mt-5 space-y-1.5">
              <label className="text-xs font-medium">{t('sidebar.agent.avatar')}</label>
              <AvatarPicker
                value={avatar}
                emojis={AGENT_AVATARS}
                onChange={(v) => { setAvatar(v); saveBasicInfo({ avatar: v }); }}
                uploadLabel={t('sidebar.agent.uploadAvatar')}
                removeLabel={t('sidebar.agent.removeAvatar')}
              />
            </div>
          </div>

          {/* Info fields card */}
          <div className="rounded-xl bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('sidebar.agent.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() && saveBasicInfo({ name: name.trim() })}
                  placeholder={t('sidebar.agent.namePlaceholder')}
                  className="w-full h-8 px-3 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('sidebar.agent.color')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {AGENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setColor(c); saveBasicInfo({ color: c }); }}
                      className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('sidebar.agent.description')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => saveBasicInfo({ description })}
                placeholder={t('sidebar.agent.descriptionPlaceholder')}
                className="w-full h-8 px-3 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
          </div>

          {/* System Prompt — collapsible */}
          <CollapsibleSection title={t('sidebar.agent.systemPrompt')}>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={() => saveBasicInfo({ systemPrompt })}
              placeholder={t('sidebar.agent.systemPromptPlaceholder')}
              className="w-full px-3 py-2 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none text-sm"
              rows={6}
            />
          </CollapsibleSection>

          <CollapsibleSection title={t('sidebar.agent.mindUserPrompt')} defaultOpen={false}>
            <textarea
              value={mindUserPrompt}
              onChange={(e) => setMindUserPrompt(e.target.value)}
              onBlur={() => saveBasicInfo({ mindUserPrompt })}
              placeholder={t('sidebar.agent.mindUserPromptPlaceholder')}
              className="w-full px-3 py-2 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none text-sm"
              rows={6}
            />
          </CollapsibleSection>

          <CollapsibleSection title={t('sidebar.agent.chatActiveAssistantPrompt')} defaultOpen={false}>
            <textarea
              value={chatActiveAssistantPrompt}
              onChange={(e) => setChatActiveAssistantPrompt(e.target.value)}
              onBlur={() => saveBasicInfo({ chatActiveAssistantPrompt })}
              placeholder={t('sidebar.agent.chatActiveAssistantPromptPlaceholder')}
              className="w-full px-3 py-2 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none text-sm"
              rows={6}
            />
          </CollapsibleSection>

          {/* LLM — collapsible */}
          <CollapsibleSection title={t('settings.nav.llm')} defaultOpen={false}>
            <LLMSection />
          </CollapsibleSection>

          {/* Tools — collapsible */}
          <CollapsibleSection title={t('settings.nav.tools')} defaultOpen={false}>
            <ToolManager />
          </CollapsibleSection>

          {/* Skills — collapsible */}
          <CollapsibleSection title={t('settings.nav.skills')} defaultOpen={false}>
            <SkillManager />
          </CollapsibleSection>

        </div>
      </ScrollArea>
    </div>
  );
}
