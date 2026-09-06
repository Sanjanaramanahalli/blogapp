const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/comment.controller');
const { requireAuth } = require('../middleware/auth');

// Routes mounted under /api/blogs/:blogId/comments
router.get('/', commentController.getBlogComments);
router.post('/', requireAuth, commentController.createComment);

module.exports = router;
