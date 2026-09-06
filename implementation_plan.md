# Implementation Plan: Full-Stack Blog Application

Building a production-grade, secure, and responsive Full-Stack Blog Application with role-based access control (Admin, Registered Reader, Anonymous Visitor), rich text publishing, multi-level nested discussions with cascade deletion, binary like/unlike mechanics, multi-taxonomy filtering, keyword search, pagination, and administrative user management.

---

## 1. Consensus Review Panel

Before finalizing the architecture and sprint plan, three specialized roles conducted a comprehensive technical review:

```
┌────────────────────────────────────────────────────────┐
│               Consensus Review Panel                   │
├────────────────────────┬───────────────────────────────┤
│ Architectural Reviewer │ Security, Data Model, Scalability │
│ Ambiguity Analyst      │ Edge Cases, UX Boundaries, States │
│ QA Specialist          │ Test Scenarios, Automation Gate  │
└────────────────────────┴───────────────────────────────┘
```

### Reviewer 1: Architectural Reviewer
* **Evaluation**: 
  * **Database Choice**: SQLite (via `better-sqlite3` or `sqlite3`) with WAL (Write-Ahead Logging) mode enabled ensures ACID compliance, zero-dependency local deployment, immediate setup, and robust foreign-key support for cascade deletions (`ON DELETE CASCADE`).
  * **Backend Architecture**: Layered Express architecture: `Routes -> Controllers -> Services -> Repositories/Database Access -> Middleware (Auth/RBAC/Uploads)`.
  * **Frontend Architecture**: Component-driven vanilla JavaScript with modular CSS design tokens, modern responsive layouts, and zero heavy client framework bloat, guaranteeing blazing fast loads, instant SEO, and total styling control.
  * **Data Integrity**: Enforce foreign keys with `PRAGMA foreign_keys = ON;`. The cascade rules must strictly handle `Blog -> Comments -> Replies` and `Blog -> Likes`.
* **Verdict**: **APPROVED** with recommendation to enforce server-side image validation (magic bytes, MIME type, max 5MB limit).

### Reviewer 2: Ambiguity Analyst
* **Evaluation**:
  * **Mobile Hierarchy UI**: In deeply nested threads (levels 4+), standard CSS indentation on narrow screens can crush content into a tiny column. Recommended design: cap visual margin indentation at level 3, and for deeper replies, display an `@ParentAuthor` badge while preserving true relational depth in the data model.
  * **Rich Text Security**: Rich text HTML stored in database must be sanitized using DOMPurify / server-side HTML sanitizer to eliminate stored XSS vectors.
  * **Unpublished Blog Integrity**: When a blog is unpublished to "Draft", it must return HTTP 404/403 to non-admins if accessed via direct URL, while retaining all relational likes and comments in the database.
* **Verdict**: **APPROVED** with visual indentation and sanitization constraints incorporated.

### Reviewer 3: QA Edge-Case Specialist
* **Evaluation**:
  * **Like Toggle Idempotency**: Concurrency test required: rapid double-clicks on "Like" must not create race conditions or increment duplicate rows (enforced by `UNIQUE(user_id, blog_id)` database constraint).
  * **Cascade Deletion Verification**: Playwright test must verify that deleting a parent comment immediately removes all recursive child replies from both the database and the DOM without page refresh.
  * **Empty Content & Whitespace**: Validation must reject comments or blog bodies consisting exclusively of whitespace or empty HTML tags (e.g., `<p><br></p>`).
* **Verdict**: **APPROVED** with requirement that all issues have positive and negative Playwright CLI tests before being marked complete.

### Panel Consensus Outcome
* **Result**: **3/3 Unanimous Agreement** reached. All recommendations have been integrated into the Sprint 1 design.

---

## 2. Proposed Architecture & System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Browser                           │
│  - Responsive UI (Vanilla CSS + HTML5)                     │
│  - Rich Text Editor (Quill.js / Custom Formatter)           │
│  - Dynamic Comments & Threading View Engine                 │
│  - Search, Filter & Pagination Client                       │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP REST APIs & Static Assets
┌─────────────────────────────▼───────────────────────────────┐
│                 Node.js / Express Server                    │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │ Auth & RBAC Middleware  │  │ Multer File Upload Engine│  │
│  └─────────────────────────┘  └──────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ REST Controllers (Blogs, Comments, Likes, Users, Auth)│  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Service & Sanitization Layer (DOMPurify, Validation)  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQL (ACID, Foreign Keys)
┌─────────────────────────────▼───────────────────────────────┐
│             SQLite Database (WAL Mode Enabled)              │
│  - Users (id, name, email, password_hash, role)             │
│  - Blogs (id, title, body, cover_image, status, author_id)  │
│  - Categories & BlogCategories (Many-to-Many)               │
│  - Tags & BlogTags (Many-to-Many)                           │
│  - Comments (id, blog_id, user_id, parent_id, content)      │
│  - Likes (id, blog_id, user_id) [UNIQUE(blog_id, user_id)]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & Relationships

