const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";

export type AITaskType =
  | "general"
  | "long_chat"
  | "structured_json"
  | "planning"
  | "document"
  | "hr";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  taskType?: AITaskType;
  jsonExample?: string;
  model?: string;
}

function stripReasoningAndFences(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\n?|```\n?/g, "")
    .trim();
}

function extractFirstJsonPayload(raw: string): string | null {
  const text = stripReasoningAndFences(raw);
  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return text.slice(start, i + 1).trim();
  }

  return null;
}

function getModel(taskType: AITaskType = "general", explicitModel?: string): string {
  if (explicitModel) return explicitModel;
  if (process.env.AI_MODEL) return process.env.AI_MODEL;

  switch (taskType) {
    case "structured_json":
      return process.env.GROQ_MODEL_JSON || "qwen/qwen3-32b";
    case "planning":
    case "long_chat":
      return process.env.GROQ_MODEL_COMPLEX || "openai/gpt-oss-120b";
    case "document":
    case "hr":
      return process.env.GROQ_MODEL_COMPLEX || "openai/gpt-oss-120b";
    case "general":
    default:
      return process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b";
  }
}

function extractAssistantContent(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

/**
 * Calls Groq chat completions with task-aware model selection.
 */
export async function callAI(
  messages: Message[],
  options: AIOptions = {}
): Promise<string> {
  const model = getModel(options.taskType, options.model);
  const allMessages: Message[] = [];
  if (options.systemPrompt) {
    allMessages.push({ role: "system", content: options.systemPrompt });
  }
  allMessages.push(...messages);

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[AI Error] Missing GROQ_API_KEY");
      return "AI is temporarily unavailable. Please try again.";
    }

    const response = await fetch(GROQ_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[AI Error]", response.status, err);
      return "AI is temporarily unavailable. Please try again.";
    }

    const data = (await response.json()) as unknown;
    return extractAssistantContent(data) || "No response generated.";
  } catch (error) {
    console.error("[AI Error]", error);
    return "AI is temporarily unavailable. Please try again.";
  }
}

/**
 * Requests and parses strictly valid JSON from the model.
 */
export async function callAIJson<T>(
  messages: Message[],
  options: AIOptions = {}
): Promise<T | null> {
  const jsonDirective = [
    "IMPORTANT JSON RULES:",
    "1) Return ONLY valid JSON. No markdown fences. No preamble. No <think> tags.",
    "2) Start with { or [ and end with } or ].",
    "3) Do not include trailing commas or comments.",
    options.jsonExample ? `4) Follow this JSON shape example exactly:\n${options.jsonExample}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callAI(messages, {
    ...options,
    taskType: options.taskType ?? "structured_json",
    systemPrompt: [options.systemPrompt, jsonDirective].filter(Boolean).join("\n\n"),
  });

  const cleaned = stripReasoningAndFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const extracted = extractFirstJsonPayload(raw);
    if (extracted) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // fall through
      }
    }
    console.error("[AI JSON Parse Error]", raw);
    return null;
  }
}
