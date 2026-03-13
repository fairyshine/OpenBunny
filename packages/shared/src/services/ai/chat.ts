import type { ModelMessage, Tool } from 'ai';
import type { ChatSessionMeta, LLMConfig, Message, MindDialogueSnapshot, Session } from '../../types';
import { useAgentStore, DEFAULT_AGENT_ID } from '../../stores/agent';
import { isAbortError } from '../../utils/errors';
import { getMessageDisplayType } from '../../utils/messagePresentation';
import { END_SESSION_TOKEN, createSnapshotMessage, extractSummaryText, sanitizeTerminalVisibleText, type DialogueVisibleCallbacks } from './dialogue';
import { createSystemMessage, createUserMessage, tagMessageSpeaker } from './messageFactory';
import { getEnabledTools } from './tools';
import { loadEnabledMCPTools } from './mcp';
import { getActivateSkillTool } from './skills';
import { buildAgentAssistantSystemPrompt } from './prompts';
import type { AgentRuntimeContext } from './runtimeContext';
import { resolveAgentRuntimeContext } from './runtimeContext';
import { appendSessionMessage, createDetachedSession, deleteSessionByOwner, flushSession, getSessionByOwner, setSessionChatMeta, setSessionPrompt, setSessionStreaming, updateSessionMessage } from './sessionOps';
import { runPairedDialogue, type PairedDialogueTrack } from './pairedDialogue';

const MAX_CHAT_TURNS = 8;
const chatAbortControllers = new Map<string, AbortController>();

export interface ChatToolContext {
  sourceSessionId: string;
  llmConfig: LLMConfig;
  enabledToolIds?: string[];
  sessionSkillIds?: string[];
  projectId?: string;
  currentAgentId?: string;
  onSourceSessionReady?: (sessionId: string) => void;
  runtimeContext?: Partial<AgentRuntimeContext>;
}

export interface ChatConversationResult {
  sourceSessionId: string;
  targetSessionId: string;
  finalTargetReply: string;
  summary: string;
  activeAssistantSystemPrompt: string;
  passiveAssistantSystemPrompt: string;
  targetAgentName: string;
}

