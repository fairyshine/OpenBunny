// Skill Manager — full CRUD for built-in + user skills
// Skills stored as folders with SKILL.md in the virtual filesystem

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '@shared/stores/skills';
import type { LoadedSkill } from '@shared/services/skills';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { SkillFolderViewer } from './SkillFolderViewer';
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  FolderOpen,
  Code,
  Eye,
} from 'lucide-react';

export function SkillManager() {
  const { t } = useTranslation();
  const { skills, loading, loadSkills, createSkill, updateSkill, removeSkill, getSkillContent } = useSkillStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<LoadedSkill | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName || !newDesc) return;
    // Validate name format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(newName) || newName.includes('--')) {
      setError(t('skills.invalidName'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSkill(newName, newDesc);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [newName, newDesc, createSkill, t]);

  const handleEdit = useCallback(async (skill: LoadedSkill) => {
    const content = await getSkillContent(skill.name);
    setEditorContent(content || '');
    setEditSkill(skill);
    setError(null);
  }, [getSkillContent]);

  const handleSave = useCallback(async () => {
    if (!editSkill) return;
    setSaving(true);
    setError(null);
    try {
      await updateSkill(editSkill.name, editorContent);
      setEditSkill(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [editSkill, editorContent, updateSkill]);

  const handleDelete = useCallback(async (skill: LoadedSkill) => {
    if (skill.source === 'builtin') return;
    if (!window.confirm(t('skills.deleteConfirm', { name: skill.name }))) return;
    try {
      await removeSkill(skill.name);
    } catch (e) {
      setError(String(e));
    }
  }, [removeSkill, t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('skills.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('skills.totalCount', { count: skills.length })}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {t('skills.create')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Skill Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <Card className="col-span-full p-8 text-center text-muted-foreground">
            Loading...
          </Card>
        ) : skills.length === 0 ? (
          <Card className="col-span-full p-8 text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('skills.empty')}</p>
          </Card>
        ) : (
          skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => handleEdit(skill)}
              onDelete={() => handleDelete(skill)}
            />
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('skills.createNew')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('skills.name')}</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-skill"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('skills.nameHint')}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t('skills.description')}</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What this skill does..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={!newName || !newDesc || saving}>
                {saving ? t('skills.saving') : t('skills.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSkill} onOpenChange={() => setEditSkill(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {t('skills.editSkill')}: {editSkill?.name}
            </DialogTitle>
          </DialogHeader>
          {editSkill && (
            <SkillEditor
              skill={editSkill}
              content={editorContent}
              onChange={setEditorContent}
              onSave={handleSave}
              onClose={() => setEditSkill(null)}
              saving={saving}
              error={error}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: LoadedSkill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const toolName = `skills_${skill.name.replace(/-/g, '_')}`;

  return (
    <Card className="p-4 group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{skill.name}</h4>
            <Badge variant={skill.source === 'builtin' ? 'secondary' : 'default'} className="text-xs">
              {skill.source === 'builtin' ? t('skills.builtin') : t('skills.user')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {skill.description}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {toolName}
            </code>
            {skill.metadata?.version && (
              <span className="text-xs text-muted-foreground">v{skill.metadata.version}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          {skill.source !== 'builtin' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function SkillEditor({
  skill,
  content,
  onChange,
  onSave,
  onClose,
  saving,
  error,
}: {
  skill: LoadedSkill;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const isBuiltin = skill.source === 'builtin';

  return (
    <div className="flex flex-col gap-4 h-[60vh]">
      <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="editor">
            <Code className="w-4 h-4 mr-1" />
            {t('skills.editor')}
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-1" />
            {t('skills.preview')}
          </TabsTrigger>
          {!isBuiltin && (
            <TabsTrigger value="files">
              <FolderOpen className="w-4 h-4 mr-1" />
              {t('skills.files')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="editor" className="flex-1 min-h-0">
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="h-full font-mono text-sm resize-none"
            readOnly={isBuiltin}
            placeholder="---\nname: my-skill\ndescription: ...\n---\n\n# My Skill\n..."
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0">
          <ScrollArea className="h-full border rounded-lg p-4">
            <pre className="text-sm whitespace-pre-wrap">{content}</pre>
          </ScrollArea>
        </TabsContent>

        {!isBuiltin && (
          <TabsContent value="files" className="flex-1 min-h-0">
            <div className="h-full border rounded-lg overflow-hidden">
              <SkillFolderViewer
                skillPath={skill.path}
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        {!isBuiltin && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? t('skills.saving') : t('skills.save')}
          </Button>
        )}
      </div>
    </div>
  );
}
