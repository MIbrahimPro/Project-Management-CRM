"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * If the model wrapped the whole reply in a single ```markdown fence, unwrap so it renders as markdown.
 */
function unwrapOuterMarkdownFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return m ? m[1].trim() : text;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-base-content mt-3 mb-1 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-base-content mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-base-content mt-2 mb-0.5">{children}</h3>
  ),
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-4 my-2 space-y-0.5 marker:text-base-content/70">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 my-2 space-y-0.5 marker:text-base-content/70">{children}</ol>
  ),
  li: ({ children }) => <li className="text-base-content pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-base-content">{children}</strong>,
  em: ({ children }) => <em className="italic text-base-content/90">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      className="link link-primary underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-base-300 pl-3 my-2 text-base-content/80 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-base-300 my-3" />,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={`${className ?? ""} text-xs font-mono`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-base-300 px-1 py-0.5 rounded text-[0.85em] font-mono text-base-content"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-base-300 rounded-lg p-3 overflow-x-auto text-xs my-2 border border-base-300 max-w-full">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 w-full max-w-full">
      <table className="table table-sm table-zebra w-full border border-base-300 rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-base-300/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-base-300 px-2 py-1 text-left text-xs font-semibold text-base-content">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-base-300 px-2 py-1 text-xs align-top">{children}</td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src ?? ""} alt={alt ?? ""} className="max-w-full rounded-lg my-2 border border-base-300" loading="lazy" />
  ),
};

export interface AiMarkdownProps {
  content: string;
}

/**
 * Renders assistant markdown (GFM) with DaisyUI-friendly styling.
 */
export function AiMarkdown({ content }: AiMarkdownProps) {
  const raw = unwrapOuterMarkdownFence(content);
  return (
    <div className="ai-md text-sm text-base-content [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {raw}
      </ReactMarkdown>
    </div>
  );
}
