const { db } = require('../db/database');

// GET /api/admin/overview
function getAdminOverview(req, res) {
  try {
    const totalBlogs = db.prepare('SELECT COUNT(*) as count FROM blogs').get().count;
    const publishedBlogs = db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'published'").get().count;
    const draftBlogs = db.prepare("SELECT COUNT(*) as count FROM blogs WHERE status = 'draft'").get().count;
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'reader'").get().count;
    const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count;
    const totalLikes = db.prepare('SELECT COUNT(*) as count FROM likes').get().count;

    const recentBlogs = db.prepare(`
      SELECT b.id, b.title, b.slug, b.status, b.created_at,
             (SELECT COUNT(*) FROM comments c WHERE c.blog_id = b.id) as comment_count,
             (SELECT COUNT(*) FROM likes l WHERE l.blog_id = b.id) as like_count
      FROM blogs b
      ORDER BY b.created_at DESC
      LIMIT 5
    `).all();

    const recentComments = db.prepare(`
      SELECT c.id, c.content, c.created_at, u.name as user_name, b.title as blog_title, b.slug as blog_slug
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN blogs b ON c.blog_id = b.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `).all();

    res.status(200).json({
      stats: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalUsers,
        totalComments,
        totalLikes
      },
      recentBlogs,
      recentComments
    });
  } catch (err) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: 'Failed to retrieve admin dashboard overview.' });
  }
}

// GET /api/admin/users
function getAllUsers(req, res) {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, u.name, u.email, u.role, u.created_at,
        (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) as comment_count,
        (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id) as like_count
      FROM users u
      ORDER BY u.role ASC, u.created_at DESC
    `).all();

    res.status(200).json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

// DELETE /api/admin/users/:id
function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    if (parseInt(id, 10) === currentUserId) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }

    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Cascade deletion removes user's comments and likes automatically
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.status(200).json({
      message: `User account "${user.name}" was successfully deleted along with their comments and likes.`
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
}

// GET /api/admin/comments (Moderation view across all blogs)
function getAllCommentsForModeration(req, res) {
  try {
    const comments = db.prepare(`
      SELECT 
        c.id, c.content, c.created_at, c.parent_id,
        u.name as user_name, u.email as user_email,
        b.id as blog_id, b.title as blog_title, b.slug as blog_slug
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN blogs b ON c.blog_id = b.id
      ORDER BY c.created_at DESC
    `).all();

    res.status(200).json({ comments });
  } catch (err) {
    console.error('Error fetching comments for moderation:', err);
    res.status(500).json({ error: 'Failed to retrieve comments for moderation.' });
  }
}

module.exports = {
  getAdminOverview,
  getAllUsers,
  deleteUser,
  getAllCommentsForModeration
};
