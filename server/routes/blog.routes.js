const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const likeController = require('../controllers/like.controller');
const { requireAdmin, requireAuth, requireOwnerOrAdmin } = require('../middleware/auth');

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

// Publishing & Author/Admin management routes
router.post('/', requireAuth, blogController.createBlog);
router.put('/:id', requireOwnerOrAdmin, blogController.updateBlog);
router.patch('/:id/status', requireOwnerOrAdmin, blogController.togglePublishStatus);
router.delete('/:id', requireOwnerOrAdmin, blogController.deleteBlog);

module.exports = router;
