import type { ReactNode } from "react";

/**
 * Parses a notification body string into React nodes.
 * Supports **bold** and [link text](/url) markdown syntax.
 */
export function parseNotificationBody(body: string): ReactNode[] {
  const parts = body.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={i} className="font-semibold text-base-content">
          {boldMatch[1]}
        </strong>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} className="text-primary underline hover:text-primary/80">
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={i}>{part}</span>;
  });
}
