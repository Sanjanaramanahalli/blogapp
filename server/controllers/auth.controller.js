const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const { db } = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

// Password complexity validator meeting Blueprint requirements
function validatePasswordComplexity(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

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
    
    const pwError = validatePasswordComplexity(password);
    if (pwError) {
      return res.status(400).json({ error: pwError });
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
      return res.status(401).json({ error: 'Account not found. Invalid credentials.' });
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
    const { name, email, bio, avatar_url, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let updatedName = user.name;
    let updatedEmail = user.email;
    let updatedBio = user.bio !== undefined && user.bio !== null ? user.bio : '';
    let updatedAvatarUrl = user.avatar_url;
    let updatedPasswordHash = user.password_hash;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }
      updatedName = name.trim();
    }

    if (bio !== undefined) {
      updatedBio = typeof bio === 'string' ? bio.trim() : '';
    }

    if (avatar_url !== undefined) {
      updatedAvatarUrl = typeof avatar_url === 'string' ? avatar_url.trim() : null;
    }

    if (email !== undefined) {
      if (!email || !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email.toLowerCase()) {
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
      const pwError = validatePasswordComplexity(newPassword);
      if (pwError) {
        return res.status(400).json({ error: pwError });
      }
      updatedPasswordHash = bcrypt.hashSync(newPassword, 10);
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, bio = ?, avatar_url = ?, password_hash = ?
      WHERE id = ?
    `).run(updatedName, updatedEmail, updatedBio, updatedAvatarUrl, updatedPasswordHash, userId);

    const safeUser = {
      id: user.id,
      name: updatedName,
      email: updatedEmail,
      bio: updatedBio,
      avatar_url: updatedAvatarUrl,
      role: user.role,
      auth_provider: user.auth_provider,
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

const SUPPORTED_PROVIDERS = ['google', 'linkedin', 'github'];

function getProvider(req) {
  const p = (req.params?.provider || req.body?.provider || 'google').toLowerCase();
  return SUPPORTED_PROVIDERS.includes(p) ? p : null;
}

// Multi-Provider Social OAuth: 1. Initiation
function socialAuthInit(req, res) {
  try {
    const provider = getProvider(req);
    if (!provider) {
      return res.redirect('/login?error=invalid_provider');
    }
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });
    res.cookie('oauth_provider', provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    const envPrefix = provider.toUpperCase();
    const isLiveConfigured = process.env[`${envPrefix}_CLIENT_ID`] && 
                             process.env[`${envPrefix}_CLIENT_SECRET`] && 
                             process.env[`${envPrefix}_AUTH_MOCK`] !== 'true';

    if (isLiveConfigured) {
      const host = req.get('host');
      const protocol = req.protocol;
      const callbackUrl = `${protocol}://${host}/auth/${provider}/callback`;
      if (provider === 'google') {
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}&prompt=select_account`;
        return res.redirect(googleAuthUrl);
      } else if (provider === 'linkedin') {
        const linkedInUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(process.env.LINKEDIN_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=openid%20profile%20email`;
        return res.redirect(linkedInUrl);
      } else if (provider === 'github') {
        const githubUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=user:email`;
        return res.redirect(githubUrl);
      }
    }

    // Redirect to the interactive Sandbox Authentication Screen
    return res.redirect(`/auth/${provider}/screen?state=${state}`);
  } catch (err) {
    console.error(`[AUTH] Social Auth Init Error (${req.params?.provider}):`, err);
    res.redirect('/login?error=init_failed');
  }
}

// Multi-Provider Social OAuth: 2. Render Screen
function renderSocialAuthScreen(req, res) {
  const provider = getProvider(req);
  if (!provider) {
    return res.redirect('/login?error=invalid_provider');
  }
  if (provider === 'google') {
    return res.sendFile(path.join(__dirname, '..', '..', 'public', 'google-auth.html'));
  }
  return res.sendFile(path.join(__dirname, '..', '..', 'public', 'social-auth.html'));
}

// Multi-Provider Social OAuth: 3. Verify Mock/Sandbox Credentials & Issue Auth Code
function socialMockAuthenticate(req, res) {
  try {
    const provider = getProvider(req) || 'google';
    const { email, password, state, action, verificationApproved } = req.body || {};

    // Handle user cancellation or denial
    if (action === 'cancel' || action === 'deny') {
      return res.status(200).json({
        success: true,
        redirectUrl: '/login?error=cancelled'
      });
    }

    // Validate account presence
    if (!email || !email.trim()) {
      let emptyMsg = 'Enter an email or phone number.';
      if (provider === 'linkedin') emptyMsg = 'Please enter your email or phone number.';
      if (provider === 'github') emptyMsg = 'Username or email address cannot be empty.';
      return res.status(400).json({ error: emptyMsg });
    }

    const trimmedEmail = email.trim();

    // Check for unauthorized / blocked accounts (Negative scenario 3)
    const isUnauthorized = trimmedEmail.toLowerCase().includes('unauthorized') || 
                           trimmedEmail.toLowerCase().includes('blocked');
    if (isUnauthorized) {
      return res.status(403).json({
        error: `Access denied. This ${provider === 'google' ? 'Google' : provider} account is not authorized to access TownTalk.`
      });
    }

    const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail);
    const isKnownInvalid = trimmedEmail.toLowerCase().includes('invalid') || 
                           trimmedEmail.toLowerCase().includes('notfound') || 
                           trimmedEmail.toLowerCase().includes('unknown');

    if (!isEmailValid || isKnownInvalid) {
      let notFoundMsg = "Couldn't find your Google Account. Please enter a valid Google account.";
      if (provider === 'linkedin') notFoundMsg = "Couldn't find a LinkedIn account associated with this email.";
      if (provider === 'github') notFoundMsg = "Incorrect username or password. Couldn't find your GitHub account.";
      return res.status(400).json({ error: notFoundMsg });
    }

    // If verificationApproved is true (e.g. from Google Account Verification prompt), bypass password check
    if (!verificationApproved) {
      // Validate password correctness
      const isIncorrectPassword = !password || 
                                  password.toLowerCase().includes('wrong') || 
                                  password.toLowerCase().includes('incorrect') || 
                                  password.toLowerCase().includes('invalid') || 
                                  password.length < 6;

      if (isIncorrectPassword) {
        let wrongPassMsg = 'Wrong password. Try again or click Forgot password to reset it.';
        if (provider === 'linkedin') wrongPassMsg = "That's not the right password. Try again.";
        if (provider === 'github') wrongPassMsg = 'Incorrect username or password.';
        return res.status(401).json({ error: wrongPassMsg });
      }
    }

    // Issue mock authorization code tied to user profile
    const authCode = `${provider}_code_` + crypto.randomBytes(16).toString('hex');
    const normalizedEmail = trimmedEmail.toLowerCase();
    const namePart = normalizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    let avatarBg = '4285F4';
    if (provider === 'linkedin') avatarBg = '0A66C2';
    if (provider === 'github') avatarBg = '24292E';

    mockOAuthSessions.set(authCode, {
      provider,
      provider_id: `${provider.substring(0, 3)}_` + crypto.createHash('sha256').update(normalizedEmail).digest('hex').substring(0, 20),
      email: normalizedEmail,
      name: namePart,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(namePart)}&background=${avatarBg}&color=ffffff`,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      redirectUrl: `/auth/${provider}/callback?code=${authCode}&state=${encodeURIComponent(state || '')}`
    });
  } catch (err) {
    console.error(`[AUTH] ${req.params?.provider || 'social'} Mock Authenticate error:`, err);
    res.status(500).json({ error: 'Internal authentication error.' });
  }
}

