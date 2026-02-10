/**
 * Telegram Bot Service
 * Handles bot commands, user linking, and notifications
 */

const TelegramBot = require('node-telegram-bot-api');
const telegramConfig = require('../config/telegram');
const { queryOne, queryAll, query } = require('../config/database');
const CreditService = require('./CreditService');
const { CREDIT_PACKAGES } = require('../config/midtrans');
const PaymentService = require('./PaymentService');

let bot = null;

class TelegramBotService {
  /**
   * Initialize the bot (call once at startup)
   */
  static initialize() {
    if (!telegramConfig.botToken) {
      console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
      return null;
    }

    const options = telegramConfig.useWebhook
      ? { webHook: false } // webhook handled by Express route
      : { polling: true };

    bot = new TelegramBot(telegramConfig.botToken, options);

    if (telegramConfig.useWebhook && telegramConfig.webhookUrl) {
      bot.setWebHook(`${telegramConfig.webhookUrl}`);
      console.log(`[TelegramBot] Webhook set: ${telegramConfig.webhookUrl}`);
    } else {
      console.log('[TelegramBot] Running in polling mode');
    }

    this._registerCommands();
    console.log('[TelegramBot] Bot initialized');
    return bot;
  }

  /**
   * Get the bot instance
   */
  static getBot() {
    return bot;
  }

  /**
   * Process incoming webhook update
   */
  static processUpdate(update) {
    if (bot) {
      bot.processUpdate(update);
    }
  }

  // ─── COMMAND HANDLERS ────────────────────────────────────────

  static _registerCommands() {
    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => this._handleStart(msg, match));
    bot.onText(/\/balance/, (msg) => this._handleBalance(msg));
    bot.onText(/\/buy/, (msg) => this._handleBuy(msg));
    bot.onText(/\/status(?:\s+(.+))?/, (msg, match) => this._handleStatus(msg, match));
    bot.onText(/\/help/, (msg) => this._handleHelp(msg));

