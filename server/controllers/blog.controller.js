const sanitizeHtml = require('sanitize-html');
const { db } = require('../db/database');

// Helper to generate a clean URL slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Sanitize rich text HTML
function cleanHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'u', 's', 'blockquote', 'code', 'pre', 'hr'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      a: ['href', 'name', 'target', 'rel'],
      code: ['class'],
      pre: ['class']
    },
    allowedSchemes: ['http', 'https', 'data']
  });
}

// Helper to attach categories and tags to blogs
function hydrateBlogs(blogs, currentUserId = null) {
  if (!blogs || blogs.length === 0) return [];

  const blogIds = blogs.map(b => b.id);
  const placeholders = blogIds.map(() => '?').join(',');

  // Categories
  const categoriesQuery = `
    SELECT bc.blog_id, c.id, c.name, c.slug
    FROM blog_categories bc
    JOIN categories c ON bc.category_id = c.id
    WHERE bc.blog_id IN (${placeholders})
  `;
  const catRows = db.prepare(categoriesQuery).all(...blogIds);

  // Tags
  const tagsQuery = `
    SELECT bt.blog_id, t.id, t.name, t.slug
    FROM blog_tags bt
    JOIN tags t ON bt.tag_id = t.id
    WHERE bt.blog_id IN (${placeholders})
  `;
  const tagRows = db.prepare(tagsQuery).all(...blogIds);

  // Likes counts
  const likesQuery = `
    SELECT blog_id, COUNT(*) as like_count
    FROM likes
    WHERE blog_id IN (${placeholders})
    GROUP BY blog_id
  `;
  const likeRows = db.prepare(likesQuery).all(...blogIds);

  // Comments counts
  const commentsQuery = `
    SELECT blog_id, COUNT(*) as comment_count
    FROM comments
    WHERE blog_id IN (${placeholders})
    GROUP BY blog_id
  `;
  const commentRows = db.prepare(commentsQuery).all(...blogIds);

  // User liked map
  let userLikedMap = new Set();
  if (currentUserId) {
    const userLikesQuery = `
      SELECT blog_id FROM likes WHERE user_id = ? AND blog_id IN (${placeholders})
    `;
    const userLikedRows = db.prepare(userLikesQuery).all(currentUserId, ...blogIds);
    userLikedRows.forEach(r => userLikedMap.add(r.blog_id));
  }

  // Maps
  const catMap = {};
  const tagMap = {};
  const likeMap = {};
  const commentMap = {};

  catRows.forEach(r => {
    if (!catMap[r.blog_id]) catMap[r.blog_id] = [];
    catMap[r.blog_id].push({ id: r.id, name: r.name, slug: r.slug });
  });

  tagRows.forEach(r => {
    if (!tagMap[r.blog_id]) tagMap[r.blog_id] = [];
    tagMap[r.blog_id].push({ id: r.id, name: r.name, slug: r.slug });
  });

  likeRows.forEach(r => {
    likeMap[r.blog_id] = r.like_count;
  });

  commentRows.forEach(r => {
    commentMap[r.blog_id] = r.comment_count;
  });

  return blogs.map(b => ({
    ...b,
    categories: catMap[b.id] || [],
    tags: tagMap[b.id] || [],
    like_count: likeMap[b.id] || 0,
    comment_count: commentMap[b.id] || 0,
    user_liked: currentUserId ? userLikedMap.has(b.id) : false
  }));
}

