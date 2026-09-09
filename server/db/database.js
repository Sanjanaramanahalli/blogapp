const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'blog.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and write-ahead logging (WAL)
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize schema
function initSchema() {
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
  }

  // Ensure Social OAuth columns exist in users table for existing databases
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userCols.includes('google_id')) {
      db.exec("ALTER TABLE users ADD COLUMN google_id TEXT;");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;");
    }
    if (!userCols.includes('linkedin_id')) {
      db.exec("ALTER TABLE users ADD COLUMN linkedin_id TEXT;");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linkedin_id ON users(linkedin_id) WHERE linkedin_id IS NOT NULL;");
    }
    if (!userCols.includes('github_id')) {
      db.exec("ALTER TABLE users ADD COLUMN github_id TEXT;");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;");
    }
    if (!userCols.includes('avatar_url')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
    }
    if (!userCols.includes('auth_provider')) {
      db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local';");
    }

    // Ensure edition and video_url columns exist in blogs table
    const blogCols = db.prepare("PRAGMA table_info(blogs)").all().map(c => c.name);
    if (!blogCols.includes('edition')) {
      db.exec("ALTER TABLE blogs ADD COLUMN edition TEXT DEFAULT 'india';");
      db.exec("CREATE INDEX IF NOT EXISTS idx_blogs_edition ON blogs(edition);");
    }
    if (!blogCols.includes('video_url')) {
      db.exec("ALTER TABLE blogs ADD COLUMN video_url TEXT;");
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

initSchema();

module.exports = {
  db,
  initSchema
};
