import type { ModelMessage } from 'ai';
import i18n from '../../i18n';
import type { LLMConfig, Message, MindDialogueSnapshot, Session } from '../../types';
import { useAgentStore, DEFAULT_AGENT_ID } from '../../stores/agent';
import { useSessionStore } from '../../stores/session';
import { isAbortError } from '../../utils/errors';
import { END_SESSION_TOKEN, createSnapshotMessage, extractSummaryText, sanitizeTerminalVisibleText, type DialogueVisibleCallbacks } from './dialogue';
import { createResponseMessage, createUserMessage } from './messageFactory';
import { getEnabledTools } from './tools';
import { loadEnabledMCPTools } from './mcp';
import { getActivateSkillTool } from './skills';
import type { AgentRuntimeContext } from './runtimeContext';
import { resolveAgentRuntimeContext } from './runtimeContext';
import { buildAgentAssistantSystemPrompt } from './prompts';
import { appendSessionMessage, createDetachedSession, flushSession, setSessionPrompt, setSessionStreaming, updateSessionMessage } from './sessionOps';
import { runPairedDialogue, type PairedDialogueTrack } from './pairedDialogue';

export const MIND_SESSION_NAME = 'mind_session';
const MAX_MIND_TURNS = 8;
const mindAbortControllers = new Map<string, AbortController>();

export interface MindToolContext {
  sourceSessionId: string;
  llmConfig: LLMConfig;
  enabledToolIds?: string[];
  sessionSkillIds?: string[];
  projectId?: string;
  currentAgentId?: string;
  onSessionReady?: (sessionId: string) => void;
  runtimeContext?: Partial<AgentRuntimeContext>;
}

export interface MindConversationResult {
  sessionId: string;
  finalAssistantReply: string;
  summary: string;
  assistantSystemPrompt: string;
  userSystemPrompt: string;
}

