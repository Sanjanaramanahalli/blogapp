const { test, expect } = require('@playwright/test');

test.describe('Admin Dashboard Interactions & Reader Blog Publishing', () => {

  // -------------------------------------------------------------
  // Part 1: Admin Dashboard (Create, Delete, Like, Comment, Share)
  // -------------------------------------------------------------

  test('Admin can Like, Comment, and Share articles from Admin Dashboard', async ({ page }) => {
    // 1. Log in as Admin
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 2. Navigate to Articles Management tab
    await page.click('button[data-tab="blogs"]');
    await expect(page.locator('#tab-blogs')).toBeVisible();
    await expect(page.locator('#blogs-table-body tr').first()).toBeVisible();

    const firstRow = page.locator('#blogs-table-body tr').first();

    // 3. Admin Like Interaction
    const likeBtn = firstRow.locator('.btn-action-like');
    await expect(likeBtn).toBeVisible();
    const initialLikeText = await likeBtn.innerText();

    await likeBtn.click();
    await page.waitForTimeout(600);
    const afterLikeText = await likeBtn.innerText();
    expect(afterLikeText).not.toEqual(initialLikeText);

    // Toggle back
    await likeBtn.click();
    await page.waitForTimeout(600);

    // 4. Admin Comment Modal Interaction
    const commentBtn = firstRow.locator('.btn-action-comment');
    await expect(commentBtn).toBeVisible();
    await commentBtn.click();

    const commentModal = page.locator('#admin-comment-modal');
    await expect(commentModal).toHaveClass(/active/);
    await expect(page.locator('#admin-comment-modal-title')).toBeVisible();

    // Submit an official admin comment
    const adminCommentText = `Official Admin Review Note ${Date.now()}`;
    await page.fill('#admin-modal-comment-input', adminCommentText);
    await page.click('#btn-submit-admin-comment');

    // Verify comment appears in modal discussion list
    await expect(page.locator('#admin-comment-modal-list', { hasText: adminCommentText })).toBeVisible();

    // Close comment modal
    await page.click('#admin-comment-modal .modal-close');
    await expect(commentModal).not.toHaveClass(/active/);

    // 5. Admin Share Modal Interaction
    const shareBtn = firstRow.locator('.btn-action-share');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    const shareModal = page.locator('#admin-share-modal');
    await expect(shareModal).toHaveClass(/active/);
    const shareUrlInput = page.locator('#admin-share-url-input');
    await expect(shareUrlInput).not.toHaveValue('');

    // Click copy link button
    await page.click('#btn-copy-share-url');
    await expect(page.locator('#btn-copy-share-url')).toContainText(/Copied/);

    // Close share modal
    await page.click('#admin-share-modal .modal-close');
    await expect(shareModal).not.toHaveClass(/active/);
  });

  test('Admin can Create and Delete an article from Admin Dashboard', async ({ page }) => {
    // 1. Log in as Admin
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 2. Open Create Blog Modal
    await page.click('#btn-create-blog-top');
    const blogModal = page.locator('#blog-modal');
    await expect(blogModal).toHaveClass(/active/);

    const testBlogTitle = `Admin Governed Post ${Date.now()}`;
    await page.fill('#blog-title-input', testBlogTitle);
    await page.fill('#blog-body-input', 'This is a high quality article published directly from the admin dashboard.');
    await page.fill('#blog-tags-input', 'admin, testing, architecture');
    
    // Select first category checkbox if available
    const firstCatCheck = page.locator('#blog-category-checks input[type="checkbox"]').first();
    if (await firstCatCheck.isVisible()) {
      await firstCatCheck.check();
    }

    await page.click('#btn-save-blog');
    await expect(page.locator('.toast')).toBeVisible();

    // 3. Switch to Articles tab and verify newly created article
    await page.click('button[data-tab="blogs"]');
    const newRow = page.locator('#blogs-table-body tr', { hasText: testBlogTitle });
    await expect(newRow).toBeVisible();

    // 4. Delete the article
    const deleteBtn = newRow.locator('button.btn-danger', { hasText: 'Delete' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm deletion modal
    const deleteModal = page.locator('#delete-blog-modal');
    await expect(deleteModal).toHaveClass(/active/);
    await page.click('#btn-confirm-delete-blog');

    // Verify row removed
    await expect(page.locator('#blogs-table-body tr', { hasText: testBlogTitle })).toHaveCount(0);
  });

  // -------------------------------------------------------------
  // Part 2: Reader Posting, Liking, and Commenting
  // -------------------------------------------------------------

  test('Reader can post a new article from the Write interface', async ({ page }) => {
    // 1. Login as standard reader
    await page.goto('/login');
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Navigate to Write interface
    await page.goto('/write');
    await expect(page.locator('#blog-title')).toBeVisible();

    // 3. Fill and publish article
    const readerTitle = `Reader Journey into Web Development ${Date.now()}`;
    await page.fill('#blog-title', readerTitle);
    await page.fill('#blog-body', 'Here are lessons learned from my perspective as an enthusiastic reader and contributor.');
    await page.fill('#tags-input', 'community, learning, web');

    // Select first category chip if available
    const firstCat = page.locator('#categories-container .category-chip').first();
    if (await firstCat.isVisible()) {
      await firstCat.click();
    }

    await page.click('#btn-publish');

    // 4. Redirects to the newly published blog detail view
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator('.article-title')).toHaveText(readerTitle);
    await expect(page.locator('.article-author-name')).toHaveText('John Reader');
  });

  test('Reader can Like and Comment on an article', async ({ page }) => {
    // 1. Login as standard reader
    await page.goto('/login');
    await page.fill('#login-email', 'sarah@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Open an article
    await page.goto('/blog/architecting-modern-web-applications');
    await expect(page.locator('#btn-like')).toBeVisible();

    // 3. Like the article
    const countBefore = await page.locator('#like-count').innerText();
    await page.click('#btn-like');
    await page.waitForTimeout(600);
    const countAfter = await page.locator('#like-count').innerText();
    expect(countAfter).not.toEqual(countBefore);

    // 4. Comment on the article
    const commentInput = page.locator('#top-comment-input');
    await expect(commentInput).toBeVisible();
    const commentText = `Great insights! Truly enjoyed reading this piece. ${Date.now()}`;
    await page.fill('#top-comment-input', commentText);
    await page.click('#btn-submit-top-comment');

    // Verify comment is displayed in comments stream
    await expect(page.locator('.comment-card', { hasText: commentText })).toBeVisible();
  });

});
