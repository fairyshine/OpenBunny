import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { getProviderMeta } from '@shared/services/ai';
import type { LLMConfig, LLMPreset } from '@shared/types';
import { ToolManager } from './ToolManager';
import { SkillManager } from './SkillManager';
import ConnectionTest from './ConnectionTest';
import ProviderPicker from './ProviderPicker';
import ProfileSettings from './ProfileSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { ChevronRight, Settings, ExternalLink, Plus, Save, Trash2, Check, Pencil } from 'lucide-react';
import { APP_VERSION } from '@shared/version';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Default empty config for "new" form
const emptyConfig: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { setLLMConfig } = useSessionStore();
  const {
    language,
    setLanguage,
    proxyUrl,
    setProxyUrl,
    toolExecutionTimeout,
    setToolExecutionTimeout,
    enableSessionTabs,
    setEnableSessionTabs,
    masterVolume,
    setMasterVolume,
    masterMuted,
    setMasterMuted,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
    llmPresets,
    addLLMPreset,
    updateLLMPreset,
    removeLLMPreset,
  } = useSettingsStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sub-dialog state: null = closed, 'new' = creating, preset id = editing
  const [formOpen, setFormOpen] = useState<string | null>(null);
  const formRef = useRef<LLMConfig>({ ...emptyConfig });

  // Find which preset is currently applied (matches llmConfig)
  const activePresetId = useSessionStore((s) => {
    const cfg = s.llmConfig;
    return llmPresets.find(
      (p) => p.provider === cfg.provider && p.model === cfg.model && p.apiKey === cfg.apiKey
    )?.id ?? null;
  });

  const openNewForm = () => {
    const meta = getProviderMeta('openai');
    formRef.current = { ...emptyConfig, baseUrl: meta?.defaultBaseUrl || '' };
    setFormOpen('new');
  };

  const openEditForm = (preset: LLMPreset) => {
    formRef.current = {
      provider: preset.provider,
      model: preset.model,
      apiKey: preset.apiKey,
      baseUrl: preset.baseUrl,
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
    };
    setFormOpen(preset.id);
  };

  const handleFormSave = () => {
    const cfg = formRef.current;
    if (formOpen === 'new') {
      // Create new preset and apply it
      const preset = addLLMPreset({
        name: `${cfg.provider} / ${cfg.model}`,
        ...cfg,
      });
      setLLMConfig(cfg);
      void preset; // created
    } else if (formOpen) {
      // Update existing preset and apply it
      updateLLMPreset(formOpen, cfg);
      setLLMConfig(cfg);
    }
    setFormOpen(null);
  };

  // Apply preset to session llmConfig
  const applyPreset = (preset: LLMPreset) => {
    setLLMConfig({
      provider: preset.provider,
      model: preset.model,
      apiKey: preset.apiKey,
      baseUrl: preset.baseUrl,
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
    });
  };

  // Force re-mount LLMFormDialog when formOpen changes so inner state resets
  const formKey = formOpen ?? '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[900px] h-[680px] max-w-[90vw] max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('settings.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="llm" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="llm">{t('settings.tabs.llm')}</TabsTrigger>
              <TabsTrigger value="tools">{t('settings.tabs.tools')}</TabsTrigger>
              <TabsTrigger value="skills">{t('settings.tabs.skills')}</TabsTrigger>
              <TabsTrigger value="profile">{t('settings.tabs.profile')}</TabsTrigger>
              <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="llm" className="flex-1 overflow-y-auto mt-0">
            <div className="space-y-5 px-6 py-5">
              {/* Header with New button */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('settings.preset.saved')}</Label>
                <button
                  onClick={openNewForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {t('settings.preset.new')}
                </button>
              </div>

              {/* Preset cards grid */}
              {llmPresets.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {llmPresets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`relative group cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm ${
                          isActive
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute top-2 right-2 text-[10px] text-primary font-medium flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            {t('settings.preset.active')}
                          </span>
                        )}
                        {/* Editable name */}
                        {editingName === preset.id ? (
                          <input
                            autoFocus
                            className="text-sm font-medium bg-transparent border-b border-primary outline-none w-full mb-1"
                            defaultValue={preset.name}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val) updateLLMPreset(preset.id, { name: val });
                              setEditingName(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingName(null);
                            }}
                          />
                        ) : (
                          <div
                            className="text-sm font-medium truncate pr-14 cursor-text"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(preset.id); }}
                          >
                            {preset.name}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {preset.provider} · {preset.model}
                        </div>
                        {/* Action buttons */}
                        <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                          {deleteConfirmId === preset.id ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[10px] text-destructive">{t('settings.preset.deleteConfirm')}</span>
                              <button
                                onClick={() => {
                                  removeLLMPreset(preset.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="text-[10px] text-destructive font-medium hover:underline"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[10px] text-muted-foreground hover:underline"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditForm(preset); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(preset.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t('settings.preset.empty')}
                </div>
              )}

              <Separator />

              <details className="group" open>
                <summary className="cursor-pointer text-sm font-medium py-2 flex items-center gap-2 hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                  {t('settings.connectionTest')}
                </summary>
                <div className="pt-3">
                  <ConnectionTest />
                </div>
              </details>
            </div>

            {/* LLM config form sub-dialog */}
            <LLMFormDialog
              key={formKey}
              open={formOpen !== null}
              onOpenChange={(open) => { if (!open) setFormOpen(null); }}
              title={formOpen === 'new' ? t('settings.preset.newConfig') : t('settings.preset.editConfig')}
              initialConfig={formRef.current}
              onSave={(cfg) => { formRef.current = cfg; handleFormSave(); }}
            />
          </TabsContent>

          <TabsContent value="tools" className="flex-1 overflow-y-auto mt-0">
            <ToolManager />
          </TabsContent>

          <TabsContent value="skills" className="flex-1 overflow-y-auto mt-0">
            <div className="px-6 py-5">
              <SkillManager />
            </div>
          </TabsContent>

          <TabsContent value="profile" className="flex-1 overflow-y-auto mt-0">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="general" className="flex-1 overflow-y-auto mt-0">
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium">{t('settings.language')}</Label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value as any)}
                >
                  <SelectTrigger id="language" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t('settings.language.system')}</SelectItem>
                    <SelectItem value="zh-CN">{t('settings.language.zhCN')}</SelectItem>
                    <SelectItem value="en-US">{t('settings.language.enUS')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sessionTabs" className="text-sm font-medium">{t('settings.sessionTabs')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.sessionTabsHint')}</p>
                  </div>
                  <Switch
                    id="sessionTabs"
                    checked={enableSessionTabs}
                    onCheckedChange={setEnableSessionTabs}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="masterMuted" className="text-sm font-medium">{t('settings.masterVolume')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.masterVolumeHint')}</p>
                  </div>
                  <Switch
                    id="masterMuted"
                    checked={!masterMuted}
                    onCheckedChange={(checked) => setMasterMuted(!checked)}
                  />
                </div>
                {!masterMuted && (
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">{t('settings.volume')}</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={masterVolume}
                      onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                      {Math.round(masterVolume * 100)}%
                    </span>
                  </div>
                )}
                {!masterMuted && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="soundEffects" className="text-sm font-medium">{t('settings.soundEffects')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.soundEffectsHint')}</p>
                    </div>
                    <Switch
                      id="soundEffects"
                      checked={soundEffectsEnabled}
                      onCheckedChange={setSoundEffectsEnabled}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="proxyUrl" className="text-sm font-medium">{t('settings.proxyUrl')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="proxyUrl"
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="https://your-worker.workers.dev"
                    className="h-10"
                  />
                  <a
                    href="https://deploy.workers.cloudflare.com/?url=https://github.com/fairyshine/CyberBunny/tree/main/worker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 h-10 text-xs font-medium rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('settings.proxyDeploy')}
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.proxyHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toolTimeout" className="text-sm font-medium">{t('settings.toolTimeout')}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="toolTimeout"
                    type="number"
                    min="10000"
                    max="1800000"
                    step="1000"
                    value={toolExecutionTimeout}
                    onChange={(e) => setToolExecutionTimeout(parseInt(e.target.value) || 300000)}
                    className="h-10"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {Math.floor(toolExecutionTimeout / 1000)}s
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.toolTimeoutHint')}</p>
              </div>

              <Separator />

              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🐰</span>
                  <div className="space-y-2 flex-1">
                    <p className="font-semibold text-sm">{t('settings.about')}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('settings.aboutDesc')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">{t('settings.version', { version: APP_VERSION })}</span>
                      <span>•</span>
                      <span>React 19 + shadcn/ui</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ── LLM Config Form Sub-Dialog ── */

interface LLMFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialConfig: LLMConfig;
  onSave: (cfg: LLMConfig) => void;
}

function LLMFormDialog({ open, onOpenChange, title, initialConfig, onSave }: LLMFormDialogProps) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<LLMConfig>({ ...initialConfig });

  const update = (patch: Partial<LLMConfig>) => setCfg((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.provider')}</Label>
            <ProviderPicker
              value={cfg.provider}
              onChange={(value) => {
                const meta = getProviderMeta(value);
                if (meta) {
                  update({
                    provider: value,
                    model: meta.models[0] || cfg.model,
                    baseUrl: meta.defaultBaseUrl || cfg.baseUrl,
                  });
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.model')}</Label>
            <Select
              value={cfg.model}
              onValueChange={(value) => update({ model: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const meta = getProviderMeta(cfg.provider);
                  const models = meta?.models || [];
                  const allModels = models.includes(cfg.model) ? models : [cfg.model, ...models];
                  return allModels
                    .filter((m: string) => m && m.trim())
                    .map((m: string) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
            <Input
              type="text"
              value={cfg.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="or type custom model"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.apiKey')}</Label>
            <Input
              type="password"
              value={cfg.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={getProviderMeta(cfg.provider)?.apiKeyPlaceholder || 'API Key'}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.baseUrl')}</Label>
            <Input
              type="text"
              value={cfg.baseUrl || ''}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder={getProviderMeta(cfg.provider)?.defaultBaseUrl || 'https://api.example.com/v1'}
              className="h-10"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('settings.temperature')} <span className="text-primary font-semibold">{cfg.temperature}</span>
              </Label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={cfg.temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('settings.temperature.precise')}</span>
                <span>{t('settings.temperature.creative')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('settings.maxTokens')}</Label>
              <Input
                type="number"
                value={cfg.maxTokens}
                onChange={(e) => update({ maxTokens: parseInt(e.target.value) || 4096 })}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => onSave(cfg)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Save className="w-4 h-4" />
              {t('settings.preset.saveAndApply')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
