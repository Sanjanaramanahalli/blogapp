# Development Plan & Scrum Issue Backlog

**Project**: Full-Stack Blog Application  
**Architect & Scrum Master**: Senior Full-Stack Lead (25 YOE)  
**Methodology**: Agile Scrum with Disciplined Test-Driven Validation (Playwright E2E)

---

## Executive Summary & Milestones Overview

| Milestone | Sprint | Theme | Target Deliverables | Story Points |
| :--- | :---: | :--- | :--- | :---: |
| **M1: Core Engine & Identity** | Sprint 1 | Security, Database, Auth & RBAC | SQLite WAL schema, Seeder, JWT/Session Auth, RBAC, Multer uploads | 21 SP |
| **M2: Publishing & Discovery** | Sprint 1 | Content Lifecycle, Search & Taxonomy | Rich text editor, Draft/Publish toggles, Multi-Taxonomy filter, Search, Pagination | 26 SP |
| **M3: Community Engagement** | Sprint 2 | Discussions & Social Dynamics | Like/Unlike binary toggle, Multi-level nested replies, Cascade deletion | 28 SP |
| **M4: Governance & Quality Gate**| Sprint 2 | Administration, E2E Audit & Demo | Admin User Management, Playwright CLI test suites, Walkthrough & Presentation | 18 SP |

---

## Detailed GitHub Issue Backlog

---

### [ISSUE-01] Database Schema & Cascade Relationships Architecture
* **Classification**: `task` / `backend`
* **Milestone**: M1: Core Engine & Identity (Sprint 1)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `5 Story Points (~6 Hours)`
* **Labels**: `backend`, `database`, `sqlite`, `architecture`

#### Summary
Design and initialize the SQLite database schema with WAL mode enabled, foreign keys enforced, and strict cascade-deletion rules across users, blogs, categories, tags, comments, and likes.

#### Background Context
The application mandates clean relational boundaries where removing a blog post cascades to erase all its comments and likes, and removing a comment cascades to wipe out all nested replies down the branch. SQLite must be configured with `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`.

#### Expected Result
An autonomous database initialization script that builds the tables, indexes, and cascades, plus a seed mechanism generating the default Administrator account (`admin@blog.com` / `Admin@123456`) and baseline categories.

#### Positive Test Cases
1. Verify tables (`users`, `blogs`, `categories`, `tags`, `blog_categories`, `blog_tags`, `comments`, `likes`) are created successfully.
2. Verify foreign keys are active and seed data inserts without errors.
3. Verify WAL mode is set (`PRAGMA journal_mode;` returns `wal`).

#### Negative Test Cases
1. Attempt to insert a comment referencing a non-existent `blog_id` -> must throw foreign key constraint violation.
2. Attempt to insert duplicate likes with the same `(blog_id, user_id)` -> must throw unique constraint violation.

#### Precise Acceptance Criteria
* [ ] Database file initializes cleanly at `server/data/blog.db`.
* [ ] Foreign keys strictly enforced on all relational tables.
* [ ] Default Administrator is seeded with securely hashed password (`bcrypt`).
* [ ] Seed categories (`Technology`, `Design`, `Engineering`, `General`) and tags seeded.

---

### [ISSUE-02] Authentication & Role-Based Access Control (RBAC) Engine
* **Classification**: `backend`
* **Milestone**: M1: Core Engine & Identity (Sprint 1)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `8 Story Points (~10 Hours)`
* **Labels**: `backend`, `auth`, `security`, `rbac`, `jwt`

#### Summary
Implement user registration (Reader role), secure login (JWT / httpOnly cookie sessions), logout, and role-enforcing middleware (`requireAuth`, `requireAdmin`).

#### Background Context
Anonymous visitors are read-only; readers can interact with comments and likes; only the Admin can create blogs and access the admin dashboard. Tokens must be protected against XSS and tampering.

#### Expected Result
Secure API endpoints for `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me` with role-validation guards.

