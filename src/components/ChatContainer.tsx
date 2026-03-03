import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../stores/session';
import { useSettingsStore } from '../stores/settings';
import { toolRegistry } from '../services/tools/registry';
import { getOpenAITools, parseToolCallArguments, convertArgumentsToInput, generateOpenAISystemPrompt } from '../services/tools/openai-format';
import { Message } from '../types';
import { useLLM } from '../hooks/useLLM';
import { logLLM, logTool } from '../services/console/logger';
import { LLMConversation } from '../services/llm/conversation';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ToolBar from './ToolBar';
import ExportDialog from './ExportDialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Download } from './icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ChatContainerProps {
  sessionId: string;
}

export default function ChatContainer({ sessionId }: ChatContainerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { sessions, addMessage, updateMessage, llmConfig } = useSessionStore();
  const { enabledTools } = useSettingsStore();
  const { sendMessage: sendLLMMessage, abort: abortLLM } = useLLM(llmConfig);

  const session = sessions.find((s) => s.id === sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, currentStatus]);

  const handleStop = () => {
    abortLLM();
    setIsLoading(false);
    setCurrentStatus('');
    addMessage(sessionId, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '⏸️ 已停止生成',
      timestamp: Date.now(),
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // 添加用户消息到 UI
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMessage);
    setIsLoading(true);
    setCurrentStatus('');
    logLLM('info', `用户消息: ${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}`);

    try {
      await runAgentLoop(content.trim());
    } catch (error) {
      console.error('Error:', error);
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ 出错了: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
      setCurrentStatus('');
    }
  };

  const runAgentLoop = async (userInput: string) => {
    if (!llmConfig.apiKey) {
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '⚠️ 请先配置 LLM API 密钥。点击右上角的设置按钮进行配置。',
        timestamp: Date.now(),
      });
      return;
    }

    // 生成本轮对话的 groupId
    const groupId = crypto.randomUUID();

    // 获取 OpenAI 格式的工具定义
    const tools = getOpenAITools(enabledTools);
    logTool('info', `已启用 ${tools.length} 个工具`, {
      tools: tools.map(t => t.function.name).join(', ')
    });

    // 创建独立的 LLM 对话管理器
    const systemPrompt = generateOpenAISystemPrompt(enabledTools);
    const conversation = new LLMConversation(systemPrompt);

    // 添加用户消息到 LLM 对话
    conversation.addUserMessage(userInput);

    // 调试：打印对话历史
    conversation.debug();

    let maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      logLLM('info', `Agent 循环 - 第 ${iteration} 轮`);

      // 创建思考消息（UI 层）
      const thinkingMessageId = crypto.randomUUID();
      addMessage(sessionId, {
        id: thinkingMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'thought',
        groupId,
      });

      // 调用 LLM（使用独立的对话历史）
      const response = await sendLLMMessage(conversation.getMessages(), {
        tools: tools.length > 0 ? tools : undefined,
        onChunk: (content) => {
          updateMessage(sessionId, thinkingMessageId, { content });
        },
        onToolCalls: (toolCalls) => {
          logTool('info', `模型请求调用 ${toolCalls.length} 个工具`, {
            tools: toolCalls.map(tc => tc.function.name).join(', ')
          });
        },
      });

      // 检查是否有工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        // 更新思考消息类型（UI 层）
        updateMessage(sessionId, thinkingMessageId, {
          type: 'thought',
          content: response.content || '正在调用工具...',
        });

        // 将 assistant 消息添加到 LLM 对话历史
        conversation.addAssistantMessage(response.content || null, response.toolCalls);

        // 执行所有工具调用
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const args = parseToolCallArguments(toolCall);
          const input = convertArgumentsToInput(args);

          logTool('info', `执行工具: ${toolName}`, {
            args: JSON.stringify(args).slice(0, 200),
            input: input.slice(0, 200)
          });

          // 创建工具调用消息（UI 层）
          const toolCallMessageId = crypto.randomUUID();
          addMessage(sessionId, {
            id: toolCallMessageId,
            role: 'assistant',
            content: `🔧 调用工具: ${toolName}`,
            timestamp: Date.now(),
            type: 'tool_call',
            toolName,
            toolInput: JSON.stringify(args, null, 2),
            toolCallId: toolCall.id,
            groupId,
          });

          setCurrentStatus(`正在执行: ${toolName}`);

          // 执行工具
          const result = await executeTool(toolName, input);

          // 创建工具结果消息（UI 层）
          const toolResultMessageId = crypto.randomUUID();
          addMessage(sessionId, {
            id: toolResultMessageId,
            role: 'tool',
            content: result,
            timestamp: Date.now(),
            type: 'tool_result',
            toolName,
            toolOutput: result,
            toolCallId: toolCall.id,
            groupId,
          });

          // 添加工具结果到 LLM 对话历史
          conversation.addToolResult(toolCall.id, result);
        }

        // 调试：打印更新后的对话历史
        conversation.debug();

        // 继续循环，让 LLM 处理工具结果
        setCurrentStatus('');
      } else {
        // 没有工具调用，这是最终响应
        updateMessage(sessionId, thinkingMessageId, {
          type: 'response',
          content: response.content,
          groupId,
        });
        logLLM('success', 'Agent 循环完成');
        break;
      }
    }

    if (iteration >= maxIterations) {
      logLLM('warning', `达到最大迭代次数 ${maxIterations}`);
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '⚠️ 已达到最大工具调用次数限制',
        timestamp: Date.now(),
        groupId,
      });
    }

    setCurrentStatus('');
  };

  const executeTool = async (toolName: string, input: string): Promise<string> => {
    // 工具名就是工具 ID（OpenAI 格式使用 ID）
    const toolId = toolName;

    if (!enabledTools.includes(toolId)) {
      const allTools = toolRegistry.getAll();
      logTool('warning', `工具未启用: ${toolName}`, {
        availableTools: allTools.map(t => t.metadata.id).join(', ')
      });
      return `工具 "${toolName}" 未启用，请在设置中启用该工具`;
    }

    try {
      logTool('info', `执行工具: ${toolName} (${toolId})`);
      const result = await toolRegistry.execute(toolId, input);
      logTool('success', `工具执行成功: ${toolName}`, { resultLength: result.content.length });
      return result.content;
    } catch (error) {
      logTool('error', `工具执行错误: ${toolName}`, error instanceof Error ? error.message : error);
      return `工具执行错误: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>会话不存在</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ToolBar />

        <div className="flex items-center gap-2">
          {/* 状态指示 */}
          {currentStatus && (
            <Badge variant="secondary" className="animate-pulse">
              {currentStatus}
            </Badge>
          )}

          {/* 导出按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowExportDialog(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>导出对话</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={session.messages} />
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        onStop={handleStop}
      />

      {/* 导出对话框 */}
      <ExportDialog
        messages={session.messages}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
