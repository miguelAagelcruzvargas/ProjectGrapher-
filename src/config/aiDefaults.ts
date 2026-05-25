const ENV = import.meta.env as Record<string, string | undefined>;

const DEFAULT_PROVIDER_MODELS = {
  gemini: ENV.VITE_DEFAULT_GEMINI_MODEL || '',
  openai: ENV.VITE_DEFAULT_OPENAI_MODEL || '',
  groq: ENV.VITE_DEFAULT_GROQ_MODEL || '',
  deepseek: ENV.VITE_DEFAULT_DEEPSEEK_MODEL || '',
  openrouter: ENV.VITE_DEFAULT_OPENROUTER_MODEL || '',
  mistral: ENV.VITE_DEFAULT_MISTRAL_MODEL || '',
  ollama: ENV.VITE_DEFAULT_OLLAMA_MODEL || ''
} as const;

export const DEFAULT_AI_PROVIDER = ENV.VITE_DEFAULT_AI_PROVIDER || 'gemini';

export const DEFAULT_AI_MODELS: Record<string, string> = {
  ...DEFAULT_PROVIDER_MODELS
};

export const getDefaultAiModel = (provider: string) =>
  DEFAULT_AI_MODELS[provider] || ENV.VITE_DEFAULT_FALLBACK_MODEL || '';
