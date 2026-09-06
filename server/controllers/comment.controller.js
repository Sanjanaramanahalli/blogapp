const { db } = require('../db/database');

// Helper to construct a recursive tree from flat comments list
function buildCommentTree(flatComments) {
  const commentMap = {};
  const rootComments = [];

  // Initialize nodes
  flatComments.forEach(c => {
    commentMap[c.id] = {
      ...c,
      replies: []
    };
  });

  // Link children to parents
  flatComments.forEach(c => {
    if (c.parent_id && commentMap[c.parent_id]) {
      commentMap[c.parent_id].replies.push(commentMap[c.id]);
    } else {
      rootComments.push(commentMap[c.id]);
    }
  });

  return rootComments;
}

// GET /api/blogs/:blogId/comments
function getBlogComments(req, res) {
  try {
    const { blogId } = req.params;

    const blog = db.prepare('SELECT id, status FROM blogs WHERE id = ?').get(blogId);
    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    const flatComments = db.prepare(`
      SELECT 
        c.id, c.blog_id, c.user_id, c.parent_id, c.content, 
        c.created_at, c.updated_at,
        u.name as user_name, u.role as user_role, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.blog_id = ?
      ORDER BY c.created_at ASC
    `).all(blogId);

    const tree = buildCommentTree(flatComments);

    res.status(200).json({
      comments: tree,
      totalCount: flatComments.length
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
}

// POST /api/blogs/:blogId/comments
function createComment(req, res) {
  try {
    const { blogId } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    const blog = db.prepare('SELECT id, status FROM blogs WHERE id = ?').get(blogId);
    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    if (blog.status === 'draft' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot comment on an unpublished draft post.' });
    }

    // Verify parent comment if this is a reply
    let validParentId = null;
    if (parent_id) {
      const parent = db.prepare('SELECT id, blog_id FROM comments WHERE id = ?').get(parent_id);
      if (!parent) {
        return res.status(404).json({ error: 'Parent comment to reply to was not found.' });
      }
      if (parent.blog_id !== parseInt(blogId, 10)) {
        return res.status(400).json({ error: 'Parent comment belongs to a different blog.' });
      }
      validParentId = parent.id;
    }

    const insertResult = db.prepare(`
      INSERT INTO comments (blog_id, user_id, parent_id, content)
      VALUES (?, ?, ?, ?)
    `).run(blogId, userId, validParentId, content.trim());

    const created = db.prepare(`
      SELECT 
        c.id, c.blog_id, c.user_id, c.parent_id, c.content, 
        c.created_at, c.updated_at,
        u.name as user_name, u.role as user_role, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(insertResult.lastInsertRowid);

    res.status(201).json({
      message: validParentId ? 'Reply posted successfully.' : 'Comment posted successfully.',
      comment: {
        ...created,
        replies: []
      }
    });
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
}

// PUT /api/comments/:id (Author only edit)
function updateComment(req, res) {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Only the author can edit their own comment
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments.' });
    }

    db.prepare(`
      UPDATE comments 
      SET content = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(content.trim(), id);

    const updated = db.prepare(`
      SELECT 
        c.id, c.blog_id, c.user_id, c.parent_id, c.content, 
        c.created_at, c.updated_at,
        u.name as user_name, u.role as user_role, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id);

    res.status(200).json({
      message: 'Comment updated successfully.',
      comment: updated
    });
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Failed to update comment.' });
  }
}

// DELETE /api/comments/:id (Author or Admin delete with cascade)
function deleteComment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Permission check: Author or Admin
    const isAuthor = comment.user_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to delete this comment.' });
    }

    // Count child replies that will be cascaded
    const repliesCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id = ?').get(id).count;

    // Execute deletion (SQLite foreign key ON DELETE CASCADE deletes all children recursively)
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);

    res.status(200).json({
      message: repliesCount > 0
        ? `Comment and its ${repliesCount} reply/replies were deleted.`
        : 'Comment deleted successfully.',
      deletedCommentId: parseInt(id, 10),
      blogId: comment.blog_id
    });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
}

module.exports = {
  getBlogComments,
  createComment,
  updateComment,
  deleteComment
};
