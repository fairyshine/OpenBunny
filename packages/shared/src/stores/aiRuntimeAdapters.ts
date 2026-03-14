import { DEFAULT_AGENT_ID, useAgentStore } from './agent';
import { useSessionStore } from './session';
import { useSettingsStore } from './settings';
import { useSkillStore } from './skills';
import { useToolStore } from './tools';
import { setDefaultAIRuntimeDefaultsResolver } from '../services/ai/runtimeDefaults';
import { setDefaultSessionOwnerStore } from '../services/ai/sessionOwnerStore';
import type { AIRuntimeDefaultsResolver } from '../services/ai/runtimeDefaults';
import type { SessionOwnerStore } from '../services/ai/sessionOwnerStore';

export function createZustandAIRuntimeDefaultsResolver(): AIRuntimeDefaultsResolver {
  return {
    getDefaults() {
      const agentStore = useAgentStore.getState();
      const sessionStore = useSessionStore.getState();
      const settingsStore = useSettingsStore.getState();
      const skillStore = useSkillStore.getState();
      const toolStore = useToolStore.getState();

      return {
        currentAgentId: agentStore.currentAgentId ?? DEFAULT_AGENT_ID,
        agents: agentStore.agents,
        defaultLLMConfig: sessionStore.llmConfig,
        defaultEnabledToolIds: settingsStore.enabledTools,
        proxyUrl: settingsStore.proxyUrl,
        toolExecutionTimeout: settingsStore.toolExecutionTimeout,
        execLoginShell: settingsStore.execLoginShell,
        searchProvider: settingsStore.searchProvider,
        exaApiKey: settingsStore.exaApiKey,
        braveApiKey: settingsStore.braveApiKey,
        skills: skillStore.skills,
        enabledSkillIds: skillStore.enabledSkillIds,
        markSkillActivated: skillStore.markActivated,
        mcpConnections: toolStore.mcpConnections,
        onConnectionStatusChange: (connectionId, status, error) => {
          toolStore.updateMCPStatus(connectionId, status);
          toolStore.setMCPError(connectionId, error || null);
        },
      };
    },
  };
}

export const zustandAIRuntimeDefaultsResolver = createZustandAIRuntimeDefaultsResolver();

export function createZustandSessionOwnerStore(): SessionOwnerStore {
  return {
    async createDetachedSession(agentId, sessionName, sessionType, projectId) {
      if (agentId === DEFAULT_AGENT_ID) {
        const store = useSessionStore.getState();
        const previousCurrentId = store.currentSessionId;
        const previousOpenIds = [...store.openSessionIds];
        const session = store.createSession(sessionName, sessionType, projectId);
        useSessionStore.setState({
          currentSessionId: previousCurrentId,
          openSessionIds: previousOpenIds.filter((id) => id !== session.id),
        });
        return session;
      }

      const store = useAgentStore.getState();
      const previousCurrentId = store.agentCurrentSessionId[agentId] ?? null;
      const session = store.createAgentSession(agentId, sessionName, projectId, sessionType);
      useAgentStore.setState((state) => ({
        agentCurrentSessionId: { ...state.agentCurrentSessionId, [agentId]: previousCurrentId },
      }));
      return session;
    },

    appendMessage(agentId, sessionId, message) {
      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().addMessage(sessionId, message);
        return;
      }

      useAgentStore.getState().addAgentMessage(agentId, sessionId, message);
    },

    updateMessage(agentId, sessionId, messageId, updates) {
      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().updateMessage(sessionId, messageId, updates);
        return;
      }

      useAgentStore.getState().updateAgentMessage(agentId, sessionId, messageId, updates);
    },

    setStreaming(agentId, sessionId, isStreaming) {
      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().setSessionStreaming(sessionId, isStreaming);
        return;
      }

      useAgentStore.getState().setAgentSessionStreaming(agentId, sessionId, isStreaming);
    },

    setPrompt(agentId, sessionId, systemPrompt) {
      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
        return;
      }

      useAgentStore.getState().setAgentSessionSystemPrompt(agentId, sessionId, systemPrompt);
    },

    setMindMeta(agentId, sessionId, mindMeta) {
      if (!mindMeta) return;

      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().setSessionMindMeta(sessionId, mindMeta);
        return;
      }

      useAgentStore.getState().setAgentSessionMindMeta(agentId, sessionId, mindMeta);
    },

    setChatMeta(agentId, sessionId, chatMeta) {
      if (!chatMeta) return;

      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().setSessionChatMeta(sessionId, chatMeta);
        return;
      }

      useAgentStore.getState().setAgentSessionChatMeta(agentId, sessionId, chatMeta);
    },

    async flush(agentId, sessionId) {
      if (agentId === DEFAULT_AGENT_ID) {
        await useSessionStore.getState().flushMessages(sessionId);
        return;
      }

      await useAgentStore.getState().flushAgentMessages(agentId, sessionId);
    },

    getSession(agentId, sessionId) {
      if (agentId === DEFAULT_AGENT_ID) {
        return useSessionStore.getState().sessions.find((session) => session.id === sessionId) || null;
      }

      return (useAgentStore.getState().agentSessions[agentId] || []).find((session) => session.id === sessionId) || null;
    },

    deleteSession(agentId, sessionId) {
      if (agentId === DEFAULT_AGENT_ID) {
        useSessionStore.getState().permanentlyDeleteSession(sessionId);
        return;
      }

      useAgentStore.getState().deleteAgentSession(agentId, sessionId);
    },
  };
}

export const zustandSessionOwnerStore = createZustandSessionOwnerStore();

export function registerZustandAIRuntimeAdapters(): void {
  setDefaultAIRuntimeDefaultsResolver(zustandAIRuntimeDefaultsResolver);
  setDefaultSessionOwnerStore(zustandSessionOwnerStore);
}