    // Set bot menu commands
    bot.setMyCommands([
      { command: 'start', description: 'Register / link your Moltbook account' },
      { command: 'balance', description: 'Check your credit balance' },
      { command: 'buy', description: 'Buy credit packages' },
      { command: 'status', description: 'Check payment status' },
      { command: 'help', description: 'Show help' },
    ]);
  }

  /**
   * /start [linkToken]
   * Register or link Telegram user to Moltbook account
   */
  static async _handleStart(msg, match) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();
    const telegramUsername = msg.from.username || '';
    const linkToken = match ? match[1] : null;

    try {
      // Check if already linked
      const existing = await queryOne(
        'SELECT user_id FROM telegram_links WHERE telegram_user_id = $1',
        [telegramUserId]
      );

      if (existing) {
        await bot.sendMessage(chatId,
          `✅ Akun Telegram kamu sudah terhubung dengan Moltbook!\n\n` +
          `User ID: \`${existing.user_id}\`\n\n` +
          `Gunakan /balance untuk cek saldo, /buy untuk beli kredit.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (linkToken) {
        // Link with existing account via token
        const user = await queryOne(
          'SELECT id, username FROM users WHERE link_token = $1 AND link_token_expires > NOW()',
          [linkToken]
        );

        if (!user) {
          await bot.sendMessage(chatId, '❌ Token tidak valid atau sudah expired. Silakan generate ulang dari dashboard.');
          return;
        }

        await query(
          `INSERT INTO telegram_links (telegram_user_id, telegram_username, user_id, chat_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (telegram_user_id) DO UPDATE SET user_id = $3, chat_id = $4, updated_at = NOW()`,
          [telegramUserId, telegramUsername, user.id, chatId.toString()]
        );

        // Clear used token
        await query('UPDATE users SET link_token = NULL, link_token_expires = NULL WHERE id = $1', [user.id]);

        await bot.sendMessage(chatId,
          `🎉 Berhasil terhubung!\n\n` +
          `Akun Telegram: @${telegramUsername || telegramUserId}\n` +
          `Moltbook: ${user.username}\n\n` +
          `Sekarang kamu bisa:\n` +
          `/balance — Cek saldo kredit\n` +
          `/buy — Beli kredit\n` +
          `/status — Cek status pembayaran`
        );
      } else {
        // No token — show instructions
        await bot.sendMessage(chatId,
          `👋 Selamat datang di *Moltbook Bot*!\n\n` +
          `Untuk menghubungkan akun Moltbook kamu:\n\n` +
          `1️⃣ Buka dashboard Moltbook\n` +
          `2️⃣ Pergi ke Settings → Telegram\n` +
          `3️⃣ Klik "Link Telegram"\n` +
          `4️⃣ Kirim link yang diberikan ke bot ini\n\n` +
          `Atau gunakan: \`/start <token>\``,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('[TelegramBot] /start error:', err);
      await bot.sendMessage(chatId, '⚠️ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  }

  /**
   * /balance — Check credit balance
   */
  static async _handleBalance(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    try {
      const link = await this._getLinkedUser(telegramUserId);
      if (!link) {
        await bot.sendMessage(chatId, '❌ Akun belum terhubung. Gunakan /start untuk menghubungkan.');
        return;
      }

      const balance = await CreditService.getBalance(link.user_id);

      await bot.sendMessage(chatId,
        `💰 *Saldo Kredit*\n\n` +
        `Balance: *${balance.toLocaleString()} credits*\n\n` +
        `Gunakan /buy untuk top-up kredit.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[TelegramBot] /balance error:', err);
      await bot.sendMessage(chatId, '⚠️ Gagal mengambil saldo. Silakan coba lagi.');
    }
  }

  /**
   * /buy — Show credit packages with payment links
   */
  static async _handleBuy(msg) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    try {
      const link = await this._getLinkedUser(telegramUserId);
      if (!link) {
        await bot.sendMessage(chatId, '❌ Akun belum terhubung. Gunakan /start untuk menghubungkan.');
        return;
      }

      const packages = Object.entries(CREDIT_PACKAGES);
      let text = '🛒 *Paket Kredit Moltbook*\n\n';

      const keyboard = packages.map(([id, pkg]) => {
        text += `• *${pkg.label}* — Rp ${pkg.priceIDR.toLocaleString('id-ID')}\n`;
        return [{ text: `💳 ${pkg.label}`, callback_data: `buy:${id}` }];
      });

      text += '\nPilih paket di bawah untuk membeli:';

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard },
      });

      // Handle callback
      bot.once('callback_query', async (cbq) => {
        if (!cbq.data.startsWith('buy:')) return;
        const packageId = cbq.data.split(':')[1];

        try {
          const result = await PaymentService.createTransaction(
            link.user_id,
            packageId,
            { name: msg.from.first_name }
          );

          await bot.answerCallbackQuery(cbq.id);
          await bot.sendMessage(chatId,
            `✅ *Order dibuat!*\n\n` +
            `📦 Paket: ${CREDIT_PACKAGES[packageId].label}\n` +
            `💵 Total: Rp ${CREDIT_PACKAGES[packageId].priceIDR.toLocaleString('id-ID')}\n` +
            `🆔 Order: \`${result.orderId}\`\n\n` +
            `👉 [Bayar Sekarang](${result.redirectUrl})\n\n` +
            `Gunakan /status ${result.orderId} untuk cek status.`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
          );
        } catch (err) {
          console.error('[TelegramBot] buy callback error:', err);
          await bot.answerCallbackQuery(cbq.id, { text: 'Gagal membuat order' });
        }
      });
    } catch (err) {
      console.error('[TelegramBot] /buy error:', err);
      await bot.sendMessage(chatId, '⚠️ Gagal memuat paket. Silakan coba lagi.');
    }
  }

  /**
   * /status [orderId] — Check payment status
   */
  static async _handleStatus(msg, match) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    try {
      const link = await this._getLinkedUser(telegramUserId);
      if (!link) {
        await bot.sendMessage(chatId, '❌ Akun belum terhubung. Gunakan /start untuk menghubungkan.');
        return;
      }

      const orderId = match ? match[1] : null;

      if (orderId) {
        // Specific order
        const payment = await queryOne(
          'SELECT * FROM payments WHERE order_id = $1 AND user_id = $2',
          [orderId, link.user_id]
        );

        if (!payment) {
          await bot.sendMessage(chatId, '❌ Order tidak ditemukan.');
          return;
        }

        const statusEmoji = {
          pending: '⏳', settlement: '✅', capture: '✅',
          expire: '❌', cancel: '❌', deny: '❌', refund: '🔄',
        };

        await bot.sendMessage(chatId,
          `📋 *Status Order*\n\n` +
          `🆔 Order: \`${payment.order_id}\`\n` +
          `📦 Paket: ${payment.package_id}\n` +
          `💵 Amount: Rp ${payment.amount.toLocaleString('id-ID')}\n` +
          `${statusEmoji[payment.status] || '❓'} Status: *${payment.status.toUpperCase()}*\n` +
          `📅 Dibuat: ${new Date(payment.created_at).toLocaleString('id-ID')}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Last 5 orders
        const payments = await queryAll(
          'SELECT order_id, package_id, amount, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
          [link.user_id]
        );

        if (!payments.length) {
          await bot.sendMessage(chatId, '📭 Belum ada transaksi. Gunakan /buy untuk beli kredit.');
          return;
        }

        let text = '📋 *5 Transaksi Terakhir*\n\n';
        for (const p of payments) {
          const emoji = p.status === 'settlement' || p.status === 'capture' ? '✅' : p.status === 'pending' ? '⏳' : '❌';
          text += `${emoji} \`${p.order_id}\`\n   ${p.package_id} — Rp ${p.amount.toLocaleString('id-ID')} — *${p.status}*\n\n`;
        }

        text += 'Detail: `/status <order_id>`';
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.error('[TelegramBot] /status error:', err);
      await bot.sendMessage(chatId, '⚠️ Gagal mengambil status. Silakan coba lagi.');
    }
  }

  /**
   * /help
   */
  static async _handleHelp(msg) {
    await bot.sendMessage(msg.chat.id,
      `🤖 *Moltbook Bot — Help*\n\n` +
      `/start — Hubungkan akun Moltbook\n` +
      `/balance — Cek saldo kredit\n` +
      `/buy — Beli paket kredit\n` +
      `/status — Cek status pembayaran\n` +
      `/help — Tampilkan bantuan ini\n\n` +
      `Butuh bantuan? Hubungi support@moltbook.com`,
      { parse_mode: 'Markdown' }
    );
  }

  // ─── NOTIFICATIONS ───────────────────────────────────────────

  /**
   * Send payment success notification
   */
  static async notifyPaymentSuccess(userId, orderId, credits, newBalance) {
    const chatId = await this._getChatId(userId);
    if (!chatId || !bot) return;

    await bot.sendMessage(chatId,
      `🎉 *Pembayaran Berhasil!*\n\n` +
      `🆔 Order: \`${orderId}\`\n` +
      `💎 Kredit ditambahkan: +${credits.toLocaleString()}\n` +
      `💰 Saldo sekarang: ${newBalance.toLocaleString()} credits`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Send low balance warning
   */
  static async notifyLowBalance(userId, balance, threshold = 10) {
    const chatId = await this._getChatId(userId);
    if (!chatId || !bot) return;

    await bot.sendMessage(chatId,
      `⚠️ *Saldo Kredit Rendah!*\n\n` +
      `Saldo kamu tinggal *${balance} credits*.\n` +
      `Top-up sekarang supaya tetap bisa pakai LLM.\n\n` +
      `Ketik /buy untuk beli kredit.`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Send generic notification
   */
  static async notify(userId, message) {
    const chatId = await this._getChatId(userId);
    if (!chatId || !bot) return;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  static async _getLinkedUser(telegramUserId) {
    return queryOne(
      'SELECT user_id FROM telegram_links WHERE telegram_user_id = $1',
      [telegramUserId]
    );
  }

  static async _getChatId(userId) {
    const link = await queryOne(
      'SELECT chat_id FROM telegram_links WHERE user_id = $1',
      [userId]
    );
    return link ? link.chat_id : null;
  }
}

module.exports = TelegramBotService;
