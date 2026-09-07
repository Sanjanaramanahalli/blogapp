const { db } = require('../db/database');

// Atomic Toggle function for node:sqlite
function performToggleLike(targetBlogId, targetUserId, userRole) {
  const blog = db.prepare('SELECT id, status FROM blogs WHERE id = ?').get(targetBlogId);
  if (!blog) {
    return { error: 'Blog not found.', status: 404 };
  }

  if (blog.status === 'draft' && userRole !== 'admin') {
    return { error: 'Cannot like an unpublished draft post.', status: 403 };
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    const existing = db.prepare('SELECT id FROM likes WHERE blog_id = ? AND user_id = ?').get(targetBlogId, targetUserId);

    let liked = false;
    if (existing) {
      // Unlike
      db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      liked = false;
    } else {
      // Like (with race condition protection on UNIQUE constraint)
      try {
        db.prepare('INSERT INTO likes (blog_id, user_id) VALUES (?, ?)').run(targetBlogId, targetUserId);
        liked = true;
      } catch (uniqueErr) {
        if (uniqueErr.message && uniqueErr.message.includes('UNIQUE constraint failed')) {
          liked = true;
        } else {
          throw uniqueErr;
        }
      }
    }

    db.exec('COMMIT;');

    const totalLikes = db.prepare('SELECT COUNT(*) as count FROM likes WHERE blog_id = ?').get(targetBlogId).count;

    return {
      liked,
      likeCount: totalLikes
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {
      // Transaction already ended or rolled back
    }
    throw err;
  }
}

// Toggle like/unlike on a blog post
function toggleLike(req, res) {
  try {
    const blogId = req.params.blogId || req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = performToggleLike(blogId, userId, userRole);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.status(200).json({
      message: result.liked ? 'Blog liked.' : 'Blog unliked.',
      liked: result.liked,
      likeCount: result.likeCount
    });
  } catch (err) {
    console.error('Error toggling like:', err);
    res.status(500).json({ error: 'Failed to update like status.' });
  }
}

// Get likes summary for a blog post
function getLikes(req, res) {
  try {
    const blogId = req.params.blogId || req.params.id;
    const currentUserId = req.user ? req.user.id : null;

    const totalLikes = db.prepare('SELECT COUNT(*) as count FROM likes WHERE blog_id = ?').get(blogId).count;
    let userLiked = false;

    if (currentUserId) {
      const existing = db.prepare('SELECT id FROM likes WHERE blog_id = ? AND user_id = ?').get(blogId, currentUserId);
      userLiked = !!existing;
    }

    res.status(200).json({
      likeCount: totalLikes,
      userLiked
    });
  } catch (err) {
    console.error('Error fetching likes:', err);
    res.status(500).json({ error: 'Failed to retrieve likes.' });
  }
}

module.exports = {
  toggleLike,
  getLikes
};
