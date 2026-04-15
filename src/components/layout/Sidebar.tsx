"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Zap,
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  CheckSquare,
  Layers,
  Briefcase,
  Calculator,
  Clock,
  Shield,
  ArrowLeft,
  FileText,
  HelpCircle,
  MessageCircleQuestion,
  KeyRound,
  Users,
  type LucideProps,
} from "lucide-react";
import type { SidebarItem } from "@/config/sidebar";

type IconComponent = React.FC<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  CheckSquare,
  Layers,
  Briefcase,
  Calculator,
  Clock,
  Shield,
  ArrowLeft,
  FileText,
  HelpCircle,
  MessageCircleQuestion,
  KeyRound,
  Users,
};

function resolveIcon(name: string): IconComponent {
  return ICON_MAP[name] ?? HelpCircle;
}

interface SidebarProps {
  items: SidebarItem[];
  onMobileClose?: () => void;
  isMobileOpen?: boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
}

export function Sidebar({
  items,
  onMobileClose,
  isMobileOpen,
  collapsed = false,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for badge updates from anywhere in the app via window events.
  // Pages dispatch CustomEvent<"sidebar-badge", { key, count }>.
  useEffect(() => {
    function onBadge(e: Event) {
      const detail = (e as CustomEvent<{ key: string; count: number }>).detail;
      if (!detail) return;
      setBadges((prev) => ({ ...prev, [detail.key]: detail.count }));
    }
    window.addEventListener("sidebar-badge", onBadge as EventListener);
    return () => window.removeEventListener("sidebar-badge", onBadge as EventListener);
  }, []);

  useEffect(() => {
    if (collapsed) {
      setExpandedItem(null);
    }
  }, [collapsed]);

  function handleItemClick(label: string, hasChildren: boolean) {
    if (!hasChildren) return;
    setExpandedItem((prev) => (prev === label ? null : label));
  }

  // Determine the single active item: the one with the longest href that matches
  // the current pathname (either exact or as a path prefix). This prevents parent
  // routes like /projects/abc from being "active" when on /projects/abc/chat.
  const activeHref = (() => {
    const candidates = items
      .filter((i) => !i.isBackButton)
      .map((i) => i.href)
      .filter((href) => pathname === href || pathname.startsWith(href + "/"))
      .sort((a, b) => b.length - a.length);
    return candidates[0] ?? null;
  })();

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150 ${
      href === activeHref
        ? "bg-primary text-primary-content font-medium"
        : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
    }`;

  const isMobile = typeof isMobileOpen === "boolean";

  if (!mounted) {
    return (
      <aside className="w-60 h-full bg-base-200 border-r border-base-300 flex flex-col">
        <div className="p-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-content" />
          </div>
          <span className="text-lg font-bold text-base-content">DevRolin</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`h-full bg-base-200 border-r border-base-300 flex flex-col transition-all duration-300 ease-in-out ${
        isMobile
          ? "w-60"
          : collapsed
          ? "w-16"
          : "w-60"
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-2">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-content" />
            </div>
            <span className="text-lg font-bold text-base-content">DevRolin</span>
          </div>
        )}
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/70 hover:text-base-content transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}
        {isMobile && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/70 hover:text-base-content transition-colors lg:hidden"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = resolveIcon(item.icon);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItem === item.label;

          return (
            <div key={item.label}>
              <div
                className="group relative"
                onClick={() => handleItemClick(item.label, !!hasChildren)}
              >
                {hasChildren ? (
                  <div className={linkClass(item.href)}>
                    <div className="relative">
                      {collapsed ? (
                        <div className="tooltip tooltip-right" data-tip={item.label}>
                          <Icon className="w-5 h-5 flex-shrink-0" />
                        </div>
                      ) : (
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <Link href={item.href} className={linkClass(item.href)}>
                    <div className="relative">
                      {collapsed ? (
                        <div className="tooltip tooltip-right" data-tip={item.label}>
                          <Icon className="w-5 h-5 flex-shrink-0" />
                        </div>
                      ) : (
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      )}
                      {item.badgeKey && (badges[item.badgeKey] ?? 0) > 0 && collapsed && (
                        <span className="absolute -top-1.5 -right-1.5 bg-error text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {badges[item.badgeKey]! > 9 ? "9+" : badges[item.badgeKey]}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badgeKey && (badges[item.badgeKey] ?? 0) > 0 && (
                      <span className="badge badge-error badge-sm text-white">
                        {badges[item.badgeKey]}
                      </span>
                    )}
                  </Link>
                )}
              </div>

              {/* Children */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-base-300 pl-2">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-3 py-2 rounded-lg text-sm text-base-content/60 hover:bg-base-300 hover:text-base-content transition-colors truncate"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section — only on mobile */}
      {isMobile && (
        <div className="px-2 py-3 border-t border-base-300 space-y-1 lg:hidden">
          <Link href="/settings" className={linkClass("/settings")}>
            <span className="flex-1 truncate">Settings</span>
          </Link>
          <button
            onClick={onMobileClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-error hover:bg-base-300 transition-colors"
          >
            <span className="flex-1 text-left">Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
}