export function stopChatConversation(sessionId: string): boolean {
  const controller = chatAbortControllers.get(sessionId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function deleteChatSessionPair(agentId: string, sessionId: string): void {
  const session = getSessionByOwner(agentId, sessionId);
  if (!session) return;

  const targets = [
    { agentId, sessionId },
    ...(session.chatSession?.peerSessionId && session.chatSession?.peerAgentId
      ? [{ agentId: session.chatSession.peerAgentId, sessionId: session.chatSession.peerSessionId }]
      : []),
  ];

  const seen = new Set<string>();
  for (const target of targets) {
    const key = `${target.agentId}:${target.sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stopChatConversation(target.sessionId);
    deleteSessionByOwner(target.agentId, target.sessionId);
  }
}

export async function runChatConversation(agentName: string, input: string, context: ChatToolContext): Promise<ChatConversationResult> {
  const sourceTask = input.trim();
  if (!sourceTask) {
    throw new Error('Chat text is required.');
  }

  const runtimeContext = resolveAgentRuntimeContext({
    currentAgentId: context.runtimeContext?.currentAgentId ?? context.currentAgentId,
    agents: context.runtimeContext?.agents,
    defaultLLMConfig: context.runtimeContext?.defaultLLMConfig,
    defaultEnabledToolIds: context.runtimeContext?.defaultEnabledToolIds,
    defaultSkillIds: context.runtimeContext?.defaultSkillIds,
    mcpConnections: context.runtimeContext?.mcpConnections,
    onConnectionStatusChange: context.runtimeContext?.onConnectionStatusChange,
    skills: context.runtimeContext?.skills,
    enabledSkillIds: context.runtimeContext?.enabledSkillIds,
    markSkillActivated: context.runtimeContext?.markSkillActivated,
    proxyUrl: context.runtimeContext?.proxyUrl,
    toolExecutionTimeout: context.runtimeContext?.toolExecutionTimeout,
  });

  const sourceAgentId = runtimeContext.currentAgentId;
  const sourceAgent = getAgentById(sourceAgentId, runtimeContext);
  if (!sourceAgent) {
    throw new Error(`Source agent not found: ${sourceAgentId}`);
  }

  const targetAgent = resolveTargetAgent(agentName, sourceAgentId, runtimeContext);
  validateRuntimeConfig(context.llmConfig, sourceAgent.name);
  const targetScope = 'local';
  const targetRuntime = getAgentRuntime(targetAgent.id, runtimeContext);
  validateRuntimeConfig(targetRuntime.llmConfig, targetAgent.name);
  const activeAssistantSystemPrompt = buildChatActiveAssistantSystemPrompt(
    sourceAgentId,
    targetAgent.id,
    sourceTask,
    targetScope,
    context.sessionSkillIds,
    runtimeContext,
  );
  const passiveAssistantSystemPrompt = buildPassiveAssistantSystemPrompt(targetAgent.id, sourceAgentId, targetScope, targetRuntime.skillIds, runtimeContext);

  const sourceSession = await createChatSession(
    sourceAgentId,
    buildSourceChatSessionName(targetAgent.name, sourceTask),
    context.projectId,
  );
  const targetSession = await createChatSession(
    targetAgent.id,
    buildTargetChatSessionName(sourceAgent.name, sourceTask),
  );

  const abortController = new AbortController();
  const activeTranscript: ModelMessage[] = [];
  const passiveTranscript: ModelMessage[] = [{ role: 'user', content: sourceTask }];
  const activeHistory: MindDialogueSnapshot = {
    systemPrompt: activeAssistantSystemPrompt,
    messages: [],
  };
  const passiveHistory: MindDialogueSnapshot = {
    systemPrompt: passiveAssistantSystemPrompt,
    messages: [createSnapshotMessage({ role: 'user', content: sourceTask, type: 'normal' })],
  };

  const sourceCallbacks = createVisibleCallbacks(
    sourceAgentId,
    sourceSession.id,
    sourceAgentId,
    sourceAgent.name,
    {
      agentId: targetAgent.id,
      sessionId: targetSession.id,
      speakerAgentId: sourceAgentId,
      speakerAgentName: sourceAgent.name,
    },
  );
  const targetCallbacks = createVisibleCallbacks(
    targetAgent.id,
    targetSession.id,
    targetAgent.id,
    targetAgent.name,
    {
      agentId: sourceAgentId,
      sessionId: sourceSession.id,
      speakerAgentId: targetAgent.id,
      speakerAgentName: targetAgent.name,
    },
  );

  const activeToolIds = (context.enabledToolIds || []).filter((toolId) => toolId !== 'chat');
  const activeToolContext = {
    ...context,
    sourceSessionId: sourceSession.id,
    currentAgentId: sourceAgentId,
    enabledToolIds: activeToolIds,
  };
  const activeTools = await buildToolSet(activeToolIds, context.sessionSkillIds, activeToolContext, abortController.signal, runtimeContext);

  const passiveToolIds = targetRuntime.enabledToolIds.filter((toolId) => toolId !== 'chat');
  const passiveToolContext = {
    sourceSessionId: targetSession.id,
    llmConfig: targetRuntime.llmConfig,
    enabledToolIds: passiveToolIds,
    sessionSkillIds: targetRuntime.skillIds,
    currentAgentId: targetAgent.id,
  };
  const passiveTools = await buildToolSet(passiveToolIds, targetRuntime.skillIds, passiveToolContext, abortController.signal, runtimeContext);

  chatAbortControllers.set(sourceSession.id, abortController);
  chatAbortControllers.set(targetSession.id, abortController);

  syncChatMeta(sourceAgentId, sourceSession.id, {
    role: 'source',
    peerSessionId: targetSession.id,
    peerAgentId: targetAgent.id,
    sourceSessionId: sourceSession.id,
    targetSessionId: targetSession.id,
    sourceTask,
    summary: '',
    counterpartAgentId: targetAgent.id,
    counterpartAgentName: targetAgent.name,
    updatedAt: Date.now(),
  });
  syncChatMeta(targetAgent.id, targetSession.id, {
    role: 'target',
    peerSessionId: sourceSession.id,
    peerAgentId: sourceAgentId,
    sourceSessionId: sourceSession.id,
    targetSessionId: targetSession.id,
    sourceTask,
    summary: '',
    counterpartAgentId: sourceAgentId,
    counterpartAgentName: sourceAgent.name,
    updatedAt: Date.now(),
  });
  setSessionPrompt(sourceAgentId, sourceSession.id, activeAssistantSystemPrompt);
  setSessionPrompt(targetAgent.id, targetSession.id, passiveAssistantSystemPrompt);
  setSessionStreaming(sourceAgentId, sourceSession.id, true);
  setSessionStreaming(targetAgent.id, targetSession.id, true);
  context.onSourceSessionReady?.(sourceSession.id);

  let finalTargetReply = '';
  let summary = '';

  try {
    const initialTaskMessage = createAgentSpokenMessage(sourceAgentId, sourceAgent.name, sourceTask);
    appendSessionMessage(sourceAgentId, sourceSession.id, initialTaskMessage);
    appendSessionMessage(targetAgent.id, targetSession.id, createAgentSpokenMessage(sourceAgentId, sourceAgent.name, sourceTask));

    const passiveTrack: PairedDialogueTrack = {
      llmConfig: targetRuntime.llmConfig,
      systemPrompt: passiveAssistantSystemPrompt,
      transcript: passiveTranscript,
      history: passiveHistory,
      tools: passiveTools,
      visibleCallbacks: targetCallbacks,
      visibleTextRole: 'assistant',
      visibleTextType: 'response',
      visibleTextMode: 'per-step',
      exposeToolMessages: true,
    };
    const activeTrack: PairedDialogueTrack = {
      llmConfig: context.llmConfig,
      systemPrompt: activeAssistantSystemPrompt,
      transcript: activeTranscript,
      history: activeHistory,
      tools: activeTools,
      visibleCallbacks: sourceCallbacks,
      visibleTextRole: 'assistant',
      visibleTextType: 'response',
      visibleTextMode: 'per-step',
      exposeToolMessages: true,
      hideSpecialTokenInVisibleText: END_SESSION_TOKEN,
      visibleTextSanitizer: (content) => sanitizeTerminalVisibleText(content, END_SESSION_TOKEN),
      shouldStop: shouldEndSession,
    };

    await runPairedDialogue({
      maxTurns: MAX_CHAT_TURNS,
      abortSignal: abortController.signal,
      firstTrack: passiveTrack,
      secondTrack: activeTrack,
      onReply: (speaker, content) => {
        if (speaker === 'first') {
          finalTargetReply = content;
        }
        if (speaker === 'second' && shouldEndSession(content)) {
          summary = extractSummaryText(content);
          const summaryValue = summary || finalTargetReply;
          syncChatMeta(sourceAgentId, sourceSession.id, {
            role: 'source',
            peerSessionId: targetSession.id,
            peerAgentId: targetAgent.id,
            sourceSessionId: sourceSession.id,
            targetSessionId: targetSession.id,
            sourceTask,
            summary: summaryValue,
            counterpartAgentId: targetAgent.id,
            counterpartAgentName: targetAgent.name,
            updatedAt: Date.now(),
          });
          syncChatMeta(targetAgent.id, targetSession.id, {
            role: 'target',
            peerSessionId: sourceSession.id,
            peerAgentId: sourceAgentId,
            sourceSessionId: sourceSession.id,
            targetSessionId: targetSession.id,
            sourceTask,
            summary: summaryValue,
            counterpartAgentId: sourceAgentId,
            counterpartAgentName: sourceAgent.name,
            updatedAt: Date.now(),
          });
        }
      },
    });

    return {
      sourceSessionId: sourceSession.id,
      targetSessionId: targetSession.id,
      finalTargetReply,
      summary: summary || finalTargetReply,
      activeAssistantSystemPrompt,
      passiveAssistantSystemPrompt,
      targetAgentName: targetAgent.name,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      appendSessionMessage(sourceAgentId, sourceSession.id, createSystemMessage(`Chat failed: ${message}`));
      appendSessionMessage(targetAgent.id, targetSession.id, createSystemMessage(`Chat failed: ${message}`));
    }
    throw error;
  } finally {
    if (chatAbortControllers.get(sourceSession.id) === abortController) {
      chatAbortControllers.delete(sourceSession.id);
    }
    if (chatAbortControllers.get(targetSession.id) === abortController) {
      chatAbortControllers.delete(targetSession.id);
    }
    setSessionStreaming(sourceAgentId, sourceSession.id, false);
    setSessionStreaming(targetAgent.id, targetSession.id, false);
    await flushSession(sourceAgentId, sourceSession.id);
    await flushSession(targetAgent.id, targetSession.id);
  }
}

async function buildToolSet(
  enabledToolIds: string[],
  sessionSkillIds: string[] | undefined,
  toolContext: ChatToolContext,
  abortSignal: AbortSignal | undefined,
  runtimeContext: AgentRuntimeContext,
): Promise<Record<string, Tool>> {
  const skillActivationTool = getActivateSkillTool(sessionSkillIds, runtimeContext);
  const builtinToolSet = getEnabledTools(enabledToolIds, toolContext);
  const mcpToolSet = await loadEnabledMCPTools(
    enabledToolIds,
    runtimeContext.mcpConnections,
    {
      proxyUrl: runtimeContext.proxyUrl,
      timeoutMs: runtimeContext.toolExecutionTimeout || 300000,
      abortSignal,
      reservedToolNames: [...Object.keys(builtinToolSet), ...Object.keys(skillActivationTool)],
      onConnectionStatusChange: runtimeContext.onConnectionStatusChange,
    },
  );

  return {
    ...builtinToolSet,
    ...mcpToolSet,
    ...skillActivationTool,
  };
}

function resolveTargetAgent(agentName: string, sourceAgentId: string, runtimeContext?: Partial<AgentRuntimeContext>) {
  const normalized = agentName.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Target agent name is required.');
  }

  const agents = runtimeContext?.agents ?? useAgentStore.getState().agents;

  const matches = agents.filter((agent) => agent.id !== sourceAgentId && agent.name.trim().toLowerCase() === normalized);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Multiple agents matched "${agentName}". Please use a unique agent name.`);
  }

  const partialMatches = agents.filter((agent) => agent.id !== sourceAgentId && agent.name.trim().toLowerCase().includes(normalized));
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }
  if (partialMatches.length > 1) {
    throw new Error(`Multiple agents partially matched "${agentName}". Please use the exact agent name.`);
  }

  throw new Error(`Agent not found: ${agentName}`);
}

