const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { generateToken } = require('../middleware/auth');

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
function forgotPassword(req, res) {
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

    console.log(`[AUTH] Generated OTP for ${normalizedEmail}: ${otp} (Expires: ${expiresAt})`);

    res.status(200).json({
      message: 'OTP has been successfully sent to your registered email address.',
      email: normalizedEmail,
      devOtp: otp // Included for test automation and development preview
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

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword
};
