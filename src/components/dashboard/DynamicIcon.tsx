import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckSquare,
  DollarSign,
  FolderKanban,
  HelpCircle,
  Inbox,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  FolderKanban,
  Users,
  Inbox,
  HelpCircle,
  Bell,
  CheckSquare,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Target,
};

interface DynamicIconProps {
  name: string;
  className?: string;
}

/**
 * Renders a Lucide icon by dashboard API string name, with a neutral fallback.
 */
export function DynamicIcon({ name, className }: DynamicIconProps) {
  const Icon = ICON_MAP[name] ?? Bell;
  return <Icon className={className ?? "w-6 h-6"} aria-hidden />;
}
