// 消息历史管理工具
import { Message } from '../types';

/**
 * 消息历史管理器
 * 提供消息压缩、搜索、统计等功能
 */
export class MessageHistoryManager {
  /**
   * 估算消息的 token 数量（粗略估算）
   * 1 token ≈ 4 个字符（英文）或 1.5 个字符（中文）
   */
  static estimateTokens(text: string): number {
    // 简单估算：中文字符 * 1.5 + 英文字符 * 0.25
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
  }

  /**
   * 计算消息列表的总 token 数
   */
  static calculateTotalTokens(messages: Message[]): number {
    return messages.reduce((total, msg) => {
      return total + this.estimateTokens(msg.content);
    }, 0);
  }

  /**
   * 压缩消息历史，保持在 token 限制内
   * 策略：
   * 1. 始终保留 system message
   * 2. 保留最近的 N 条消息
   * 3. 压缩中间的消息（只保留摘要）
   */
  static compressMessages(
    messages: Message[],
    maxTokens: number,
    keepRecentCount: number = 10
  ): Message[] {
    if (messages.length === 0) return [];

    const result: Message[] = [];
    let currentTokens = 0;

    // 1. 保留 system message
    const systemMessages = messages.filter(m => m.role === 'system');
    for (const msg of systemMessages) {
      result.push(msg);
      currentTokens += this.estimateTokens(msg.content);
    }

    // 2. 保留最近的消息
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = nonSystemMessages.slice(-keepRecentCount);

    // 计算最近消息的 token 数
    const recentTokens = this.calculateTotalTokens(recentMessages);

    if (currentTokens + recentTokens <= maxTokens) {
      // 空间足够，添加所有最近消息
      result.push(...recentMessages);
      currentTokens += recentTokens;

      // 尝试添加更早的消息
      const olderMessages = nonSystemMessages.slice(0, -keepRecentCount);
      for (const msg of olderMessages.reverse()) {
        const msgTokens = this.estimateTokens(msg.content);
        if (currentTokens + msgTokens <= maxTokens) {
          result.splice(result.length - recentMessages.length, 0, msg);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }
    } else {
      // 空间不够，只添加部分最近消息
      for (const msg of recentMessages.reverse()) {
        const msgTokens = this.estimateTokens(msg.content);
        if (currentTokens + msgTokens <= maxTokens) {
          result.push(msg);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }
      result.reverse();
    }

    return result;
  }

  /**
   * 搜索消息
   */
  static searchMessages(
    messages: Message[],
    query: string,
    options: {
      caseSensitive?: boolean;
      searchInToolOutput?: boolean;
    } = {}
  ): Message[] {
    const { caseSensitive = false, searchInToolOutput = true } = options;
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    return messages.filter(msg => {
      const content = caseSensitive ? msg.content : msg.content.toLowerCase();

      // 搜索主要内容
      if (content.includes(searchQuery)) return true;

      // 搜索工具输出
      if (searchInToolOutput && msg.toolOutput) {
        const toolOutput = caseSensitive ? msg.toolOutput : msg.toolOutput.toLowerCase();
        if (toolOutput.includes(searchQuery)) return true;
      }

      // 搜索工具名称
      if (msg.toolName) {
        const toolName = caseSensitive ? msg.toolName : msg.toolName.toLowerCase();
        if (toolName.includes(searchQuery)) return true;
      }

      return false;
    });
  }

  /**
   * 按类型统计消息
   */
  static getMessageStats(messages: Message[]): {
    total: number;
    byRole: Record<string, number>;
    byType: Record<string, number>;
    toolCalls: number;
    tokens: number;
  } {
    const stats = {
      total: messages.length,
      byRole: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      toolCalls: 0,
      tokens: 0,
    };

    for (const msg of messages) {
      // 按 role 统计
      stats.byRole[msg.role] = (stats.byRole[msg.role] || 0) + 1;

      // 按 type 统计
      if (msg.type) {
        stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
      }

      // 统计工具调用
      if (msg.type === 'tool_call') {
        stats.toolCalls++;
      }

      // 统计 tokens
      stats.tokens += this.estimateTokens(msg.content);
    }

    return stats;
  }

  /**
   * 按 groupId 分组消息
   */
  static groupByGroupId(messages: Message[]): Map<string, Message[]> {
    const groups = new Map<string, Message[]>();

    for (const msg of messages) {
      const groupId = msg.groupId || msg.id;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(msg);
    }

    return groups;
  }

  /**
   * 获取对话轮次
   * 一个轮次 = 用户消息 + AI 响应（可能包含多次工具调用）
   */
  static getConversationTurns(messages: Message[]): Message[][] {
    const turns: Message[][] = [];
    let currentTurn: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // system 消息单独成组
        if (currentTurn.length > 0) {
          turns.push(currentTurn);
          currentTurn = [];
        }
        turns.push([msg]);
      } else if (msg.role === 'user') {
        // 新的用户消息开始新的轮次
        if (currentTurn.length > 0) {
          turns.push(currentTurn);
        }
        currentTurn = [msg];
      } else {
        // assistant 或 tool 消息加入当前轮次
        currentTurn.push(msg);
      }
    }

    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }

