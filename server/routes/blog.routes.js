const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', blogController.getAllBlogs);
router.get('/taxonomy', blogController.getTaxonomy);
router.get('/:slugOrId', blogController.getBlogBySlugOrId);

// Admin-only management routes
router.post('/', requireAdmin, blogController.createBlog);
router.put('/:id', requireAdmin, blogController.updateBlog);
router.patch('/:id/status', requireAdmin, blogController.togglePublishStatus);
router.delete('/:id', requireAdmin, blogController.deleteBlog);

module.exports = router;
