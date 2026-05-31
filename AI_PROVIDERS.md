# AI Provider Configuration Guide

## Recommended: NVIDIA NIM (Best Free Tier for Reasoning)

**Why NVIDIA NIM?**
- 1000 RPM free tier API credits
- Access to state-of-the-art open models
- No credit card required to start

**Available Models** (pick based on your needs):

| Model | Best For | Strengths |
|-------|----------|-------------|
| `kimi-k2-instruct` | **Reasoning/Planning** | Strong instruction following, great for milestones |
| `qwen2.5-coder` | **JSON/Code** | Excellent structured output, coding tasks |
| `glm-4.7` | **General Purpose** | Balanced performance, good context window |
| `deepseek-v4-flash` | **Fast Reasoning** | Quick responses with good quality |
| `deepseek-v4-pro` | **Complex Analysis** | Best reasoning, slower |
| `gpt-oss-20b` | **Fast General** | Quick everyday queries |
| `gpt-oss-120b` | **Complex Tasks** | Strong performance, larger context |
| `gemma-4-31b-it` | **Efficiency** | Lightweight, fast responses |
| `minimax-m2.5` | **Chat** | Good conversational abilities |

**My Recommendation:**

```bash
# NVIDIA NIM (Recommended for reasoning tasks)
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxx

# Model Selection - Pick from the table above
NVIDIA_MODEL_REASONING=kimi-k2-instruct      # For milestone planning
NVIDIA_MODEL_COMPLEX=deepseek-v4-flash       # For analysis
NVIDIA_MODEL_FAST=gpt-oss-20b                # For quick queries
NVIDIA_MODEL_JSON=qwen2.5-coder              # For structured output
```

**Alternative combinations:**
- **All-rounder**: Use `kimi-k2-instruct` for everything
- **Speed focused**: `deepseek-v4-flash` for reasoning, `gpt-oss-20b` for general
- **Quality focused**: `deepseek-v4-pro` for hard tasks, `glm-4.7` for general

## Alternative: Groq (Current, Fast)

Already configured. Good for speed, limited reasoning depth.

```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
GROQ_MODEL_REASONING=openai/gpt-oss-120b
GROQ_MODEL_COMPLEX=openai/gpt-oss-120b
GROQ_MODEL_FAST=openai/gpt-oss-20b
GROQ_MODEL_JSON=qwen/qwen3-32b
```

## Alternative: OpenRouter (Most Flexibility)

Access to Claude, GPT-4, Llama, etc. Rate-limited free tier.

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
```

Then set `AI_MODEL=anthropic/claude-3.5-sonnet` or any model.

## Provider Priority

The system selects providers automatically based on model name:

1. **NVIDIA NIM**: Model contains `kimi`, `qwen`, `deepseek`, `glm`, `minimax`, `gemma`, `gpt-oss`
2. **OpenRouter**: Model starts with `openrouter/`, contains `anthropic`, `google/`
3. **Groq**: Default fallback

## Task-Based Model Selection

| Task Type | Uses | Recommended |
|-----------|------|-------------|
| `planning` | Milestones, complex analysis | `NVIDIA_MODEL_REASONING` → kimi-k2 or deepseek-v4 |
| `structured_json` | JSON output | `NVIDIA_MODEL_JSON` → qwen2.5-coder |
| `document` | Long form docs | `NVIDIA_MODEL_COMPLEX` → glm-4.7 or deepseek-v4 |
| `general` | Quick responses | `NVIDIA_MODEL_FAST` → gpt-oss-20b or gemma-4 |

## Reasoning Models for Planning

Models like `kimi-k2-instruct` and `deepseek-v4-pro` excel at:
- **Explicit scope boundaries** (what's NOT included)
- **Anti-scope-creep defenses**
- **Detailed acceptance criteria**
- **Risk and assumption documentation**

These models "think" before responding, producing more thorough milestone plans.

## Testing

Test your configuration:

```bash
# Test milestone generation with reasoning
npm run dev
# Create a project from a client request
# Watch the AI generate detailed milestones with scope sections
```

## Troubleshooting

**Model not found / 404 error:**
- Check available models at [build.nvidia.com](https://build.nvidia.com)
- Some models may have different names in the API vs the UI
- Try the exact model ID from the API catalog

**Quick debug:**
```bash
# Check which model is being used
# Add to your .env:
DEBUG_AI_MODEL=true
```

**Fallback priority:**
1. Explicit model in code (highest priority)
2. `AI_MODEL` env var
3. Task-specific env vars (NVIDIA_MODEL_* or GROQ_MODEL_*)
4. Generic fallbacks (lowest priority)

**Simple setup (one model for everything):**
```bash
# Just set these two:
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx
AI_MODEL=kimi-k2-instruct
# This will use kimi for all AI tasks
```
