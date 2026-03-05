import {
  SquareFunction,
  Search,
  Calculator,
  FolderOpen,
  Plug,
  Wrench,
  Brain,
  Terminal,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  python: SquareFunction,
  search: Search,
  calculator: Calculator,
  folder: FolderOpen,
  plug: Plug,
  brain: Brain,
  terminal: Terminal,
};

interface ToolIconProps {
  icon?: string;
  className?: string;
}

export function ToolIcon({ icon, className = 'w-5 h-5' }: ToolIconProps) {
  if (!icon) return <Wrench className={className} />;
  const Icon = iconMap[icon] || Wrench;
  return <Icon className={className} />;
}
