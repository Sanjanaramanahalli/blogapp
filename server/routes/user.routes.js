const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireAdmin } = require('../middleware/auth');

// All admin routes require admin privileges
router.use(requireAdmin);

router.get('/overview', userController.getAdminOverview);
router.get('/users', userController.getAllUsers);
router.delete('/users/:id', userController.deleteUser);
router.get('/comments', userController.getAllCommentsForModeration);

module.exports = router;
