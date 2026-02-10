/**
 * Verification Routes - GitHub & Telegram verification
 */

const { Router } = require('express');
const { requireJwtAuth } = require('../middleware/jwtAuth');
const VerificationService = require('../services/VerificationService');
const { rateLimit } = require('../middleware/rateLimit');

const router = Router();

const verifyLimiter = rateLimit('verify', {
  message: 'Too many verification attempts. Try again later.',
  keyGenerator: (req) => `rl:verify:${req.ip}`,
});

/**
 * GET /api/v1/verify/status
 * Get verification status for current user
 */
router.get('/status', requireJwtAuth, async (req, res, next) => {
  try {
    const status = await VerificationService.getStatus(req.user.id);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/verify/github/token
 * Generate a verification token for GitHub Gist verification
 */
router.post('/github/token', requireJwtAuth, verifyLimiter, async (req, res, next) => {
  try {
    const token = await VerificationService.generateToken(req.user.id, 'github');
    res.json({
      success: true,
      data: {
        token,
        instructions: [
          '1. Go to https://gist.github.com',
          '2. Create a new public Gist',
          '3. Paste the token below as the content',
          '4. Save the Gist',
          '5. Come back and submit the Gist URL',
        ],
        expiresInMinutes: 30,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/verify/github
 * Verify GitHub by checking Gist contains token
 * Body: { gistUrl: string }
 */
router.post('/github', requireJwtAuth, verifyLimiter, async (req, res, next) => {
  try {
    const { gistUrl } = req.body;
    if (!gistUrl) {
      return res.status(400).json({ success: false, error: 'gistUrl is required' });
    }

    const result = await VerificationService.verifyGithub(req.user.id, gistUrl);
    res.json({
      success: true,
      data: {
        verified: true,
        githubUsername: result.githubUsername,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

/**
 * POST /api/v1/verify/telegram/token
 * Generate a verification token for Telegram verification
 */
router.post('/telegram/token', requireJwtAuth, verifyLimiter, async (req, res, next) => {
  try {
    const token = await VerificationService.generateToken(req.user.id, 'telegram');
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MoltbookBot';
    res.json({
      success: true,
      data: {
        token,
        botUsername,
        deepLink: `https://t.me/${botUsername}?start=verify_${token}`,
        instructions: [
          `1. Open Telegram and find @${botUsername}`,
          `2. Send: /verify ${token}`,
          '3. The bot will confirm your verification',
        ],
        expiresInMinutes: 30,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/verify/telegram
 * Webhook callback from Telegram bot (internal use)
 * Body: { telegramUserId, telegramUsername, token }
 */
router.post('/telegram', verifyLimiter, async (req, res, next) => {
  try {
    const { telegramUserId, telegramUsername, token } = req.body;
    if (!telegramUserId || !token) {
      return res.status(400).json({ success: false, error: 'telegramUserId and token required' });
    }

    const result = await VerificationService.verifyTelegram(telegramUserId, telegramUsername, token);
    res.json({ success: true, data: { verified: true, userId: result.userId } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

/**
 * DELETE /api/v1/verify/:type
 * Disconnect a verification
 */
router.delete('/:type', requireJwtAuth, async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['github', 'telegram'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid verification type' });
    }

    await VerificationService.disconnect(req.user.id, type);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
