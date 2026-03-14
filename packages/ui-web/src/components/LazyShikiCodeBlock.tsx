import { Suspense, lazy } from 'react';

const ShikiCodeBlock = lazy(() => import('./ShikiCodeBlock'));

interface LazyShikiCodeBlockProps {
  code: string;
  language?: string;
  showHeader?: boolean;
  compact?: boolean;
  maxHeightClassName?: string;
}

export default function LazyShikiCodeBlock(props: LazyShikiCodeBlockProps) {
  const { code, maxHeightClassName, showHeader = true } = props;

  return (
    <Suspense
      fallback={(
        <pre
          className={`m-0 overflow-x-auto ${showHeader ? 'border-t border-border/40' : ''} bg-muted/40 p-4 text-sm leading-6 ${maxHeightClassName ?? ''}`}
        >
          <code>{code}</code>
        </pre>
      )}
    >
      <ShikiCodeBlock {...props} />
    </Suspense>
  );
}
