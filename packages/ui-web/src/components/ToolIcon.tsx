import {
  SquareFunction,
  Search,
  FolderOpen,
  Plug,
  Wrench,
  Brain,
  Terminal,
  Clock,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  python: SquareFunction,
  search: Search,
  folder: FolderOpen,
  plug: Plug,
  brain: Brain,
  terminal: Terminal,
  clock: Clock,
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
