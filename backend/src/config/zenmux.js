/**
 * ZenMux LLM Proxy Configuration
 * Routes models to appropriate providers
 */

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  groq: {
    name: 'Groq',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || '',
    models: ['llama-3-70b', 'llama-3-8b', 'mixtral-8x7b'],
  },
};

// Optional: override with a single proxy URL (e.g. LiteLLM, OpenRouter)
const PROXY_URL = process.env.ZENMUX_PROXY_URL || null;
const PROXY_API_KEY = process.env.ZENMUX_PROXY_API_KEY || null;

/**
 * Resolve which provider handles a given model
 */
function resolveProvider(model) {
  if (PROXY_URL) {
    return { name: 'proxy', baseUrl: PROXY_URL, apiKey: PROXY_API_KEY };
  }
  const key = (model || '').toLowerCase();
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    if (provider.models.some(m => key.includes(m) || m.includes(key))) {
      return { ...provider, id };
    }
  }
  // Default to OpenAI
  return { ...PROVIDERS.openai, id: 'openai' };
}

module.exports = { PROVIDERS, PROXY_URL, resolveProvider };
