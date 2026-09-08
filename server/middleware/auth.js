const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'blog-platform-super-secret-jwt-key-2026';

function authenticate(req, res, next) {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(decoded.id);
    req.user = user || null;
  } catch (err) {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in to perform this action.'
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in as an administrator.'
    });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden. Administrator privileges are required for this action.'
    });
  }
  next();
}

function requireOwnerOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in to perform this action.'
    });
  }
  if (req.user.role === 'admin') {
    return next();
  }
  const blogId = req.params.id || req.params.blogId;
  const blog = db.prepare('SELECT author_id FROM blogs WHERE id = ?').get(blogId);
  if (!blog) {
    return res.status(404).json({ error: 'Blog not found.' });
  }
  if (blog.author_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden. You do not have permission to modify this article.' });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  requireOwnerOrAdmin,
  generateToken,
  JWT_SECRET
};
