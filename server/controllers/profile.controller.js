const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { validatePasswordComplexity } = require('./auth.controller');

// GET /api/user/profile
function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = db.prepare(`
      SELECT id, name, email, role, avatar_url, bio, auth_provider, created_at
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

// PUT /api/user/profile
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

    // Validate name
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }
      updatedName = name.trim();
    }

    // Update bio
    if (bio !== undefined) {
      updatedBio = typeof bio === 'string' ? bio.trim() : '';
    }

    // Update avatar_url
    if (avatar_url !== undefined) {
      updatedAvatarUrl = typeof avatar_url === 'string' ? avatar_url.trim() : null;
    }

    // Validate email
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

    // Update password if provided
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

// GET /api/user/saved-blogs
function getSavedBlogs(req, res) {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT 
        b.id, b.title, b.slug, b.body, b.cover_image, b.status, 
        b.created_at, b.updated_at, b.author_id, b.edition, b.video_url,
        u.name as author_name, u.email as author_email,
        sb.created_at as saved_at,
        (SELECT COUNT(*) FROM likes l WHERE l.blog_id = b.id) as like_count
      FROM saved_blogs sb
      JOIN blogs b ON sb.blog_id = b.id
      JOIN users u ON b.author_id = u.id
      WHERE sb.user_id = ?
      ORDER BY sb.created_at DESC
    `).all(userId);

    res.status(200).json({
      savedBlogs: rows,
      count: rows.length
    });
  } catch (err) {
    console.error('Error fetching saved blogs:', err);
    res.status(500).json({ error: 'Failed to retrieve saved articles.' });
  }
}

// Helper to check blog existence and access
function getAccessibleBlog(blogIdOrSlug, currentUser) {
  let blog = null;
  if (/^\d+$/.test(blogIdOrSlug)) {
    blog = db.prepare('SELECT id, title, slug, status, author_id FROM blogs WHERE id = ?').get(parseInt(blogIdOrSlug, 10));
  } else {
    blog = db.prepare('SELECT id, title, slug, status, author_id FROM blogs WHERE slug = ?').get(blogIdOrSlug);
  }

  if (!blog) return null;

  const isAdmin = currentUser && currentUser.role === 'admin';
  const isAuthor = currentUser && currentUser.id === blog.author_id;
  if (blog.status !== 'published' && !isAdmin && !isAuthor) {
    return null; // Unpublished and not accessible
  }

  return blog;
}

// POST /api/user/saved-blogs/:blogId
function saveBlog(req, res) {
  try {
    const userId = req.user.id;
    const blogParam = req.params.blogId;
    const blog = getAccessibleBlog(blogParam, req.user);

    if (!blog) {
      return res.status(404).json({ error: 'Cannot save unavailable or non-existent article.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO saved_blogs (user_id, blog_id)
      VALUES (?, ?)
    `).run(userId, blog.id);

    res.status(200).json({
      message: 'Article saved to bookmarks.',
      saved: true,
      blogId: blog.id
    });
  } catch (err) {
    console.error('Error saving blog:', err);
    res.status(500).json({ error: 'Failed to save article.' });
  }
}

// DELETE /api/user/saved-blogs/:blogId
function unsaveBlog(req, res) {
  try {
    const userId = req.user.id;
    const blogParam = req.params.blogId;
    let blogId = parseInt(blogParam, 10);

    if (isNaN(blogId)) {
      const b = db.prepare('SELECT id FROM blogs WHERE slug = ?').get(blogParam);
      if (b) blogId = b.id;
    }

    db.prepare(`
      DELETE FROM saved_blogs
      WHERE user_id = ? AND blog_id = ?
    `).run(userId, blogId);

    res.status(200).json({
      message: 'Article removed from bookmarks.',
      saved: false,
      blogId
    });
  } catch (err) {
    console.error('Error unsaving blog:', err);
    res.status(500).json({ error: 'Failed to remove saved article.' });
  }
}

// POST /api/user/saved-blogs/:blogId/toggle
function toggleSaveBlog(req, res) {
  try {
    const userId = req.user.id;
    const blogParam = req.params.blogId;
    const blog = getAccessibleBlog(blogParam, req.user);

    if (!blog) {
      return res.status(404).json({ error: 'Cannot save unavailable or non-existent article.' });
    }

    const existing = db.prepare('SELECT id FROM saved_blogs WHERE user_id = ? AND blog_id = ?').get(userId, blog.id);

    if (existing) {
      db.prepare('DELETE FROM saved_blogs WHERE id = ?').run(existing.id);
      return res.status(200).json({
        message: 'Article removed from bookmarks.',
        saved: false,
        blogId: blog.id
      });
    } else {
      db.prepare('INSERT INTO saved_blogs (user_id, blog_id) VALUES (?, ?)').run(userId, blog.id);
      return res.status(200).json({
        message: 'Article saved to bookmarks.',
        saved: true,
        blogId: blog.id
      });
    }
  } catch (err) {
    console.error('Error toggling save status:', err);
    res.status(500).json({ error: 'Failed to update saved status.' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getSavedBlogs,
  saveBlog,
  unsaveBlog,
  toggleSaveBlog
};
