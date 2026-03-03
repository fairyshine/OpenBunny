import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session';
import { useSettingsStore } from '../../stores/settings';
import { toolRegistry } from '../../services/tools/registry';
import { getOpenAITools, parseToolCallArguments, convertArgumentsToInput, generateOpenAISystemPrompt } from '../../services/tools/openai-format';
import { Message } from '../../types';
import { useLLM } from '../../hooks/useLLM';
import { logLLM, logTool } from '../../services/console/logger';
import { LLMConversation } from '../../services/llm/conversation';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ToolBar from '../layout/ToolBar';
import ExportDialog from './ExportDialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download } from '../icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ChatContainerProps {
  sessionId: string;
}

export default function ChatContainer({ sessionId }: ChatContainerProps) {
  const { t } = useTranslation();
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
      content: t('chat.stopped'),
      timestamp: Date.now(),
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMessage);
    setIsLoading(true);
    setCurrentStatus('');
    logLLM('info', `User message: ${content.trim().slice(0, 100)}${content.length > 100 ? '...' : ''}`);

    try {
      await runAgentLoop(content.trim());
    } catch (error) {
      console.error('Error:', error);
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('chat.error', { error: error instanceof Error ? error.message : String(error) }),
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
        content: t('chat.configRequired'),
        timestamp: Date.now(),
      });
      return;
    }

    const groupId = crypto.randomUUID();

    const tools = getOpenAITools(enabledTools);
    logTool('info', `${tools.length} tools enabled`, {
      tools: tools.map(t => t.function.name).join(', ')
    });

    const systemPrompt = generateOpenAISystemPrompt(enabledTools);
    const conversation = new LLMConversation(systemPrompt);

    conversation.addUserMessage(userInput);
    conversation.debug();

    let iteration = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      iteration++;
      logLLM('info', `Agent loop - round ${iteration}`);

      const thinkingMessageId = crypto.randomUUID();
      addMessage(sessionId, {
        id: thinkingMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'thought',
        groupId,
      });

      const response = await sendLLMMessage(conversation.getMessages(), {
        tools: tools.length > 0 ? tools : undefined,
        onChunk: (content) => {
          updateMessage(sessionId, thinkingMessageId, { content });
        },
        onToolCalls: (toolCalls) => {
          logTool('info', `Model requests ${toolCalls.length} tool calls`, {
            tools: toolCalls.map(tc => tc.function.name).join(', ')
          });
        },
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        updateMessage(sessionId, thinkingMessageId, {
          type: 'thought',
          content: response.content || t('chat.callingTools'),
        });

        conversation.addAssistantMessage(response.content || null, response.toolCalls);

        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const args = parseToolCallArguments(toolCall);
          const input = convertArgumentsToInput(args);

          logTool('info', `Execute tool: ${toolName}`, {
            args: JSON.stringify(args).slice(0, 200),
            input: input.slice(0, 200)
          });

          const toolCallMessageId = crypto.randomUUID();
          addMessage(sessionId, {
            id: toolCallMessageId,
            role: 'assistant',
            content: t('chat.callTool', { toolName }),
            timestamp: Date.now(),
            type: 'tool_call',
            toolName,
            toolInput: JSON.stringify(args, null, 2),
            toolCallId: toolCall.id,
            groupId,
          });

          setCurrentStatus(t('chat.executing', { toolName }));

          const result = await executeTool(toolName, input);

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

          conversation.addToolResult(toolCall.id, result);
        }

        conversation.debug();

        setCurrentStatus('');
      } else {
        updateMessage(sessionId, thinkingMessageId, {
          type: 'response',
          content: response.content,
          groupId,
        });
        logLLM('success', 'Agent loop completed');
        break;
      }
    }

    setCurrentStatus('');
  };

  const executeTool = async (toolName: string, input: string): Promise<string> => {
    const toolId = toolName;

    if (!enabledTools.includes(toolId)) {
      const allTools = toolRegistry.getAll();
      logTool('warning', `Tool not enabled: ${toolName}`, {
        availableTools: allTools.map(t => t.metadata.id).join(', ')
      });
      return t('tools.exec.toolNotEnabled', { toolName });
    }

    try {
      logTool('info', `Execute tool: ${toolName} (${toolId})`);
      const result = await toolRegistry.execute(toolId, input);
      logTool('success', `Tool executed successfully: ${toolName}`, { resultLength: result.content.length });
      return result.content;
    } catch (error) {
      logTool('error', `Tool execution error: ${toolName}`, error instanceof Error ? error.message : error);
      return t('tools.exec.toolError', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>{t('chat.sessionNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ToolBar />

        <div className="flex items-center gap-2">
          {currentStatus && (
            <Badge variant="secondary" className="animate-pulse">
              {currentStatus}
            </Badge>
          )}

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
              <TooltipContent>{t('chat.exportConversation')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MessageList messages={session.messages} />
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        onStop={handleStop}
      />

      <ExportDialog
        messages={session.messages}
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
