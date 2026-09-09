const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

async function safeNavigate(page, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('[ISSUE-17] Google Account Login, User/Admin Profile Management, Content Interaction & News Portal Features', () => {

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(600);
  });

  // ==========================================
  // POSITIVE TEST CASES (1 - 9)
  // ==========================================

  test('Positive 1: Login using an existing Google account', async ({ page }) => {
    // 1. Open the Blog application login page
    await safeNavigate(page,'/login');
    await expect(page).toHaveURL('/login');

    // 2. Click Continue with Google
    const googleBtn = page.locator('#btn-google-login');
    await expect(googleBtn).toBeVisible();
    await googleBtn.click();

    // 3. Chooser screen appears
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    await expect(page.locator('#google-header-title')).toHaveText('Choose an account');

    // 4. Select already signed-in Google account (Alex Mercer)
    const alexAccountItem = page.locator('#account-item-alex');
    await expect(alexAccountItem).toBeVisible();
    await alexAccountItem.click();

    // 5. Verification / approval prompt appears
    const verificationModal = page.locator('#google-verification-modal');
    await expect(verificationModal).toBeVisible();
    await expect(page.locator('#btn-approve-verification')).toBeVisible();

    // 6. Click Approve to grant access
    await page.locator('#btn-approve-verification').click();

    // 7. Successfully authenticated and redirected to application
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });
    await expect(page).not.toHaveURL('/login');

    // Verify user is authenticated
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe('alex.dev@gmail.com');
  });

  test('Positive 2: Login using another Google account', async ({ page }) => {
    await safeNavigate(page,'/login');
    await page.locator('#btn-google-login').click();
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // Click "Use another account"
    const useAnotherBtn = page.locator('#btn-use-another-account');
    await expect(useAnotherBtn).toBeVisible();
    await useAnotherBtn.click();

    // Enter another valid Google account
    const uniqueEmail = `sarah.google.${Date.now()}@gmail.com`;
    await page.fill('#google-email', uniqueEmail);
    await page.fill('#google-password', 'ValidGooglePassword123!');
    await page.click('#btn-google-signin-submit');

    // Verification prompt
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });

    // Successfully logged in as the new account
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe(uniqueEmail.toLowerCase());
  });

  test('Positive 3: Validate registered email during login', async ({ page }) => {
    await safeNavigate(page,'/login');

    // Enter valid registered email and password
    await page.locator('#login-email').fill('admin@blog.com');
    await page.locator('#login-password').fill('Admin@123456');
    await page.locator('#btn-submit-login').click();

    // Email is accepted and authentication succeeds (admin redirected to admin dashboard)
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await expect(page).toHaveURL('/admin');
  });

  test('Positive 4: Validate password requirements (uppercase, lowercase, number, special char)', async ({ page }) => {
    await safeNavigate(page,'/register');

    const uniqueEmail = `complex_user_${Date.now()}@example.com`;
    await page.locator('#reg-name').fill('Complex Password Tester');
    await page.locator('#reg-email').fill(uniqueEmail);
    // Meets: length >= 8, uppercase, lowercase, number, special char
    await page.locator('#reg-password').fill('Secure@Pass2026');

    await page.locator('#btn-submit-register').click();

    // User is successfully registered and redirected
    await page.waitForURL('/', { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).toBeDefined();
    expect(meRes.user.name).toBe('Complex Password Tester');
  });

  test('Positive 5: Create / Manage user/admin profile (bio, name, email)', async ({ page }) => {
    // 1. Sign in as reader
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-reader').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL('/', { timeout: 10000 });

    // 2. Open Profile page
    await safeNavigate(page,'/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('#profile-display-name')).toBeVisible();

    // 3. Edit bio and name
    const updatedName = `Johnathan Reader ${Date.now()}`;
    const newBio = 'Senior Tech Writer & Cloud Engineer. Passionate about Node.js and AI.';
    await page.locator('#profile-bio-input').fill(newBio);
    await page.locator('#profile-name-input').fill(updatedName);

    // 4. Save Profile
    await page.locator('#btn-save-profile').click();

    // 5. Verify success alert and updated header
    await expect(page.locator('#profile-success-alert')).toBeVisible();
    await expect(page.locator('#profile-success-alert')).toContainText('Profile information saved successfully');
    await expect(page.locator('#profile-display-name')).toHaveText(updatedName);
    await expect(page.locator('#profile-display-bio')).toHaveText(newBio);

    // 6. Restore original profile name for test isolation
    await page.locator('#profile-name-input').fill('John Reader');
    await page.locator('#profile-bio-input').fill('');
    await page.locator('#btn-save-profile').click();
    await expect(page.locator('#profile-display-name')).toHaveText('John Reader');
  });

  test('Positive 6: Upload profile photo', async ({ page }) => {
    // Login as admin
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-admin').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL(/\/admin|\//, { timeout: 10000 });

    // Open Profile
    await safeNavigate(page,'/profile');
    await expect(page).toHaveURL('/profile');

    // Create a temporary valid test image in os.tmpdir() to avoid triggering file watcher
    const tempImgPath = path.join(os.tmpdir(), `temp_test_avatar_${Date.now()}.png`);
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(tempImgPath, pngBuffer);

    try {
      // Set input file directly via setInputFiles
      await page.setInputFiles('#avatar-file-input', tempImgPath);

      // Verify upload succeeds and avatar is displayed
      await expect(page.locator('#profile-success-alert')).toBeVisible();
      await expect(page.locator('#profile-success-alert')).toContainText('Profile photo uploaded successfully');

      const avatarImg = page.locator('#profile-avatar-img');
      await expect(avatarImg).toBeVisible();
      const src = await avatarImg.getAttribute('src');
      expect(src).toContain('/uploads/');
    } finally {
      if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);
    }
  });

  test('Positive 7: Create blog/video post by authorized user/admin', async ({ page }) => {
    // Login as admin
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-admin').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL(/\/admin|\//, { timeout: 10000 });

    // Navigate to Write page
    await safeNavigate(page,'/write');
    await expect(page).toHaveURL('/write');

    const title = `Portal News Video Post ${Date.now()}`;
    await page.locator('#blog-title').fill(title);
    await page.locator('#blog-body').fill('This is a breaking technology story on ApexBlog with embedded video report.');
    await page.locator('#blog-video-url').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Publish
    await page.locator('#btn-publish').click();

    // Verify published and displayed
    await page.waitForURL(/\/blog\/.+/, { timeout: 10000 });
    await expect(page.locator('h1.article-title')).toHaveText(title);
    await expect(page.locator('.article-video-wrapper')).toBeVisible();
  });

  test('Positive 8: Save a blog to bookmarks and view in profile', async ({ page }) => {
    // Login as reader
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-reader').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Open first article on homepage via title link
    const firstBlogTitleLink = page.locator('.blog-card-title a').first();
    await expect(firstBlogTitleLink).toBeVisible();
    const articleTitle = await firstBlogTitleLink.innerText();
    await firstBlogTitleLink.click();

    await page.waitForURL(/\/blog\/.+/, { timeout: 10000 });
    await expect(page.locator('h1.article-title')).toBeVisible();

    // Click Save (deterministic toggle)
    const saveBtn = page.locator('#btn-save-blog');
    await expect(saveBtn).toBeVisible();
    const saveText = page.locator('#save-text');
    if ((await saveText.innerText()).trim() === 'Saved') {
      await saveBtn.click();
      await expect(saveText).toHaveText('Save');
    }
    await saveBtn.click();

    // Verify button updates to "Saved"
    await expect(saveText).toHaveText('Saved');

    // Navigate to Profile Saved Articles tab
    await safeNavigate(page,'/profile');
    await page.locator('#btn-tab-saved').click();

    // Verify the saved article is present
    await expect(page.locator('#saved-articles-list')).toContainText(articleTitle.trim());
  });

  test('Positive 9: Share a blog', async ({ page }) => {
    // Open an article directly
    await safeNavigate(page,'/');
    const firstBlogTitleLink = page.locator('.blog-card-title a').first();
    await expect(firstBlogTitleLink).toBeVisible();
    await firstBlogTitleLink.click();
    await page.waitForURL(/\/blog\/.+/, { timeout: 10000 });

    // Click Share
    const shareBtn = page.locator('#btn-share-blog');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify share action succeeds (toast notification is triggered)
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Article (link copied|shared)/i);
  });

  // ==========================================
  // NEGATIVE TEST CASES (1 - 10)
  // ==========================================

  test('Negative 1: Enter an invalid/non-existent Google email ID', async ({ page }) => {
    await safeNavigate(page,'/auth/google/screen');

    // Click "Use another account"
    await page.click('#btn-use-another-account');

    // Enter non-existent email
    await page.fill('#google-email', 'invalid_fake_user@unknown.xyz');
    await page.fill('#google-password', 'ValidPass123!');
    await page.click('#btn-google-signin-submit');

    // Expect account not found rejection
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Couldn't find your Google Account");
  });

  test('Negative 2: Enter an incorrect Google account password', async ({ page }) => {
    await safeNavigate(page,'/auth/google/screen');
    await page.click('#btn-use-another-account');

    // Enter valid email but wrong password
    await page.fill('#google-email', 'alex.dev@gmail.com');
    await page.fill('#google-password', 'wrongpassword999!');
    await page.click('#btn-google-signin-submit');

    // Expect wrong password rejection
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Wrong password');
  });

  test('Negative 3: Enter a password without an uppercase letter', async ({ page }) => {
    await safeNavigate(page,'/register');

    await page.locator('#reg-name').fill('Test User');
    await page.locator('#reg-email').fill(`test_no_upper_${Date.now()}@example.com`);
    // Missing uppercase
    await page.locator('#reg-password').fill('password@123');
    await page.locator('#btn-submit-register').click();

    const errorAlert = page.locator('#register-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Password must contain at least one uppercase letter.');
  });

  test('Negative 4: Enter a password without a lowercase letter', async ({ page }) => {
    await safeNavigate(page,'/register');

    await page.locator('#reg-name').fill('Test User');
    await page.locator('#reg-email').fill(`test_no_lower_${Date.now()}@example.com`);
    // Missing lowercase
    await page.locator('#reg-password').fill('PASSWORD@123');
    await page.locator('#btn-submit-register').click();

    const errorAlert = page.locator('#register-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Password must contain at least one lowercase letter.');
  });

  test('Negative 5: Enter a password without a number', async ({ page }) => {
    await safeNavigate(page,'/register');

    await page.locator('#reg-name').fill('Test User');
    await page.locator('#reg-email').fill(`test_no_number_${Date.now()}@example.com`);
    // Missing number
    await page.locator('#reg-password').fill('Password@Special');
    await page.locator('#btn-submit-register').click();

    const errorAlert = page.locator('#register-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Password must contain at least one number.');
  });

  test('Negative 6: Enter a password without a special character', async ({ page }) => {
    await safeNavigate(page,'/register');

    await page.locator('#reg-name').fill('Test User');
    await page.locator('#reg-email').fill(`test_no_special_${Date.now()}@example.com`);
    // Missing special character
    await page.locator('#reg-password').fill('Password123');
    await page.locator('#btn-submit-register').click();

    const errorAlert = page.locator('#register-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Password must contain at least one special character.');
  });

  test('Negative 7: Upload an unsupported/invalid profile image (.txt or .pdf)', async ({ page }) => {
    // Login as reader
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-reader').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL('/', { timeout: 10000 });

    await safeNavigate(page,'/profile');

    // Create temporary text file in os.tmpdir() to avoid triggering file watcher
    const invalidFilePath = path.join(os.tmpdir(), `invalid_doc_${Date.now()}.txt`);
    fs.writeFileSync(invalidFilePath, 'This is a text document, not an image.');

    try {
      await page.setInputFiles('#avatar-file-input', invalidFilePath);

      // Expect rejection with appropriate message
      const errorAlert = page.locator('#profile-error-alert');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('Only image files (JPEG, PNG, WEBP, GIF, AVIF) are allowed.');
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  test('Negative 8: Submit an empty or invalid email in the profile', async ({ page }) => {
    // Login as reader
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-reader').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL('/', { timeout: 10000 });

    await safeNavigate(page,'/profile');

    // Clear email field and attempt save
    await page.locator('#profile-email-input').fill('invalid-email-string');
    await page.locator('#btn-save-profile').click();

    // Verify rejection
    const errorAlert = page.locator('#profile-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('A valid email address is required.');
  });

  test('Negative 9: Unauthorized user attempts to publish a blog/video', async ({ page, request }) => {
    // 1. Browser: Unauthenticated user visits /write -> redirected to login
    await safeNavigate(page,'/write');
    await expect(page).toHaveURL(/\/login/);

    // 2. Direct API call without authorization token -> 401 Unauthorized
    const res = await request.post('/api/blogs', {
      data: {
        title: 'Unauthorized Post Attempt',
        body: 'Should be rejected.'
      }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('Negative 10: Attempt to save or share a non-existent or unavailable blog', async ({ page, request }) => {
    // Login as reader
    await safeNavigate(page,'/login');
    await page.locator('#btn-fill-reader').click();
    await page.locator('#btn-submit-login').click();
    await page.waitForURL('/', { timeout: 10000 });

    // 1. API: Attempt to save non-existent blog ID 999999 via in-browser fetch
    const saveResult = await page.evaluate(async () => {
      const res = await fetch('/api/blogs/999999/save', { method: 'POST' });
      const data = await res.json();
      return { status: res.status, data };
    });
    expect(saveResult.status).toBe(404);
    expect(saveResult.data.error).toContain('Cannot save unavailable or non-existent article.');

    // 2. Frontend: Visit non-existent blog URL and attempt share
    await safeNavigate(page,'/blog/non-existent-ghost-article-404');
    await expect(page.locator('.not-found-state')).toBeVisible();

    // Attempting share/save directly should display error toast
    await page.evaluate(() => {
      if (typeof handleShareClick === 'function') handleShareClick();
    });

    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Cannot share unavailable or non-existent article.');
  });

});
