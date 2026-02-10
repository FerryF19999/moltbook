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

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'model (string) and messages (array) are required',
      });
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
