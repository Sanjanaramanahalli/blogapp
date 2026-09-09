const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-18] Dynamic Validated User Authentication & Hardcoded Credentials Removal', () => {

  test.beforeEach(async ({ context }) => {
    // Clear cookies before each test run
    await context.clearCookies();
  });

  // ==========================================
  // POSITIVE TEST SCENARIOS
  // ==========================================

  test('Positive 1: Login with registered Admin account redirects to Admin Dashboard', async ({ page }) => {
    await page.goto('/login');

    // Enter a valid registered Admin email and password
    await page.fill('#login-email', 'admin@blog.com');
    await page.fill('#login-password', 'Admin@123456');
    await page.click('#btn-submit-login');

    // Admin is authenticated and redirected to the Admin dashboard
    await page.waitForURL('/admin', { timeout: 10000 });
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('Platform Control Center');
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.role-badge')).toHaveText('admin');
  });

  test('Positive 2: Login with registered Reader account redirects to Reader/home page', async ({ page }) => {
    await page.goto('/login');

    // Enter a valid registered Reader email and password
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');

    // Reader is authenticated and redirected to the Reader/home page
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.role-badge')).toHaveText('reader');
    // Admin link should remain hidden for readers
    await expect(page.locator('#nav-admin-link')).toBeHidden();
  });

  test('Positive 3: Login with newly registered user', async ({ page, context }) => {
    const uniqueId = Date.now();
    const newName = `Dynamic User ${uniqueId}`;
    const newEmail = `dynamic_${uniqueId}@towntalk.org`;
    const newPassword = 'SecurePassword123!';

    // 1. Register a new account
    await page.goto('/register');
    await page.fill('#reg-name', newName);
    await page.fill('#reg-email', newEmail);
    await page.fill('#reg-password', newPassword);
    await page.click('#btn-submit-register');

    // Newly registered user redirected to home
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();

    // 2. Sign out
    await page.click('#user-menu-btn');
    await page.click('#btn-logout');
    await page.waitForTimeout(500);

    // 3. Login using the newly created credentials
    await page.goto('/login');
    await page.fill('#login-email', newEmail);
    await page.fill('#login-password', newPassword);
    await page.click('#btn-submit-login');

    // User can successfully log in using newly created credentials
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.role-badge')).toHaveText('reader');
  });

  // ==========================================
  // NEGATIVE TEST SCENARIOS
  // ==========================================

  test('Negative 1: Login with a fake/unregistered email ID is rejected', async ({ page }) => {
    await page.goto('/login');

    const fakeEmail = 'fake_unregistered_account_999@unknown.xyz';
    await page.fill('#login-email', fakeEmail);
    await page.fill('#login-password', 'SomePassword123!');
    await page.click('#btn-submit-login');

    // Login should be rejected with an Account not found/Invalid credentials message
    const errorAlert = page.locator('#login-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Account not found|Invalid credentials/i);

    // Ensure user remains on login page and is not authenticated
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.user-menu')).toBeHidden();
  });

  test('Negative 2: Login with registered email and incorrect password', async ({ page }) => {
    await page.goto('/login');

    // Registered email with incorrect password
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'CompletelyWrongPassword123!');
    await page.click('#btn-submit-login');

    // Login should be rejected with an appropriate error message
    const errorAlert = page.locator('#login-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Invalid email or password|Invalid password/i);

    // User is not logged in
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.user-menu')).toBeHidden();
  });

  test('Negative 3: Login with an unregistered email and any password fails and does NOT auto-create user', async ({ page, request }) => {
    await page.goto('/login');

    const unregisteredEmail = `unregistered_never_created_${Date.now()}@test.com`;
    await page.fill('#login-email', unregisteredEmail);
    await page.fill('#login-password', 'AnyPassword123!');
    await page.click('#btn-submit-login');

    // Authentication must fail
    const errorAlert = page.locator('#login-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Account not found|Invalid credentials/i);

    // Verify user was NOT automatically created in the database
    // Calling login again with any other password still fails with account not found
    await page.fill('#login-password', 'DifferentPassword999!');
    await page.click('#btn-submit-login');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Account not found|Invalid credentials/i);
    await expect(page).toHaveURL('/login');
  });

  test('Negative 4: Attempt login using hardcoded/static credentials after they are not registered', async ({ page }) => {
    await page.goto('/login');

    // Ensure hardcoded static strings for unregistered accounts fail
    const fictitiousStaticAccount = 'hardcoded_fake_static_admin@blog.com';
    await page.fill('#login-email', fictitiousStaticAccount);
    await page.fill('#login-password', 'StaticAdmin123!');
    await page.click('#btn-submit-login');

    const errorAlert = page.locator('#login-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Account not found|Invalid credentials/i);
    await expect(page).toHaveURL('/login');
  });

});
