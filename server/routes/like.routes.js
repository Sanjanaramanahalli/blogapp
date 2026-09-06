const express = require('express');
const router = express.Router({ mergeParams: true });
const likeController = require('../controllers/like.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/', likeController.getLikes);
router.post('/toggle', requireAuth, likeController.toggleLike);

module.exports = router;