#### Positive Test Cases
1. Register a new user with valid name, email, and strong password -> 201 Created with Reader role.
2. Login as Admin with seeded credentials -> 200 OK with session token set.
3. Access `/api/admin/overview` with Admin token -> 200 OK.
4. Access public reading endpoints without token -> 200 OK.

#### Negative Test Cases
1. Register with an already existing email -> 409 Conflict.
2. Login with incorrect password -> 401 Unauthorized.
3. Access `/api/admin/*` endpoints with Reader token -> 403 Forbidden.
4. Access protected like/comment endpoints without token -> 401 Unauthorized.

#### Precise Acceptance Criteria
* [ ] Passwords hashed with `bcrypt` (salt rounds >= 10).
* [ ] JWT or secure cookie contains user ID, email, and role.
* [ ] RBAC middleware intercepts and blocks unauthorized operations with standard JSON error bodies.

---

### [ISSUE-03] File Upload Engine for Blog Cover Images
* **Classification**: `backend`
* **Milestone**: M1: Core Engine & Identity (Sprint 1)
* **Priority**: `P1 - High`
* **Complexity**: `Medium`
* **Estimated Effort**: `3 Story Points (~4 Hours)`
* **Labels**: `backend`, `uploads`, `multer`, `media`

#### Summary
Configure Multer storage engine for handling local file uploads of blog cover images with MIME type and file-size validation.

#### Background Context
The Admin must be able to upload cover image files directly from their device. Uploaded assets must be served securely from a public static directory with unique sanitized filenames.

#### Expected Result
Endpoint `/api/uploads` accepting `multipart/form-data`, validating image extensions (`.png`, `.jpg`, `.jpeg`, `.webp`), capping size at 5MB, and returning the relative image URL.

#### Positive Test Cases
1. Upload a 2MB `.webp` or `.jpg` file -> 200 OK returning `{ url: "/uploads/cover-172555....jpg" }`.
2. Access the uploaded file via browser URL -> 200 OK with proper image headers.

#### Negative Test Cases
1. Upload an executable file (`.exe` or `.sh`) disguised as image -> 400 Bad Request.
2. Upload an image exceeding 5MB -> 400 Bad Request / 413 Payload Too Large.
3. Attempt upload without Admin privileges -> 403 Forbidden.

#### Precise Acceptance Criteria
* [ ] Validated file storage path at `server/public/uploads`.
* [ ] Strict MIME-type filter accepting only JPEG, PNG, WEBP, and GIF.
* [ ] Unique timestamp/UUID filename generation prevents name collisions.

---

### [ISSUE-04] Blog Publishing Engine & Rich Text Authoring UI
* **Classification**: `frontend` / `backend`
* **Milestone**: M2: Publishing & Discovery (Sprint 1)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `8 Story Points (~10 Hours)`
* **Labels**: `fullstack`, `cms`, `rich-text`, `admin`

#### Summary
Build full CRUD endpoints and responsive admin UI for blog authoring, including rich text editing, cover image upload preview, multi-category selection, tags input, and Draft/Published status switching.

#### Background Context
Only the Admin creates content. Unpublishing a blog moves it to "Draft" without deleting its discussions or likes. Deleting a blog removes it permanently along with all related rows.

#### Expected Result
Interactive Admin Blog Manager: Create Blog, Edit Blog, Toggle Publish/Draft, Delete Blog with cascade warning modal, and clean preview.

#### Positive Test Cases
1. Admin creates a draft blog with rich text formatting (headings, lists) -> Saved as Draft, hidden from public feed.
2. Admin publishes the draft -> Blog immediately appears in public feed.
3. Admin unpublishes the blog -> Hidden from public feed; direct URL returns 404/403 for readers.
4. Admin deletes the blog -> Permanently purged from DB.

