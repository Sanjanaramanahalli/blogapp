const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);

// Password recovery with OTP routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);

// Google OAuth routes
router.get('/google', authController.googleAuthInit);
router.get('/google/callback', authController.googleAuthCallback);
router.get('/google/screen', authController.renderGoogleAuthScreen);
router.post('/google/authenticate', authController.googleMockAuthenticate);

module.exports = router;
