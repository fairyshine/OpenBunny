import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session';
import { buildChatCompletionsUrl } from '../../utils/api';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

export default function ConnectionTest() {
  const { t } = useTranslation();
  const [result, setResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const { llmConfig } = useSessionStore();
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

      const { url: apiUrl, targetUrl } = buildChatCompletionsUrl(llmConfig);

      log(t('connTest.testing'));
      log(t('connTest.requestUrl', { url: apiUrl }));
      if (targetUrl) {
        log(t('connTest.targetUrl', { url: targetUrl }));
      }
      log('');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`,
      };

      if (targetUrl) {
        headers['X-Target-URL'] = targetUrl;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10,
          stream: false,
        }),
      });

      log(t('connTest.responseStatus', { status: response.status, statusText: response.statusText }));

      if (!response.ok) {
        const errorText = await response.text();
        log('');
        log(t('connTest.requestFailed'));
        log(errorText.substring(0, 500));
        log('');
        log(t('connTest.possibleReasons'));
        if (llmConfig.baseUrl) {
          log(t('connTest.vllmNotRunning'));
          log(t('connTest.vllmNoCors'));
          log(t('connTest.baseUrlError'));
          log(t('connTest.modelNameError'));
        } else {
          log(t('connTest.apiKeyInvalid'));
          log(t('connTest.networkErrorNum'));
        }
        return;
      }

      const data = await response.json();
      log('');
      log(t('connTest.success'));
      log('');
      log(t('connTest.responseData'));
      log(JSON.stringify(data, null, 2));

    } catch (error) {
      log('');
      log(t('connTest.failed'));
      log(error instanceof Error ? error.message : String(error));
      log('');
      log(t('connTest.possibleReasons'));
      if (llmConfig.baseUrl) {
        log(t('connTest.vllmNotRunning'));
        log(t('connTest.vllmNoCorsShort'));
        log('   python -m vllm.entrypoints.openai.api_server \\');
        log('              --model your-model \\');
        log('              --allowed-origins "*"');
        log(t('connTest.baseUrlError'));
      } else {
        log('1. ' + t('connTest.networkError'));
        log(t('connTest.firewallBlock'));
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