#### Negative Test Cases
1. Non-admin or anonymous user attempts POST/PUT/DELETE to `/api/blogs` -> 401/403.
2. Submitting blog with empty title or whitespace-only content -> 400 Bad Request with field errors.

#### Precise Acceptance Criteria
* [ ] Rich text editor integrated seamlessly without external CDN dependencies.
* [ ] Server sanitizes HTML body before database persistence.
* [ ] Status toggle ("Draft" vs "Published") works instantly.
* [ ] Multi-category and multiple tags can be selected and saved.

---

### [ISSUE-05] Public Blog Feed, Keyword Search, Multi-Taxonomy Filter & Pagination
* **Classification**: `frontend` / `backend`
* **Milestone**: M2: Publishing & Discovery (Sprint 1)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `8 Story Points (~10 Hours)`
* **Labels**: `frontend`, `search`, `filter`, `pagination`, `ui`

#### Summary
Develop the public blog feed featuring dynamic keyword search (title/body matching), multi-category filtering, tag filtering, and structured pagination.

#### Background Context
Search, category filtering, and pagination are mandatory core requirements. Anonymous visitors and readers browse this view to discover published content.

#### Expected Result
A clean, responsive, card-based blog feed with search bar, category pills, tag badges, and pagination controls (e.g. 6 blogs per page) updating smoothly.

#### Positive Test Cases
1. Search by keyword "Architect" -> Returns only matching published blogs.
2. Filter by category "Technology" -> Displays blogs assigned to "Technology".
3. Click Page 2 -> Loads the next page of results with correct page count and active pill state.
4. Combine Search + Category Filter -> Returns intersection of matching blogs.

#### Negative Test Cases
1. Search for non-existent keyword -> Shows modern "No blogs found matching your query" empty state with a reset button.
2. Direct navigation to out-of-range page (e.g. `?page=999`) -> Safely renders empty state or redirects to last valid page.

#### Precise Acceptance Criteria
* [ ] Server endpoint `/api/blogs` supports `?search=`, `?category=`, `?tag=`, `?page=`, `?limit=`.
* [ ] Only "published" blogs returned to public requests.
* [ ] Active filter chips visible with one-click clear button.
* [ ] Fully responsive on 320px mobile to 4K desktop screens.

---

### [ISSUE-06] Public Blog Detail & Reading View
* **Classification**: `frontend`
* **Milestone**: M2: Publishing & Discovery (Sprint 1)
* **Priority**: `P1 - High`
* **Complexity**: `Medium`
* **Estimated Effort**: `5 Story Points (~6 Hours)`
* **Labels**: `frontend`, `reader`, `typography`, `responsive`

#### Summary
Build the dedicated blog reader page showing the cover image, author credentials, publication timestamp, reading time estimate, category/tag badges, rendered rich text content, like counter, and discussion section.

#### Background Context
The reading experience must be polished with excellent typography, high readability, and responsive media embeds.

#### Expected Result
A visually captivating article view with sticky social bar (like button, comment anchor, share), proper heading hierarchies, and sanitized rich-content styling.

#### Positive Test Cases
1. Open published blog URL -> Renders full article, cover image, tags, and like count.
2. Verify semantic HTML structure (`<article>`, `<h1>`, `<time>`, `<header>`).

#### Negative Test Cases
1. Open invalid blog slug or ID -> Displays custom 404 "Blog Not Found" view with home link.
2. Non-admin opens draft blog URL -> Returns 404/403 Access Denied.

#### Precise Acceptance Criteria
* [ ] Proper metadata, title tag, and semantic markup.
* [ ] Rich typography with code-block and blockquote formatting.
* [ ] Draft posts protected against guest access.

---

### [ISSUE-07] Binary Like/Unlike Engine with Duplicate Prevention
* **Classification**: `fullstack`
* **Milestone**: M3: Community Engagement (Sprint 2)
* **Priority**: `P0 - Blocker`
* **Complexity**: `Medium`
* **Estimated Effort**: `5 Story Points (~6 Hours)`
* **Labels**: `backend`, `frontend`, `likes`, `engagement`

