/**
 * LLM Proxy Routes (ZenMux)
 * Proxies LLM requests, deducts credits automatically
 */

const { Router } = require('express');
const { requireJwtAuth } = require('../middleware/jwtAuth');
const ZenMuxService = require('../services/ZenMuxService');
const CreditService = require('../services/CreditService');

const router = Router();

router.use(requireJwtAuth);

// POST /api/v1/llm/chat
router.post('/chat', async (req, res, next) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;

    if (!model || typeof model !== 'string' || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'model (string) and messages (array) are required',
      });
    }
    
    // Validate model name (prevent injection)
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) {
      return res.status(400).json({ success: false, error: 'Invalid model name format' });
    }
    
    // Validate messages structure
    if (messages.length === 0 || messages.length > 100) {
      return res.status(400).json({ success: false, error: 'Messages must contain 1-100 entries' });
    }
    
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return res.status(400).json({ success: false, error: 'Each message must have role and content (string)' });
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ success: false, error: 'Message role must be system, user, or assistant' });
      }
    }

    // Rate limit check
    ZenMuxService.checkRateLimit(req.user.id);

    // Deduct credits first (fail-fast if insufficient)
    const creditResult = await CreditService.deduct(req.user.id, model, {
      endpoint: '/llm/chat',
      message_count: messages.length,
    });

    // Proxy to provider
    const llmResult = await ZenMuxService.chatCompletion({
      model, messages, temperature, max_tokens,
    });

    res.json({
      success: true,
      data: {
        result: llmResult,
        credits: {
          cost: creditResult.cost,
          remaining: creditResult.balance,
        },
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        ...(err.providerError && { provider_error: err.providerError }),
      });
    }
    next(err);
  }
});

// GET /api/v1/llm/models
router.get('/models', (req, res) => {
  const models = ZenMuxService.listModels();
  res.json({ success: true, data: models });
});

module.exports = router;
