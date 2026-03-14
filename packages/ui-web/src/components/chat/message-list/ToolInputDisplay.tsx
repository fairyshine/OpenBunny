import { memo } from 'react';
import LazyShikiCodeBlock from '../../LazyShikiCodeBlock';

type ToolParamKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' | 'unknown';

function getCodeLanguage(toolName?: string, paramKey?: string): string | undefined {
  if (toolName === 'python' && paramKey === 'code') return 'python';
  if (toolName === 'exec' && paramKey === 'command') return 'bash';
  if (toolName === 'file_manager' && paramKey === 'content') return undefined;
  return undefined;
}

function getToolParamKind(value: unknown): ToolParamKind {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function getToolParamTypeClassName(kind: ToolParamKind): string {
  switch (kind) {
    case 'string':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'number':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'boolean':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300';
    case 'null':
      return 'border-border/60 bg-muted/60 text-muted-foreground';
    case 'array':
    case 'object':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    default:
      return 'border-border/60 bg-muted/60 text-muted-foreground';
  }
}

function getToolParamValueClassName(kind: ToolParamKind, multiline: boolean): string {
  const layoutClassName = multiline
    ? 'block rounded-lg border px-3 py-2 whitespace-pre-wrap break-all'
    : 'inline-flex items-center rounded-md px-2 py-1';

  switch (kind) {
    case 'string':
      return `${layoutClassName} border-sky-500/15 bg-sky-500/5 text-sky-800 dark:text-sky-200`;
    case 'number':
      return `${layoutClassName} border-blue-500/15 bg-blue-500/5 text-blue-700 dark:text-blue-300`;
    case 'boolean':
      return `${layoutClassName} border-violet-500/15 bg-violet-500/5 text-violet-700 dark:text-violet-300`;
    case 'null':
      return `${layoutClassName} border-border/60 bg-muted/50 text-muted-foreground`;
    default:
      return `${layoutClassName} border-border/60 bg-background/60 text-foreground/80`;
  }
}

const ToolInputDisplay = memo(function ToolInputDisplay({ input, toolName }: { input: string; toolName?: string }) {
  try {
    const params = JSON.parse(input) as Record<string, unknown>;

    return (
      <div className="space-y-2.5">
        {Object.entries(params).map(([key, value]) => {
          const kind = getToolParamKind(value);
          const isMultilineString = typeof value === 'string' && value.includes('\n');
          const language = isMultilineString ? getCodeLanguage(toolName, key) : undefined;

          return (
            <div key={key} className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 shadow-sm backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <div className="inline-flex items-center rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-[11px] font-mono font-semibold text-primary/90">
                  {key}
                </div>
                <div className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getToolParamTypeClassName(kind)}`}>
                  {kind}
                </div>
              </div>
              <div className="text-xs font-mono text-foreground/85">
                {typeof value === 'string' ? (
                  language ? (
                    <LazyShikiCodeBlock code={value} language={language} compact maxHeightClassName="max-h-64" />
                  ) : isMultilineString ? (
                    <pre className={getToolParamValueClassName(kind, true)}>{value}</pre>
                  ) : (
                    <span className={getToolParamValueClassName(kind, false)}>
                      <span className="opacity-60 mr-0.5">&quot;</span>
                      {value}
                      <span className="opacity-60 ml-0.5">&quot;</span>
                    </span>
                  )
                ) : typeof value === 'number' ? (
                  <span className={getToolParamValueClassName(kind, false)}>{value}</span>
                ) : typeof value === 'boolean' ? (
                  <span className={getToolParamValueClassName(kind, false)}>{String(value)}</span>
                ) : value === null ? (
                  <span className={getToolParamValueClassName(kind, false)}>null</span>
                ) : Array.isArray(value) || typeof value === 'object' ? (
                  <pre className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-foreground/75 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  String(value)
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch {
    return (
      <pre className="text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto border-elegant">
        {input}
      </pre>
    );
  }
});

export default ToolInputDisplay;
