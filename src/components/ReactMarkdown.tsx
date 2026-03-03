interface ReactMarkdownProps {
  content: string;
}

// 简单的 Markdown 渲染器
export default function ReactMarkdown({ content }: ReactMarkdownProps) {
  // 渲染代码块
  const renderCodeBlock = (code: string, language?: string) => {
    return (
      <pre className="my-2 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-2 bg-muted text-muted-foreground text-xs rounded-t-lg">
          <span>{language || 'code'}</span>
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="hover:text-white transition-colors"
          >
            复制
          </button>
        </div>
        <code className="block p-4 pt-2 bg-secondary text-secondary-foreground overflow-x-auto">
          {code}
        </code>
      </pre>
    );
  };

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
    <div className="prose prose-sm max-w-none">
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
