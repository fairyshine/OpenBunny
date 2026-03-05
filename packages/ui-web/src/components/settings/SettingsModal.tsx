import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { getProviderMeta } from '@shared/services/ai';
import { ToolManager } from './ToolManager';
import { SkillManager } from './SkillManager';
import ConnectionTest from './ConnectionTest';
import ProviderPicker from './ProviderPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ChevronRight, Settings, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '@shared/version';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { llmConfig, setLLMConfig } = useSessionStore();
  const {
    language,
    setLanguage,
    proxyUrl,
    setProxyUrl,
    toolExecutionTimeout,
    setToolExecutionTimeout
  } = useSettingsStore();

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="llm">{t('settings.tabs.llm')}</TabsTrigger>
              <TabsTrigger value="tools">{t('settings.tabs.tools')}</TabsTrigger>
              <TabsTrigger value="skills">{t('settings.tabs.skills')}</TabsTrigger>
              <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="llm" className="flex-1 overflow-y-auto mt-0">
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.provider')}</Label>
                <ProviderPicker
                  value={llmConfig.provider}
                  onChange={(value) => {
                    const meta = getProviderMeta(value);
                    if (meta) {
                      setLLMConfig({
                        provider: value,
                        model: meta.models[0] || llmConfig.model,
                        baseUrl: meta.defaultBaseUrl || llmConfig.baseUrl,
                      });
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm font-medium">{t('settings.model')}</Label>
                <Select
                  value={llmConfig.model}
                  onValueChange={(value) => setLLMConfig({ model: value })}
                >
                  <SelectTrigger id="model" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const meta = getProviderMeta(llmConfig.provider);
                      const models = meta?.models || [];
                      const allModels = models.includes(llmConfig.model)
                        ? models
                        : [llmConfig.model, ...models];
                      // Filter out empty strings to avoid Select.Item error
                      return allModels
                        .filter((m: string) => m && m.trim())
                        .map((m: string) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ));
                    })()}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => setLLMConfig({ model: e.target.value })}
                  placeholder="or type custom model"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-sm font-medium">{t('settings.apiKey')}</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
                  placeholder={getProviderMeta(llmConfig.provider)?.apiKeyPlaceholder || 'API Key'}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-sm font-medium">{t('settings.baseUrl')}</Label>
                <Input
                  id="baseUrl"
                  type="text"
                  value={llmConfig.baseUrl || ''}
                  onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
                  placeholder={getProviderMeta(llmConfig.provider)?.defaultBaseUrl || 'https://api.example.com/v1'}
                  className="h-10"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature" className="text-sm font-medium">
                    {t('settings.temperature')} <span className="text-primary font-semibold">{llmConfig.temperature}</span>
                  </Label>
                  <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={llmConfig.temperature}
                    onChange={(e) => setLLMConfig({ temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('settings.temperature.precise')}</span>
                    <span>{t('settings.temperature.creative')}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTokens" className="text-sm font-medium">{t('settings.maxTokens')}</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    value={llmConfig.maxTokens}
                    onChange={(e) => setLLMConfig({ maxTokens: parseInt(e.target.value) || 4096 })}
                    className="h-10"
                  />
                </div>
              </div>

              <Separator />

              <details className="group">
                <summary className="cursor-pointer text-sm font-medium py-2 flex items-center gap-2 hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                  {t('settings.connectionTest')}
                </summary>
                <div className="pt-3">
                  <ConnectionTest />
                </div>
              </details>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="flex-1 overflow-y-auto mt-0">
            <ToolManager />
          </TabsContent>

          <TabsContent value="skills" className="flex-1 overflow-y-auto mt-0">
            <div className="px-6 py-5">
              <SkillManager />
            </div>
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
