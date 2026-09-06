const { db } = require('../db/database');

// Toggle like/unlike on a blog post
function toggleLike(req, res) {
  try {
    const { blogId } = req.params;
    const userId = req.user.id;

    const blog = db.prepare('SELECT id, status FROM blogs WHERE id = ?').get(blogId);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    if (blog.status === 'draft' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot like an unpublished draft post.' });
    }

    const existing = db.prepare('SELECT id FROM likes WHERE blog_id = ? AND user_id = ?').get(blogId, userId);

    let liked = false;
    if (existing) {
      // Unlike
      db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      liked = false;
    } else {
      // Like
      db.prepare('INSERT INTO likes (blog_id, user_id) VALUES (?, ?)').run(blogId, userId);
      liked = true;
    }

    const totalLikes = db.prepare('SELECT COUNT(*) as count FROM likes WHERE blog_id = ?').get(blogId).count;

    res.status(200).json({
      message: liked ? 'Blog liked.' : 'Blog unliked.',
      liked,
      likeCount: totalLikes
    });
  } catch (err) {
    console.error('Error toggling like:', err);
    res.status(500).json({ error: 'Failed to update like status.' });
  }
}

// Get likes summary for a blog post
function getLikes(req, res) {
  try {
    const { blogId } = req.params;
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
