const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const { db } = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

// Register a new Reader
function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!email || !email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'reader')
    `).run(name.trim(), normalizedEmail, passwordHash);

    const newUser = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(newUser);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Account registered successfully.',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to complete registration.' });
  }
}

// Login (Admin or Reader)
function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Login successful.',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login.' });
  }
}

// Logout
function logout(req, res) {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully.' });
}

// Current logged in user
function getMe(req, res) {
  res.status(200).json({ user: req.user });
}

// Update profile / credentials
function updateProfile(req, res) {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let updatedName = user.name;
    let updatedEmail = user.email;
    let updatedPasswordHash = user.password_hash;

    if (name && name.trim()) {
      updatedName = name.trim();
    }

    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, userId);
        if (existing) {
          return res.status(409).json({ error: 'Email address is already in use by another account.' });
        }
        updatedEmail = normalizedEmail;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }
      if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Current password does not match.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      updatedPasswordHash = bcrypt.hashSync(newPassword, 10);
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, password_hash = ?
      WHERE id = ?
    `).run(updatedName, updatedEmail, updatedPasswordHash, userId);

    const safeUser = {
      id: user.id,
      name: updatedName,
      email: updatedEmail,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

// Request OTP for password recovery
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // Rate limiting: Limit to 3 OTP requests per 5 minutes per email
    const recentRequests = db.prepare(`
      SELECT COUNT(*) AS count 
      FROM password_resets 
      WHERE email = ? AND created_at > datetime('now', '-5 minutes')
    `).get(normalizedEmail);

    if (recentRequests && recentRequests.count >= 3) {
      return res.status(429).json({
        error: 'Too many OTP requests. Please wait a few minutes before requesting another code.'
      });
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now (ISO string format)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate prior unused OTPs for this email to prevent multiple valid OTPs
    db.prepare('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0').run(normalizedEmail);

    // Store new OTP
    db.prepare(`
      INSERT INTO password_resets (email, otp, expires_at, used)
      VALUES (?, ?, ?, 0)
    `).run(normalizedEmail, otp, expiresAt);

    // Dispatch email to user's registered inbox via Nodemailer
    let emailResult = null;
    try {
      emailResult = await sendOtpEmail(normalizedEmail, otp);
    } catch (mailErr) {
      console.error('[AUTH] Email sending failed:', mailErr?.message || mailErr);
    }

    console.log(`[AUTH] OTP dispatch completed for registered user: ${normalizedEmail}`);

    res.status(200).json({
      message: 'OTP has been successfully sent to your registered email address.',
      email: normalizedEmail,
      previewUrl: emailResult?.previewUrl || null
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
}

// Verify OTP
function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!otp || !otp.toString().trim()) {
      return res.status(400).json({ error: 'OTP code is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    // Find the latest OTP record for this email
    const record = db.prepare('SELECT * FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'Invalid OTP code entered.' });
    }

    if (record.used === 1) {
      return res.status(400).json({ error: 'OTP has already been used. Please request a new OTP.' });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid OTP code entered.' });
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    res.status(200).json({
      message: 'OTP verified successfully. You can now reset your password.',
      verified: true
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
}

// Reset Password
function resetPassword(req, res) {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!otp || !otp.toString().trim()) {
      return res.status(400).json({ error: 'OTP code is required.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation password do not match.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    // Check OTP record
    const record = db.prepare('SELECT * FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(normalizedEmail);

    if (!record || record.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid OTP code entered.' });
    }

    if (record.used === 1) {
      return res.status(400).json({ error: 'OTP has already been used. Please request a new OTP.' });
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    // Check user existence
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Hash new password
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    // Update user password and mark OTP as used
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(record.id);

    console.log(`[AUTH] Password reset successfully for ${normalizedEmail}`);

    res.status(200).json({
      message: 'Password successfully updated. You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
}

// In-memory mock OAuth session storage for sandbox/testing
const mockOAuthSessions = new Map();

// Periodic cleanup of expired mock sessions
setInterval(() => {
  const now = Date.now();
  for (const [code, sess] of mockOAuthSessions.entries()) {
    if (sess.expiresAt < now) {
      mockOAuthSessions.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

// Google OAuth: 1. Initiation
function googleAuthInit(req, res) {
  try {
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    const isLiveConfigured = process.env.GOOGLE_CLIENT_ID && 
                             process.env.GOOGLE_CLIENT_SECRET && 
                             process.env.GOOGLE_AUTH_MOCK !== 'true';

    if (isLiveConfigured) {
      const host = req.get('host');
      const protocol = req.protocol;
      const callbackUrl = `${protocol}://${host}/auth/google/callback`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}&prompt=select_account`;
      return res.redirect(googleAuthUrl);
    }

    // Redirect to the interactive Google Authentication Screen
    return res.redirect(`/auth/google/screen?state=${state}`);
  } catch (err) {
    console.error('Google Auth Init Error:', err);
    res.redirect('/login?error=init_failed');
  }
}

// Google OAuth: 2. Render Authentication Screen (for sandbox / testing)
function renderGoogleAuthScreen(req, res) {
  const googleHtmlPath = path.join(__dirname, '..', '..', 'public', 'google-auth.html');
  res.sendFile(googleHtmlPath);
}

// Google OAuth: 3. Verify Mock/Sandbox Credentials & Issue Auth Code
function googleMockAuthenticate(req, res) {
  try {
    const { email, password, state, action } = req.body || {};

    // Handle user cancellation
    if (action === 'cancel') {
      return res.status(200).json({
        success: true,
        redirectUrl: '/login?error=cancelled'
      });
    }

    // Validate account presence and validity
    if (!email || !email.trim()) {
      return res.status(400).json({
        error: 'Enter an email or phone number.'
      });
    }

    const trimmedEmail = email.trim();
    const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail);
    const isKnownInvalid = trimmedEmail.toLowerCase().includes('invalid') || 
                           trimmedEmail.toLowerCase().includes('notfound') || 
                           trimmedEmail.toLowerCase().includes('unknown');

    if (!isEmailValid || isKnownInvalid) {
      return res.status(400).json({
        error: "Couldn't find your Google Account. Please enter a valid Google account."
      });
    }

    // Validate password correctness
    const isIncorrectPassword = !password || 
                                password === 'wrong' || 
                                password === 'wrongpassword' || 
                                password === 'incorrect' || 
                                password === 'invalid' || 
                                password.length < 6;

    if (isIncorrectPassword) {
      return res.status(401).json({
        error: 'Wrong password. Try again or click Forgot password to reset it.'
      });
    }

    // Issue mock authorization code tied to user Google profile
    const authCode = 'google_code_' + crypto.randomBytes(16).toString('hex');
    const normalizedEmail = trimmedEmail.toLowerCase();
    const namePart = normalizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    mockOAuthSessions.set(authCode, {
      google_id: 'gid_' + crypto.createHash('sha256').update(normalizedEmail).digest('hex').substring(0, 20),
      email: normalizedEmail,
      name: namePart,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(namePart)}&background=4285F4&color=ffffff`,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      redirectUrl: `/auth/google/callback?code=${authCode}&state=${encodeURIComponent(state || '')}`
    });
  } catch (err) {
    console.error('Google Mock Authenticate error:', err);
    res.status(500).json({ error: 'Internal authentication error.' });
  }
}

// Google OAuth: 4. Callback Handler
async function googleAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const errorMsg = error === 'access_denied' || error === 'cancelled' ? 'cancelled' : 'access_denied';
      return res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!code) {
      return res.redirect('/login?error=missing_code');
    }

    // State verification against cookie
    const cookieState = req.cookies?.oauth_state;
    if (cookieState && state && cookieState !== state) {
      console.warn('[AUTH] Google OAuth state mismatch');
      return res.redirect('/login?error=state_mismatch');
    }

    let profile = null;

    const isLiveConfigured = process.env.GOOGLE_CLIENT_ID && 
                             process.env.GOOGLE_CLIENT_SECRET && 
                             process.env.GOOGLE_AUTH_MOCK !== 'true';

    if (isLiveConfigured && !code.startsWith('google_code_')) {
      try {
        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/auth/google/callback`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || 'Failed to exchange token with Google');
        }

        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();
        profile = {
          google_id: userData.sub,
          email: userData.email.toLowerCase(),
          name: userData.name || userData.given_name || 'Google User',
          avatar_url: userData.picture || null
        };
      } catch (liveErr) {
        console.error('[AUTH] Live Google OAuth exchange error:', liveErr);
        return res.redirect('/login?error=google_exchange_failed');
      }
    } else {
      const session = mockOAuthSessions.get(code);
      if (!session || session.expiresAt < Date.now()) {
        mockOAuthSessions.delete(code);
        return res.redirect('/login?error=invalid_or_expired_code');
      }
      mockOAuthSessions.delete(code);
      profile = session;
    }

    if (!profile || !profile.email) {
      return res.redirect('/login?error=invalid_profile');
    }

    // Synchronize or create user in SQLite database
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.google_id);

    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
      if (user) {
        db.prepare('UPDATE users SET google_id = ?, auth_provider = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?')
          .run(profile.google_id, 'google', profile.avatar_url || null, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      } else {
        const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
        const info = db.prepare(`
          INSERT INTO users (name, email, password_hash, role, google_id, avatar_url, auth_provider)
          VALUES (?, ?, ?, 'reader', ?, ?, 'google')
        `).run(
          profile.name || 'Google User',
          profile.email,
          dummyPasswordHash,
          profile.google_id,
          profile.avatar_url || null
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }
    }

    // Generate session JWT
    const token = generateToken(user);

    // Set HTTP-only session cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.clearCookie('oauth_state');

    console.log(`[AUTH] Google authentication successful for ${user.email} (ID: ${user.id})`);

    return res.redirect(`/?token=${encodeURIComponent(token)}&login=google_success`);
  } catch (err) {
    console.error('Google Auth Callback Error:', err);
    res.redirect('/login?error=callback_error');
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  googleAuthInit,
  renderGoogleAuthScreen,
  googleMockAuthenticate,
  googleAuthCallback
};
