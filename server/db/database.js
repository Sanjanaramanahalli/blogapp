/**
 * Database Layer for ApexBlog / TownTalk
 * Supports:
 * 1. Supabase PostgreSQL via DATABASE_URL in production (Render)
 * 2. Prisma ORM Client integration
 * 3. Native SQLite (node:sqlite) for local development and offline testing
 */

const fs = require('node:fs');
const path = require('node:path');

const isPostgres = !!(
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://')) &&
  (process.env.NODE_ENV === 'production' || process.env.USE_POSTGRES === 'true' || process.env.DATABASE_URL.includes('supabase.co'))
);

let dbInstance = null;
let prismaClient = null;

// Lazy Prisma Client initializer
function getPrismaClient() {
  if (!prismaClient) {
    try {
      const { PrismaClient } = require('@prisma/client');
      prismaClient = new PrismaClient();
    } catch (e) {
      console.warn('Prisma Client not initialized:', e.message);
    }
  }
  return prismaClient;
}

if (isPostgres) {
  console.log('🐘 [Database] Configuring PostgreSQL connection for Supabase via DATABASE_URL');
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    dbInstance = {
      isPostgres: true,
      pool,
      prepare(sql) {
        return {
          get: async (...params) => {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await pool.query(pgSql, params);
            return res.rows[0];
          },
          all: async (...params) => {
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);
            const res = await pool.query(pgSql, params);
            return res.rows;
          },
          run: async (...params) => {
            let i = 1;
            let pgSql = sql.replace(/\?/g, () => `$${i++}`);
            if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
              pgSql += ' RETURNING id';
            }
            const res = await pool.query(pgSql, params);
            return {
              lastInsertRowid: res.rows[0]?.id || null,
              changes: res.rowCount
            };
          }
        };
      },
      exec: async (sql) => {
        await pool.query(sql);
      }
    };
  } catch (pgErr) {
    console.warn('⚠️ pg driver not loaded, falling back to local SQLite:', pgErr.message);
  }
}

// Fallback to native node:sqlite for local development and offline test suites
if (!dbInstance) {
  console.log('📁 [Database] Using native SQLite database at server/data/blog.db');
  const { DatabaseSync } = require('node:sqlite');
  const DB_DIR = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const DB_PATH = path.join(DB_DIR, 'blog.db');
  const sqliteDb = new DatabaseSync(DB_PATH);

  // Enable foreign keys and write-ahead logging (WAL)
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');

  dbInstance = sqliteDb;
  dbInstance.isPostgres = false;
}

const db = dbInstance;

// Initialize schema
function initSchema() {
  if (isPostgres) {
    console.log('ℹ️ [Database] Supabase PostgreSQL schema is managed via Prisma migrations (npx prisma migrate deploy).');
    return;
  }

  const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
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
    if (!userCols.includes('bio')) {
      db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';");
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

    // Ensure saved_blogs table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        blog_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, blog_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_saved_blogs_user_id ON saved_blogs(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_blogs_blog_id ON saved_blogs(blog_id);
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

initSchema();

module.exports = {
  db,
  initSchema,
  isPostgres,
  getPrismaClient
};
