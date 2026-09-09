# ApexBlog — Full-Stack Publishing & Threaded Discussions Platform

A production-ready, secure, user-friendly, and responsive Full-Stack Blog Application featuring strict Role-Based Access Control (RBAC), rich text authoring with cloud media uploads, multi-taxonomy discovery (keyword search, multi-category chips, tags, pagination, editions), binary like/unlike mechanics, bookmarking, and multi-level nested discussions with automatic cascade deletion.

---

## 🏗️ Production Architecture

ApexBlog is prepared for free-tier cloud deployment using a decoupled full-stack architecture:

```text
                     +---------------------------+
                     |    GitHub Source Control  |
                     +-------------+-------------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
      +-----------------------+         +-----------------------+
      |    Vercel Frontend    |         |    Render Backend     |
      |   (HTML / CSS / JS)   |         |    (Node / Express)   |
      |   Custom Routing &    |         |   REST API & Security |
      |   Glassmorphism UI    |         |   CORS & JWT Auth     |
      +-----------+-----------+         +-----------+-----------+
                  |                                 |
                  +------------ HTTPS / API --------+
                                                    |
                                                    v
                                        +-----------------------+
                                        |  Supabase PostgreSQL  |
                                        |   Hosted Database     |
                                        |      with Prisma      |
                                        +-----------------------+
```

| Layer | Technology | Hosting Target | Free Tier Capability |
| :--- | :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla CSS Design System, Modular JS | **Vercel** | Unlimited deployments, fast global CDN edge, client-side routing |
| **Backend API** | Node.js, Express.js, JWT, Multer, Nodemailer | **Render** | Free web service with automatic GitHub continuous deployment |
| **Database** | PostgreSQL with Prisma ORM (SQLite for local dev) | **Supabase** | 500 MB free PostgreSQL database with automated backups |
| **Media Storage** | Cloudinary / Supabase Storage (local fallback) | **Cloudinary / Supabase** | Persistent cloud image uploads surviving server restarts |

---

## 👥 User Roles & Access Control

1. **Administrator (`admin`)**:
   * Secure credential & OAuth authentication.
   * Full Blog authoring, rich text editing, draft vs. published state toggling, and deletion.
   * Cross-post comment and reply moderation with recursive cascade deletion.
   * User directory inspection and account deletion.
   * Access to executive analytics dashboard (total posts, users, comments, likes).
2. **Registered Reader (`reader`)**:
   * Self-registration, secure login, profile inspection and bio editing.
   * Reading published articles, liking/unliking with atomic toggle.
   * Submitting root comments and multi-level nested replies.
   * Editing and deleting own comments and replies.
   * Bookmarking/saving articles for reading later.
   * Server-side rejection (403 Forbidden) when attempting administrative actions.
3. **Anonymous Visitor**:
   * Public article browsing, multi-category filtering, keyword search, edition toggling.
   * Reading full articles, reading discussion threads and viewing like counts.
   * Interacting (liking, commenting, saving) opens a polite authentication modal.

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js**: v20 or higher
* **NPM**: v10 or higher

### 1. Clone & Install
```bash
git clone https://github.com/your-username/fullstack-blog-application.git
cd fullstack-blog-application
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(In local development, the application defaults to local SQLite at `server/data/blog.db` with zero external dependencies required).*

### 3. Seed Local Database
```bash
npm run seed
```

**Default Demo Credentials:**
* **Administrator**: `admin@blog.com` / `Admin@123456`
* **Reader 1**: `john@reader.com` / `Reader@123`
* **Reader 2**: `sarah@reader.com` / `Reader@123`

### 4. Start Local Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 5. Run Test Suites
* **Backend Integration Suite**:
  ```bash
  node tests/backend-integration.test.js
  ```
* **Playwright E2E Browser Regression Suite**:
  ```bash
  npm test
  ```

---

## 🌐 Free Production Deployment Guide

Follow these sequential steps to deploy your application to the cloud at zero cost:

### Step 1: Database Setup on Supabase (PostgreSQL)

1. Sign up or log in to [Supabase](https://supabase.com).
2. Click **"New project"**, choose an organization, name your project (e.g. `apexblog`), set a strong database password, and select a nearby region.
3. Once the database is provisioned (1-2 minutes):
   * Go to **Project Settings** -> **Database**.
   * Under **Connection string**, select **URI**.
   * Copy the connection string. It will look like:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
4. In your local terminal, apply the Prisma migrations directly to Supabase:
   ```bash
   npx cross-env DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" npx prisma migrate deploy
   ```
5. *(Optional)* Seed the default Administrator and sample articles into Supabase:
   ```bash
   npx cross-env DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" node scripts/seed-prisma.js
   ```

---

### Step 2: Push Repository to GitHub

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `fullstack-blog-application`).
2. Add your GitHub remote and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fullstack-blog-application.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 3: Deploy Backend API to Render

1. Sign up or log in to [Render](https://render.com).
2. Click **"New +"** -> **"Web Service"**.
3. Connect your GitHub repository.
4. Fill in the deployment details:
   * **Name**: `apexblog-api`
   * **Region**: Choose the region closest to your Supabase project
   * **Branch**: `main`
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npx prisma generate`
   * **Start Command**: `npm start`
   * **Instance Type**: `Free`
