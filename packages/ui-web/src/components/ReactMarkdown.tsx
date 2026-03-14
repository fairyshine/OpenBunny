import { useEffect, useRef } from 'react';
import ReactMarkdownCore from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import LazyShikiCodeBlock from './LazyShikiCodeBlock';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements?: HTMLElement[]) => void;
    };
  }
}

interface ReactMarkdownProps {
  content: string;
}

export default function ReactMarkdown({ content }: ReactMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  const components: Components = {
    a: ({ href, children, ...props }) => (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-4 hover:underline"
      >
        {children}
      </a>
    ),
    pre: ({ children }) => <>{children}</>,
    code: (props) => {
      const { children, className, ...rest } = props as {
        children?: React.ReactNode;
        className?: string;
      } & Record<string, unknown>;

      const rawCode = String(children ?? '').replace(/\n$/, '');
      const isBlock = Boolean(className?.includes('language-')) || rawCode.includes('\n');

      if (isBlock) {
        return (
          <LazyShikiCodeBlock
            code={rawCode}
            language={className?.replace(/^language-/, '')}
          />
        );
      }

      return (
        <code
          {...rest}
          className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {children}
        </code>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-primary/60 pl-4 text-muted-foreground">
        {children}
      </blockquote>
    ),
    p: ({ children }) => <p className="my-2 leading-7">{children}</p>,
    ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table>{children}</table>
      </div>
    ),
  };

  return (
    <div ref={containerRef} className="prose prose-sm max-w-none break-words math-content dark:prose-invert">
      <ReactMarkdownCore remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdownCore>
    </div>
  );
}
