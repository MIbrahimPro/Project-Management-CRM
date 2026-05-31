import {
  AlarmClock,
  AlertTriangle,
  Bell,
  Calendar,
  ClipboardEdit,
  ClipboardList,
  FolderKanban,
  HelpCircle,
  MessageSquare,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@prisma/client";

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  CHAT_MESSAGE:       MessageSquare,
  TASK_ASSIGNED:      ClipboardList,
  TASK_CHANGED:       ClipboardEdit,
  MEETING_SCHEDULED:  Calendar,
  MEETING_REMINDER:   AlarmClock,
  PROJECT_UPDATE:     FolderKanban,
  QUESTION_ANSWERED:  HelpCircle,
  ATTENDANCE_ALERT:   AlertTriangle,
  AWAY_CHECK:         UserCheck,
  HIRING_UPDATE:      UserPlus,
  GENERAL:            Bell,
};

export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  CHAT_MESSAGE:       "text-info",
  TASK_ASSIGNED:      "text-primary",
  TASK_CHANGED:       "text-warning",
  MEETING_SCHEDULED:  "text-success",
  MEETING_REMINDER:   "text-warning",
  PROJECT_UPDATE:     "text-primary",
  QUESTION_ANSWERED:  "text-success",
  ATTENDANCE_ALERT:   "text-error",
  AWAY_CHECK:         "text-warning",
  HIRING_UPDATE:      "text-info",
  GENERAL:            "text-base-content/60",
};