function getAgentById(agentId: string, runtimeContext?: Partial<AgentRuntimeContext>) {
  const agents = runtimeContext?.agents ?? useAgentStore.getState().agents;
  return agents.find((agent) => agent.id === agentId) || null;
}

function syncChatMeta(agentId: string, sessionId: string, meta: ChatSessionMeta): void {
  setSessionChatMeta(agentId, sessionId, meta);
}

function getAgentRuntime(agentId: string, runtimeContext?: Partial<AgentRuntimeContext>): { llmConfig: LLMConfig; enabledToolIds: string[]; skillIds: string[] } {
  if (agentId === DEFAULT_AGENT_ID) {
    return {
      llmConfig: resolveAgentRuntimeContext(runtimeContext).defaultLLMConfig,
      enabledToolIds: runtimeContext?.defaultEnabledToolIds ?? [],
      skillIds: runtimeContext?.defaultSkillIds ?? [],
    };
  }

  const agent = getAgentById(agentId, runtimeContext);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return {
    llmConfig: agent.llmConfig,
    enabledToolIds: agent.enabledTools || [],
    skillIds: agent.enabledSkills || [],
  };
}

function buildChatActiveAssistantSystemPrompt(
  sourceAgentId: string,
  targetAgentId: string,
  sourceTask: string,
  targetScope: 'local' | 'network',
  sessionSkillIds?: string[],
  runtimeContext?: Partial<AgentRuntimeContext>,
): string {
  const sourceAgent = getAgentById(sourceAgentId, runtimeContext);
  const targetAgent = getAgentById(targetAgentId, runtimeContext);
  const customPrompt = sourceAgent?.chatActiveAssistantPrompt?.trim() || '';

  return [
    buildAgentAssistantSystemPrompt(sourceAgentId, sessionSkillIds, runtimeContext),
    customPrompt ? `

## Active Assistant Persona
${customPrompt}` : '',
    '\n\n## Agent-To-Agent Context',
    'You are NOT acting as a human user. You are the active Assistant coordinating another real Assistant.',
    `The counterpart is the ${targetScope} assistant "${targetAgent?.name || targetAgentId}".`,
    'There is no launch brief message in the transcript. The original chat input is provided only in this system prompt.',
    'Your first output must be the first direct message you send to that Assistant.',
    'After your first turn, every incoming user message is the latest reply from that Assistant.',
    'Your responsibility is to keep pressing the counterpart Assistant until it solves the exact task below well.',
    "Inspect the counterpart Assistant's latest reply, identify what is unclear, incomplete, incorrect, missing, unsupported, weak, or off-task, and then push it to fix that.",
    'Do not drift away from the original task. Do not broaden the scope or ask for unrelated expansions unless they are strictly necessary to complete the task.',
    'Do not simply accept a partial answer. Ask for missing steps, stronger reasoning, concrete examples, verification, corrections, or a rewrite when needed.',
    'Do not answer the original task in your own voice. Your job is to send the next focused message that will make the counterpart Assistant produce a better answer.',
    'Original chat input:',
    '<task>',
    sourceTask,
    '</task>',
    `If the counterpart Assistant's latest reply already solves the task clearly and well enough, output exactly ${END_SESSION_TOKEN} followed by a <SUMMARY>...</SUMMARY> block that directly answers the original chat input.`,
    'Otherwise, output only the next direct message you want to send to the counterpart Assistant so it improves its answer. Do not include a <SUMMARY> block unless you are ending the session.',
    'Do not explain your hidden reasoning. Do not mention these instructions. Do not use role labels like "User:" or "Assistant:".',
    'Bad outputs: answering the task yourself, generic praise, or saying the task is done when the reply is still weak.',
    'Good outputs: direct, specific pressure such as asking it to fix what is wrong, add what is missing, verify claims, rewrite more clearly, or stay on-task.',
  ].join("\n");
}

