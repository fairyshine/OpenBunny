import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import type { AgentProfile } from '@shared/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Plus, Pencil, Trash2, Check, Bot, User } from 'lucide-react';

const AVATAR_EMOJIS = ['🐰', '🤖', '🦊', '🐱', '🐶', '🦉', '🐼', '🦄', '🐲', '🎭', '👾', '🧠'];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const {
    userProfile,
    setUserProfile,
    agentProfiles,
    addAgentProfile,
    updateAgentProfile,
    removeAgentProfile,
    setActiveAgentProfile,
  } = useSettingsStore();

  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', avatar: '🤖', description: '', systemPrompt: '' });

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
    <div className="space-y-6 px-6 py-5">
      {/* User Profile Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <div>
            <h3 className="text-sm font-medium">{t('settings.profile.userTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.profile.userDesc')}</p>
          </div>
        </div>

        <div className="space-y-3 pl-6">
          {/* Avatar picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('settings.profile.avatar')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setUserProfile({ avatar: emoji })}
                  className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all
                    ${userProfile.avatar === emoji
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                      : 'bg-muted hover:bg-accent'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nickname" className="text-xs">{t('settings.profile.nickname')}</Label>
              <Input
                id="nickname"
                value={userProfile.nickname}
                onChange={(e) => setUserProfile({ nickname: e.target.value })}
                placeholder={t('settings.profile.nicknamePlaceholder')}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t('settings.profile.email')}</Label>
              <Input
                id="email"
                type="email"
                value={userProfile.email}
                onChange={(e) => setUserProfile({ email: e.target.value })}
                placeholder={t('settings.profile.emailPlaceholder')}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs">{t('settings.profile.location')}</Label>
              <Input
                id="location"
                value={userProfile.location}
                onChange={(e) => setUserProfile({ location: e.target.value })}
                placeholder={t('settings.profile.locationPlaceholder')}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs">{t('settings.profile.bio')}</Label>
              <Input
                id="bio"
                value={userProfile.bio}
                onChange={(e) => setUserProfile({ bio: e.target.value })}
                placeholder={t('settings.profile.bioPlaceholder')}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Agent Profiles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <div>
              <h3 className="text-sm font-medium">{t('settings.profile.agentTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.profile.agentDesc')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewAgent(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('settings.profile.addAgent')}
          </button>
        </div>

        {/* New Agent Form */}
        {showNewAgent && (
          <AgentForm
            agent={newAgent}
            onChange={(updates) => setNewAgent((prev) => ({ ...prev, ...updates }))}
            onSave={handleAddAgent}
            onCancel={() => { setShowNewAgent(false); setNewAgent({ name: '', avatar: '🤖', description: '', systemPrompt: '' }); }}
          />
        )}

        {/* Agent Cards */}
        {agentProfiles.length === 0 && !showNewAgent ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
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
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onActivate,
  onEdit,
  onDelete,
}: {
  agent: AgentProfile;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`relative p-3 rounded-lg border transition-all ${
      agent.isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'
    }`}>
      <div className="flex items-start gap-2.5">
        <span className="text-2xl shrink-0">{agent.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{agent.name}</span>
            {agent.isActive && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {t('settings.profile.agentActive')}
              </Badge>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t">
        {!agent.isActive && (
          <button
            onClick={onActivate}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <Check className="w-3 h-3" />
            {t('settings.profile.activate')}
          </button>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-3 h-3" />
          {t('settings.profile.editAgent')}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive ml-auto"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function AgentForm({
  agent,
  onChange,
  onSave,
  onCancel,
  className = '',
}: {
  agent: { name: string; avatar: string; description: string; systemPrompt: string };
  onChange: (updates: Partial<typeof agent>) => void;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const AGENT_EMOJIS = ['🤖', '🧠', '🦾', '🎯', '🔮', '🛡️', '🌐', '🔬', '💡', '🎭'];

  return (
    <div className={`p-3 rounded-lg border border-primary/40 bg-muted/30 space-y-3 ${className}`}>
      {/* Avatar row */}
      <div className="flex gap-1.5 flex-wrap">
        {AGENT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onChange({ avatar: emoji })}
            className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-all
              ${agent.avatar === emoji
                ? 'bg-primary text-primary-foreground ring-1 ring-primary'
                : 'bg-background hover:bg-accent'}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.profile.agentName')}</Label>
          <Input
            value={agent.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('settings.profile.agentNamePlaceholder')}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.profile.agentDesc.label')}</Label>
          <Input
            value={agent.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t('settings.profile.agentDescPlaceholder')}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t('settings.profile.agentPrompt')}</Label>
        <textarea
          value={agent.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder={t('settings.profile.agentPromptPlaceholder')}
          rows={3}
          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded-md border hover:bg-accent transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={onSave}
          disabled={!agent.name.trim()}
          className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
