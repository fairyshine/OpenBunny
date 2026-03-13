import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { getProviderMeta } from '@openbunny/shared/services/ai';
import type { LLMConfig, LLMPreset } from '@openbunny/shared/types';
import ConnectionTest from './ConnectionTest';
import ProviderPicker from './ProviderPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import {
  ChevronRight,
  Plus,
  Save,
  Trash2,
  Check,
  Pencil,
} from 'lucide-react';

// Default empty config for "new" form
const emptyConfig: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
};

/* ── macOS-style grouped section wrapper ── */
export function SettingsGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-muted/30 p-4 space-y-3 ${className}`}>
      {children}
    </div>
  );
}

export function LLMSection() {
  const { t } = useTranslation();
  const { llmConfig, setLLMConfig } = useAgentConfig();
  const { llmPresets, addLLMPreset, updateLLMPreset, removeLLMPreset } = useSettingsStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<string | null>(null);
  const formRef = useRef<LLMConfig>({ ...emptyConfig });

  const activePresetId = llmPresets.find(
    (p) => p.provider === llmConfig.provider && p.model === llmConfig.model && p.apiKey === llmConfig.apiKey
  )?.id ?? null;

  const openNewForm = () => {
    const meta = getProviderMeta('openai');
    formRef.current = { ...emptyConfig, baseUrl: meta?.defaultBaseUrl || '' };
    setFormOpen('new');
  };

  const openEditForm = (preset: LLMPreset) => {
    formRef.current = {
      provider: preset.provider, model: preset.model, apiKey: preset.apiKey,
      baseUrl: preset.baseUrl, temperature: preset.temperature, maxTokens: preset.maxTokens,
    };
    setFormOpen(preset.id);
  };

  const handleFormSave = () => {
    const cfg = formRef.current;
    if (formOpen === 'new') {
      addLLMPreset({ name: `${cfg.provider} / ${cfg.model}`, ...cfg });
      setLLMConfig(cfg);
    } else if (formOpen) {
      updateLLMPreset(formOpen, cfg);
      setLLMConfig(cfg);
    }
    setFormOpen(null);
  };

  const applyPreset = (preset: LLMPreset) => {
    setLLMConfig({
      provider: preset.provider, model: preset.model, apiKey: preset.apiKey,
      baseUrl: preset.baseUrl, temperature: preset.temperature, maxTokens: preset.maxTokens,
    });
  };

  const formKey = formOpen ?? '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('settings.nav.llm')}</h2>
        <button
          onClick={openNewForm}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-muted hover:bg-accent transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t('settings.preset.new')}
        </button>
      </div>

      {/* Preset cards */}
      <SettingsGroup>
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('settings.preset.saved')}</Label>
        {llmPresets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {llmPresets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`relative group cursor-pointer rounded-lg p-3 transition-all ${
                    isActive
                      ? 'bg-primary/10'
                      : 'bg-background hover:bg-accent/50'
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-2 right-2 text-[10px] text-primary font-medium flex items-center gap-0.5">
                      <Check className="w-3 h-3" />
                      {t('settings.preset.active')}
                    </span>
                  )}
                  {editingName === preset.id ? (
                    <input
                      autoFocus
                      className="text-sm font-medium bg-transparent outline-none w-full mb-1 focus:ring-1 focus:ring-primary rounded px-1"
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
                  <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                    {deleteConfirmId === preset.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-destructive">{t('settings.preset.deleteConfirm')}</span>
                        <button
                          onClick={() => { removeLLMPreset(preset.id); setDeleteConfirmId(null); }}
                          className="text-[10px] text-destructive font-medium hover:underline"
                        >OK</button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] text-muted-foreground hover:underline"
                        >✕</button>
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
          <div className="text-sm text-muted-foreground text-center py-6">
            {t('settings.preset.empty')}
          </div>
        )}
      </SettingsGroup>

      {/* Connection Test */}
      <SettingsGroup>
        <details className="group" open>
          <summary className="cursor-pointer text-sm font-medium py-1 flex items-center gap-2 hover:text-primary transition-colors">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            {t('settings.connectionTest')}
          </summary>
          <div className="pt-3">
            <ConnectionTest />
          </div>
        </details>
      </SettingsGroup>

      {/* LLM config form sub-dialog */}
      <LLMFormDialog
        key={formKey}
        open={formOpen !== null}
        onOpenChange={(open) => { if (!open) setFormOpen(null); }}
        title={formOpen === 'new' ? t('settings.preset.newConfig') : t('settings.preset.editConfig')}
        initialConfig={formRef.current}
        onSave={(cfg) => { formRef.current = cfg; handleFormSave(); }}
      />
    </div>
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
            <Select value={cfg.model} onValueChange={(value) => update({ model: value })}>
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
                type="range" min="0" max="2" step="0.1"
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
