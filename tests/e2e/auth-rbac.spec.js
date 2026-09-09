const { test, expect } = require('@playwright/test');

test.describe('M1: Authentication & Role-Based Access Control (RBAC)', () => {

  test('Positive: Registered Reader Login & Navigation', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials for seeded reader
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');

    // Should redirect to home page and show user avatar
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.role-badge')).toHaveText('reader');

    // Verify Reader does not see Admin link in navbar
    const adminLink = page.locator('#nav-admin-link');
    await expect(adminLink).toBeHidden();
  });

  test('Positive: Admin Login & Dashboard Navigation', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials for registered Admin account
    await page.fill('#login-email', 'admin@blog.com');
    await page.fill('#login-password', 'Admin@123456');
    await page.click('#btn-submit-login');

    // Should redirect to /admin and display Control Center
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('Platform Control Center');
    await expect(page.locator('.admin-title-row')).toBeVisible();
  });

  test('Negative: Non-Admin Access to /admin is Denied and Redirected', async ({ page }) => {
    // Unauthenticated access
    await page.goto('/admin');
    // Expect redirection to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('Positive: Public Self-Registration for New Reader', async ({ page }) => {
    await page.goto('/register');

    const randomId = Date.now();
    await page.fill('#reg-name', `Test Reader ${randomId}`);
    await page.fill('#reg-email', `reader${randomId}@example.com`);
    await page.fill('#reg-password', 'Secret@123');
    await page.click('#btn-submit-register');

    // Successfully registered and redirected to home
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();
  });

  test('Negative: Duplicate Registration with Same Email is Rejected', async ({ page }) => {
    await page.goto('/register');

    // Attempt registering with existing email
    await page.fill('#reg-name', 'Duplicate User');
    await page.fill('#reg-email', 'john@reader.com');
    await page.fill('#reg-password', 'Secret@123');
    await page.click('#btn-submit-register');

    // Error toast should appear
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('already exists');
  });

  test('Negative: Login with Incorrect Password Fails', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#login-email', 'admin@blog.com');
    await page.fill('#login-password', 'WrongPassword123');
    await page.click('#btn-submit-login');

    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('Invalid email or password');
  });

});
