// Project management dialog component
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@shared/stores/agent';
import type { Project } from '@shared/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { PROJECT_ICON_NAMES, getProjectIcon } from '../icons';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project; // If provided, edit mode; otherwise create mode
}

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1',
];

export function ProjectDialog({ isOpen, onClose, project }: ProjectDialogProps) {
  const { t } = useTranslation();
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const createAgentProject = useAgentStore((s) => s.createAgentProject);
  const updateAgentProject = useAgentStore((s) => s.updateAgentProject);
  const { createProject, updateProject } = useSessionStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<string>(PROJECT_ICON_NAMES[0]);

  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;

  useEffect(() => {
    if (isOpen) {
      setName(project?.name || '');
      setDescription(project?.description || '');
      setColor(project?.color || PRESET_COLORS[0]);
      setIcon(project?.icon || PROJECT_ICON_NAMES[0]);
    }
  }, [isOpen, project]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (project) {
      if (isDefaultAgent) {
        updateProject(project.id, { name: name.trim(), description: description.trim(), color, icon });
      } else {
        updateAgentProject(currentAgentId, project.id, { name: name.trim(), description: description.trim(), color, icon });
      }
    } else {
      if (isDefaultAgent) {
        createProject(name.trim(), description.trim(), color, icon);
      } else {
        createAgentProject(currentAgentId, name.trim(), description.trim(), color, icon);
      }
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {project ? t('sidebar.editProject') : t('sidebar.createProject')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Icon Picker */}
          <div>
            <label className="text-sm font-medium mb-2 block">{t('sidebar.projectIcon')}</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_ICON_NAMES.map((iconName) => {
                const IconComp = getProjectIcon(iconName);
                return (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg border-2 transition-all ${
                      icon === iconName
                        ? 'border-primary bg-primary/10 scale-110'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-sm font-medium mb-2 block">{t('sidebar.projectColor')}</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium mb-1 block">{t('sidebar.projectName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sidebar.projectName')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">{t('sidebar.projectDescription')}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('sidebar.projectDescription')}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              {project ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