    return turns;
  }

  /**
   * 导出消息为 JSON
   */
  static exportToJSON(messages: Message[]): string {
    return JSON.stringify(messages, null, 2);
  }

  /**
   * 导出消息为 Markdown
   */
  static exportToMarkdown(messages: Message[]): string {
    const lines: string[] = [];
    lines.push('# 对话历史\n');

    const turns = this.getConversationTurns(messages);

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const firstMsg = turn[0];

      if (firstMsg.role === 'system') {
        lines.push('## System Prompt\n');
        lines.push('```');
        lines.push(firstMsg.content);
        lines.push('```\n');
      } else {
        lines.push(`## 轮次 ${i + 1}\n`);

        for (const msg of turn) {
          if (msg.role === 'user') {
            lines.push('**用户**:\n');
            lines.push(msg.content + '\n');
          } else if (msg.type === 'thought') {
            lines.push('**思考**:\n');
            lines.push('```');
            lines.push(msg.content);
            lines.push('```\n');
          } else if (msg.type === 'tool_call') {
            lines.push(`**工具调用**: \`${msg.toolName}\`\n`);
            lines.push('```');
            lines.push(msg.toolInput || '');
            lines.push('```\n');
          } else if (msg.type === 'tool_result') {
            lines.push(`**工具结果**: \`${msg.toolName}\`\n`);
            lines.push('```');
            lines.push(msg.content);
            lines.push('```\n');
          } else if (msg.type === 'response' || msg.role === 'assistant') {
            lines.push('**助手**:\n');
            lines.push(msg.content + '\n');
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 导出消息为纯文本
   */
  static exportToText(messages: Message[]): string {
    const lines: string[] = [];
    const turns = this.getConversationTurns(messages);

    for (const turn of turns) {
      for (const msg of turn) {
        const timestamp = new Date(msg.timestamp).toLocaleString('zh-CN');
        lines.push(`[${timestamp}] ${msg.role.toUpperCase()}`);

        if (msg.type) {
          lines.push(`  类型: ${msg.type}`);
        }

        if (msg.toolName) {
          lines.push(`  工具: ${msg.toolName}`);
        }

        lines.push(`  内容: ${msg.content}`);
        lines.push('');
      }
      lines.push('---\n');
    }

    return lines.join('\n');
  }

  /**
   * 验证消息完整性
   */
  static validateMessages(messages: Message[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查 toolCallId 匹配
    const toolCalls = new Map<string, Message>();
    const toolResults = new Map<string, Message>();

    for (const msg of messages) {
      if (msg.type === 'tool_call' && msg.toolCallId) {
        toolCalls.set(msg.toolCallId, msg);
      }
      if (msg.type === 'tool_result' && msg.toolCallId) {
        toolResults.set(msg.toolCallId, msg);
      }
    }

    // 检查每个 tool_call 是否有对应的 tool_result
    for (const [callId, callMsg] of toolCalls) {
      if (!toolResults.has(callId)) {
        errors.push(`工具调用 ${callId} (${callMsg.toolName}) 缺少对应的结果`);
      }
    }

    // 检查每个 tool_result 是否有对应的 tool_call
    for (const [callId, resultMsg] of toolResults) {
      if (!toolCalls.has(callId)) {
        errors.push(`工具结果 ${callId} (${resultMsg.toolName}) 缺少对应的调用`);
      }
    }

    // 检查 groupId 一致性
    const groups = this.groupByGroupId(messages);
    for (const [groupId, groupMsgs] of groups) {
      if (groupId === groupMsgs[0].id) continue; // 未分组的消息

      // 检查同组消息的时间戳是否接近
      const timestamps = groupMsgs.map(m => m.timestamp);
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const timeDiff = maxTime - minTime;

      if (timeDiff > 60000) { // 超过 1 分钟
        errors.push(`组 ${groupId} 的消息时间跨度过大 (${timeDiff}ms)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 清理重复消息
   */
  static deduplicateMessages(messages: Message[]): Message[] {
    const seen = new Set<string>();
    const result: Message[] = [];

    for (const msg of messages) {
      // 使用内容和时间戳作为唯一标识
      const key = `${msg.role}-${msg.content}-${msg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(msg);
      }
    }

    return result;
  }

  /**
   * 合并连续的相同角色消息
   */
  static mergeConsecutiveMessages(messages: Message[]): Message[] {
    if (messages.length === 0) return [];

    const result: Message[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const last = result[result.length - 1];

      // 只合并相同 role 且没有特殊类型的消息
      if (
        current.role === last.role &&
        !current.type &&
        !last.type &&
        !current.toolName &&
        !last.toolName
      ) {
        // 合并内容
        last.content += '\n\n' + current.content;
        last.timestamp = current.timestamp; // 使用最新的时间戳
      } else {
        result.push(current);
      }
    }

    return result;
  }
}

/**
 * 消息过滤器
 */
export class MessageFilter {
  /**
   * 只保留用户和助手的最终响应
   */
  static onlyUserAndResponse(messages: Message[]): Message[] {
    return messages.filter(msg => {
      if (msg.role === 'user') return true;
      if (msg.role === 'assistant' && msg.type === 'response') return true;
      if (msg.role === 'assistant' && !msg.type) return true;
      return false;
    });
  }

  /**
   * 移除工具调用细节
   */
  static removeToolDetails(messages: Message[]): Message[] {
    return messages.filter(msg => {
      return msg.type !== 'tool_call' && msg.type !== 'tool_result';
    });
  }

  /**
   * 只保留特定时间范围的消息
   */
  static byTimeRange(
    messages: Message[],
    startTime: number,
    endTime: number
  ): Message[] {
    return messages.filter(msg => {
      return msg.timestamp >= startTime && msg.timestamp <= endTime;
    });
  }

  /**
   * 只保留包含特定工具的消息组
   */
  static byToolName(messages: Message[], toolName: string): Message[] {
    const relevantGroupIds = new Set<string>();

    // 找出所有使用该工具的 groupId
    for (const msg of messages) {
      if (msg.toolName === toolName && msg.groupId) {
        relevantGroupIds.add(msg.groupId);
      }
    }

    // 返回这些组的所有消息
    return messages.filter(msg => {
      if (msg.groupId && relevantGroupIds.has(msg.groupId)) return true;
      if (msg.toolName === toolName) return true;
      return false;
    });
  }
}
