/**
 * LLM 对话管理器
 * 独立于 UI 层，专门管理发送给 LLM 的消息历史
 */

import { LLMMessage } from '../../types';
import { OpenAIToolCall } from '../tools/openai-format';

/**
 * LLM 对话历史管理器
 */
export class LLMConversation {
  private messages: LLMMessage[] = [];

  constructor(systemPrompt: string) {
    this.messages = [
      { role: 'system', content: systemPrompt }
    ];
  }

  /**
   * 添加用户消息
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content: content.trim(),
    });
  }

  /**
   * 添加 Assistant 消息（带工具调用）
   */
  addAssistantMessage(content: string | null, toolCalls?: OpenAIToolCall[]): void {
    this.messages.push({
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    });
  }

  /**
   * 添加工具结果消息
   */
  addToolResult(toolCallId: string, content: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content,
    });
  }

  /**
   * 获取所有消息（用于发送给 LLM）
   */
  getMessages(): LLMMessage[] {
    return [...this.messages];
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * 清空对话历史（保留 system prompt）
   */
  clear(): void {
    const systemPrompt = this.messages[0];
    this.messages = [systemPrompt];
  }

  /**
   * 获取最后一条用户消息
   */
  getLastUserMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        return this.messages[i].content;
      }
    }
    return null;
  }

  /**
   * 打印对话历史（调试用）
   */
  debug(): void {
    console.group('[LLM Conversation] 对话历史');
    this.messages.forEach((msg, index) => {
      console.log(`[${index}] ${msg.role}:`, msg.content || '(无文本内容)');
      if (msg.tool_calls) {
        console.log(`  └─ tool_calls:`, msg.tool_calls);
      }
      if (msg.tool_call_id) {
        console.log(`  └─ tool_call_id:`, msg.tool_call_id);
      }
    });
    console.groupEnd();
  }
}