5. Click **"Advanced"** -> **"Add Environment Variable"** and configure:
   * `NODE_ENV` = `production`
   * `PORT` = `10000`
   * `DATABASE_URL` = *Your Supabase PostgreSQL URI (from Step 1)*
   * `DIRECT_URL` = *Your Supabase PostgreSQL URI (from Step 1)*
   * `JWT_SECRET` = *A strong random secret string (minimum 32 characters)*
   * `FRONTEND_URL` = *Your Vercel URL, e.g. `https://apexblog.vercel.app` (you can update this after Step 4)*
   * *(Optional for cloud images)* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
6. Click **"Create Web Service"**.
7. Once deployed, note down your Render service URL (e.g. `https://apexblog-api.onrender.com`).
8. Test the health endpoint in your browser:
   `https://apexblog-api.onrender.com/api/health` -> should return `{"status":"healthy"}`.

---

### Step 4: Deploy Frontend to Vercel

1. Sign up or log in to [Vercel](https://vercel.com).
2. Click **"Add New..."** -> **"Project"**.
3. Import your GitHub repository (`fullstack-blog-application`).
4. Configure project settings:
   * **Framework Preset**: `Other`
   * **Root Directory**: `./`
   * **Build Command**: `npm run build`
   * **Output Directory**: `public`
5. In **Environment Variables**, add:
   * `VITE_API_URL` = `https://apexblog-api.onrender.com` (Your Render backend URL from Step 3)
6. Click **"Deploy"**.
7. Once deployed, Vercel will assign you a live production URL (e.g. `https://apexblog.vercel.app`).
8. Update `FRONTEND_URL` on your Render service dashboard with your exact Vercel URL so CORS allows authenticated browser requests.

---

## 🔒 Security & Production Hardening

* **Role-Based Authorization**: Authoring (`POST /api/blogs`), blog deletion, user account management, and comment moderation strictly enforce `role === 'admin'` on the server side.
* **Cascading Relational Integrity**: Recursive foreign key deletion cascades (`ON DELETE CASCADE`) guarantee zero orphaned comments, replies, likes, or bookmark records.
* **Content Sanitization**: Rich text HTML is scrubbed via `sanitize-html` to prevent stored Cross-Site Scripting (XSS).
* **Controlled CORS**: Origin whitelisting allows only the authorized Vercel domain and development endpoints with credentials.
* **Clean Error Masking**: Internal server and database error stack traces are suppressed in production mode.
* **Persistent Media**: Cloudinary and Supabase Storage support eliminate data loss caused by container restarts on ephemeral filesystems.

---

## 📋 Production Verification Checklist

- [ ] **Visitor**: Home page loads articles from Supabase PostgreSQL.
- [ ] **Visitor**: Search keyword and category filter work smoothly.
- [ ] **Visitor**: Clicking Like or Comment displays login prompt.
- [ ] **Reader**: Self-registration works with email and password complexity validation.
- [ ] **Reader**: Login sets signed JWT; user can like/unlike articles and bookmark them.
- [ ] **Reader**: Submitting comments and replying to existing comments updates discussion trees.
- [ ] **Reader**: Reader editing own comment succeeds; editing another user's comment returns 403.
- [ ] **Reader**: Reader attempting `POST /api/blogs` receives 403 Forbidden.
- [ ] **Admin**: Admin login reveals Dashboard and Article Management tabs.
- [ ] **Admin**: Admin can create, publish, unpublish, and delete articles.
- [ ] **Admin**: Deleting an article cascades to delete all associated comments and likes automatically.
