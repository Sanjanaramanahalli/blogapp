const bcrypt = require('bcryptjs');

function seedDatabase(passedDb) {
  const databaseModule = require('./database');
  const db = passedDb || databaseModule.db;

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
  insertUserStmt.run('Sanjana', 'sanjanalr8@gmail.com', readerPasswordHash, 'reader');

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
  insertCatStmt.run('Sports', 'sports');
  insertCatStmt.run('Movies', 'movies');
  insertCatStmt.run('Weather', 'weather');

  const catTech = db.prepare('SELECT id FROM categories WHERE slug = ?').get('technology');
  const catArch = db.prepare('SELECT id FROM categories WHERE slug = ?').get('software-architecture');
  const catWeb = db.prepare('SELECT id FROM categories WHERE slug = ?').get('web-development');
  const catEng = db.prepare('SELECT id FROM categories WHERE slug = ?').get('engineering');
  const catSports = db.prepare('SELECT id FROM categories WHERE slug = ?').get('sports');
  const catMovies = db.prepare('SELECT id FROM categories WHERE slug = ?').get('movies');
  const catWeather = db.prepare('SELECT id FROM categories WHERE slug = ?').get('weather');

  // 4. Seed Tags
  const insertTagStmt = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)');
  insertTagStmt.run('javascript', 'javascript');
  insertTagStmt.run('nodejs', 'nodejs');
  insertTagStmt.run('sqlite', 'sqlite');
  insertTagStmt.run('security', 'security');
  insertTagStmt.run('architecture', 'architecture');
  insertTagStmt.run('css', 'css');
  insertTagStmt.run('india', 'india');
  insertTagStmt.run('world', 'world');
  insertTagStmt.run('video', 'video');

  const tagNode = db.prepare('SELECT id FROM tags WHERE slug = ?').get('nodejs');
  const tagSqlite = db.prepare('SELECT id FROM tags WHERE slug = ?').get('sqlite');
  const tagArch = db.prepare('SELECT id FROM tags WHERE slug = ?').get('architecture');
  const tagSec = db.prepare('SELECT id FROM tags WHERE slug = ?').get('security');
  const tagJs = db.prepare('SELECT id FROM tags WHERE slug = ?').get('javascript');
  const tagIndia = db.prepare('SELECT id FROM tags WHERE slug = ?').get('india');
  const tagWorld = db.prepare('SELECT id FROM tags WHERE slug = ?').get('world');
  const tagVideo = db.prepare('SELECT id FROM tags WHERE slug = ?').get('video');

  // 5. Seed Blogs
  const insertBlogStmt = db.prepare(`
    INSERT INTO blogs (title, slug, body, cover_image, status, author_id, edition, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Blog 1: Published (India)
  insertBlogStmt.run(
    'Architecting Modern Web Applications with Resilient Full-Stack Patterns',
    'architecting-modern-web-applications',
    `<h2>Building for Long-Term Durability</h2>
    <p>In modern software engineering, web application longevity is determined by architectural discipline rather than the latest fleeting trends. By leveraging clean separation of concerns, transactional integrity, and role-based boundaries, teams deliver software that survives decades of evolution.</p>
    <blockquote>The essence of architecture is finding simplicity in complex distributed interactions.</blockquote>`,
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id,
    'india',
    null
  );

  // Blog 2: Published (India)
  insertBlogStmt.run(
    'Deep Dive into Multi-Level Comment Hierarchies and Cascade Deletions',
    'deep-dive-into-multi-level-comment-hierarchies',
    `<h2>Understanding Threaded Community Conversations</h2>
    <p>Linear comment lists fail to capture the nuance of collaborative human conversation. By structuring discussions into hierarchical parent-child relationships, readers can engage in specific contextual replies without losing track of the surrounding dialogue.</p>`,
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id,
    'india',
    null
  );

  // Blog 3: Draft (World)
  insertBlogStmt.run(
    'Internal Roadmap: Platform Architecture Vision for 2027',
    'internal-roadmap-platform-vision',
    `<h2>Confidential Strategic Blueprint</h2>
    <p>This draft documents upcoming architectural milestones, automated regression suites, and infrastructure optimizations currently under review by engineering leadership.</p>`,
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'draft',
    adminUser.id,
    'world',
    null
  );

  // Blog 4: Published (India)
  insertBlogStmt.run(
    'Mastering SQLite WAL Mode for High Concurrency Web Backends',
    'mastering-sqlite-wal-mode',
    `<h2>Concurrency Without Complexity</h2>
    <p>Write-Ahead Logging (WAL) completely decouples readers from writers in SQLite. Readers never block writers, and writers never block readers, achieving exceptional read performance on modern hardware.</p>`,
    'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&q=80',
    'published',
    johnUser.id,
    'india',
    null
  );

  // Blog 5: Published (India)
  insertBlogStmt.run(
    'Modern Frontend Aesthetics: Glassmorphism and Fluid Responsive Layouts',
    'modern-frontend-aesthetics-glassmorphism',
    `<h2>Crafting Interfaces That Delight</h2>
    <p>Modern web users expect interfaces that feel alive, responsive, and tactile. By pairing subtle backdrop blurs with tailored HSL color tokens and clamp() fluid typography, applications stand out with premium visual quality.</p>`,
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    'published',
    sarahUser.id,
    'india',
    null
  );

  // Blog 6: Published (World)
  insertBlogStmt.run(
    'Building Resilient Microservices with Event-Driven Architecture',
    'building-resilient-microservices',
    `<h2>Decoupled Scaling Patterns</h2>
    <p>Event streams provide a resilient backbone for asynchronous communication across microservices. By ensuring idempotency and replayability, systems remain robust in the face of partial network failures.</p>`,
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id,
    'world',
    null
  );

  // Blog 7: Published (India)
  insertBlogStmt.run(
    'Defensive API Design: Input Sanitization, CSRF, and RBAC',
    'defensive-api-design-security',
    `<h2>Zero-Trust Web Applications</h2>
    <p>Security must be embedded into every route, handler, and database query. By sanitizing rich-text inputs and enforcing role-based access control, applications neutralize injection attacks and unauthorized mutations.</p>`,
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    'published',
    johnUser.id,
    'india',
    null
  );

  // Blog 8: Published (World)
  insertBlogStmt.run(
    'The Evolution of Design Systems: Tokens, Dark Mode, and Micro-Animations',
    'evolution-of-design-systems',
    `<h2>Systematic UI Engineering</h2>
    <p>A design system is more than a style guide; it is a shared vocabulary between designers and engineers. Semantic CSS custom properties enable seamless dark/light transitions with zero runtime bundle overhead.</p>`,
    'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80',
    'published',
    sarahUser.id,
    'world',
    null
  );

  // Blog 9: India Edition - Sports (with video)
  insertBlogStmt.run(
    'India National Cricket Team Clinches Championship Victory',
    'india-cricket-championship-victory',
    `<h2>Historic Triumph for the Men in Blue</h2>
    <p>In a thrilling final watched by millions across the nation, India delivered a masterclass performance in bowling and batting to secure the championship trophy.</p>`,
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id,
    'india',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  );

  // Blog 10: India Edition - Movies (with video)
  insertBlogStmt.run(
    'Indian Cinema Sensation Breaks International Box Office Records',
    'indian-cinema-box-office-records',
    `<h2>Pan-Indian Storytelling Conquers Global Screens</h2>
    <p>Captivating audiences with spectacular visuals and heartfelt music, the latest Indian cinematic blockbuster has surpassed all previous box office milestones worldwide.</p>`,
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    'published',
    sarahUser.id,
    'india',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
  );

  // Blog 11: India Edition - Weather
  insertBlogStmt.run(
    'Monsoon Forecast: Heavy Rainfall Alert Across Western Coastal India',
    'monsoon-forecast-western-coastal-india',
    `<h2>Meteorological Advisory for Coastal Communities</h2>
    <p>The India Meteorological Department has issued active alerts for continuous monsoon showers, advising local fishermen and travelers to exercise caution.</p>`,
    'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1200&q=80',
    'published',
    johnUser.id,
    'india',
    null
  );

  // Blog 12: World Edition - Sports (with video)
  insertBlogStmt.run(
    'World Athletics Championships: Historic Global Records Broken',
    'world-athletics-championships-records',
    `<h2>Athletes from 40 Nations Compete at Peak Form</h2>
    <p>The international stadium witnessed unprecedented speed and endurance as sprinters shattered decade-old global records in thrilling photo-finishes.</p>`,
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    'published',
    adminUser.id,
    'world',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  );

  // Blog 13: World Edition - Movies
  insertBlogStmt.run(
    'International Film Festival Celebrates Cinematic Masterpieces',
    'international-film-festival-masterpieces',
    `<h2>Independent Directors Honored on the World Stage</h2>
    <p>Celebrating diverse voices and innovative filmmaking, the festival jury awarded the Golden Palme to an inspiring documentary highlighting resilience.</p>`,
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1200&q=80',
    'published',
    sarahUser.id,
    'world',
    null
  );

  // Blog 14: World Edition - Weather (with video)
  insertBlogStmt.run(
    'Global Climate Summit Issues Worldwide Extreme Heat Advisory',
    'global-climate-summit-extreme-heat-advisory',
    `<h2>Coordinated Global Preparedness Plans</h2>
    <p>International climate scientists and municipal authorities have coordinated emergency heat preparedness guides to support vulnerable populations across three continents.</p>`,
    'https://images.unsplash.com/photo-1504370805625-d32c54b16100?auto=format&fit=crop&w=1200&q=80',
    'published',
    johnUser.id,
    'world',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
  );

  const blog1 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('architecting-modern-web-applications');
  const blog2 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('deep-dive-into-multi-level-comment-hierarchies');
  const blog3 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('internal-roadmap-platform-vision');
  const blog4 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('mastering-sqlite-wal-mode');
  const blog5 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('modern-frontend-aesthetics-glassmorphism');
  const blog6 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('building-resilient-microservices');
  const blog7 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('defensive-api-design-security');
  const blog8 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('evolution-of-design-systems');
  const blog9 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('india-cricket-championship-victory');
  const blog10 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('indian-cinema-box-office-records');
  const blog11 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('monsoon-forecast-western-coastal-india');
  const blog12 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('world-athletics-championships-records');
  const blog13 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('international-film-festival-masterpieces');
  const blog14 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('global-climate-summit-extreme-heat-advisory');

  // Assign Categories & Tags
  const insertBlogCat = db.prepare('INSERT INTO blog_categories (blog_id, category_id) VALUES (?, ?)');
  insertBlogCat.run(blog1.id, catTech.id);
  insertBlogCat.run(blog1.id, catArch.id);
  insertBlogCat.run(blog2.id, catWeb.id);
  insertBlogCat.run(blog2.id, catEng.id);
  insertBlogCat.run(blog3.id, catArch.id);
  insertBlogCat.run(blog4.id, catTech.id);
  insertBlogCat.run(blog5.id, catWeb.id);
  insertBlogCat.run(blog6.id, catArch.id);
  insertBlogCat.run(blog7.id, catTech.id);
  insertBlogCat.run(blog8.id, catWeb.id);
  insertBlogCat.run(blog9.id, catSports.id);
  insertBlogCat.run(blog10.id, catMovies.id);
  insertBlogCat.run(blog11.id, catWeather.id);
  insertBlogCat.run(blog12.id, catSports.id);
  insertBlogCat.run(blog13.id, catMovies.id);
  insertBlogCat.run(blog14.id, catWeather.id);

  const insertBlogTag = db.prepare('INSERT INTO blog_tags (blog_id, tag_id) VALUES (?, ?)');
  insertBlogTag.run(blog1.id, tagNode.id);
  insertBlogTag.run(blog1.id, tagSqlite.id);
  insertBlogTag.run(blog1.id, tagArch.id);
  insertBlogTag.run(blog2.id, tagJs.id);
  insertBlogTag.run(blog2.id, tagSec.id);
  insertBlogTag.run(blog4.id, tagSqlite.id);
  insertBlogTag.run(blog5.id, tagJs.id);
  insertBlogTag.run(blog6.id, tagNode.id);
  insertBlogTag.run(blog7.id, tagSec.id);
  insertBlogTag.run(blog8.id, tagJs.id);
  insertBlogTag.run(blog9.id, tagIndia.id);
  insertBlogTag.run(blog9.id, tagVideo.id);
  insertBlogTag.run(blog10.id, tagIndia.id);
  insertBlogTag.run(blog10.id, tagVideo.id);
  insertBlogTag.run(blog11.id, tagIndia.id);
  insertBlogTag.run(blog12.id, tagWorld.id);
  insertBlogTag.run(blog12.id, tagVideo.id);
  insertBlogTag.run(blog13.id, tagWorld.id);
  insertBlogTag.run(blog14.id, tagWorld.id);
  insertBlogTag.run(blog14.id, tagVideo.id);

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
