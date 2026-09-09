const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth');

// All profile and saved-blogs endpoints require authentication
router.use(requireAuth);

router.get('/profile', profileController.getProfile);
router.put('/profile', profileController.updateProfile);

router.get('/saved-blogs', profileController.getSavedBlogs);
router.post('/saved-blogs/:blogId', profileController.saveBlog);
router.delete('/saved-blogs/:blogId', profileController.unsaveBlog);
router.post('/saved-blogs/:blogId/toggle', profileController.toggleSaveBlog);

module.exports = router;
