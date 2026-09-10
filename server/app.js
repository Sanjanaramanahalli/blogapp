require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { authenticate } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const blogRoutes = require('./routes/blog.routes');
const commentRoutes = require('./routes/comment.routes');
const directCommentRoutes = require('./routes/direct-comment.routes');
const likeRoutes = require('./routes/like.routes');
const userRoutes = require('./routes/user.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileRoutes = require('./routes/profile.routes');

const app = express();

// Dynamic production-ready CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production' || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global session authentication extractor
app.use(authenticate);

// Serve static assets from public/
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));

// Dynamic handler for uploaded media (serves from public/uploads, /tmp/uploads, or SQLite database)
app.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const localFile = path.join(PUBLIC_DIR, 'uploads', filename);
  if (fs.existsSync(localFile)) {
    return res.sendFile(localFile);
  }
  const tmpFile = path.join('/tmp', 'uploads', filename);
  if (fs.existsSync(tmpFile)) {
    return res.sendFile(tmpFile);
  }
  try {
    const { db } = require('./db/database');
    const row = db.prepare('SELECT mimetype, data FROM uploaded_files WHERE filename = ?').get(filename);
    if (row && row.data) {
      res.setHeader('Content-Type', row.mimetype || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(row.data));
    }
  } catch (err) {
    console.warn('Error reading uploaded file from db:', err.message);
  }
  res.status(404).send('Image not found.');
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/blogs/:blogId/comments', commentRoutes);
app.use('/api/blogs/:blogId/likes', likeRoutes);
app.use('/api/comments', directCommentRoutes);
app.use('/api/admin', userRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/uploads', uploadRoutes);

// Single Page HTML route mappings
app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/write', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'write.html'));
});

app.get('/presentation', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'presentation.html'));
});

app.get('/blog/:slug', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'blog.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Health check endpoint for Render monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Fallback to home page
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction 
    ? 'An unexpected internal server error occurred.' 
    : (err.message || 'Internal server error.');
  res.status(err.status || 500).json({ error: errorMessage });
});

module.exports = app;