// GET /api/blogs (Public feed + Search + Filter + Pagination)
function getAllBlogs(req, res) {
  try {
    const {
      search,
      category,
      tag,
      status,
      page = 1,
      limit = 6,
      sort = 'newest'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 6));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Role-based status filtering
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      conditions.push("b.status = 'published'");
    } else if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    // Keyword Search (in title or body)
    if (search && search.trim()) {
      conditions.push('(b.title LIKE ? OR b.body LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Category Filter
    if (category && category.trim()) {
      conditions.push(`b.id IN (
        SELECT bc.blog_id FROM blog_categories bc
        JOIN categories c ON bc.category_id = c.id
        WHERE c.slug = ? OR c.name = ?
      )`);
      params.push(category.trim(), category.trim());
    }

    // Tag Filter
    if (tag && tag.trim()) {
      conditions.push(`b.id IN (
        SELECT bt.blog_id FROM blog_tags bt
        JOIN tags t ON bt.tag_id = t.id
        WHERE t.slug = ? OR t.name = ?
      )`);
      params.push(tag.trim(), tag.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Order By
    let orderBy = 'ORDER BY b.created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'ORDER BY b.created_at ASC';
    } else if (sort === 'popular') {
      orderBy = 'ORDER BY like_count DESC, b.created_at DESC';
    }

    // Count query for pagination
    const countSql = `
      SELECT COUNT(*) as total
      FROM blogs b
      ${whereClause}
    `;
    const totalResult = db.prepare(countSql).get(...params);
    const total = totalResult ? totalResult.total : 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    // Data query
    const dataSql = `
      SELECT 
        b.id, b.title, b.slug, b.body, b.cover_image, b.status, 
        b.created_at, b.updated_at, b.author_id,
        u.name as author_name, u.email as author_email,
        (SELECT COUNT(*) FROM likes l WHERE l.blog_id = b.id) as like_count
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataSql).all(...params, limitNum, offset);

    const blogs = hydrateBlogs(rows, req.user ? req.user.id : null);

    res.status(200).json({
      blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ error: 'Failed to retrieve blogs.' });
  }
}

// GET /api/blogs/:slugOrId (Single blog detail)
function getBlogBySlugOrId(req, res) {
  try {
    const { slugOrId } = req.params;
    const isNumeric = /^\d+$/.test(slugOrId);

    const query = isNumeric
      ? `SELECT b.*, u.name as author_name, u.email as author_email
         FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.id = ?`
      : `SELECT b.*, u.name as author_name, u.email as author_email
         FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.slug = ?`;

    const blog = db.prepare(query).get(slugOrId);

    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    if (blog.status === 'draft' && !isAdmin) {
      return res.status(403).json({ error: 'This blog post is currently an unpublished draft.' });
    }

    const hydrated = hydrateBlogs([blog], req.user ? req.user.id : null)[0];
    res.status(200).json({ blog: hydrated });
  } catch (err) {
    console.error('Error fetching blog detail:', err);
    res.status(500).json({ error: 'Failed to retrieve blog detail.' });
  }
}

// POST /api/blogs (Create blog - Admin only)
function createBlog(req, res) {
  try {
    const { title, body, cover_image, status = 'draft', categories = [], tags = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Blog title is required.' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Blog body content is required.' });
    }

    let baseSlug = slugify(title);
    if (!baseSlug) baseSlug = 'untitled-post';

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (db.prepare('SELECT id FROM blogs WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const sanitizedBody = cleanHtml(body);
    const validStatus = status === 'published' ? 'published' : 'draft';

    const insertResult = db.prepare(`
      INSERT INTO blogs (title, slug, body, cover_image, status, author_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      slug,
      sanitizedBody,
      cover_image || null,
      validStatus,
      req.user.id
    );

    const blogId = insertResult.lastInsertRowid;

    // Handle Categories
    if (Array.isArray(categories) && categories.length > 0) {
      const insertCatStmt = db.prepare('INSERT OR IGNORE INTO blog_categories (blog_id, category_id) VALUES (?, ?)');
      for (const catItem of categories) {
        let catId = null;
        if (typeof catItem === 'number' || /^\d+$/.test(catItem)) {
          const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(parseInt(catItem, 10));
          if (cat) catId = cat.id;
        } else if (typeof catItem === 'string' && catItem.trim()) {
          const catSlug = slugify(catItem);
          let cat = db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(catSlug, catItem.trim());
          if (!cat) {
            const newCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(catItem.trim(), catSlug);
            catId = newCat.lastInsertRowid;
          } else {
            catId = cat.id;
          }
        }
        if (catId) {
          insertCatStmt.run(blogId, catId);
        }
      }
    }

    // Handle Tags (can be IDs or new tag names)
    if (Array.isArray(tags) && tags.length > 0) {
      const insertTagLink = db.prepare('INSERT OR IGNORE INTO blog_tags (blog_id, tag_id) VALUES (?, ?)');
      for (let tagItem of tags) {
        let tagId = null;
        if (typeof tagItem === 'number' || /^\d+$/.test(tagItem)) {
          const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(parseInt(tagItem, 10));
          if (tag) tagId = tag.id;
        } else if (typeof tagItem === 'string' && tagItem.trim()) {
          const tagSlug = slugify(tagItem);
          let existingTag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
          if (!existingTag) {
            const newTag = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(tagItem.trim(), tagSlug);
            tagId = newTag.lastInsertRowid;
          } else {
            tagId = existingTag.id;
          }
        }
        if (tagId) {
          insertTagLink.run(blogId, tagId);
        }
      }
    }

    const createdBlog = db.prepare('SELECT b.*, u.name as author_name FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.id = ?').get(blogId);
    const hydrated = hydrateBlogs([createdBlog], req.user.id)[0];

    res.status(201).json({
      message: 'Blog created successfully.',
      blog: hydrated
    });
  } catch (err) {
    console.error('Error creating blog:', err);
    res.status(500).json({ error: 'Failed to create blog post.' });
  }
}

// PUT /api/blogs/:id (Update blog - Admin only)
function updateBlog(req, res) {
  try {
    const { id } = req.params;
    const { title, body, cover_image, status, categories, tags } = req.body;

    const existing = db.prepare('SELECT * FROM blogs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    let updatedTitle = existing.title;
    let updatedSlug = existing.slug;
    let updatedBody = existing.body;
    let updatedCover = existing.cover_image;
    let updatedStatus = existing.status;

    if (title && title.trim() && title.trim() !== existing.title) {
      updatedTitle = title.trim();
      let baseSlug = slugify(updatedTitle);
      let slug = baseSlug;
      let counter = 1;
      while (db.prepare('SELECT id FROM blogs WHERE slug = ? AND id != ?').get(slug, id)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updatedSlug = slug;
    }

    if (body !== undefined) {
      if (!body.trim()) {
        return res.status(400).json({ error: 'Blog body cannot be empty.' });
      }
      updatedBody = cleanHtml(body);
    }

    if (cover_image !== undefined) {
      updatedCover = cover_image || null;
    }

    if (status && (status === 'draft' || status === 'published')) {
      updatedStatus = status;
    }

    db.prepare(`
      UPDATE blogs
      SET title = ?, slug = ?, body = ?, cover_image = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedTitle, updatedSlug, updatedBody, updatedCover, updatedStatus, id);

    // Update categories if provided
    if (Array.isArray(categories)) {
      db.prepare('DELETE FROM blog_categories WHERE blog_id = ?').run(id);
      const insertCatStmt = db.prepare('INSERT OR IGNORE INTO blog_categories (blog_id, category_id) VALUES (?, ?)');
      for (const catItem of categories) {
        let catId = null;
        if (typeof catItem === 'number' || /^\d+$/.test(catItem)) {
          const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(parseInt(catItem, 10));
          if (cat) catId = cat.id;
        } else if (typeof catItem === 'string' && catItem.trim()) {
          const catSlug = slugify(catItem);
          let cat = db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(catSlug, catItem.trim());
          if (!cat) {
            const newCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(catItem.trim(), catSlug);
            catId = newCat.lastInsertRowid;
          } else {
            catId = cat.id;
          }
        }
        if (catId) {
          insertCatStmt.run(id, catId);
        }
      }
    }

    // Update tags if provided
    if (Array.isArray(tags)) {
      db.prepare('DELETE FROM blog_tags WHERE blog_id = ?').run(id);
      const insertTagLink = db.prepare('INSERT OR IGNORE INTO blog_tags (blog_id, tag_id) VALUES (?, ?)');
      for (let tagItem of tags) {
        let tagId = null;
        if (typeof tagItem === 'number' || /^\d+$/.test(tagItem)) {
          const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(parseInt(tagItem, 10));
          if (tag) tagId = tag.id;
        } else if (typeof tagItem === 'string' && tagItem.trim()) {
          const tagSlug = slugify(tagItem);
          let existingTag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
          if (!existingTag) {
            const newTag = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(tagItem.trim(), tagSlug);
            tagId = newTag.lastInsertRowid;
          } else {
            tagId = existingTag.id;
          }
        }
        if (tagId) {
          insertTagLink.run(id, tagId);
        }
      }
    }

    const updatedBlog = db.prepare('SELECT b.*, u.name as author_name FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.id = ?').get(id);
    const hydrated = hydrateBlogs([updatedBlog], req.user.id)[0];

    res.status(200).json({
      message: 'Blog updated successfully.',
      blog: hydrated
    });
  } catch (err) {
    console.error('Error updating blog:', err);
    res.status(500).json({ error: 'Failed to update blog post.' });
  }
}

// PATCH /api/blogs/:id/status (Toggle publish/draft - Admin only)
function togglePublishStatus(req, res) {
  try {
    const { id } = req.params;
    const blog = db.prepare('SELECT id, status FROM blogs WHERE id = ?').get(id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    const newStatus = blog.status === 'published' ? 'draft' : 'published';
    db.prepare('UPDATE blogs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

    res.status(200).json({
      message: `Blog status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error toggling blog status:', err);
    res.status(500).json({ error: 'Failed to toggle status.' });
  }
}

// DELETE /api/blogs/:id (Cascade delete blog - Admin only)
function deleteBlog(req, res) {
  try {
    const { id } = req.params;
    const blog = db.prepare('SELECT id, title FROM blogs WHERE id = ?').get(id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    // Cascade deletion handles comments, likes, blog_categories, blog_tags automatically
    db.prepare('DELETE FROM blogs WHERE id = ?').run(id);

    res.status(200).json({
      message: `Blog "${blog.title}" and all associated comments and likes were permanently deleted.`
    });
  } catch (err) {
    console.error('Error deleting blog:', err);
    res.status(500).json({ error: 'Failed to delete blog.' });
  }
}

// GET /api/categories
function getTaxonomy(req, res) {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(bc.blog_id) as blog_count
      FROM categories c
      LEFT JOIN blog_categories bc ON c.id = bc.category_id
      LEFT JOIN blogs b ON bc.blog_id = b.id AND b.status = 'published'
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();

    const tags = db.prepare(`
      SELECT t.*, COUNT(bt.blog_id) as blog_count
      FROM tags t
      LEFT JOIN blog_tags bt ON t.id = bt.tag_id
      LEFT JOIN blogs b ON bt.blog_id = b.id AND b.status = 'published'
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all();

    res.status(200).json({ categories, tags });
  } catch (err) {
    console.error('Error fetching taxonomy:', err);
    res.status(500).json({ error: 'Failed to retrieve categories and tags.' });
  }
}

module.exports = {
  getAllBlogs,
  getBlogBySlugOrId,
  createBlog,
  updateBlog,
  togglePublishStatus,
  deleteBlog,
  getTaxonomy
};
