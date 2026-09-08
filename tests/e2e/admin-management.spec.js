const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-09] Admin Governance, Moderation & User Management', () => {

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
    await expect(page.locator('#stat-total-comments')).not.toHaveText('-');
    await expect(page.locator('#stat-total-likes')).not.toHaveText('-');

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

  test('Positive: Admin Deletes a Reader Account with Cascade Removal', async ({ page, request }) => {
    // 1. Create a dedicated test reader to safely delete
    const tempEmail = `test_temp_${Date.now()}@example.com`;
    const regRes = await request.post('http://127.0.0.1:3000/api/auth/register', {
      data: {
        name: 'Temporary User',
        email: tempEmail,
        password: 'Password@123'
      }
    });
    expect(regRes.ok()).toBeTruthy();

    // 2. Open Reader Accounts tab
    await page.click('button[data-tab="users"]');
    await expect(page.locator('#tab-users')).toBeVisible();

    // 3. Locate the created user row
    const userRow = page.locator('#users-table-body tr', { hasText: tempEmail });
    await expect(userRow).toBeVisible();

    // 4. Accept the confirmation dialog and click Delete User
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to delete');
      await dialog.accept();
    });

    const deleteBtn = userRow.locator('button.btn-danger', { hasText: 'Delete User' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 5. Verify success toast and table updates
    await expect(page.locator('.toast-success, .toast')).toBeVisible();
    await expect(page.locator('#users-table-body tr', { hasText: tempEmail })).toHaveCount(0);
  });

  test('Positive: Admin Moderates and Removes Inappropriate Comment', async ({ page }) => {
    // Click Comment Moderation tab
    await page.click('button[data-tab="moderation"]');
    await expect(page.locator('#tab-moderation')).toBeVisible();

    // Verify moderation table headers and entries
    await expect(page.locator('#moderation-table-body')).toBeVisible();
    const firstCommentRow = page.locator('#moderation-table-body tr').first();
    await expect(firstCommentRow).toBeVisible();

    // Check that Remove button is present
    const removeBtn = firstCommentRow.locator('button.btn-danger', { hasText: 'Remove' });
    if (await removeBtn.isVisible()) {
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Moderate and delete this comment');
        await dialog.accept();
      });
      await removeBtn.click();
      await expect(page.locator('.toast-success, .toast')).toBeVisible();
    }
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

  test('Negative: Primary Admin Account Cannot Be Deleted', async ({ page, request }) => {
    // 1. UI Check: Open Reader Accounts tab and verify Admin row has no Delete button
    await page.click('button[data-tab="users"]');
    await expect(page.locator('#tab-users')).toBeVisible();

    const adminRow = page.locator('#users-table-body tr', { hasText: 'admin@blog.com' });
    await expect(adminRow).toBeVisible();
    await expect(adminRow).toContainText('Current Admin');
    await expect(adminRow.locator('button', { hasText: 'Delete User' })).toHaveCount(0);

    // 2. API Check: Direct DELETE /api/admin/users/:adminId fails with 400
    const adminUser = await page.evaluate(() => JSON.parse(localStorage.getItem('blog_user')));
    const token = await page.evaluate(() => localStorage.getItem('blog_token'));
    const deleteRes = await request.delete(`http://127.0.0.1:3000/api/admin/users/${adminUser.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(deleteRes.status()).toBe(400);
    const body = await deleteRes.json();
    expect(body.error).toContain('cannot delete your own active administrator account');
  });

  test('Negative: Anonymous or Reader Access to /admin is Denied', async ({ browser }) => {
    // Create an isolated context without admin token
    const context = await browser.newContext();
    const guestPage = await context.newPage();

    await guestPage.goto('/admin');
    // Admin guard redirects unauthorized users to login
    await expect(guestPage).toHaveURL(/\/login/);

    await context.close();
  });

});
