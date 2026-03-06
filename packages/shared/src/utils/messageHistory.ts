// 消息历史管理工具
import { Message } from '../types';
import type { Tool } from 'ai';
import i18n from '../i18n';

export interface ExportOptions {
  systemPrompt?: string;
  sessionId?: string;
  sessionName?: string;
  tools?: Record<string, Tool>;
}

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
    if (!text) return 0;
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
      return total + this.estimateTokens(msg.content || '');
    }, 0);
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
      const content = msg.content || '';
      const contentToSearch = caseSensitive ? content : content.toLowerCase();

      // 搜索主要内容
      if (contentToSearch.includes(searchQuery)) return true;

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
      stats.tokens += this.estimateTokens(msg.content || '');
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
  static exportToJSON(messages: Message[], opts: ExportOptions = {}): string {
    const toolsList = opts.tools
      ? Object.entries(opts.tools).map(([name, tool]) => ({
          name,
          description: (tool as any).description || '',
        }))
      : [];

    const exportData = {
      sessionId: opts.sessionId || null,
      sessionName: opts.sessionName || null,
      systemPrompt: opts.systemPrompt || null,
      tools: toolsList.length > 0 ? toolsList : undefined,
      messages,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出消息为 Markdown
   */
  static exportToMarkdown(messages: Message[], opts: ExportOptions = {}): string {
    const t = i18n.t.bind(i18n);
    const lines: string[] = [];
    lines.push(t('history.title') + '\n');

    // Add session metadata if available
    if (opts.sessionId || opts.sessionName) {
      lines.push('## Session Info\n');
      if (opts.sessionName) {
        lines.push(`**Name:** ${opts.sessionName}\n`);
      }
      if (opts.sessionId) {
        lines.push(`**ID:** ${opts.sessionId}\n`);
      }
      lines.push('');
    }

    // Add system prompt if available
    if (opts.systemPrompt) {
      lines.push('## System Prompt\n');
      lines.push('```');
      lines.push(opts.systemPrompt);
      lines.push('```\n');
      lines.push('---\n');
    }

    // Add enabled tools info
    if (opts.tools && Object.keys(opts.tools).length > 0) {
      lines.push('## Tools\n');
      for (const [name, tool] of Object.entries(opts.tools)) {
        const desc = (tool as any).description || '';
        lines.push(`- **${name}**: ${desc}`);
      }
      lines.push('\n---\n');
    }

    const turns = this.getConversationTurns(messages);

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const firstMsg = turn[0];

      if (firstMsg.role === 'system') {
        lines.push('## System Prompt\n');
        lines.push('```');
        lines.push(firstMsg.content || '');
        lines.push('```\n');
      } else {
        lines.push(t('history.turn', { index: i + 1 }) + '\n');

        for (const msg of turn) {
          if (msg.role === 'user') {
            lines.push(t('history.user') + '\n');
            lines.push((msg.content || '') + '\n');
          } else if (msg.type === 'thought') {
            lines.push(t('history.thinking') + '\n');
            lines.push('```');
            lines.push(msg.content || '');
            lines.push('```\n');
          } else if (msg.type === 'tool_call') {
            lines.push(t('history.toolCall', { toolName: msg.toolName }) + '\n');
            lines.push('```');
            lines.push(msg.toolInput || '');
            lines.push('```\n');
          } else if (msg.type === 'tool_result') {
            lines.push(t('history.toolResult', { toolName: msg.toolName }) + '\n');
            lines.push('```');
            lines.push(msg.content || '');
            lines.push('```\n');
          } else if (msg.type === 'response' || msg.role === 'assistant') {
            lines.push(t('history.assistant') + '\n');
            lines.push((msg.content || '') + '\n');
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 导出消息为纯文本
   */
  static exportToText(messages: Message[], opts: ExportOptions = {}): string {
    const t = i18n.t.bind(i18n);
    const lines: string[] = [];

    // Add session metadata if available
    if (opts.sessionId || opts.sessionName) {
      lines.push('=== SESSION INFO ===');
      if (opts.sessionName) {
        lines.push(`Name: ${opts.sessionName}`);
      }
      if (opts.sessionId) {
        lines.push(`ID: ${opts.sessionId}`);
      }
      lines.push('');
    }

    // Add system prompt if available
    if (opts.systemPrompt) {
      lines.push('=== SYSTEM PROMPT ===');
      lines.push(opts.systemPrompt);
      lines.push('');
    }

    // Add enabled tools info
    if (opts.tools && Object.keys(opts.tools).length > 0) {
      lines.push('=== TOOLS ===');
      for (const [name, tool] of Object.entries(opts.tools)) {
        const desc = (tool as any).description || '';
        lines.push(`  ${name}: ${desc}`);
      }
      lines.push('');
    }

    lines.push('=== CONVERSATION ===');
    lines.push('');

    const turns = this.getConversationTurns(messages);

    for (const turn of turns) {
      for (const msg of turn) {
        const timestamp = new Date(msg.timestamp).toLocaleString(i18n.language);
        lines.push(`[${timestamp}] ${msg.role.toUpperCase()}`);

        if (msg.type) {
          lines.push(t('history.type', { type: msg.type }));
        }

        if (msg.toolName) {
          lines.push(t('history.tool', { toolName: msg.toolName }));
        }

        lines.push(t('history.content', { content: msg.content || '' }));
        lines.push('');
      }
      lines.push('---\n');
    }

    return lines.join('\n');
  }
}
