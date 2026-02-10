/**
 * Credit cost configuration per model
 */

const MODEL_COSTS = {
  // OpenAI
  'gpt-4o':           5,
  'gpt-4o-mini':      1,
  'gpt-4-turbo':      8,
  'gpt-4':            10,
  'gpt-3.5-turbo':    1,
  'o1':               15,
  'o1-mini':          3,

  // Anthropic
  'claude-opus-4':    15,
  'claude-sonnet-4':  5,
  'claude-haiku':     1,
  'claude-3-opus':    15,
  'claude-3-sonnet':  3,
  'claude-3-haiku':   1,

  // Meta / Open source
  'llama-3-70b':      2,
  'llama-3-8b':       1,
  'mixtral-8x7b':     2,

  // Default fallback
  'default':          3,
};

/**
 * Get credit cost for a model
 */
function getCreditCost(model) {
  if (!model) return MODEL_COSTS.default;
  const key = model.toLowerCase();
  // Try exact match, then prefix match
  if (MODEL_COSTS[key]) return MODEL_COSTS[key];
  for (const [k, v] of Object.entries(MODEL_COSTS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return MODEL_COSTS.default;
}

module.exports = { MODEL_COSTS, getCreditCost };
