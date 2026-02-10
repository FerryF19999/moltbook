/**
 * Auth Routes - Register & Login
 */

const { Router } = require('express');
const UserService = require('../services/UserService');
const { isValidEmail } = require('../middleware/validate');
const { auditLog, LOG_LEVELS } = require('../utils/auditLog');
const { rateLimit } = require('../middleware/rateLimit');

const router = Router();

const authLimiter = rateLimit('auth', {
  message: 'Too many login attempts. Try again later.',
  keyGenerator: (req) => `rl:auth:${req.ip}`,
});

const registerLimiter = rateLimit('register', {
  message: 'Too many registrations. Try again later.',
  keyGenerator: (req) => `rl:register:${req.ip}`,
});

// POST /api/v1/auth/register
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password too long' });
    }
    if (name && (name.length < 2 || name.length > 50)) {
      return res.status(400).json({ success: false, error: 'Name must be 2-50 characters' });
    }
    const user = await UserService.register(email, password, name);
    const { token } = await UserService.login(email, password);
    await auditLog('user_register', { level: LOG_LEVELS.INFO, ip: req.ip, metadata: { email } });
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const result = await UserService.login(email, password);
    await auditLog('user_login', { level: LOG_LEVELS.INFO, userId: result.user.id, ip: req.ip });
    res.json({ success: true, data: result });
  } catch (err) {
    await auditLog('login_failed', { level: LOG_LEVELS.WARN, ip: req.ip, metadata: { email: req.body?.email } });
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

module.exports = router;
