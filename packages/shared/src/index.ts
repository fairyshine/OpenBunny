// Platform
export * from './platform';

// Types
export * from './types';

// Stores
export { useSessionStore, selectCurrentSession, selectActiveSessions, selectDeletedSessions } from './stores/session';
export { useSettingsStore, setThemeHandler, setLanguageHandler, resolveLanguage } from './stores/settings';
export type { Theme, Language } from './stores/settings';
export { useToolStore, getBuiltinToolIds } from './stores/tools';
export { useSkillStore } from './stores/skills';

// Services - Console & FileSystem & Python (unchanged)
export { logSystem, logLLM, logTool, logFile, logSettings, logMCP, logPython, consoleLogger } from './services/console/logger';
export type { LogEntry, LogLevel, LogCategory } from './services/console/logger';
export { fileSystem, setFileSystemInstance } from './services/filesystem';
export type { IFileSystem, FileSystemEntry } from './services/filesystem';
export { pythonExecutor } from './services/python/executor';

// Services - AI (new unified AI service)
export { createProvider, createModel } from './services/ai/provider';
export { builtinTools, getEnabledTools } from './services/ai/tools';
export { generateSkillsSystemPrompt, getBuiltinSkills } from './services/ai/skills';
export type { SkillInfo } from './services/ai/skills';
export { connectMCPServer } from './services/ai/mcp';
export type { MCPClient } from './services/ai/mcp';
export { runAgentLoop } from './services/ai/agent';
export type { AgentCallbacks } from './services/ai/agent';

// Services - LLM streaming (simplified with AI SDK)
export { callLLM } from './services/llm/streaming';
export type { StreamOptions } from './services/llm/streaming';

// Hooks
export { useLLM } from './hooks/useLLM';

// Utils
export { getErrorMessage, isAbortError } from './utils/errors';

// Lib
export { cn } from './lib/utils';

// i18n
export { default as i18n } from './i18n';
