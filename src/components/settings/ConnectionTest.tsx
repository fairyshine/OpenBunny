import { useRef, useState } from 'react';
import { useSessionStore } from '../../stores/session';
import { buildChatCompletionsUrl } from '../../utils/api';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

export default function ConnectionTest() {
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
      log('=== 配置信息 ===');
      log(`Provider: ${llmConfig.provider}`);
      log(`Base URL: ${llmConfig.baseUrl || '(默认)'}`);
      log(`Model: ${llmConfig.model}`);
      log(`API Key: ${llmConfig.apiKey ? '已配置 (' + llmConfig.apiKey.substring(0, 10) + '...)' : '未配置'}`);
      log('');

      if (!llmConfig.apiKey) {
        log('❌ 错误: 未配置 API Key');
        return;
      }

      // 构建 URL
      const { url: apiUrl, targetUrl } = buildChatCompletionsUrl(llmConfig);

      log('=== 测试连接 ===');
      log(`请求 URL: ${apiUrl}`);
      if (targetUrl) {
        log(`目标 URL (代理): ${targetUrl}`);
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

      log(`响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        log('');
        log('❌ 请求失败:');
        log(errorText.substring(0, 500));
        log('');
        log('可能的原因:');
        if (llmConfig.baseUrl) {
          log('1. vLLM 服务器未运行');
          log('2. vLLM 未配置 CORS (需要 --allowed-origins "*")');
          log('3. Base URL 配置错误');
          log('4. 模型名称不正确');
        } else {
          log('1. API Key 无效');
          log('2. 网络连接问题');
        }
        return;
      }

      const data = await response.json();
      log('');
      log('✅ 连接成功!');
      log('');
      log('响应数据:');
      log(JSON.stringify(data, null, 2));

    } catch (error) {
      log('');
      log('❌ 连接失败:');
      log(error instanceof Error ? error.message : String(error));
      log('');
      log('可能的原因:');
      if (llmConfig.baseUrl) {
        log('1. vLLM 服务器未运行');
        log('2. vLLM 未配置 CORS');
        log('   启动命令: python -m vllm.entrypoints.openai.api_server \\');
        log('              --model your-model \\');
        log('              --allowed-origins "*"');
        log('3. Base URL 配置错误');
      } else {
        log('1. 网络连接问题');
        log('2. 防火墙阻止');
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
        {testing ? '测试中...' : '测试连接'}
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
