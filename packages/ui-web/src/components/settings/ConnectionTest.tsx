import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { testConnection as testLLMConnection } from '@openbunny/shared/services/ai/provider';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

export default function ConnectionTest() {
  const { t } = useTranslation();
  const [result, setResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const { llmConfig } = useAgentConfig();
  const { proxyUrl } = useSettingsStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollParentToBottom = () => {
    requestAnimationFrame(() => {
      const tabPanel = containerRef.current?.closest('[role="tabpanel"]');
      if (tabPanel) {
        tabPanel.scrollTo({ top: tabPanel.scrollHeight, behavior: 'smooth' });
      }
    });
  };

  const testConnection = async () => {
    setTesting(true);
    setResult('');
    scrollParentToBottom();

    const log = (msg: string) => {
      setResult(prev => prev + msg + '\n');
    };

    try {
      log(t('connTest.configInfo'));
      log(`Provider: ${llmConfig.provider}`);
      log(`Base URL: ${llmConfig.baseUrl || t('connTest.baseUrlDefault')}`);
      log(`Model: ${llmConfig.model}`);
      log(`API Key: ${llmConfig.apiKey ? t('connTest.apiKeyConfigured', { prefix: llmConfig.apiKey.substring(0, 10) }) : t('connTest.apiKeyNotConfigured')}`);
      log('');

      if (!llmConfig.apiKey) {
        log(t('connTest.noApiKey'));
        return;
      }

      log(t('connTest.testing'));
      log('Using AI SDK to test connection...');
      log('');

      const text = await testLLMConnection(llmConfig, proxyUrl);

      log('');
      log(t('connTest.success'));
      log('');
      log(`Response: ${text}`);

    } catch (error) {
      log('');
      log(t('connTest.failed'));
      if (error instanceof Error) {
        log(error.message);
        if (error.stack) {
          log('');
          log('Stack trace:');
          log(error.stack);
        }
        // Log the cause if available
        if ('cause' in error && error.cause) {
          log('');
          log('Cause:');
          log(String(error.cause));
        }
      } else {
        log(String(error));
      }
      log('');
      log(t('connTest.possibleReasons'));
      if (llmConfig.baseUrl) {
        log(t('connTest.vllmNotRunning'));
        log(t('connTest.baseUrlError'));
      } else {
        log('1. ' + t('connTest.networkError'));
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      <Button
        onClick={testConnection}
        disabled={testing}
      >
        {testing ? t('connTest.buttonTesting') : t('connTest.buttonTest')}
      </Button>

      {result && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                {result}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
