# Sprint 17 Walkthrough: Google Account Login, User/Admin Profile Management, Content Interaction & News Portal Features

**Project**: ApexBlog Full-Stack Application  
**Sprint**: Sprint 17  
**GitHub Issue**: [Issue #27](https://github.com/Sanjanaramanahalli/blogapp/issues/27) — `[ISSUE-17] Google Account Login and User/Admin Profile Management with Content Interaction & News Portal Features`  
**Status**: 🚀 **100% Implemented, Verified (19 / 19 E2E Tests), 3-Subagent Approved, Merged to `main` & Closed**  

---

## 1. Overview of Delivered Features

Sprint 17 successfully delivered and integrated user/admin profile management, strict password complexity validation, news-portal content interactions (article bookmarking & sharing), and role-based video article publishing on top of Google Account authentication:

1. **Google Account Login with Chooser & Account Switching**:
   - Seamless "Continue with Google" flow with account chooser ("Alex Mercer" & "Admin User").
   - Support for "Use another account" with instant credentials and email verification approval.
   - Strict validation preventing fake, non-existent, or unauthorized Google accounts.

2. **Registered Email Validation & Strict Password Complexity**:
   - Enforces minimum 8 characters, at least one uppercase letter (`[A-Z]`), at least one lowercase letter (`[a-z]`), at least one number (`[0-9]`), and at least one special character (`[!@#$%^&*(),.?":{}|<>]`).
   - Returns explicit, actionable error messages identifying the exact missing complexity requirement.

3. **Individual Profile Management (`/profile`)**:
   - Profile overview displaying user avatar, name, email, role badge, and bio.
   - Live photo upload with strict validation: only image files (`.jpeg`, `.png`, `.webp`, `.gif`, `.avif`) are accepted; unsupported documents (`.txt`, `.pdf`) are rejected with clear error feedback.
   - Profile metadata editing (display name, bio, email address) with email format validation and persistence in SQLite.
   - Secure password update requiring verification of current password and adherence to password complexity rules.

4. **Content Interactions & News Portal Features**:
   - **Save / Bookmark Article (`POST /api/blogs/:id/save`)**: Persisted bookmarks in `saved_blogs` database table with cascade deletion; accessible in the user profile under the "Saved Articles" tab.
   - **Share Article**: Native Web Share API integration with automatic fallback to clipboard URL copy; error handling for non-existent or unavailable articles.
   - **Video News Publishing**: Support for embedded video reports (YouTube iframe embed & HTML5 video) alongside rich text authoring.
   - **Role-Based Publishing Gating**: Non-admin/unauthenticated users are strictly blocked from publishing.

---

## 2. Playwright Automated End-to-End Test Results

All 19 acceptance scenarios (9 Positive, 10 Negative) defined in the sprint blueprint were automated in [`tests/e2e/profile-and-news-portal.spec.js`](file:///c:/Users/giris/OneDrive/Desktop/blog%20applicaton/tests/e2e/profile-and-news-portal.spec.js) and executed via Playwright CLI:

```bash
npx playwright test tests/e2e/profile-and-news-portal.spec.js
```

### Execution Summary
```
Running 19 tests using 1 worker

  ok   1 [chromium] › Positive 1: Login using an existing Google account (2.4s)
  ok   2 [chromium] › Positive 2: Login using another Google account (2.4s)
  ok   3 [chromium] › Positive 3: Validate registered email during login (2.0s)
  ok   4 [chromium] › Positive 4: Validate password requirements (uppercase, lowercase, number, special char) (2.0s)
  ok   5 [chromium] › Positive 5: Create / Manage user/admin profile (bio, name, email) (3.5s)
  ok   6 [chromium] › Positive 6: Upload profile photo (1.7s)
  ok   7 [chromium] › Positive 7: Create blog/video post by authorized user/admin (4.4s)
  ok   8 [chromium] › Positive 8: Save a blog to bookmarks and view in profile (3.8s)
  ok   9 [chromium] › Positive 9: Share a blog (2.8s)
  ok  10 [chromium] › Negative 1: Enter an invalid/non-existent Google email ID (1.9s)
  ok  11 [chromium] › Negative 2: Enter an incorrect Google account password (1.6s)
  ok  12 [chromium] › Negative 3: Enter a password without an uppercase letter (1.5s)
  ok  13 [chromium] › Negative 4: Enter a password without a lowercase letter (3.5s)
  ok  14 [chromium] › Negative 5: Enter a password without a number (1.6s)
  ok  15 [chromium] › Negative 6: Enter a password without a special character (1.5s)
  ok  16 [chromium] › Negative 7: Upload an unsupported/invalid profile image (.txt or .pdf) (2.5s)
  ok  17 [chromium] › Negative 8: Submit an empty or invalid email in the profile (4.4s)
  ok  18 [chromium] › Negative 9: Unauthorized user attempts to publish a blog/video (2.3s)
  ok  19 [chromium] › Negative 10: Attempt to save or share a non-existent or unavailable blog (2.4s)

============================================================
19 passed (100% green)
============================================================
```

### Full Regression Suite Status
- **`tests/e2e/google-account-chooser.spec.js`**: **8 / 8 PASSED** (100%)
- **`tests/e2e/multi-social-signup-editions.spec.js`**: **26 / 26 PASSED** (100%)

---

## 3. Subagent Consensus Code Reviews

### Reviewer 1: Security & RBAC Reviewer
- **Password Complexity Validation**:
  - `validatePasswordComplexity(password)` is enforced both on the server controller (`auth.controller.js` and `profile.controller.js`) and on the client forms (`register.html`, `profile.html`). Checks minimum 8 characters, `[A-Z]`, `[a-z]`, `[0-9]`, and special characters.
- **Upload Restrictions**:
  - Multer storage middleware (`server/middleware/upload.js`) strictly verifies MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`) and rejects malicious extensions or text/pdf uploads with HTTP 400.
- **Publishing RBAC Guard**:
  - `POST /api/blogs` strictly enforces `requireAuth` and role verification; non-admins and unauthenticated visitors cannot publish articles or video posts.
- **Verdict**: **APPROVED**

### Reviewer 2: UX & Accessibility Reviewer
- **Profile Interface & Interactions**:
  - Modern, responsive card layout with tabs for "Profile Settings" and "Saved Articles".
  - Profile photo upload has instant preview, file name display, and accessible status announcements.
  - Bookmarking button dynamically updates icon, text (`Save` / `Saved`), and ARIA attribute (`aria-pressed="true|false"`).
- **Accessible Alerts & Feedback**:
  - Form validations feature `role="alert"` and `aria-live="assertive"` for instantaneous screen reader notification.
- **Verdict**: **APPROVED**

### Reviewer 3: Architecture & System Design Reviewer
- **Schema & Migration Design**:
  - Added `bio TEXT DEFAULT ''` to `users` table and created `saved_blogs` table with `ON DELETE CASCADE` foreign keys and indexed columns (`idx_saved_blogs_user_id`, `idx_saved_blogs_blog_id`).
  - Safe runtime migration in `initSchema()` ensures backward compatibility across database versions.
- **RESTful Endpoints & Controller Structure**:
  - Profile endpoints separated into dedicated controller `server/controllers/profile.controller.js` and mounted cleanly at `/api/user`.
- **Verdict**: **APPROVED**

---

## 4. Git & GitHub Lifecycle

| Step | Detail |
| :--- | :--- |
| **Feature Branch** | `feature/issue-17-profile-management-news-portal` |
| **Commit** | `5fb1998` (`feat(auth,profile,news): [ISSUE-17] Google account login, user/admin profile management, password rules, bookmarking, and news portal features`) |
| **Merge Strategy** | Non-fast-forward merge into `main` (`4679686`) |
| **Remote Repository** | Pushed to `https://github.com/Sanjanaramanahalli/blogapp.git` (`main` and feature branch) |
| **GitHub Issue** | Closed [Issue #27](https://github.com/Sanjanaramanahalli/blogapp/issues/27) |
