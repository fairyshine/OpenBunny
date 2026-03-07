import { ChevronRight } from '../../icons';

interface GridBreadcrumbProps {
  gridPath: string;
  onNavigate: (path: string) => void;
}

export function GridBreadcrumb({ gridPath, onNavigate }: GridBreadcrumbProps) {
  const parts = gridPath.split('/').filter(Boolean);
  const paths: { name: string; path: string }[] = [];
  let acc = '';
  for (const part of parts) {
    acc += '/' + part;
    paths.push({ name: part, path: acc });
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 text-xs text-muted-foreground overflow-x-auto shrink-0 border-b border-border">
      {paths.map((p, i) => (
        <span key={p.path} className="flex items-center gap-0.5 shrink-0">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          <button
            onClick={() => onNavigate(p.path)}
            className={`hover:text-foreground px-1 py-0.5 rounded transition-colors ${
              p.path === gridPath ? 'text-foreground font-medium' : ''
            }`}
          >
            {p.name}
          </button>
        </span>
      ))}
    </div>
  );
}
