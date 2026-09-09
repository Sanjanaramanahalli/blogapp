const { test, expect } = require('@playwright/test');

test.describe('Admin can Delete Any User Post', () => {

  test('Admin can view author details and delete a user post from the Admin Dashboard', async ({ page }) => {
    const timestamp = Date.now();
    const userPostTitle = `Community Article by Reader ${timestamp}`;

    // 1. Log in as reader (John Reader)
    await page.goto('/login');
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Reader writes and publishes a post
    await page.goto('/write');
    await expect(page.locator('#blog-title')).toBeVisible();
    await page.fill('#blog-title', userPostTitle);
    await page.fill('#blog-body', '<p>This is a community post written by John Reader that an admin may moderate or delete.</p>');
    await page.fill('#tags-input', 'community, reader, test');
    await page.click('#btn-publish');

    // Verify reader reached blog detail
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator('.article-title')).toHaveText(userPostTitle);
    await expect(page.locator('.article-author-name')).toHaveText('John Reader');

    // 3. Log out reader
    await page.click('#btn-logout');
    await page.waitForTimeout(500);

    // 4. Log in as Administrator
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 5. Navigate to Articles tab in Admin Dashboard
    await page.click('button[data-tab="blogs"]');
    await expect(page.locator('#tab-blogs')).toBeVisible();

    // Verify user post is displayed in table with Author column showing John Reader
    const userRow = page.locator('#blogs-table-body tr', { hasText: userPostTitle });
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText('John Reader');
    await expect(userRow).toContainText('john@reader.com');

    // 6. Admin deletes the user post
    const deleteBtn = userRow.locator('button.btn-danger', { hasText: 'Delete' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify delete confirmation modal appears with author details
    const deleteModal = page.locator('#delete-blog-modal');
    await expect(deleteModal).toHaveClass(/active/);
    await expect(page.locator('#delete-blog-title-text')).toContainText(userPostTitle);
    await expect(page.locator('#delete-blog-title-text')).toContainText('John Reader');

    // Confirm permanent deletion
    await page.click('#btn-confirm-delete-blog');

    // Verify toast notification and row removal
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('#blogs-table-body tr', { hasText: userPostTitle })).toHaveCount(0);
  });

  test('Admin can delete a user post directly from the article reading page', async ({ page }) => {
    const timestamp = Date.now();
    const userPostTitle = `Direct Reader Article ${timestamp}`;

    // 1. Log in as reader (Sarah Reader)
    await page.goto('/login');
    await page.fill('#login-email', 'sarah@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Sarah writes and publishes a post
    await page.goto('/write');
    await expect(page.locator('#blog-title')).toBeVisible();
    await page.fill('#blog-title', userPostTitle);
    await page.fill('#blog-body', '<p>Another reader post to test deletion directly on the article page by an admin.</p>');
    await page.click('#btn-publish');

    await expect(page).toHaveURL(/\/blog\//);
    const blogUrl = page.url();

    // 3. Log out Sarah
    await page.click('#btn-logout');
    await page.waitForTimeout(500);

    // 4. Log in as Administrator
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 5. Admin visits the reader article URL
    await page.goto(blogUrl);
    await expect(page.locator('.article-title')).toHaveText(userPostTitle);

    // Verify Admin Post Controls toolbar is visible on reader post
    const adminToolbar = page.locator('.admin-post-toolbar');
    await expect(adminToolbar).toBeVisible();
    await expect(adminToolbar).toContainText('Sarah Connor');
    await expect(adminToolbar).toContainText('sarah@reader.com');

    // 6. Admin clicks Delete Article (Admin)
    const adminDeleteBtn = page.locator('#btn-admin-delete-blog');
    await expect(adminDeleteBtn).toBeVisible();
    await adminDeleteBtn.click();

    // Verify modal appears
    const deleteModal = page.locator('#delete-article-modal');
    await expect(deleteModal).toHaveClass(/active/);
    await expect(page.locator('#delete-article-warning-text')).toContainText(userPostTitle);
    await expect(page.locator('#delete-article-warning-text')).toContainText('Sarah Connor');

    // Confirm deletion
    await page.click('#btn-confirm-delete-article');

    // Verify redirect after deletion
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/\/(admin|$)/);

    // 7. Verify the deleted article is now gone (404)
    await page.goto(blogUrl);
    await expect(page.locator('.not-found-state')).toBeVisible();
  });

});
