const bcrypt = require('bcryptjs');
const { db, initSchema } = require('./database');

function seedDatabase() {
  console.log('--- Initializing database schema ---');
  initSchema();

  console.log('--- Seeding default records ---');

  // 1. Clear existing data in reverse dependency order
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM likes;');
  db.exec('DELETE FROM comments;');
  db.exec('DELETE FROM blog_tags;');
  db.exec('DELETE FROM blog_categories;');
  db.exec('DELETE FROM tags;');
  db.exec('DELETE FROM categories;');
  db.exec('DELETE FROM blogs;');
  db.exec('DELETE FROM users;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 2. Seed Users
  const adminPasswordHash = bcrypt.hashSync('Admin@123456', 10);
  const readerPasswordHash = bcrypt.hashSync('Reader@123', 10);

  const insertUserStmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);

  insertUserStmt.run('System Administrator', 'admin@blog.com', adminPasswordHash, 'admin');
  insertUserStmt.run('John Reader', 'john@reader.com', readerPasswordHash, 'reader');
  insertUserStmt.run('Sarah Connor', 'sarah@reader.com', readerPasswordHash, 'reader');

  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@blog.com');
  const johnUser = db.prepare('SELECT id FROM users WHERE email = ?').get('john@reader.com');
  const sarahUser = db.prepare('SELECT id FROM users WHERE email = ?').get('sarah@reader.com');

  // 3. Seed Categories
  const insertCatStmt = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
  insertCatStmt.run('Technology', 'technology');
  insertCatStmt.run('Software Architecture', 'software-architecture');
  insertCatStmt.run('Web Development', 'web-development');
  insertCatStmt.run('Design', 'design');
  insertCatStmt.run('Engineering', 'engineering');

  const catTech = db.prepare('SELECT id FROM categories WHERE slug = ?').get('technology');
  const catArch = db.prepare('SELECT id FROM categories WHERE slug = ?').get('software-architecture');
  const catWeb = db.prepare('SELECT id FROM categories WHERE slug = ?').get('web-development');
  const catEng = db.prepare('SELECT id FROM categories WHERE slug = ?').get('engineering');

  // 4. Seed Tags
  const insertTagStmt = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)');
  insertTagStmt.run('javascript', 'javascript');
  insertTagStmt.run('nodejs', 'nodejs');
  insertTagStmt.run('sqlite', 'sqlite');
  insertTagStmt.run('security', 'security');
  insertTagStmt.run('architecture', 'architecture');
  insertTagStmt.run('css', 'css');

  const tagNode = db.prepare('SELECT id FROM tags WHERE slug = ?').get('nodejs');
  const tagSqlite = db.prepare('SELECT id FROM tags WHERE slug = ?').get('sqlite');
  const tagArch = db.prepare('SELECT id FROM tags WHERE slug = ?').get('architecture');
  const tagSec = db.prepare('SELECT id FROM tags WHERE slug = ?').get('security');
  const tagJs = db.prepare('SELECT id FROM tags WHERE slug = ?').get('javascript');

  // 5. Seed Blogs
  const insertBlogStmt = db.prepare(`
    INSERT INTO blogs (title, slug, body, cover_image, status, author_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Blog 1: Published
  insertBlogStmt.run(
    'Architecting Modern Web Applications with Resilient Full-Stack Patterns',
    'architecting-modern-web-applications',
    `<h2>Building for Long-Term Durability</h2>
    <p>In modern software engineering, web application longevity is determined by architectural discipline rather than the latest fleeting trends. By leveraging clean separation of concerns, transactional integrity, and role-based boundaries, teams deliver software that survives decades of evolution.</p>
    <blockquote>The essence of architecture is finding simplicity in complex distributed interactions.</blockquote>
    <h3>1. Relational Integrity at the Core</h3>
    <p>Using strict foreign key constraints and cascade rules guarantees that your application state remains perpetually consistent. When a parent post or comment is deleted, recursive child dependencies are removed atomically without orphan records polluting storage.</p>
    <h3>2. Security & Role Governance</h3>
    <p>Distinguishing between authenticated Readers and administrative personnel ensures that content moderation, account management, and authoring capabilities remain strictly isolated.</p>`,
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id
  );

  // Blog 2: Published
  insertBlogStmt.run(
    'Deep Dive into Multi-Level Comment Hierarchies and Cascade Deletions',
    'deep-dive-into-multi-level-comment-hierarchies',
    `<h2>Understanding Threaded Community Conversations</h2>
    <p>Linear comment lists fail to capture the nuance of collaborative human conversation. By structuring discussions into hierarchical parent-child relationships, readers can engage in specific contextual replies without losing track of the surrounding dialogue.</p>
    <h3>Cascade Deletion Dynamics</h3>
    <p>When an author or administrator removes a root comment, all subsidiary replies down the tree are purged instantaneously. This prevents conversational dead-ends and maintains structural hygiene.</p>`,
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id
  );

  // Blog 3: Draft (Only visible to Admin)
  insertBlogStmt.run(
    'Internal Roadmap: Platform Architecture Vision for 2027',
    'internal-roadmap-platform-vision',
    `<h2>Confidential Strategic Blueprint</h2>
    <p>This draft documents upcoming architectural milestones, automated regression suites, and infrastructure optimizations currently under review by engineering leadership.</p>`,
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'draft',
    adminUser.id
  );

  const blog1 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('architecting-modern-web-applications');
  const blog2 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('deep-dive-into-multi-level-comment-hierarchies');
  const blog3 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('internal-roadmap-platform-vision');

  // Assign Categories & Tags
  const insertBlogCat = db.prepare('INSERT INTO blog_categories (blog_id, category_id) VALUES (?, ?)');
  insertBlogCat.run(blog1.id, catTech.id);
  insertBlogCat.run(blog1.id, catArch.id);
  insertBlogCat.run(blog2.id, catWeb.id);
  insertBlogCat.run(blog2.id, catEng.id);
  insertBlogCat.run(blog3.id, catArch.id);

  const insertBlogTag = db.prepare('INSERT INTO blog_tags (blog_id, tag_id) VALUES (?, ?)');
  insertBlogTag.run(blog1.id, tagNode.id);
  insertBlogTag.run(blog1.id, tagSqlite.id);
  insertBlogTag.run(blog1.id, tagArch.id);
  insertBlogTag.run(blog2.id, tagJs.id);
  insertBlogTag.run(blog2.id, tagSec.id);

  // 6. Seed Multi-Level Comments
  const insertCommentStmt = db.prepare(`
    INSERT INTO comments (blog_id, user_id, parent_id, content)
    VALUES (?, ?, ?, ?)
  `);

  // Top-level comment by John on Blog 1
  insertCommentStmt.run(blog1.id, johnUser.id, null, 'Excellent breakdown of the WAL mode and cascade integrity rules!');
  const comment1 = db.prepare('SELECT id FROM comments WHERE content LIKE ?').get('Excellent breakdown%');

  // Reply by Admin to John (Level 2)
  insertCommentStmt.run(blog1.id, adminUser.id, comment1.id, 'Thanks John! Foreign key enforcement at the database level eliminates orphan record bugs.');
  const reply1 = db.prepare('SELECT id FROM comments WHERE content LIKE ?').get('Thanks John!%');

  // Reply by Sarah to Admin (Level 3 - Deeply nested)
  insertCommentStmt.run(blog1.id, sarahUser.id, reply1.id, '@Admin Couldn\'t agree more, especially in nested comment trees where orphaned children ruin UI layouts.');

  // Top-level comment by Sarah on Blog 1
  insertCommentStmt.run(blog1.id, sarahUser.id, null, 'How does this approach compare to distributed document stores for reader-heavy sites?');
  const comment2 = db.prepare('SELECT id FROM comments WHERE content LIKE ?').get('How does this approach compare%');

  // Reply by John to Sarah (Level 2)
  insertCommentStmt.run(blog1.id, johnUser.id, comment2.id, '@Sarah For read-heavy applications, SQLite WAL mode provides zero network hop latency and exceptional throughput.');

  // 7. Seed Likes
  const insertLikeStmt = db.prepare('INSERT INTO likes (blog_id, user_id) VALUES (?, ?)');
  insertLikeStmt.run(blog1.id, johnUser.id);
  insertLikeStmt.run(blog1.id, sarahUser.id);
  insertLikeStmt.run(blog2.id, johnUser.id);

  console.log('--- Database successfully seeded! ---');
  console.log('Admin Account: admin@blog.com / Admin@123456');
  console.log('Reader 1:      john@reader.com / Reader@123');
  console.log('Reader 2:      sarah@reader.com / Reader@123');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
