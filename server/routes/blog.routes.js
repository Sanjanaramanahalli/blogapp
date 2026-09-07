const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const likeController = require('../controllers/like.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

// Public routes
router.get('/', blogController.getAllBlogs);
router.get('/taxonomy', blogController.getTaxonomy);
router.get('/:slugOrId', blogController.getBlogBySlugOrId);

// Community Engagement (Like / Unlike)
router.get('/:id/likes', (req, res, next) => {
  req.params.blogId = req.params.id;
  next();
}, likeController.getLikes);

router.post('/:id/like', requireAuth, (req, res, next) => {
  req.params.blogId = req.params.id;
  next();
}, likeController.toggleLike);

// Admin-only management routes
router.post('/', requireAdmin, blogController.createBlog);
router.put('/:id', requireAdmin, blogController.updateBlog);
router.patch('/:id/status', requireAdmin, blogController.togglePublishStatus);
router.delete('/:id', requireAdmin, blogController.deleteBlog);

module.exports = router;
