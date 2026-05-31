import { config } from "dotenv";
config(); // load .env before validation — ts-node doesn't auto-load it

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_EMAIL",
  // Note: AI provider key is required but can be GROQ_API_KEY, NVIDIA_API_KEY, or OPENROUTER_API_KEY
  // The AI system will check for at least one of these at runtime
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export {};
