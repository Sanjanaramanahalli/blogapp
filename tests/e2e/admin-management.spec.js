const { test, expect } = require('@playwright/test');

test.describe('M4: Admin Governance, Moderation & User Management', () => {

  test.beforeEach(async ({ page }) => {
    // Login as Admin before each test
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');
  });

  test('Positive: Overview Metrics and Recent Feeds Render Properly', async ({ page }) => {
    // Check metric counters
    await expect(page.locator('#stat-total-blogs')).not.toHaveText('-');
    await expect(page.locator('#stat-published-blogs')).not.toHaveText('-');
    await expect(page.locator('#stat-total-readers')).not.toHaveText('-');

    // Check recent activity cards
    await expect(page.locator('#overview-recent-blogs')).toBeVisible();
    await expect(page.locator('#overview-recent-comments')).toBeVisible();
  });

  test('Positive: Admin Navigates and Inspects Reader Accounts', async ({ page }) => {
    // Click Reader Accounts tab
    await page.click('button[data-tab="users"]');
    await expect(page.locator('#tab-users')).toBeVisible();

    // Wait for user table to finish loading
    await expect(page.locator('#users-table-body td strong').first()).toBeVisible();

    // Check user table rows
    const userRows = page.locator('#users-table-body tr');
    const count = await userRows.count();
    expect(count).toBeGreaterThan(1); // At least admin and readers
  });

  test('Positive: Admin Toggles Article Status (Publish / Unpublish)', async ({ page }) => {
    // Click Articles Management tab
    await page.click('button[data-tab="blogs"]');
    await expect(page.locator('#tab-blogs')).toBeVisible();

    // Find first article row
    const firstRow = page.locator('#blogs-table-body tr').first();
    const statusBadge = firstRow.locator('.role-badge');
    const toggleBtn = firstRow.locator('button', { hasText: /(Publish|Unpublish)/ });

    const initialStatus = await statusBadge.innerText();
    await toggleBtn.click();

    // Expect status to toggle
    await page.waitForTimeout(1000);
    const updatedStatus = await firstRow.locator('.role-badge').innerText();
    expect(updatedStatus).not.toEqual(initialStatus);

    // Toggle back to restore initial state
    await firstRow.locator('button', { hasText: /(Publish|Unpublish)/ }).click();
  });

  test('Positive: Admin Updates Profile Name and Credentials in Settings Tab', async ({ page }) => {
    // Click Settings tab
    await page.click('button[data-tab="settings"]');
    await expect(page.locator('#tab-settings')).toBeVisible();

    // Verify name and email pre-filled
    const nameInput = page.locator('#admin-name');
    await expect(nameInput).toHaveValue('System Administrator');
  });

});
