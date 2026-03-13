import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { highlightCodeBlock, normalizeCodeLanguage } from '../lib/shiki';

interface ShikiCodeBlockProps {
  code: string;
  language?: string;
  showHeader?: boolean;
  compact?: boolean;
  maxHeightClassName?: string;
}

export default function ShikiCodeBlock({
  code,
  language,
  showHeader = true,
  compact = false,
  maxHeightClassName,
}: ShikiCodeBlockProps) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const codeThemePreset = useSettingsStore((s) => s.codeThemePreset);
  const isDark = useSettingsStore((s) => {
    if (s.theme === 'dark') return true;
    if (s.theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState('');

  useEffect(() => {
    let cancelled = false;

    highlightCodeBlock(code, normalizedLanguage, isDark, codeThemePreset)
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html);
      })
      .catch((error) => {
        console.error('Shiki highlight failed:', error);
        if (!cancelled) setHighlightedHtml('');
      });

    return () => {
      cancelled = true;
    };
  }, [code, codeThemePreset, isDark, normalizedLanguage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const wrapperClassName = compact
    ? 'overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm'
    : 'my-4 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm';
  const headerClassName = compact
    ? 'flex items-center justify-between border-b border-border/60 bg-muted/35 px-2.5 py-1.5'
    : 'flex items-center justify-between border-b border-border/60 bg-muted/35 px-3 py-2';
  const buttonClassName = compact
    ? 'inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border/60 hover:bg-background hover:text-foreground'
    : 'inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:bg-background hover:text-foreground';
  const contentClassName = [
    'shiki-block border-t border-border/40 overflow-x-auto',
    maxHeightClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName}>
      {showHeader && (
        <div className={headerClassName}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/85" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/85" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
            </div>
            <span className="rounded-md border border-border/50 bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {normalizedLanguage}
            </span>
          </div>
          <button onClick={handleCopy} className={buttonClassName} type="button">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {highlightedHtml ? (
        <div className={contentClassName} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      ) : (
        <pre
          className={`m-0 overflow-x-auto ${showHeader ? 'border-t border-border/40' : ''} bg-muted/40 p-4 text-sm leading-6 ${maxHeightClassName ?? ''}`}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
