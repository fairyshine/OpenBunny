import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session';
import { useSettingsStore } from '../../stores/settings';
import { ToolManager } from './ToolManager';
import ConnectionTest from './ConnectionTest';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ChevronRight, Settings } from 'lucide-react';
import { Lightbulb } from '../icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { llmConfig, setLLMConfig } = useSessionStore();
  const {
    proxyWorkerUrl,
    setProxyWorkerUrl,
    language,
    setLanguage
  } = useSettingsStore();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[95vh] md:max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-lg md:text-xl flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('settings.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="llm" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 md:px-6 pt-3 md:pt-4 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
              <TabsTrigger value="llm" className="text-xs sm:text-sm px-2">{t('settings.tabs.llm')}</TabsTrigger>
              <TabsTrigger value="tools" className="text-xs sm:text-sm px-2">{t('settings.tabs.tools')}</TabsTrigger>
              <TabsTrigger value="general" className="text-xs sm:text-sm px-2">{t('settings.tabs.general')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="llm" className="flex-1 min-h-0 mt-0 overflow-y-auto">
            <div className="space-y-4 px-4 md:px-6 py-4 md:pb-6">
              <div className="space-y-2">
                <Label htmlFor="provider" className="text-sm font-medium">{t('settings.provider')}</Label>
                <Select
                  value={llmConfig.provider}
                  onValueChange={(value) => setLLMConfig({ provider: value as any })}
                >
                  <SelectTrigger id="provider" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="custom">{t('settings.provider.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-sm font-medium">{t('settings.apiKey')}</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm font-medium">{t('settings.model')}</Label>
                <Input
                  id="model"
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => setLLMConfig({ model: e.target.value })}
                  placeholder="gpt-4"
                  className="h-10"
                />
              </div>

              {llmConfig.provider === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className="text-sm font-medium">{t('settings.baseUrl')}</Label>
                  <Input
                    id="baseUrl"
                    type="text"
                    value={llmConfig.baseUrl || ''}
                    onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="h-10"
                  />
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="proxyUrl" className="text-sm font-medium">{t('settings.proxyUrl')}</Label>
                <Input
                  id="proxyUrl"
                  type="text"
                  value={proxyWorkerUrl}
                  onChange={(e) => setProxyWorkerUrl(e.target.value)}
                  placeholder="https://cyberbunny-proxy.your-account.workers.dev"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{t('settings.proxyHint')}</span>
                </p>
              </div>

              <Separator />

              <details className="group" onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) {
                  requestAnimationFrame(() => {
                    const tabContent = (e.target as HTMLElement).closest('[role="tabpanel"]');
                    if (tabContent) {
                      tabContent.scrollTo({ top: tabContent.scrollHeight, behavior: 'smooth' });
                    }
                  });
                }
              }}>
                <summary className="cursor-pointer text-sm font-medium py-2 flex items-center gap-2 hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                  {t('settings.connectionTest')}
                </summary>
                <div className="pt-2">
                  <ConnectionTest />
                </div>
              </details>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="flex-1 min-h-0 mt-0">
            <ToolManager />
          </TabsContent>

          <TabsContent value="general" className="flex-1 min-h-0 mt-0 overflow-y-auto">
            <div className="space-y-4 px-4 md:px-6 py-4 md:pb-6">
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
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">{t('settings.version')}</span>
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
