// Version
export { APP_VERSION } from './version';

// Platform
export * from './platform';

// Types
export * from './types';

// Stores
export { useSessionStore, selectCurrentSession, selectActiveSessions, selectDeletedSessions } from './stores/session';
export { useSettingsStore, setThemeHandler, setLanguageHandler, resolveLanguage } from './stores/settings';
export type { Theme, Language, CodeThemePreset } from './stores/settings';
export { useToolStore, getBuiltinToolIds, getMCPToolIds } from './stores/tools';
export type { MCPConnection, MCPToolDescriptor, MCPTransportType } from './stores/tools';
export { useSkillStore } from './stores/skills';
export { useAgentStore, DEFAULT_AGENT_ID } from './stores/agent';

// Services - Message Storage (IndexedDB / AsyncStorage)
export { messageStorage } from './services/storage/messageStorage';
export type { IMessageStorageBackend } from './services/storage/messageStorage';

// Services - Stats Storage (IndexedDB / SQLite)
export { statsStorage } from './services/storage/statsStorage';
export type { IStatsStorageBackend, StatsRecord, AggregatedStats } from './services/storage/statsStorage';

// Stores - Stats
export { useStatsStore } from './stores/stats';

// Services - Console & FileSystem & Python (unchanged)
export { logSystem, logLLM, logTool, logFile, logSettings, logMCP, logPython, consoleLogger } from './services/console/logger';
export type { LogEntry, LogLevel, LogCategory } from './services/console/logger';
export { fileSystem, setFileSystemInstance } from './services/filesystem';
export type { IFileSystem, FileSystemEntry } from './services/filesystem';
export { pythonExecutor } from './services/python/executor';

// Services - AI (new unified AI service)
export { createProvider, createModel, testConnection } from './services/ai/provider';
export { builtinTools, getEnabledTools } from './services/ai/tools';
export { cronManager } from './services/cron';
export type { CronJob } from './services/cron';
export { heartbeatManager } from './services/heartbeat';
export type { HeartbeatItem, HeartbeatInterval } from './services/heartbeat';
export { generateSkillsSystemPrompt, getActivateSkillTool, getBuiltinSkills, getSkillTools } from './services/ai/skills';
export type { SkillInfo } from './services/ai/skills';
export { loadAllSkills, saveSkill, deleteSkill, readSkillMd, ensureSkillsDir, SKILLS_DIR, generateSkillTemplate } from './services/skills';
export type { LoadedSkill } from './services/skills';
export { connectMCPServer, discoverMCPConnection } from './services/ai/mcp';
export { getMCPToolId, isMCPToolId, parseMCPToolId } from './services/ai/mcpToolId';
export type { MCPClient } from './services/ai/mcp';
export { runAgentLoop } from './services/ai/agent';
export type { AgentCallbacks } from './services/ai/agent';
export { createMessage, createUserMessage, createAssistantMessage, createSystemMessage, createThoughtMessage, createResponseMessage, createToolCallMessage, createToolResultMessage, tagMessageSpeaker, cloneMessage, normalizeToolResultOutput } from './services/ai/messageFactory';
export { providerRegistry, getProviderMeta } from './services/ai/providers';
export type { ProviderMeta } from './services/ai/providers';
export { resolveAgentRuntimeContext, resolveMCPRuntimeContext, resolveSkillRuntimeContext } from './services/ai/runtimeContext';
export type { AgentRuntimeContext, MCPRuntimeContext, SkillRuntimeContext } from './services/ai/runtimeContext';

// Services - LLM streaming (simplified with AI SDK)
export { callLLM } from './services/llm/streaming';
export type { StreamOptions } from './services/llm/streaming';

// Services - Sound
export { soundManager } from './services/sound';
export type { SoundEffect, ISoundBackend } from './services/sound';

// Utils
export { getErrorMessage, isAbortError } from './utils/errors';
export { deriveMessagePresentation, getMessageDisplayType, getMessagePresentation, getMessageSearchTexts, getMessageToolName, normalizeMessagePresentation, mergeMessageWithPresentation, formatFileSize } from './utils/messagePresentation';

// Lib
export { cn } from './lib/utils';

// i18n
export { default as i18n } from './i18n';