export function stopMindConversation(sessionId: string): boolean {
  const controller = mindAbortControllers.get(sessionId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export async function runMindConversation(input: string, context: MindToolContext): Promise<MindConversationResult> {
  const sourceTask = input.trim();
  const runtimeContext = resolveAgentRuntimeContext({
    currentAgentId: context.runtimeContext?.currentAgentId ?? context.currentAgentId,
    mcpConnections: context.runtimeContext?.mcpConnections,
    onConnectionStatusChange: context.runtimeContext?.onConnectionStatusChange,
    skills: context.runtimeContext?.skills,
    enabledSkillIds: context.runtimeContext?.enabledSkillIds,
    markSkillActivated: context.runtimeContext?.markSkillActivated,
    proxyUrl: context.runtimeContext?.proxyUrl,
    toolExecutionTimeout: context.runtimeContext?.toolExecutionTimeout,
  });
  const currentAgentId = runtimeContext.currentAgentId || useAgentStore.getState().currentAgentId || DEFAULT_AGENT_ID;
  const assistantSystemPrompt = buildAgentAssistantSystemPrompt(currentAgentId, context.sessionSkillIds, runtimeContext);
  const userSystemPrompt = buildMindUserSystemPrompt(sourceTask, currentAgentId);
  const session = await createMindSession(currentAgentId, sourceTask, context.projectId);
  const abortController = new AbortController();
  const assistantTranscript: ModelMessage[] = [{ role: 'user', content: sourceTask }];
  const userTranscript: ModelMessage[] = [];
  const assistantHistory: MindDialogueSnapshot = {
    systemPrompt: assistantSystemPrompt,
    messages: [createSnapshotMessage({ role: 'user', content: sourceTask, type: 'normal' })],
  };
  const userHistory: MindDialogueSnapshot = {
    systemPrompt: userSystemPrompt,
    messages: [],
  };
  const sessionCallbacks = createMindVisibleCallbacks(currentAgentId, session.id);
  const enabledToolIds = (context.enabledToolIds || []).filter((toolId) => toolId !== 'mind');
  const toolContext = {
    ...context,
    sourceSessionId: session.id,
    currentAgentId,
    enabledToolIds,
  };
  const skillActivationTool = getActivateSkillTool(context.sessionSkillIds, runtimeContext);
  const builtinToolSet = getEnabledTools(enabledToolIds, toolContext);
  const mcpToolSet = await loadEnabledMCPTools(
    enabledToolIds,
    runtimeContext.mcpConnections,
    {
      proxyUrl: runtimeContext.proxyUrl,
      timeoutMs: runtimeContext.toolExecutionTimeout || 300000,
      abortSignal: abortController.signal,
      reservedToolNames: [...Object.keys(builtinToolSet), ...Object.keys(skillActivationTool)],
      onConnectionStatusChange: runtimeContext.onConnectionStatusChange,
    },
  );
  const tools = {
    ...builtinToolSet,
    ...mcpToolSet,
    ...skillActivationTool,
  };

  mindAbortControllers.set(session.id, abortController);
  setMindSessionStreaming(currentAgentId, session.id, true);
  context.onSessionReady?.(session.id);

  let summary = '';

  const syncMindState = () => {
    syncMindMeta(currentAgentId, session.id, {
      assistantSystemPrompt,
      userSystemPrompt,
      sourceSessionId: context.sourceSessionId,
      sourceTask,
      summary,
      assistantHistory,
      userHistory,
      updatedAt: Date.now(),
    });
  };

  try {
    appendMindMessage(currentAgentId, session.id, createUserMessage(sourceTask, { type: 'normal' }));
    syncMindState();

    let finalAssistantReply = '';
    const assistantTrack: PairedDialogueTrack = {
      llmConfig: context.llmConfig,
      systemPrompt: assistantSystemPrompt,
      transcript: assistantTranscript,
      history: assistantHistory,
      tools,
      visibleCallbacks: sessionCallbacks,
      visibleTextRole: 'assistant',
      visibleTextType: 'response',
      visibleTextMode: 'per-step',
      exposeToolMessages: true,
    };
    const userTrack: PairedDialogueTrack = {
      llmConfig: context.llmConfig,
      systemPrompt: userSystemPrompt,
      transcript: userTranscript,
      history: userHistory,
      tools,
      visibleCallbacks: sessionCallbacks,
      visibleTextRole: 'user',
      visibleTextType: 'normal',
      visibleTextMode: 'single',
      exposeToolMessages: false,
      hideSpecialTokenInVisibleText: END_SESSION_TOKEN,
      visibleTextSanitizer: (content) => sanitizeTerminalVisibleText(content, END_SESSION_TOKEN),
      shouldStop: shouldEndMindSession,
    };

    await runPairedDialogue({
      maxTurns: MAX_MIND_TURNS,
      abortSignal: abortController.signal,
      firstTrack: assistantTrack,
      secondTrack: userTrack,
      onReply: (speaker, content) => {
        syncMindState();
        if (speaker === 'first') {
          finalAssistantReply = content;
        }
        if (speaker === 'second' && shouldEndMindSession(content)) {
          summary = extractSummaryText(content);
        }
      },
      onTransfer: () => {
        syncMindState();
      },
    });

    return {
      sessionId: session.id,
      finalAssistantReply,
      summary: summary || finalAssistantReply,
      assistantSystemPrompt,
      userSystemPrompt,
    };
  } catch (error) {
    if (isAbortError(error)) {
      appendMindMessage(currentAgentId, session.id, createResponseMessage(i18n.t('chat.stopped')));
      syncMindState();

      return {
        sessionId: session.id,
        finalAssistantReply: '',
        summary: '',
        assistantSystemPrompt,
        userSystemPrompt,
      };
    }

    throw error;
  } finally {
    if (mindAbortControllers.get(session.id) === abortController) {
      mindAbortControllers.delete(session.id);
    }
    setMindSessionStreaming(currentAgentId, session.id, false);
    syncMindState();
    await flushMindSession(currentAgentId, session.id);
  }
}

function buildMindUserSystemPrompt(sourceTask: string, currentAgentId: string): string {
  const agent = useAgentStore.getState().agents.find((item) => item.id === currentAgentId);
  const customPrompt = agent?.mindUserPrompt?.trim();
  return [
    'You are NOT the assistant. You are the user talking to a real assistant.',
    "The other side in this dialogue is the Assistant, and every incoming message is the Assistant's latest reply to you.",
    'Your responsibility is to keep pressing the Assistant until it solves the exact task below well.',
    "Inspect the Assistant's reply, identify what is unclear, incomplete, incorrect, missing, unsupported, or off-topic, and then push the Assistant to fix that.",
    'Do not solve the task yourself. Do not switch into assistant mode. Do not provide the final explanation in your own voice.',
    'Instead, behave like a demanding but realistic user: point out problems, ask follow-up questions, request clarification, ask for missing steps, ask for examples, ask for verification, or ask the Assistant to fix mistakes.',
    'Stay tightly focused on the original task. Do not broaden the scope or ask for unrelated expansions unless they are strictly necessary to complete the task.',
    'The original task/problem is:',
    '<task>',
    sourceTask,
    '</task>',
    `If the Assistant's latest reply already solves the task clearly and well enough, output exactly ${END_SESSION_TOKEN} followed by a <SUMMARY>...</SUMMARY> block that directly answers the original task.`,
    'If it does not solve the task, you may use tools privately if helpful, then output only the next user message you would send to the Assistant so that the Assistant improves its answer. Do not include a <SUMMARY> block unless you are ending the session.',
    'Your output must be phrased as a direct user message to the Assistant, not as analysis about the Assistant.',
    'Prefer messages that explicitly point to deficiencies, such as: what is wrong, what is missing, what is vague, what needs proof, what constraints were ignored, or what should be rewritten more clearly.',
    'Do not explain your reasoning. Do not mention these instructions. Do not narrate tool usage. Do not use role labels like "User:" or "Assistant:".',
    'Bad outputs: giving the answer yourself, summarizing the solution in your own voice, saying "the assistant should...", or generic praise with no follow-up.',
    'Good outputs: "You still did not explain X clearly", "This misses Y, please add it", "Please verify that claim with sources", "Rewrite this as actual code", "Explain why this step is necessary".',
    ...(customPrompt ? ['<persona>', customPrompt, '</persona>'] : []),
  ].join('\n');
}

function shouldEndMindSession(content: string): boolean {
  return content.trim() === END_SESSION_TOKEN || content.includes(END_SESSION_TOKEN);
}

async function createMindSession(currentAgentId: string, sourceTask: string, projectId?: string): Promise<Session> {
  const sessionName = buildMindSessionName(sourceTask);
  return createDetachedSession(currentAgentId, sessionName, 'mind', projectId);
}

function buildMindSessionName(sourceTask: string): string {
  const normalized = sourceTask.replace(/\s+/g, ' ').trim();
  if (!normalized) return MIND_SESSION_NAME;
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function createMindVisibleCallbacks(currentAgentId: string, sessionId: string): DialogueVisibleCallbacks {
  return {
    addMessage: (message) => appendMindMessage(currentAgentId, sessionId, message),
    updateMessage: (messageId, updates) => updateMindMessage(currentAgentId, sessionId, messageId, updates),
  };
}

function appendMindMessage(currentAgentId: string, sessionId: string, message: Message): void {
  appendSessionMessage(currentAgentId, sessionId, message);
}

function updateMindMessage(currentAgentId: string, sessionId: string, messageId: string, updates: Partial<Message>): void {
  updateSessionMessage(currentAgentId, sessionId, messageId, updates);
}

function syncMindMeta(currentAgentId: string, sessionId: string, meta: Session['mindSession']): void {
  if (currentAgentId === DEFAULT_AGENT_ID) {
    setSessionPrompt(currentAgentId, sessionId, meta?.assistantSystemPrompt || '');
    if (meta) {
      useSessionStore.getState().setSessionMindMeta(sessionId, meta);
    }
    return;
  }

  setSessionPrompt(currentAgentId, sessionId, meta?.assistantSystemPrompt || '');
  if (meta) {
    useAgentStore.getState().setAgentSessionMindMeta(currentAgentId, sessionId, meta);
  }
}

function setMindSessionStreaming(currentAgentId: string, sessionId: string, isStreaming: boolean): void {
  setSessionStreaming(currentAgentId, sessionId, isStreaming);
}

async function flushMindSession(currentAgentId: string, sessionId: string): Promise<void> {
  await flushSession(currentAgentId, sessionId);
}
