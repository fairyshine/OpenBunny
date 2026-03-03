/**
 * OpenAI Function Calling 格式转换工具
 * 将内部工具定义转换为 OpenAI 的 tools 格式
 */

import { ToolMetadata, ToolParameter } from './base';
import { toolRegistry } from './registry';

/**
 * OpenAI Tool 定义格式
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * OpenAI Tool Call 格式
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * 将 ToolParameter 转换为 JSON Schema
 */
function convertParameterToJsonSchema(param: ToolParameter): any {
  const schema: any = {
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
      schema.properties[key] = convertParameterToJsonSchema(value);
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
 * 将内部工具元数据转换为 OpenAI Tool 格式
 */
export function convertToOpenAITool(metadata: ToolMetadata): OpenAITool {
  const properties: Record<string, any> = {};
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
    type: 'function',
    function: {
      name: metadata.id, // 使用 ID 作为函数名（英文，符合 OpenAI 规范）
      description: `${metadata.name} - ${metadata.description}`,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

/**
 * 获取所有已启用工具的 OpenAI 格式
 */
export function getOpenAITools(enabledToolIds: string[]): OpenAITool[] {
  const tools: OpenAITool[] = [];

  for (const toolId of enabledToolIds) {
    const tool = toolRegistry.get(toolId);
    if (tool) {
      tools.push(convertToOpenAITool(tool.metadata));
    }
  }

  return tools;
}

/**
 * 解析 OpenAI Tool Call 的参数
 */
export function parseToolCallArguments(toolCall: OpenAIToolCall): Record<string, any> {
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (error) {
    console.error('[OpenAI Format] Failed to parse tool call arguments:', error);
    return {};
  }
}

/**
 * 将参数对象转换为工具执行的输入字符串
 * 根据参数数量决定格式：
 * - 单个参数：直接返回值
 * - 多个参数：返回 JSON 字符串
 */
export function convertArgumentsToInput(args: Record<string, any>): string {
  const keys = Object.keys(args);

  if (keys.length === 0) {
    return '';
  }

  if (keys.length === 1) {
    const value = args[keys[0]];
    // 如果是简单类型，直接返回字符串
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  // 多个参数或复杂类型，返回 JSON
  return JSON.stringify(args);
}

/**
 * 生成 OpenAI 格式的 System Prompt
 */
export function generateOpenAISystemPrompt(enabledToolIds: string[]): string {
  const tools = getOpenAITools(enabledToolIds);

  if (tools.length === 0) {
    return '你是一个智能助手。';
  }

  const toolDescriptions = tools.map(tool => {
    const func = tool.function;
    const params = Object.entries(func.parameters.properties)
      .map(([name, schema]: [string, any]) => {
        const required = func.parameters.required.includes(name) ? '(必需)' : '(可选)';
        return `  - ${name} (${schema.type}) ${required}: ${schema.description}`;
      })
      .join('\n');

    return `### ${func.name}\n${func.description}\n\n参数:\n${params}`;
  }).join('\n\n');

  return `你是一个智能助手，可以调用工具来完成任务。

## 可用工具

${toolDescriptions}

## 工具使用规则

**仅在用户明确要求时才调用工具。**

如果用户只是在聊天、提问或讨论，直接用你的知识回答，不要调用工具。`;
}
