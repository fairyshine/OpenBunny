import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import { Button } from '../ui/button';
import { useAgentStore } from '@shared/stores/agent';
import type { Agent } from '@shared/types';

interface AgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent;
}

const AGENT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];
const AGENT_AVATARS = ['🤖', '🦾', '🧠', '👾', '🚀', '⚡', '🔮', '💎', '🌟', '🎯', '🎨', '🔥'];

export function AgentDialog({ isOpen, onClose, agent }: AgentDialogProps) {
  const { t } = useTranslation();
  const createAgent = useAgentStore((s) => s.createAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description);
      setSystemPrompt(agent.systemPrompt);
      setAvatar(agent.avatar);
      setColor(agent.color);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setAvatar('🤖');
      setColor('#3b82f6');
    }
  }, [agent, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (agent) {
      updateAgent(agent.id, { name: trimmedName, description, systemPrompt, avatar, color });
    } else {
      createAgent({ name: trimmedName, description, systemPrompt, avatar, color });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {agent ? t('sidebar.agent.edit') : t('sidebar.agent.create')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('sidebar.agent.avatar')}</label>
            <div className="flex flex-wrap gap-2">
              {AGENT_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                    avatar === emoji
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('sidebar.agent.color')}</label>
            <div className="flex flex-wrap gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('sidebar.agent.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sidebar.agent.namePlaceholder')}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('sidebar.agent.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('sidebar.agent.descriptionPlaceholder')}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('sidebar.agent.systemPrompt')}</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t('sidebar.agent.systemPromptPlaceholder')}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1">
              {agent ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