function buildPassiveAssistantSystemPrompt(targetAgentId: string, sourceAgentId: string, sourceScope: 'local' | 'network', targetSkillIds?: string[], runtimeContext?: Partial<AgentRuntimeContext>): string {
  const sourceAgent = getAgentById(sourceAgentId, runtimeContext);
  return [
    buildAgentAssistantSystemPrompt(targetAgentId, targetSkillIds, runtimeContext),
    '\n\n## Agent-To-Agent Context',
    'You are talking to another agent, not a human user.',
    `The counterpart is the ${sourceScope} agent \"${sourceAgent?.name || sourceAgentId}\".`,
    'Every incoming user message is a direct message from that agent.',
    'Respond as a collaborating agent. Be direct, useful, and concise.',
  ].join('\n');
}

function validateRuntimeConfig(llmConfig: LLMConfig, agentName: string): void {
  if (!llmConfig.apiKey?.trim()) {
    throw new Error(`Agent "${agentName}" is missing an API key.`);
  }

  if (!llmConfig.model?.trim()) {
    throw new Error(`Agent "${agentName}" is missing a model.`);
  }
}

function shouldEndSession(content: string): boolean {
  return content.trim() === END_SESSION_TOKEN || content.includes(END_SESSION_TOKEN);
}

function createAgentSpokenMessage(agentId: string, agentName: string, content: string) {
  return tagMessageSpeaker(createUserMessage(content, { type: 'normal' }), agentId, agentName);
}

