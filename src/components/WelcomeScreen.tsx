import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [, setStep] = useState(0);

  const features = [
    {
      icon: '🐍',
      title: 'Python 代码执行',
      description: '基于 Pyodide 的浏览器内 Python 运行时，支持 NumPy、Pandas、Matplotlib',
      example: '/python print("Hello, World!")',
    },
    {
      icon: '🔍',
      title: '网页搜索',
      description: '内置 DuckDuckGo 搜索，快速获取网络信息',
      example: '/search 最新 AI 进展',
    },
    {
      icon: '🧮',
      title: '智能计算',
      description: '执行数学计算和数据分析',
      example: '/calc sqrt(2) * 100',
    },
    {
      icon: '🔌',
      title: 'MCP 扩展',
      description: '连接 MCP 服务器，扩展 Agent 能力',
      example: '配置 MCP 服务器 → 使用扩展工具',
    },
  ];

  const handleStart = () => {
    setStep(1);
    onStart();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-5xl sm:text-6xl mb-4">🐰</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            CyberBunny
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            浏览器端 AI Agent · 支持 Python · MCP · 技能系统
          </p>
        </div>

        {/* 功能特性 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="hover:border-primary/50 transition-colors"
            >
              <CardHeader>
                <div className="text-2xl mb-2">{feature.icon}</div>
                <CardTitle className="text-base">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-xs font-mono">
                  {feature.example}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 开始使用按钮 */}
        <div className="text-center">
          <Button
            onClick={handleStart}
            size="lg"
            className="px-8 shadow-lg"
          >
            开始对话
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            在设置中配置 API Key 后可以使用 LLM 功能
          </p>
        </div>

        {/* 快捷提示 */}
        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">
              💡 试试这些命令
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono">
                /python import numpy as np
              </Badge>
              <Badge variant="outline" className="font-mono">
                /calc 2**10
              </Badge>
              <Badge variant="outline" className="font-mono">
                /search Python教程
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
