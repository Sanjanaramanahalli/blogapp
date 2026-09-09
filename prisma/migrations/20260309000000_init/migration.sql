-- ApexBlog Initial PostgreSQL Migration for Supabase

-- Users Table
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'reader',
    "google_id" TEXT,
    "linkedin_id" TEXT,
    "github_id" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT DEFAULT '',
    "auth_provider" TEXT NOT NULL DEFAULT 'local',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Categories Table
CREATE TABLE IF NOT EXISTS "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Tags Table
CREATE TABLE IF NOT EXISTS "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- Blogs Table
CREATE TABLE IF NOT EXISTS "blogs" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cover_image" TEXT,
    "video_url" TEXT,
    "edition" TEXT NOT NULL DEFAULT 'india',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "author_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- Blog Categories Association (Many-to-Many)
CREATE TABLE IF NOT EXISTS "blog_categories" (
    "blog_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("blog_id","category_id")
);

-- Blog Tags Association (Many-to-Many)
CREATE TABLE IF NOT EXISTS "blog_tags" (
    "blog_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("blog_id","tag_id")
);

-- Comments Table with Self-referencing Parent
CREATE TABLE IF NOT EXISTS "comments" (
    "id" SERIAL NOT NULL,
    "blog_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- Likes Table
CREATE TABLE IF NOT EXISTS "likes" (
    "id" SERIAL NOT NULL,
    "blog_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- Saved Blogs (Bookmarks) Table
CREATE TABLE IF NOT EXISTS "saved_blogs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "blog_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_blogs_pkey" PRIMARY KEY ("id")
);

-- Password Resets & OTP Table
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- Settings Table
CREATE TABLE IF NOT EXISTS "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_linkedin_id_key" ON "users"("linkedin_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_key" ON "users"("github_id");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_key" ON "tags"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "blogs_slug_key" ON "blogs"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "likes_blog_id_user_id_key" ON "likes"("blog_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_blogs_user_id_blog_id_key" ON "saved_blogs"("user_id", "blog_id");
CREATE UNIQUE INDEX IF NOT EXISTS "settings_key_key" ON "settings"("key");

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "blogs_status_idx" ON "blogs"("status");
CREATE INDEX IF NOT EXISTS "blogs_slug_idx" ON "blogs"("slug");
CREATE INDEX IF NOT EXISTS "blogs_edition_idx" ON "blogs"("edition");
CREATE INDEX IF NOT EXISTS "comments_blog_id_idx" ON "comments"("blog_id");
CREATE INDEX IF NOT EXISTS "comments_parent_id_idx" ON "comments"("parent_id");
CREATE INDEX IF NOT EXISTS "likes_blog_id_idx" ON "likes"("blog_id");
CREATE INDEX IF NOT EXISTS "saved_blogs_user_id_idx" ON "saved_blogs"("user_id");
CREATE INDEX IF NOT EXISTS "saved_blogs_blog_id_idx" ON "saved_blogs"("blog_id");
CREATE INDEX IF NOT EXISTS "password_resets_email_idx" ON "password_resets"("email");

-- Foreign Key Constraints with ON DELETE CASCADE
ALTER TABLE "blogs" DROP CONSTRAINT IF EXISTS "blogs_author_id_fkey";
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_categories" DROP CONSTRAINT IF EXISTS "blog_categories_blog_id_fkey";
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_categories" DROP CONSTRAINT IF EXISTS "blog_categories_category_id_fkey";
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_tags" DROP CONSTRAINT IF EXISTS "blog_tags_blog_id_fkey";
ALTER TABLE "blog_tags" ADD CONSTRAINT "blog_tags_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_tags" DROP CONSTRAINT IF EXISTS "blog_tags_tag_id_fkey";
ALTER TABLE "blog_tags" ADD CONSTRAINT "blog_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_blog_id_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_user_id_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_parent_id_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_blog_id_fkey";
ALTER TABLE "likes" ADD CONSTRAINT "likes_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_user_id_fkey";
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_blogs" DROP CONSTRAINT IF EXISTS "saved_blogs_user_id_fkey";
ALTER TABLE "saved_blogs" ADD CONSTRAINT "saved_blogs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_blogs" DROP CONSTRAINT IF EXISTS "saved_blogs_blog_id_fkey";
ALTER TABLE "saved_blogs" ADD CONSTRAINT "saved_blogs_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
