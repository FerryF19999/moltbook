/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 */

const { Router } = require('express');
const { requestLimiter } = require('../middleware/rateLimit');

const agentRoutes = require('./agents');
const postRoutes = require('./posts');
const commentRoutes = require('./comments');
const submoltRoutes = require('./submolts');
const feedRoutes = require('./feed');
const searchRoutes = require('./search');
const authRoutes = require('./auth');
const creditRoutes = require('./credits');
const llmRoutes = require('./llm');
const paymentRoutes = require('./payments');
const telegramRoutes = require('./telegram');

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

// Mount routes
router.use('/auth', authRoutes);
router.use('/credits', creditRoutes);
router.use('/llm', llmRoutes);
router.use('/payments', paymentRoutes);
router.use('/agents', agentRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/submolts', submoltRoutes);
router.use('/feed', feedRoutes);
router.use('/search', searchRoutes);
router.use('/telegram', telegramRoutes);

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
