import { useEffect, useRef } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useSettingsStore } from '@shared/stores/settings';


declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements?: HTMLElement[]) => void;
    };
  }
}

SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

interface ReactMarkdownProps {
  content: string;
}

// 简单的 Markdown 渲染器
export default function ReactMarkdown({ content }: ReactMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useSettingsStore((s) => {
    if (s.theme === 'dark') return true;
    if (s.theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let attempts = 0;

    const tryTypeset = () => {
      if (cancelled) return;
      if (!window.MathJax?.typesetPromise) {
        if (attempts < 20) {
          attempts += 1;
          window.setTimeout(tryTypeset, 250);
        }
        return;
      }

      window.MathJax.typesetClear?.([element]);
      window.MathJax.typesetPromise([element]).catch((error) => {
        console.error('MathJax typeset failed:', error);
      });
    };

    tryTypeset();
    return () => {
      cancelled = true;
    };
  }, [content]);

  // 渲染代码块
  const renderCodeBlock = (code: string, language?: string) => {
    const normalizedLanguage = normalizeCodeLanguage(language);
    return (
      <div className="my-2 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2 bg-muted text-muted-foreground text-xs">
          <span>{normalizedLanguage || language || 'code'}</span>
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="hover:text-foreground transition-colors"
          >
            复制
          </button>
        </div>
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={isDark ? atomOneDark : atomOneLight}
          customStyle={{
            margin: 0,
            padding: '16px',
            borderRadius: 0,
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            overflowX: 'auto',
          }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  };

function normalizeCodeLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  if (['js', 'jsx', 'javascript'].includes(normalized)) return 'javascript';
  if (['ts', 'tsx', 'typescript'].includes(normalized)) return 'typescript';
  if (['sh', 'shell', 'zsh', 'bash'].includes(normalized)) return 'bash';
  if (normalized === 'py' || normalized === 'python') return 'python';
  if (normalized === 'json') return 'json';
  return normalized;
}

  // 简单的 Markdown 解析
  const parseContent = (text: string) => {
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    let remaining = text;

    while (remaining) {
      // 查找代码块
      const codeBlockMatch = remaining.match(/```(\w+)?\n([\s\S]*?)```/);
      
      if (codeBlockMatch) {
        const index = codeBlockMatch.index!;
        
        // 添加代码块前的文本
        if (index > 0) {
          parts.push({ type: 'text', content: remaining.slice(0, index) });
        }
        
        // 添加代码块
        parts.push({
          type: 'code',
          content: codeBlockMatch[2].trim(),
          language: codeBlockMatch[1],
        });
        
        remaining = remaining.slice(index + codeBlockMatch[0].length);
      } else {
        // 没有更多代码块
        parts.push({ type: 'text', content: remaining });
        break;
      }
    }

    return parts;
  };

  // 渲染内联元素
  const renderInline = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // 标题
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }

        // 列表项
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4">{renderInlineFormatting(line.slice(2))}</li>;
        }
        if (/^\d+\./.test(line)) {
          return <li key={i} className="ml-4">{renderInlineFormatting(line.replace(/^\d+\.\s*/, ''))}</li>;
        }

        // 引用
        if (line.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-4 border-primary pl-4 my-2 text-muted-foreground">
              {line.slice(2)}
            </blockquote>
          );
        }

        // 空行
        if (!line.trim()) {
          return <div key={i} className="h-2" />;
        }

        // 普通段落
        return <p key={i} className="my-1">{renderInlineFormatting(line)}</p>;
      });
  };

  // 渲染内联格式
  const renderInlineFormatting = (text: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining) {
      // 粗体 **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // 斜体 *text*
      const italicMatch = remaining.match(/\*(.+?)\*/);
      // 行内代码 `code`
      const codeMatch = remaining.match(/`(.+?)`/);
      // 链接 [text](url)
      const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

      const matches = [
        boldMatch && { type: 'bold', match: boldMatch },
        italicMatch && { type: 'italic', match: italicMatch },
        codeMatch && { type: 'code', match: codeMatch },
        linkMatch && { type: 'link', match: linkMatch },
      ].filter(Boolean).sort((a, b) => (a!.match!.index || 0) - (b!.match!.index || 0));

      if (matches.length === 0) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }

      const first = matches[0]!;
      const index = first.match!.index!;

      if (index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, index)}</span>);
      }

      switch (first.type) {
        case 'bold':
          parts.push(<strong key={key++} className="font-semibold">{first.match![1]}</strong>);
          break;
        case 'italic':
          parts.push(<em key={key++} className="italic">{first.match![1]}</em>);
          break;
        case 'code':
          parts.push(
            <code key={key++} className="px-1.5 py-0.5 bg-muted text-destructive rounded text-sm">
              {first.match![1]}
            </code>
          );
          break;
        case 'link':
          parts.push(
            <a
              key={key++}
              href={first.match![2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {first.match![1]}
            </a>
          );
          break;
      }

      remaining = remaining.slice(index + first.match![0].length);
    }

    return parts;
  };

  const parts = parseContent(content);

  return (
    <div ref={containerRef} className="prose prose-sm max-w-none math-content">
      {parts.map((part, index) => (
        part.type === 'code' ? (
          <div key={index}>{renderCodeBlock(part.content, part.language)}</div>
        ) : (
          <div key={index}>{renderInline(part.content)}</div>
        )
      ))}
    </div>
  );
}
