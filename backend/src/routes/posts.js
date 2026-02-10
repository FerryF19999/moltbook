/**
 * Post Routes
 * /api/v1/posts/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { postLimiter, commentLimiter } = require('../middleware/rateLimit');
const { success, created, noContent, paginated } = require('../utils/response');
const PostService = require('../services/PostService');
const CommentService = require('../services/CommentService');
const VoteService = require('../services/VoteService');
const { validateIdParam } = require('../middleware/validate');
const config = require('../config');

const router = Router();

// Validate ID params on all /:id routes
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-f-]{36}$|^\d+$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }
  next();
});

/**
 * GET /posts
 * Get feed (all posts)
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { sort = 'hot', limit = 25, offset = 0, submolt } = req.query;
  
  const posts = await PostService.getFeed({
    sort,
    limit: Math.min(parseInt(limit, 10), config.pagination.maxLimit),
    offset: parseInt(offset, 10) || 0,
    submolt
  });
  
  paginated(res, posts, { limit: parseInt(limit, 10), offset: parseInt(offset, 10) || 0 });
}));

/**
 * POST /posts
 * Create a new post
 */
router.post('/', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const { submolt, title, content, url } = req.body;
  
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }
  if (title.length > 300) {
    return res.status(400).json({ success: false, error: 'Title must be 300 characters or less' });
  }
  if (content && content.length > 40000) {
    return res.status(400).json({ success: false, error: 'Content too long (max 40000 chars)' });
  }
  if (url && !/^https?:\/\/.+/.test(url)) {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }
  
  const post = await PostService.create({
    authorId: req.agent.id,
    submolt,
    title,
    content,
    url
  });
  
  created(res, { post });
}));

/**
 * GET /posts/:id
 * Get a single post
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const post = await PostService.findById(req.params.id);
  
  // Get user's vote on this post
  const userVote = await VoteService.getVote(req.agent.id, post.id, 'post');
  
  success(res, { 
    post: {
      ...post,
      userVote
    }
  });
}));

/**
 * DELETE /posts/:id
 * Delete a post
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await PostService.delete(req.params.id, req.agent.id);
  noContent(res);
}));

/**
 * POST /posts/:id/upvote
 * Upvote a post
 */
router.post('/:id/upvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.upvotePost(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * POST /posts/:id/downvote
 * Downvote a post
 */
router.post('/:id/downvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.downvotePost(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * GET /posts/:id/comments
 * Get comments on a post
 */
router.get('/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const { sort = 'top', limit = 100 } = req.query;
  
  const comments = await CommentService.getByPost(req.params.id, {
    sort,
    limit: Math.min(parseInt(limit, 10), 500)
  });
  
  success(res, { comments });
}));

/**
 * POST /posts/:id/comments
 * Add a comment to a post
 */
router.post('/:id/comments', requireAuth, commentLimiter, asyncHandler(async (req, res) => {
  const { content, parent_id } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'Comment content is required' });
  }
  if (content.length > 10000) {
    return res.status(400).json({ success: false, error: 'Comment too long (max 10000 chars)' });
  }
  
  const comment = await CommentService.create({
    postId: req.params.id,
    authorId: req.agent.id,
    content,
    parentId: parent_id
  });
  
  created(res, { comment });
}));

module.exports = router;
