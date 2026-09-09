const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-16] Google Authentication: Account Chooser, "Use another account" & Verification Approval Flow', () => {

  test.beforeEach(async ({ context }) => {
    // Clear cookies and state before each test
    await context.clearCookies();
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(200);
  });

  // ==========================================
  // POSITIVE TEST SCENARIOS
  // ==========================================

  test('Positive 1: Login with already signed-in Google account', async ({ page }) => {
    // 1. Open the Blog application
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    // 2. Click Continue with Google
    const googleLoginBtn = page.locator('#btn-google-login');
    await expect(googleLoginBtn).toBeVisible();
    await googleLoginBtn.click();

    // Verify Google Account Chooser screen
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    await expect(page.locator('#google-header-title')).toHaveText('Choose an account');

    // 3. Select the already signed-in Google account (Alex Mercer)
    const alexAccountItem = page.locator('#account-item-alex');
    await expect(alexAccountItem).toBeVisible();
    await alexAccountItem.click();

    // Verify Google Account Verification / Approval prompt modal appears
    const verificationModal = page.locator('#google-verification-modal');
    await expect(verificationModal).toBeVisible();
    await expect(page.locator('#modal-account-email')).toHaveText('alex.dev@gmail.com');
    await expect(page.locator('#verification-modal-title')).toHaveText("Verify it's you");

    // 4. Complete the Google verification prompt by clicking 'Approve & Continue'
    const approveBtn = page.locator('#btn-approve-verification');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify redirection back to the blog application with successful login
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });
    await expect(page).not.toHaveURL('/login');

    // Verify user is authenticated as reader
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe('alex.dev@gmail.com');
    expect(meRes.user.role).toBe('reader');
  });

  test('Positive 2: Login using another Google account', async ({ page }) => {
    // 1. Click Continue with Google from register page
    await page.goto('/register');
    const googleSignupBtn = page.locator('#btn-google-signup');
    await expect(googleSignupBtn).toBeVisible();
    await googleSignupBtn.click();

    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // 2. Select 'Use another account'
    const useAnotherBtn = page.locator('#btn-use-another-account');
    await expect(useAnotherBtn).toBeVisible();
    await useAnotherBtn.click();

    // Verify header updates to 'Sign in' and input receives focus
    await expect(page.locator('#google-header-title')).toHaveText('Sign in');
    await expect(page.locator('#google-email')).toBeFocused();

    // 3. Enter another valid Google account
    const uniqueEmail = `sarah.google.${Date.now()}@gmail.com`;
    await page.fill('#google-email', uniqueEmail);
    await page.fill('#google-password', 'ValidGooglePassword123!');

    // 4. Complete authentication
    await page.click('#btn-google-signin-submit');
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });

    // Verify the newly entered account is authenticated and NOT the previously remembered account
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe(uniqueEmail.toLowerCase());
    expect(meRes.user.email).not.toBe('alex.dev@gmail.com');
  });

  test('Positive 3: Verify Google authentication approval for Admin Account', async ({ page }) => {
    // 1. Open Google authentication screen
    await page.goto('/auth/google');
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // Select admin account
    const adminAccountItem = page.locator('#account-item-admin');
    await expect(adminAccountItem).toBeVisible();
    await adminAccountItem.click();

    // 2. Verify and complete the Google authentication/approval prompt
    const verificationModal = page.locator('#google-verification-modal');
    await expect(verificationModal).toBeVisible();
    await expect(page.locator('#modal-account-email')).toHaveText('admin@blog.com');

    // Complete approval
    await page.click('#btn-approve-verification');

    // 3. Return to the application - verify user is logged in as admin
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });

    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe('admin@blog.com');
    expect(meRes.user.role).toBe('admin');

    // Verify admin can access admin dashboard
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('.admin-header')).toBeVisible();
  });

  // ==========================================
  // NEGATIVE TEST SCENARIOS
  // ==========================================

  test('Negative 1: Select Continue with Google and cancel the Google authentication prompt', async ({ page }) => {
    await page.goto('/login');
    await page.click('#btn-google-login');
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // Click global Cancel button
    const cancelBtn = page.locator('#btn-google-cancel');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // User should be redirected back to the login page with error=cancelled
    await expect(page).toHaveURL(/\/login\?error=cancelled/);
    const alert = page.locator('#login-error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/authentication was cancelled/i);

    // User must remain unauthenticated
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).toBeNull();
  });

  test('Negative 2: Select "Use another account" and enter invalid Google credentials', async ({ page }) => {
    await page.goto('/auth/google/screen');

    // Click 'Use another account'
    await page.click('#btn-use-another-account');

    // Enter non-existent / invalid Google account credentials
    await page.fill('#google-email', 'invalid_google_user@unknown.xyz');
    await page.fill('#google-password', 'ValidPass123!');
    await page.click('#btn-google-signin-submit');

    // Google authentication should fail and access should be denied
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Couldn't find your Google Account");

    // Enter valid email but incorrect password
    await page.fill('#google-email', 'alex.dev@gmail.com');
    await page.fill('#google-password', 'wrongpassword');
    await page.click('#btn-google-signin-submit');

    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Wrong password');

    // User is NOT logged into the application
    await page.goto('/api/auth/me');
    const content = await page.textContent('body');
    expect(content).toContain('"user":null');
  });

  test('Negative 3: Enter a Google account that is not authorized for the application', async ({ page }) => {
    await page.goto('/auth/google/screen');

    await page.click('#btn-use-another-account');
    await page.fill('#google-email', 'unauthorized.user@gmail.com');
    await page.fill('#google-password', 'ValidPassword123!');
    await page.click('#btn-google-signin-submit');

    // Access should be denied with an appropriate error message
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Access denied. This Google account is not authorized to access ApexBlog.');

    // Unauthorized account does NOT gain access
    await page.goto('/api/auth/me');
    const content = await page.textContent('body');
    expect(content).toContain('"user":null');
  });

  test('Negative 4: Close the Google authentication pop-up before completing verification', async ({ page }) => {
    await page.goto('/auth/google/screen');

    // Select account to open verification modal
    await page.click('#account-item-alex');
    const verificationModal = page.locator('#google-verification-modal');
    await expect(verificationModal).toBeVisible();

    // Close the verification modal via the close 'X' button
    const closeBtn = page.locator('#btn-close-verification');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Login is aborted and user is redirected back to login page
    await expect(page).toHaveURL(/\/login\?error=cancelled/);

    // Verify user remains unauthenticated
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).toBeNull();

    // Also test the 'Deny' button flow
    await page.goto('/auth/google/screen');
    await page.click('#account-item-admin');
    await expect(verificationModal).toBeVisible();

    await page.click('#btn-deny-verification');
    await expect(page).toHaveURL(/\/login\?error=cancelled/);
  });

  test('Negative 5: Try to access the application after failed Google authentication', async ({ page }) => {
    // 1. Initiate Google auth and fail with wrong credentials
    await page.goto('/auth/google/screen');
    await page.click('#btn-use-another-account');
    await page.fill('#google-email', 'alex.dev@gmail.com');
    await page.fill('#google-password', 'wrongpassword');
    await page.click('#btn-google-signin-submit');

    await expect(page.locator('#google-error-alert')).toBeVisible();

    // 2. Clear any lingering client cache and attempt to directly access protected writer route
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/write');

    // User/admin should remain logged out and protected pages should not be accessible
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // 3. Attempt to directly access protected admin route
    await page.goto('/admin');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

});