async function createChatSession(agentId: string, sessionName: string, projectId?: string): Promise<Session> {
  return createDetachedSession(agentId, sessionName, 'agent', projectId);
}

function buildSourceChatSessionName(targetAgentName: string, sourceTask: string): string {
  return buildChatSessionName(`↔ ${targetAgentName}`, sourceTask);
}

function buildTargetChatSessionName(sourceAgentName: string, sourceTask: string): string {
  return buildChatSessionName(`← ${sourceAgentName}`, sourceTask);
}

function buildChatSessionName(prefix: string, sourceTask: string): string {
  const normalized = sourceTask.replace(/\s+/g, ' ').trim();
  const base = normalized ? `${prefix}: ${normalized}` : prefix;
  return base.length > 60 ? `${base.slice(0, 57)}...` : base;
}

interface MirroredVisibleSession {
  agentId: string;
  sessionId: string;
  speakerAgentId: string;
  speakerAgentName: string;
}

function shouldMirrorVisibleMessage(message: Message): boolean {
  const messageType = getMessageDisplayType(message);
  return message.role === 'assistant' && (messageType === 'response' || messageType === 'normal');
}

function createMirroredVisibleMessage(message: Message, mirror: MirroredVisibleSession): Message {
  return tagMessageSpeaker({
    ...message,
    role: 'user',
  }, mirror.speakerAgentId, mirror.speakerAgentName);
}

function createVisibleCallbacks(
  agentId: string,
  sessionId: string,
  speakerAgentId: string,
  speakerAgentName: string,
  mirroredVisibleSession?: MirroredVisibleSession,
): DialogueVisibleCallbacks {
  return {
    addMessage: (message) => {
      const taggedMessage = tagMessageSpeaker(message, speakerAgentId, speakerAgentName);
      appendSessionMessage(agentId, sessionId, taggedMessage);

      if (mirroredVisibleSession && shouldMirrorVisibleMessage(taggedMessage)) {
        appendSessionMessage(
          mirroredVisibleSession.agentId,
          mirroredVisibleSession.sessionId,
          createMirroredVisibleMessage(taggedMessage, mirroredVisibleSession),
        );
      }
    },
    updateMessage: (messageId, updates) => {
      updateSessionMessage(agentId, sessionId, messageId, updates);

      if (mirroredVisibleSession) {
        updateSessionMessage(
          mirroredVisibleSession.agentId,
          mirroredVisibleSession.sessionId,
          messageId,
          {
            ...updates,
            metadata: updates.metadata
              ? {
                  ...updates.metadata,
                  speakerAgentId: mirroredVisibleSession.speakerAgentId,
                  speakerAgentName: mirroredVisibleSession.speakerAgentName,
                }
              : updates.metadata,
          },
        );
      }
    },
  };
}
