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

  // Ensure Google OAuth columns exist in users table for existing databases
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!columns.includes('google_id')) {
      db.exec("ALTER TABLE users ADD COLUMN google_id TEXT;");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;");
    }
    if (!columns.includes('avatar_url')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
    }
    if (!columns.includes('auth_provider')) {
      db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local';");
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
