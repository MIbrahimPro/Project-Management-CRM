/**
 * Extracts a plain-text preview from stored BlockNote JSON (array of blocks).
 */
export function blockNoteJsonToPlainText(json: string | null | undefined): string {
  if (!json || json.trim() === "") return "";
  try {
    const blocks = JSON.parse(json) as unknown;
    if (!Array.isArray(blocks)) return "";
    const parts: string[] = [];

    const walkInline = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "text" && typeof n.text === "string") {
        parts.push(n.text);
      }
      if (Array.isArray(n.content)) {
        for (const c of n.content) walkInline(c);
      }
    };

    const walkBlock = (block: unknown): void => {
      if (!block || typeof block !== "object") return;
      const b = block as Record<string, unknown>;
      if (Array.isArray(b.content)) {
        for (const c of b.content) walkInline(c);
      }
      if (Array.isArray(b.children)) {
        for (const ch of b.children) walkBlock(ch);
      }
    };

    for (const block of blocks) walkBlock(block);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}
