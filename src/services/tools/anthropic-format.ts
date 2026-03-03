/**
 * Anthropic Messages API 格式转换工具
 * 将内部工具定义转换为 Anthropic 的 tools 格式
 */

import { ToolMetadata, ToolParameter } from './base';
import { toolRegistry } from './registry';
import i18n from '../../i18n';

/**
 * Anthropic Tool 定义格式
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Anthropic Tool Use 格式
 */
export interface AnthropicToolUse {
  id: string;
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
  inputBuffer?: string; // 用于累积流式输入
}

/**
 * Anthropic Message 格式
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string;
  }>;
}

/**
 * 将 ToolParameter 转换为 JSON Schema
 */
function convertParameterToJsonSchema(param: ToolParameter): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: param.type,
    description: param.description,
  };

  if (param.enum) {
    schema.enum = param.enum;
  }

  if (param.default !== undefined) {
    schema.default = param.default;
  }

  if (param.type === 'object' && param.properties) {
    schema.properties = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(param.properties)) {
      (schema.properties as Record<string, unknown>)[key] = convertParameterToJsonSchema(value);
      if (value.required) {
        required.push(key);
      }
    }

    if (required.length > 0) {
      schema.required = required;
    }
  }

  if (param.type === 'array' && param.items) {
    schema.items = convertParameterToJsonSchema(param.items);
  }

  return schema;
}

/**
 * 将内部工具元数据转换为 Anthropic Tool 格式
 */
export function convertToAnthropicTool(metadata: ToolMetadata): AnthropicTool {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  if (metadata.parameters) {
    for (const param of metadata.parameters) {
      properties[param.name] = convertParameterToJsonSchema(param);
      if (param.required) {
        required.push(param.name);
      }
    }
  }

  return {
    name: metadata.id,
    description: `${metadata.name} - ${metadata.description}`,
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * 获取所有已启用工具的 Anthropic 格式
 */
export function getAnthropicTools(enabledToolIds: string[]): AnthropicTool[] {
  const tools: AnthropicTool[] = [];

  for (const toolId of enabledToolIds) {
    const tool = toolRegistry.get(toolId);
    if (tool) {
      tools.push(convertToAnthropicTool(tool.metadata));
    }
  }

  return tools;
}

/**
 * 将参数对象转换为工具执行的输入字符串
 */
export function convertInputToString(input: Record<string, unknown>): string {
  const keys = Object.keys(input);

  if (keys.length === 0) {
    return '';
  }

  if (keys.length === 1) {
    const value = input[keys[0]];
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return JSON.stringify(input);
}

/**
 * 生成 Anthropic 格式的 System Prompt
 */
export function generateAnthropicSystemPrompt(enabledToolIds: string[]): string {
  const t = i18n.t.bind(i18n);
  const tools = getAnthropicTools(enabledToolIds);

  if (tools.length === 0) {
    return t('systemPrompt.assistant');
  }

  const toolDescriptions = tools.map(tool => {
    const params = Object.entries(tool.input_schema.properties)
      .map(([name, schema]: [string, any]) => {
        const required = tool.input_schema.required.includes(name) ? t('systemPrompt.required') : t('systemPrompt.optional');
        return `  - ${name} (${schema.type}) ${required}: ${schema.description}`;
      })
      .join('\n');

    return `### ${tool.name}\n${tool.description}\n\n${t('systemPrompt.params')}\n${params}`;
  }).join('\n\n');

  return t('systemPrompt.withTools', { toolDescriptions });
}
