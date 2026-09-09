require('dotenv').config();
const express = require('express');
const path = require('node:path');
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

// Standard middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global session authentication extractor
app.use(authenticate);

// Serve static assets from public/
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));

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
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

module.exports = app;
