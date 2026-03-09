// 工具使用示例文件
// 演示如何创建自定义工具

import { BaseTool, ToolMetadata } from '../services/tools/base';
import { ToolContext, ToolExecuteResult } from '../types';

/**
 * 示例：天气查询工具
 */
export class WeatherTool extends BaseTool {
  constructor() {
    const metadata: ToolMetadata = {
      id: 'weather',
      name: '天气查询',
      description: '查询指定城市的天气信息',
      icon: '🌤️',
      version: '1.0.0',
      author: 'OpenBunny',
      tags: ['weather', 'api'],
    };
    super(metadata);
  }

  async execute(input: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      // 这里可以调用真实的天气 API
      // 示例使用模拟数据
      const city = input.trim();

      if (!city) {
        return {
          content: '❌ 请提供城市名称',
          metadata: { error: true }
        };
      }

      // 模拟 API 调用
      const weatherData = {
        city,
        temperature: Math.floor(Math.random() * 30) + 10,
        condition: ['晴', '多云', '阴', '小雨'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 40) + 40,
      };

      return {
        content: `🌤️ ${city}天气:\n温度: ${weatherData.temperature}°C\n天气: ${weatherData.condition}\n湿度: ${weatherData.humidity}%`,
        metadata: weatherData
      };
    } catch (error) {
      return {
        content: `❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: true }
      };
    }
  }

  async validate(input: string): Promise<boolean> {
    return input.trim().length > 0;
  }

  async onLoad(): Promise<void> {
    console.log('Weather tool loaded');
  }

  async onUnload(): Promise<void> {
    console.log('Weather tool unloaded');
  }
}

/**
 * 示例：文本翻译工具
 */
export class TranslateTool extends BaseTool {
  constructor() {
    const metadata: ToolMetadata = {
      id: 'translate',
      name: '文本翻译',
      description: '翻译文本到指定语言',
      icon: '🌐',
      version: '1.0.0',
      tags: ['translate', 'text'],
    };
    super(metadata);
  }

  async execute(input: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      // 输入格式: "目标语言|文本"
      const parts = input.split('|');
      if (parts.length < 2) {
        return {
          content: '❌ 格式错误，请使用: 目标语言|文本',
          metadata: { error: true }
        };
      }

      const targetLang = parts[0].trim();
      const text = parts.slice(1).join('|').trim();

      // 这里可以调用真实的翻译 API
      // 示例返回模拟结果
      return {
        content: `🌐 翻译结果 (${targetLang}):\n[模拟翻译] ${text}`,
        metadata: { targetLang, originalText: text }
      };
    } catch (error) {
      return {
        content: `❌ 翻译失败: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: true }
      };
    }
  }
}

// 导出工具数组（支持批量导出）
export const tools = [
  new WeatherTool(),
  new TranslateTool(),
];

// 默认导出（支持单个工具导出）
export default new WeatherTool();
