# ApexBlog — Full-Stack Publishing & Threaded Discussions Platform

A production-grade, responsive, and secure Full-Stack Blog Application featuring strict Role-Based Access Control (RBAC), rich text authoring with device media uploads, multi-taxonomy discovery (search, multi-category, tags, pagination), binary like/unlike mechanics, and multi-level nested discussions with cascade deletion.

---

## 🌟 Key Highlights & System Architecture

* **Relational ACID Database**: Powered by native `node:sqlite` in WAL (Write-Ahead Logging) mode, enforcing foreign key integrity and strict cascade deletion (`ON DELETE CASCADE`) on both blogs and recursive comments.
* **Role-Based Access Control (RBAC)**:
  * **Administrator**: Full authoring, status toggles (Draft vs Published), blog CRUD, cross-post comment moderation, reader account management, profile settings.
  * **Registered Reader**: Self-registration, liking/unliking blogs, submitting top-level comments and deeply nested replies, editing and deleting own comments.
  * **Anonymous Visitor**: Read-only browsing, keyword search, multi-taxonomy filtering, viewing like counts and public discussions. Interacting opens a polite authentication modal.
* **Modern Design System**: Pure Vanilla CSS design tokens with Glassmorphism, dark/light theme switcher, responsive layout grid, and fluid typography (`Outfit` and `Inter` via Google Fonts).
* **Automated Quality Gate**: Comprehensive Playwright CLI end-to-end browser test suites testing both positive and negative scenarios across all roles.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v20+ (developed and verified on Node.js v24 with native SQLite)
* **NPM**: v10+

### 1. Installation
Clone or navigate to the project directory and install dependencies:
```bash
npm install
```

### 2. Initialize and Seed Database
Run the automated seed script to initialize the schema, cascade rules, default Admin, demo readers, categories, tags, sample articles, likes, and nested comment threads:
```bash
npm run seed
```

**Default Demo Credentials:**
* **Administrator**: `admin@blog.com` / `Admin@123456`
* **Registered Reader 1**: `john@reader.com` / `Reader@123`
* **Registered Reader 2**: `sarah@reader.com` / `Reader@123`

### 3. Start the Application
```bash
npm run dev
```
Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🧪 Automated Testing (Playwright CLI)

Run the full end-to-end headless browser regression suite:
```bash
npm test
```
Or run the backend integration test suite:
```bash
node tests/backend-integration.test.js
```

---

## 📁 Directory Structure

```
├── public/                     # Frontend Client
│   ├── css/
│   │   ├── styles.css          # Design system, themes, cards, toasts, layouts
│   │   ├── rich-text.css       # Article typography, social bar, nested comment tree
│   │   └── admin.css           # Admin dashboard, stats grid, data tables
│   ├── js/
│   │   ├── api.js              # API client, JWT storage, theme toggle, toasts
│   │   ├── app.js              # Public feed, search, category filtering, pagination
│   │   ├── blog-detail.js      # Article view, reading time, like toggle
│   │   ├── comments.js         # Recursive comments engine, inline replies, edit, cascade delete
│   │   └── admin.js            # Admin metrics, CRUD, image upload, moderation, users
│   ├── uploads/                # Static storage for uploaded cover images
│   ├── index.html              # Public home feed
│   ├── blog.html               # Article reading view & discussions
│   ├── admin.html              # Admin Control Center
│   ├── login.html              # Sign in page (with 1-click demo logins)
│   └── register.html           # Public reader sign-up page
├── server/                     # Backend API & Database
│   ├── db/
│   │   ├── database.js         # SQLite connection (WAL, foreign keys)
│   │   ├── schema.sql          # Relational tables, indexes, cascade rules
│   │   └── seed.js             # Initial database seeder
│   ├── middleware/
│   │   ├── auth.js             # JWT extraction, requireAuth, requireAdmin
│   │   └── upload.js           # Multer configuration with MIME & size validation
│   ├── controllers/            # REST controllers (auth, blog, comment, like, user)
│   ├── routes/                 # Express route definitions
│   ├── app.js                  # Express application setup
│   └── server.js               # HTTP server entrypoint
├── tests/                      # Automated Verification
│   ├── backend-integration.test.js
│   └── e2e/
│       ├── auth-rbac.spec.js           # 6 tests: Reader/Admin auth, RBAC guard, input validation
│       ├── blogs-publishing.spec.js    # 6 tests: CMS lifecycle, rich-text editor, authoring
│       ├── blog-feed.spec.js           # 11 tests: Search, taxonomy filter, chip removal, pagination
│       ├── blog-detail.spec.js         # 6 tests: Semantic HTML, dynamic reading time, 404/403 states
│       ├── discussions-likes.spec.js   # 5 tests: Atomic likes, threaded comments, cascade delete
│       ├── file-upload.spec.js         # 6 tests: Multer upload engine, MIME verify, live preview
│       └── admin-management.spec.js    # 8 tests: Metrics, user management, comment moderation
├── development_plan.md         # Scrum backlog, milestones, and issue specifications
├── implementation_plan.md      # Architectural design & consensus panel review
├── PRESENTATION.md             # Complete 16-slide presentation deck & live demo script
├── walkthrough.md              # Historical sprint walkthroughs & verification reports
└── package.json
```

