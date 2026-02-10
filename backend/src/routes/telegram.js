/**
 * Telegram Bot Routes
 * Webhook endpoint for receiving Telegram updates
 */

const { Router } = require('express');
const TelegramBotService = require('../services/TelegramBotService');

const router = Router();

/**
 * POST /api/v1/telegram/webhook
 * Receives updates from Telegram Bot API
 */
router.post('/webhook', (req, res) => {
  try {
    TelegramBotService.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err);
    res.sendStatus(200); // Always 200 to avoid Telegram retries
  }
});

/**
 * GET /api/v1/telegram/health
 * Health check for Telegram bot
 */
router.get('/health', (req, res) => {
  const bot = TelegramBotService.getBot();
  res.json({
    success: true,
    botActive: !!bot,
    mode: process.env.TELEGRAM_USE_WEBHOOK === 'true' ? 'webhook' : 'polling',
  });
});

module.exports = router;