1. **Users**
   * `id` INTEGER PRIMARY KEY AUTOINCREMENT
   * `name` TEXT NOT NULL
   * `email` TEXT UNIQUE NOT NULL
   * `password_hash` TEXT NOT NULL
   * `role` TEXT CHECK(role IN ('admin', 'reader')) DEFAULT 'reader'
   * `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

2. **Blogs**
   * `id` INTEGER PRIMARY KEY AUTOINCREMENT
   * `title` TEXT NOT NULL
   * `slug` TEXT UNIQUE NOT NULL
   * `body` TEXT NOT NULL
   * `cover_image` TEXT
   * `status` TEXT CHECK(status IN ('draft', 'published')) DEFAULT 'draft'
   * `author_id` INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE
   * `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   * `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

3. **Categories & Blog_Categories**
   * `categories` (`id`, `name`, `slug`)
   * `blog_categories` (`blog_id` REFERENCES Blogs(id) ON DELETE CASCADE, `category_id` REFERENCES Categories(id) ON DELETE CASCADE)

4. **Tags & Blog_Tags**
   * `tags` (`id`, `name`, `slug`)
   * `blog_tags` (`blog_id` REFERENCES Blogs(id) ON DELETE CASCADE, `tag_id` REFERENCES Tags(id) ON DELETE CASCADE)

5. **Comments**
   * `id` INTEGER PRIMARY KEY AUTOINCREMENT
   * `blog_id` INTEGER NOT NULL REFERENCES Blogs(id) ON DELETE CASCADE
   * `user_id` INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE
   * `parent_id` INTEGER REFERENCES Comments(id) ON DELETE CASCADE
   * `content` TEXT NOT NULL
   * `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   * `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

6. **Likes**
   * `id` INTEGER PRIMARY KEY AUTOINCREMENT
   * `blog_id` INTEGER NOT NULL REFERENCES Blogs(id) ON DELETE CASCADE
   * `user_id` INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE
   * `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   * `UNIQUE(blog_id, user_id)`

---

## 4. Work Breakdown & Milestones

* **Milestone 1: Project Foundation & Core Infrastructure**
  * Express server setup, database schema creation with cascade rules, initial Admin seeder.
  * Authentication (Registration, Login, JWT/Cookie Session), RBAC middleware.
  * Local image upload handling via Multer with validation.
* **Milestone 2: Content Publishing & Public Discovery**
  * Admin Blog Management (CRUD, Rich Text Editor, Draft/Publish toggling).
  * Public Blog Feed with keyword search, category/tag multi-filtering, and pagination.
  * Blog Detail Reading View.
* **Milestone 3: Community Engagement (Discussions & Likes)**
  * Like/Unlike toggle with duplicate prevention and live counter.
  * Multi-level nested comments and replies engine.
  * Comment editing and cascade deletion by author and Admin.
* **Milestone 4: Admin Oversight & Quality Assurance**
  * Admin User Management (listing readers, deactivating/deleting accounts).
  * Comprehensive Playwright CLI automated test suite (positive & negative scenarios).
  * Walkthrough documentation and presentation deck preparation.

---

## 5. Verification & Testing Plan

### Automated Testing (Playwright CLI)
* **Auth & RBAC**: Test valid/invalid login, reader registration, admin route protection, unauthorized redirection.
* **Blog Lifecycle**: Test draft creation, rich text publishing, public visibility, unpublishing (hiding from feed), and permanent deletion with cascade.
* **Taxonomy & Discovery**: Test keyword search, single and multi-category filtering, and page navigation across paginated results.
* **Likes**: Test like button click (increments count), unlike click (decrements count), and duplicate click rejection.
* **Nested Comments**: Test top-level comment submission, nested reply submission (3+ levels), comment editing, and cascade deletion (parent delete removing all child replies).

### Manual Verification
* Responsive mobile viewport audit (Chrome DevTools / Playwright emulated mobile view).
* Cross-role session verification using separate browser sessions.
