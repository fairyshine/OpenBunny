import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import { ToolManager } from './ToolManager';
import { SkillManager } from './SkillManager';
import { LLMSection, SettingsGroup } from './LLMSection';
import ProfileSettings from './ProfileSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Pencil,
  User,
  Settings2,
  BrainCircuit,
  Wrench,
  Sparkles,
  Globe,
} from 'lucide-react';
import { APP_VERSION } from '@shared/version';
import { isImageAvatar } from '@shared/utils/imageUtils';
import { AvatarPicker } from '../ui/avatar-picker';
import type { SettingsSection } from './settingsModalEvents';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
}

export default function SettingsModal({ isOpen, onClose, initialSection = 'profile' }: SettingsModalProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const { userProfile } = useSettingsStore();

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
    }
  }, [initialSection, isOpen]);

  const navItems: { id: SettingsSection; icon: React.ReactNode; label: string }[] = [
    { id: 'general', icon: <Settings2 className="w-[18px] h-[18px]" />, label: t('settings.nav.general') },
    { id: 'llm', icon: <BrainCircuit className="w-[18px] h-[18px]" />, label: t('settings.nav.llm') },
    { id: 'tools', icon: <Wrench className="w-[18px] h-[18px]" />, label: t('settings.nav.tools') },
    { id: 'skills', icon: <Sparkles className="w-[18px] h-[18px]" />, label: t('settings.nav.skills') },
    { id: 'network', icon: <Globe className="w-[18px] h-[18px]" />, label: t('settings.nav.network') },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!flex !flex-row w-[860px] h-[620px] max-w-[92vw] max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        {/* ── Left Sidebar ── */}
        <nav className="w-[200px] shrink-0 bg-muted/40 border-r flex flex-col py-2">
          <ScrollArea className="flex-1">
            {/* Profile nav item — special layout */}
            <div className="px-2 mb-2">
              <button
                onClick={() => setActiveSection('profile')}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] transition-colors text-left ${
                  activeSection === 'profile'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/80 hover:bg-accent'
                }`}
              >
                <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                  {userProfile.avatar ? (
                    isImageAvatar(userProfile.avatar)
                      ? <img src={userProfile.avatar} alt="avatar" className="w-full h-full object-cover" draggable={false} />
                      : userProfile.avatar
                  ) : <User className="w-5 h-5 text-muted-foreground" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] truncate ${activeSection === 'profile' ? 'font-medium' : ''}`}>
                    {t('settings.nav.profile')}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {userProfile.nickname || t('settings.profile.nicknamePlaceholder')}
                  </p>
                </div>
              </button>
            </div>

            <div className="px-2 pt-2 mt-2 space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/80 hover:bg-accent'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            {/* About at bottom of sidebar */}
            <div className="px-2 mt-3 pt-3">
              <button
                onClick={() => setActiveSection('about')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left ${
                  activeSection === 'about'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-accent'
                }`}
              >
                <span className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 text-sm">🐰</span>
                <span className="truncate">{t('settings.about')}</span>
              </button>
            </div>
          </ScrollArea>
        </nav>

        {/* ── Right Content ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeSection === 'profile' && <ProfileSettings />}
              {activeSection === 'general' && <GeneralSection />}
              {activeSection === 'llm' && <LLMSection />}
              {activeSection === 'tools' && <ToolsSection />}
              {activeSection === 'skills' && <SkillsSection />}
              {activeSection === 'network' && <NetworkSection />}
              {activeSection === 'about' && <AboutSection />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── General Settings ── */
function GeneralSection() {
  const { t } = useTranslation();
  const {
    language, setLanguage,
    enableSessionTabs, setEnableSessionTabs,
    masterVolume, setMasterVolume,
    masterMuted, setMasterMuted,
    soundEffectsEnabled, setSoundEffectsEnabled,
    toolExecutionTimeout, setToolExecutionTimeout,
    proxyUrl, setProxyUrl,
  } = useSettingsStore();

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{t('settings.nav.general')}</h2>

      <SettingsGroup>
        <SettingsRow label={t('settings.language')}>
          <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('settings.language.system')}</SelectItem>
              <SelectItem value="zh-CN">{t('settings.language.zhCN')}</SelectItem>
              <SelectItem value="en-US">{t('settings.language.enUS')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <Separator />

        <SettingsRow label={t('settings.sessionTabs')} hint={t('settings.sessionTabsHint')}>
          <Switch checked={enableSessionTabs} onCheckedChange={setEnableSessionTabs} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label={t('settings.masterVolume')} hint={t('settings.masterVolumeHint')}>
          <Switch checked={!masterMuted} onCheckedChange={(c) => setMasterMuted(!c)} />
        </SettingsRow>

        {!masterMuted && (
          <>
            <div className="flex items-center gap-3 pl-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">{t('settings.volume')}</Label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>

            <Separator />

            <SettingsRow label={t('settings.soundEffects')} hint={t('settings.soundEffectsHint')}>
              <Switch checked={soundEffectsEnabled} onCheckedChange={setSoundEffectsEnabled} />
            </SettingsRow>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup>
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.toolTimeout')}</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number" min="10000" max="1800000" step="1000"
              value={toolExecutionTimeout}
              onChange={(e) => setToolExecutionTimeout(parseInt(e.target.value) || 300000)}
              className="h-9"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {Math.floor(toolExecutionTimeout / 1000)}s
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.toolTimeoutHint')}</p>
        </div>
      </SettingsGroup>

      <SettingsGroup>
        <div className="space-y-2">
          <Label className="text-sm">{t('settings.proxyUrl')}</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://your-worker.workers.dev"
              className="h-9"
            />
            <a
              href="https://deploy.workers.cloudflare.com/?url=https://github.com/fairyshine/OpenBunny/tree/main/worker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-md bg-muted hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('settings.proxyDeploy')}
            </a>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.proxyHint')}</p>
        </div>
      </SettingsGroup>
    </div>
  );
}

/* ── Tools Section (wrapper) ── */
function ToolsSection() {
  return <ToolManager />;
}

/* ── Skills Section (wrapper) ── */
function SkillsSection() {
  return <SkillManager />;
}

/* ── Network Settings (Agent Identity) ── */
function NetworkSection() {
  const { t } = useTranslation();
  const {
    agentProfiles,
    addAgentProfile,
    updateAgentProfile,
    removeAgentProfile,
    setActiveAgentProfile,
  } = useSettingsStore();

  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', avatar: '🤖', description: '', systemPrompt: '' });

  const AGENT_EMOJIS = ['🐰', '🤖', '🧠', '🦾', '🎯', '🔮', '🛡️', '🌐', '🔬', '💡', '🎭'];

  const handleAddAgent = () => {
    if (!newAgent.name.trim()) return;
    addAgentProfile({ ...newAgent, isActive: agentProfiles.length === 0 });
    setNewAgent({ name: '', avatar: '🤖', description: '', systemPrompt: '' });
    setShowNewAgent(false);
  };

  const handleDeleteAgent = (id: string) => {
    if (!confirm(t('settings.profile.deleteConfirm'))) return;
    removeAgentProfile(id);
    if (editingAgentId === id) setEditingAgentId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('settings.nav.network')}</h2>
        <button
          onClick={() => setShowNewAgent(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('settings.profile.addAgent')}
        </button>
      </div>

      <SettingsGroup>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">{t('settings.profile.agentTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.profile.agentDesc')}</p>
          </div>
        </div>

        {/* New Agent Form */}
        {showNewAgent && (
          <AgentForm
            agent={newAgent}
            emojis={AGENT_EMOJIS}
            onChange={(updates) => setNewAgent((prev) => ({ ...prev, ...updates }))}
            onSave={handleAddAgent}
            onCancel={() => { setShowNewAgent(false); setNewAgent({ name: '', avatar: '🤖', description: '', systemPrompt: '' }); }}
          />
        )}

        {/* Agent Cards */}
        {agentProfiles.length === 0 && !showNewAgent ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('settings.profile.noAgents')}</p>
            <p className="text-xs mt-1">{t('settings.profile.noAgentsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {agentProfiles.map((agent) => (
              editingAgentId === agent.id ? (
                <AgentForm
                  key={agent.id}
                  agent={agent}
                  emojis={AGENT_EMOJIS}
                  onChange={(updates) => updateAgentProfile(agent.id, updates)}
                  onSave={() => setEditingAgentId(null)}
                  onCancel={() => setEditingAgentId(null)}
                  className="col-span-2"
                />
              ) : (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onActivate={() => setActiveAgentProfile(agent.id)}
                  onEdit={() => setEditingAgentId(agent.id)}
                  onDelete={() => handleDeleteAgent(agent.id)}
                />
              )
            ))}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}

/* ── Agent Card ── */
function AgentCard({
  agent,
  onActivate,
  onEdit,
  onDelete,
}: {
  agent: { id: string; name: string; avatar: string; description: string; isActive?: boolean };
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`relative p-3 rounded-lg transition-all ${
      agent.isActive ? 'bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
    }`}>
      <div className="flex items-start gap-2.5">
        <span className="text-2xl shrink-0 w-8 h-8 flex items-center justify-center overflow-hidden rounded">
          {isImageAvatar(agent.avatar)
            ? <img src={agent.avatar} alt="avatar" className="w-full h-full object-cover rounded" draggable={false} />
            : agent.avatar}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{agent.name}</span>
            {agent.isActive && (
              <span className="text-[10px] px-1.5 py-0 rounded bg-primary text-primary-foreground font-medium">
                {t('settings.profile.agentActive')}
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {!agent.isActive && (
          <button onClick={onActivate} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <Check className="w-3 h-3" />{t('settings.profile.activate')}
          </button>
        )}
        <button onClick={onEdit} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Pencil className="w-3 h-3" />{t('settings.profile.editAgent')}
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive ml-auto">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Agent Form ── */
function AgentForm({
  agent,
  emojis,
  onChange,
  onSave,
  onCancel,
  className = '',
}: {
  agent: { name: string; avatar: string; description: string; systemPrompt: string };
  emojis: string[];
  onChange: (updates: Partial<typeof agent>) => void;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={`p-3 rounded-lg bg-muted/50 space-y-3 ${className}`}>
      <AvatarPicker
        value={agent.avatar}
        emojis={emojis}
        onChange={(avatar) => onChange({ avatar })}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.profile.agentName')}</Label>
          <Input value={agent.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={t('settings.profile.agentNamePlaceholder')} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.profile.agentDesc.label')}</Label>
          <Input value={agent.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={t('settings.profile.agentDescPlaceholder')} className="h-7 text-xs" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('settings.profile.agentPrompt')}</Label>
        <textarea
          value={agent.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder={t('settings.profile.agentPromptPlaceholder')}
          rows={3}
          className="w-full rounded-md bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-xs rounded-md bg-muted hover:bg-accent transition-colors">{t('common.cancel')}</button>
        <button onClick={onSave} disabled={!agent.name.trim()} className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">{t('common.save')}</button>
      </div>
    </div>
  );
}

/* ── About Section ── */
function AboutSection() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{t('settings.about')}</h2>

      <SettingsGroup>
        <div className="flex items-start gap-3">
          <span className="text-3xl">🐰</span>
          <div className="space-y-2 flex-1">
            <p className="font-semibold text-base">OpenBunny</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('settings.aboutDesc')}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[11px]">
                {t('settings.version', { version: APP_VERSION })}
              </span>
              <span>·</span>
              <span>React 19 + shadcn/ui</span>
            </div>
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
}
