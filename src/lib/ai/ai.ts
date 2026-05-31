const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1/chat/completions";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

export type AITaskType =
  | "general"
  | "long_chat"
  | "structured_json"
  | "planning"
  | "document"
  | "hr";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  taskType?: AITaskType;
  jsonExample?: string;
  model?: string;
  tools?: any[];
  toolChoice?: string;
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
      // JSON tasks: Use user's configured model or fall through to general
      return process.env.NVIDIA_MODEL_JSON 
        || process.env.GROQ_MODEL_JSON 
        || process.env.NVIDIA_MODEL_COMPLEX
        || process.env.GROQ_MODEL_COMPLEX
        || "qwen-2.5-coder"; // Generic fallback
    case "planning":
    case "long_chat":
      // REASONING MODELS for complex planning
      // Priority: User's reasoning config → complex config → generic fallbacks
      return process.env.NVIDIA_MODEL_REASONING
        || process.env.NVIDIA_MODEL_COMPLEX
        || process.env.GROQ_MODEL_REASONING
        || process.env.GROQ_MODEL_COMPLEX
        || "kimi-k2-instruct"; // Generic fallback
    case "document":
    case "hr":
      return process.env.NVIDIA_MODEL_COMPLEX
        || process.env.GROQ_MODEL_COMPLEX
        || process.env.NVIDIA_MODEL_REASONING
        || "glm-4.7"; // Generic fallback
    case "general":
    default:
      return process.env.NVIDIA_MODEL_FAST
        || process.env.GROQ_MODEL_FAST
        || process.env.NVIDIA_MODEL_COMPLEX
        || "gpt-oss-20b"; // Generic fallback
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

function getProviderConfig(model: string) {
  // NVIDIA NIM models - includes all available models
  const nvidiaModels = [
    "kimi", "qwen", "deepseek", "glm", "minimax", "gemma",
    "gpt-oss", "nemotron", "llama", "mistral", "mixtral"
  ];
  const isNvidia = model.startsWith("nvidia/") || 
    nvidiaModels.some(m => model.toLowerCase().includes(m));
  
  if (isNvidia) {
    return {
      baseUrl: NVIDIA_BASE,
      apiKey: process.env.NVIDIA_API_KEY,
      keyName: "NVIDIA_API_KEY",
    };
  }
  // OpenRouter models
  if (model.startsWith("openrouter/") || model.includes("anthropic") || model.includes("google/")) {
    return {
      baseUrl: OPENROUTER_BASE,
      apiKey: process.env.OPENROUTER_API_KEY,
      keyName: "OPENROUTER_API_KEY",
    };
  }
  // Default to Groq
  return {
    baseUrl: GROQ_BASE,
    apiKey: process.env.GROQ_API_KEY,
    keyName: "GROQ_API_KEY",
  };
}

/**
 * Calls AI provider chat completions with task-aware model selection.
 * Supports Groq, NVIDIA NIM, and OpenRouter.
 * Returns the full message object to support tool calls.
 */
export async function callAIRaw(
  messages: Message[],
  options: AIOptions = {}
): Promise<Message | null> {
  // Validate at least one AI provider is configured
  const hasAIKey = process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!hasAIKey) {
    console.error("[AI Error] No AI provider key configured. Set GROQ_API_KEY, NVIDIA_API_KEY, or OPENROUTER_API_KEY");
    return null;
  }

  const model = getModel(options.taskType, options.model);
  const allMessages: Message[] = [];
  if (options.systemPrompt) {
    allMessages.push({ role: "system", content: options.systemPrompt });
  }
  allMessages.push(...messages);

  const provider = getProviderConfig(model);

  try {
    if (!provider.apiKey) {
      console.error(`[AI Error] Missing ${provider.keyName}`);
      return null;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };

    // OpenRouter requires additional headers
    if (provider.baseUrl === OPENROUTER_BASE) {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://devrolin.com";
      headers["X-Title"] = "DevRolin CRM";
    }

    const response = await fetch(provider.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: allMessages,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        temperature: options.temperature ?? 0.7,
        ...(options.tools ? { tools: options.tools.map(t => ({ type: "function", function: t })), tool_choice: options.toolChoice ?? "auto" } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[AI Error]", response.status, err);
      return null;
    }

    const data = (await response.json()) as any;
    if (data.choices?.[0]?.message) {
      return data.choices[0].message as Message;
    }
    return null;
  } catch (error) {
    console.error("[AI Error]", error);
    return null;
  }
}

/**
 * Convenience wrapper for callAIRaw that returns only content.
 */
export async function callAI(
  messages: Message[],
  options: AIOptions = {}
): Promise<string> {
  const res = await callAIRaw(messages, options);
  return res?.content || "AI is temporarily unavailable. Please try again.";
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
