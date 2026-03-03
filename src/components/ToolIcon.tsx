import {
  Code,
  Search,
  Calculator,
  FolderOpen,
  Plug,
  Wrench,
  Brain,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  python: Code,
  search: Search,
  calculator: Calculator,
  folder: FolderOpen,
  plug: Plug,
  brain: Brain,
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
