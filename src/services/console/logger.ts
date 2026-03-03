/**
 * 控制台日志系统
 * 记录所有系统活动：LLM 对话、工具调用、文件操作、设置变更等
 */

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

export type LogCategory =
  | 'llm'           // LLM 对话
  | 'tool'          // 工具调用
  | 'file'          // 文件系统操作
  | 'settings'      // 设置变更
  | 'mcp'           // MCP 服务器
  | 'python'        // Python 执行
  | 'system';       // 系统事件

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  metadata?: Record<string, any>;
}

class ConsoleLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最多保留 1000 条日志
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  /**
   * 添加日志
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
      metadata,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 同时输出到浏览器控制台
    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
    const prefix = `[${category.toUpperCase()}]`;
    console[consoleMethod](prefix, message, details || '');

    // 通知监听器
    this.notifyListeners();
  }

  /**
   * 便捷方法
   */
  info(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('info', category, message, details, metadata);
  }

  success(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('success', category, message, details, metadata);
  }

  warning(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('warning', category, message, details, metadata);
  }

  error(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('error', category, message, details, metadata);
  }

  debug(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('debug', category, message, details, metadata);
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 按类别过滤日志
   */
  getLogsByCategory(category: LogCategory): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * 按级别过滤日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  /**
   * 订阅日志更新
   */
  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const logs = this.getLogs();
    this.listeners.forEach(listener => listener(logs));
  }

  /**
   * 导出日志为 JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 导出日志为文本
   */
  exportText(): string {
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toLocaleString();
      const level = log.level.toUpperCase().padEnd(7);
      const category = log.category.toUpperCase().padEnd(8);
      let text = `[${time}] [${level}] [${category}] ${log.message}`;
      if (log.details) {
        text += `\n  Details: ${typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}`;
      }
      return text;
    }).join('\n\n');
  }
}

// 单例导出
export const consoleLogger = new ConsoleLogger();

// 便捷导出
export const logLLM = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'llm', message, details, metadata);

export const logTool = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'tool', message, details, metadata);

export const logFile = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'file', message, details, metadata);

export const logSettings = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'settings', message, details, metadata);

export const logMCP = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'mcp', message, details, metadata);

export const logPython = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'python', message, details, metadata);

export const logSystem = (level: LogLevel, message: string, details?: any, metadata?: Record<string, any>) =>
  consoleLogger.log(level, 'system', message, details, metadata);