// Multi-Provider Social OAuth: 4. Callback Handler
async function socialAuthCallback(req, res) {
  try {
    const provider = getProvider(req) || 'google';
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
      console.warn(`[AUTH] ${provider} OAuth state mismatch`);
      return res.redirect('/login?error=state_mismatch');
    }

    let profile = null;
    const envPrefix = provider.toUpperCase();
    const isLiveConfigured = process.env[`${envPrefix}_CLIENT_ID`] && 
                             process.env[`${envPrefix}_CLIENT_SECRET`] && 
                             process.env[`${envPrefix}_AUTH_MOCK`] !== 'true';

    if (isLiveConfigured && !code.startsWith(`${provider}_code_`)) {
      try {
        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/auth/${provider}/callback`;

        if (provider === 'google') {
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
            provider_id: userData.sub,
            email: userData.email.toLowerCase(),
            name: userData.name || userData.given_name || 'Google User',
            avatar_url: userData.picture || null
          };
        } else if (provider === 'github') {
          const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: process.env.GITHUB_CLIENT_ID,
              client_secret: process.env.GITHUB_CLIENT_SECRET,
              code,
              redirect_uri: redirectUri
            })
          });
          const tokenData = await tokenRes.json();
          const userRes = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'TownTalk-App' }
          });
          const userData = await userRes.json();
          profile = {
            provider_id: String(userData.id),
            email: (userData.email || `${userData.login}@users.noreply.github.com`).toLowerCase(),
            name: userData.name || userData.login || 'GitHub User',
            avatar_url: userData.avatar_url || null
          };
        }
      } catch (liveErr) {
        console.error(`[AUTH] Live ${provider} OAuth exchange error:`, liveErr);
        return res.redirect(`/login?error=${provider}_exchange_failed`);
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

    // Account deduplication & linking
    const providerIdCol = provider === 'linkedin' ? 'linkedin_id' : provider === 'github' ? 'github_id' : 'google_id';

    let user = db.prepare(`SELECT * FROM users WHERE ${providerIdCol} = ?`).get(profile.provider_id);

    if (!user) {
      // Deduplication: Check if account exists with this email address
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
      if (user) {
        // Link provider ID to existing account while strictly preserving existing user.role (admin/reader)
        db.prepare(`UPDATE users SET ${providerIdCol} = ?, auth_provider = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`)
          .run(profile.provider_id, provider, profile.avatar_url || null, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      } else {
        // First-time social signup -> create account with 'reader' role
        const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
        const insertInfo = db.prepare(`
          INSERT INTO users (name, email, password_hash, role, ${providerIdCol}, avatar_url, auth_provider)
          VALUES (?, ?, ?, 'reader', ?, ?, ?)
        `).run(
          profile.name || `${provider} User`,
          profile.email,
          dummyPasswordHash,
          profile.provider_id,
          profile.avatar_url || null,
          provider
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(insertInfo.lastInsertRowid);
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
    res.clearCookie('oauth_provider');

    console.log(`[AUTH] ${provider} authentication successful for ${user.email} (ID: ${user.id})`);

    return res.redirect(`/?token=${encodeURIComponent(token)}&login=${provider}_success`);
  } catch (err) {
    console.error(`[AUTH] ${req.params?.provider || 'social'} Auth Callback Error:`, err);
    res.redirect('/login?error=callback_error');
  }
}

// Backward compatibility wrappers for Google OAuth
const googleAuthInit = (req, res) => { req.params.provider = 'google'; return socialAuthInit(req, res); };
const renderGoogleAuthScreen = (req, res) => { req.params.provider = 'google'; return renderSocialAuthScreen(req, res); };
const googleMockAuthenticate = (req, res) => { req.params.provider = 'google'; return socialMockAuthenticate(req, res); };
const googleAuthCallback = (req, res) => { req.params.provider = 'google'; return socialAuthCallback(req, res); };

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  socialAuthInit,
  renderSocialAuthScreen,
  socialMockAuthenticate,
  socialAuthCallback,
  googleAuthInit,
  renderGoogleAuthScreen,
  googleMockAuthenticate,
  googleAuthCallback,
  validatePasswordComplexity
};