#### Summary
Implement like/unlike functionality restricted to authenticated users, enforced by unique database constraint, with real-time UI state toggle and public like count display.

#### Background Context
A reader can like a blog once. Clicking again unlikes it. Anonymous visitors clicking like must be prompted to log in.

#### Expected Result
Heart/thumbs-up button toggles between active and inactive states. Count updates immediately.

#### Positive Test Cases
1. Logged-in reader clicks "Like" -> DB inserts like, count increments from N to N+1, button highlights.
2. Reader clicks "Unlike" -> DB removes like, count decrements to N, button resets.
3. Reader refreshes page -> Like status persists accurately for their account.

#### Negative Test Cases
1. Anonymous visitor clicks "Like" -> Opens login/register modal with message "Please sign in to like this blog".
2. Concurrency test: Rapid consecutive clicks -> Does not generate duplicate likes due to `UNIQUE(blog_id, user_id)`.

#### Precise Acceptance Criteria
* [ ] Endpoint `POST /api/blogs/:id/like` toggles like state atomically.
* [ ] Duplicate likes strictly prevented at DB level.
* [ ] Accurate count visible to all users including anonymous visitors.

---

### [ISSUE-08] Multi-Level Nested Discussions & Cascade Deletion Engine
* **Classification**: `fullstack`
* **Milestone**: M3: Community Engagement (Sprint 2)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `13 Story Points (~16 Hours)`
* **Labels**: `comments`, `threading`, `recursive-ui`, `fullstack`

#### Summary
Build the recursive discussion system supporting top-level comments, deeply nested replies (replies to replies), immediate display, author edit/delete, Admin moderation, and cascade thread deletion.

#### Background Context
When any parent comment is deleted, all replies underneath it are permanently deleted from DB and UI. Logged-in users can reply to any node in the tree. Authors can edit and delete their own comments.

#### Expected Result
A threaded discussion tree where clicking "Reply" opens an inline response box under that specific comment, formatting nested children with visual tree guides and handling cascade deletions cleanly.

#### Positive Test Cases
1. Reader posts top-level comment -> Appears immediately at top of discussion list.
2. Reader posts reply to comment -> Appears indented directly under parent comment.
3. Reader posts reply to a reply (Level 3+) -> Appears properly threaded.
4. Author edits their comment -> Updated text renders with "(edited)" timestamp badge.
5. Author or Admin deletes parent comment -> Parent and all nested replies are permanently removed.

#### Negative Test Cases
1. Anonymous user attempts to submit comment/reply -> 401 Unauthorized, redirected to login.
2. Reader attempts to edit or delete another user's comment -> 403 Forbidden.
3. Submitting empty or whitespace comment -> 400 Bad Request validation error.

#### Precise Acceptance Criteria
* [ ] Recursive tree construction algorithm on server or client.
* [ ] Cascade delete enforced by `FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE`.
* [ ] Mobile-responsive indentation that does not collapse text width.
* [ ] Immediate reactive posting without page reload.

---

### [ISSUE-09] Dedicated Admin User Management & Content Moderation Panel
* **Classification**: `fullstack`
* **Milestone**: M4: Governance & Quality Gate (Sprint 2)
* **Priority**: `P1 - High`
* **Complexity**: `Medium`
* **Estimated Effort**: `8 Story Points (~10 Hours)`
* **Labels**: `admin`, `user-management`, `moderation`, `security`

#### Summary
Build the Admin control center to inspect registered reader accounts, manage user statuses (view info, delete/deactivate accounts), and moderate discussions across all blog posts.

#### Background Context
Admin has ultimate platform authority. Deleting a user account cleanly cascades or manages their associated contributions according to platform rules.

