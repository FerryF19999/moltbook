/**
 * Telegram Bot Configuration
 */

const config = require('./index');

const telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '', // e.g. https://api.moltbook.com/api/v1/telegram/webhook
  useWebhook: process.env.TELEGRAM_USE_WEBHOOK === 'true',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || 'MoltbookBot',
};

module.exports = telegramConfig;