---

## 🏆 Sprint & Quality Gate Verification Matrix

| Sprint | Ticket | Domain | Specs / Features | E2E Tests | Status |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **Sprint 1** | [ISSUE-01] | Database Architecture | SQLite WAL schema, foreign keys, cascade deletes | 12 API | ✅ Verified |
| **Sprint 2** | [ISSUE-02] | Authentication & RBAC | JWT auth, role cookies, guest guard, register/login UX | 6 E2E | ✅ Verified |
| **Sprint 3** | [ISSUE-03] | File Upload Engine | Multer storage, MIME verification, size limit, live preview | 6 E2E | ✅ Verified |
| **Sprint 4** | [ISSUE-04] | Publishing Engine & CMS | Rich text authoring, draft/publish lifecycle, categories/tags | 6 E2E | ✅ Verified |
| **Sprint 5** | [ISSUE-05] | Discovery & Public Feed | Debounced search, multi-category filter, chips, pagination | 11 E2E | ✅ Verified |
| **Sprint 6** | [ISSUE-07] | Binary Likes Engine | Atomic binary like/unlike, duplicate prevention, counts | 2 E2E | ✅ Verified |
| **Sprint 7** | [ISSUE-08] | Nested Discussions | Recursive comment tree, inline reply, author edit, cascade | 3 E2E | ✅ Verified |
| **Sprint 8** | [ISSUE-06] | Public Blog Detail View | Semantic `<article>`, `<time>`, reading time, custom 404/403 | 6 E2E | ✅ Verified |
| **Sprint 9** | [ISSUE-09] | Admin Governance Panel | Metrics grid, reader management, comment moderation | 8 E2E | ✅ Verified |
| **Sprint 10**| [ISSUE-10] | Playwright Quality Gate | Automated regression test suite across all 7 specs (48 tests) | 48 E2E | ✅ Verified |
| **Sprint 11**| [ISSUE-11] | Project Presentation & Docs | Complete deck (`PRESENTATION.md`), walkthrough, setup guide | Docs | ✅ Verified |

---

## 🛡️ API Endpoints Reference

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new Reader account |
| `POST` | `/api/auth/login` | Public | Login (Admin or Reader) |
| `POST` | `/api/auth/logout` | Public | Clear auth cookie |
| `GET` | `/api/auth/me` | Public / Token | Get current authenticated user |
| `PUT` | `/api/auth/profile` | Authenticated | Update user name, email, or password |
| `GET` | `/api/blogs` | Public | Get blogs (with search, category, tag, page) |
| `GET` | `/api/blogs/taxonomy` | Public | Get categories and tags with counts |
| `GET` | `/api/blogs/:slugOrId`| Public / Draft | Get single article detail |
| `POST` | `/api/blogs` | Admin Only | Create new article |
| `PUT` | `/api/blogs/:id` | Admin Only | Update article details |
| `PATCH`| `/api/blogs/:id/status`| Admin Only | Toggle publish / draft status |
| `DELETE`| `/api/blogs/:id` | Admin Only | Cascade delete article, comments, and likes |
| `POST` | `/api/uploads/cover` | Admin Only | Upload cover image file (max 5MB) |
| `GET` | `/api/blogs/:id/likes` | Public | Get like count and user liked status |
| `POST` | `/api/blogs/:id/likes/toggle` | Authenticated | Toggle like/unlike atomically |
| `GET` | `/api/blogs/:id/comments` | Public | Get recursive tree of discussions |
| `POST` | `/api/blogs/:id/comments` | Authenticated | Post comment or nested reply |
| `PUT` | `/api/comments/:id` | Author Only | Edit own comment |
| `DELETE`| `/api/comments/:id` | Author / Admin | Cascade delete comment and all child replies |
| `GET` | `/api/admin/overview` | Admin Only | Get dashboard metric analytics |
| `GET` | `/api/admin/users` | Admin Only | List registered reader accounts |
| `DELETE`| `/api/admin/users/:id`| Admin Only | Delete reader account |
| `GET` | `/api/admin/comments` | Admin Only | Moderation view of all platform comments |

---

## ⚖️ License
MIT License. Built for technical showcase and evaluation.