#### Expected Result
Admin Dashboard containing:
1. Analytics summary cards (Total Blogs, Published Blogs, Total Readers, Total Comments, Total Likes).
2. Reader Management table with search, role display, and delete action.
3. Moderation list allowing one-click deletion of inappropriate comments across all posts.

#### Positive Test Cases
1. Admin views list of all registered readers with creation dates and emails.
2. Admin deletes a problematic reader account -> DB cascades removal of user session and access.
3. Admin edits admin credentials (name, email, password) from settings tab.

#### Negative Test Cases
1. Non-admin tries to navigate to `/admin/users` -> Redirected to home with 403 alert.
2. Admin cannot delete their own primary admin account.

#### Precise Acceptance Criteria
* [ ] Dedicated Admin navigation bar with quick links to Blogs, Users, Moderation, and Settings.
* [ ] Full CRUD operations on user accounts by Admin.
* [ ] Secure password update form requiring old password confirmation.

---

### [ISSUE-10] Playwright CLI End-to-End Test Suite & Quality Gate
* **Classification**: `task` / `qa`
* **Milestone**: M4: Governance & Quality Gate (Sprint 2)
* **Priority**: `P0 - Blocker`
* **Complexity**: `High`
* **Estimated Effort**: `8 Story Points (~10 Hours)`
* **Labels**: `testing`, `playwright`, `automation`, `qa`

#### Summary
Develop an automated Playwright CLI end-to-end test suite executing both positive and negative scenarios across all user roles, workflows, and edge cases.

#### Background Context
No issue is transitioned to "Completed" on the board without passing its automated test suite in headless browser execution.

#### Expected Result
Test suite in `tests/e2e/` verifying:
1. `auth.spec.js`: Register, Login, Admin guard, Unauthorized access.
2. `blogs.spec.js`: Draft/Publish lifecycle, Rich text render, Search, Category filter, Pagination.
3. `engagement.spec.js`: Like/Unlike toggle, Duplicate like prevention, Like count accuracy.
4. `comments.spec.js`: Top-level comment, Nested reply (level 1 to 3), Comment edit, Cascade deletion.
5. `admin.spec.js`: User management, Comment moderation, Post deletion with cascade.

#### Positive Test Cases
1. `npm test` runs all Playwright tests to 100% green pass in headless mode.
2. Cross-browser verification in Chromium and Mobile viewport.

#### Negative Test Cases
1. Test deliberate failure injection (e.g. duplicate like attempt) -> verified that application rejects properly.

#### Precise Acceptance Criteria
* [ ] Single command `npm test` executes the complete test run.
* [ ] All 10 backlog issues verified against acceptance criteria.
* [ ] Playwright report generated cleanly.

---

### [ISSUE-11] Project Presentation Deck, Walkthrough & Documentation
* **Classification**: `enhancement` / `task`
* **Milestone**: M4: Governance & Quality Gate (Sprint 2)
* **Priority**: `P1 - High`
* **Complexity**: `Medium`
* **Estimated Effort**: `5 Story Points (~6 Hours)`
* **Labels**: `docs`, `presentation`, `demo`, `walkthrough`

#### Summary
Create the complete project documentation (`README.md`, setup guide) and a structured 10–15 minute presentation deck detailing architecture, AI tool utilization, code authorship breakdown, and live demonstration script.

#### Background Context
The project requires demonstrating not just that the app works, but that the engineering rationale, AI pair-programming methodology, and architectural decisions are thoroughly understood.

#### Expected Result
- Comprehensive `README.md` with zero-friction startup instructions.
- Presentation document (`PRESENTATION.md` or slide deck) covering all 16 required presentation points.
- Step-by-step walkthrough demo script for a 10-15 minute showcase.

#### Precise Acceptance Criteria
* [ ] Complete instructions to run app locally (`npm install`, `npm run seed`, `npm run dev`).
* [ ] Transparent breakdown of AI-assisted code vs. manually verified/written components.
* [ ] Step-by-step demo script covering Admin, Reader, and Guest journeys.
