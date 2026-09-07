const { test, expect } = require('@playwright/test');

test.describe('M3: Community Engagement (Likes & Multi-Level Discussions)', () => {

  test('Negative: Guest Clicking Like Triggers Authentication Modal', async ({ page }) => {
    await page.goto('/blog/architecting-modern-web-applications');
    await expect(page.locator('#social-bar')).toBeVisible();

    // Click like as anonymous visitor
    await page.click('#btn-like');

    // Authentication modal should open
    await expect(page.locator('#guest-modal')).toHaveClass(/active/);
  });

  test('Positive: Reader Likes and Unlikes an Article with Real-Time Counter', async ({ page }) => {
    // 1. Login as Reader (Sarah)
    await page.goto('/login');
    await page.fill('#login-email', 'sarah@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Open Blog 2 (which Sarah hasn't liked yet)
    await page.goto('/blog/deep-dive-into-multi-level-comment-hierarchies');
    await expect(page.locator('#btn-like')).toBeVisible();

    const initialLikesText = await page.locator('#like-count').innerText();
    const initialLikes = parseInt(initialLikesText, 10) || 0;

    // 3. Click Like
    await page.click('#btn-like');
    await expect(page.locator('#btn-like')).toHaveClass(/liked/);
    await expect(page.locator('#like-count')).toHaveText(String(initialLikes + 1));

    // 4. Click Unlike
    await page.click('#btn-like');
    await expect(page.locator('#btn-like')).not.toHaveClass(/liked/);
    await expect(page.locator('#like-count')).toHaveText(String(initialLikes));
  });

  test('Positive: Multi-Level Threaded Comments & Cascade Deletion Lifecycle', async ({ page }) => {
    // 1. Login as Reader (John)
    await page.goto('/login');
    await page.fill('#login-email', 'john@reader.com');
    await page.fill('#login-password', 'Reader@123');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/');

    // 2. Open Blog 2
    await page.goto('/blog/deep-dive-into-multi-level-comment-hierarchies');
    await expect(page.locator('#top-comment-input')).toBeVisible();

    // 3. Post Top-Level Comment (Level 1)
    const commentText = `Root level comment by John ${Date.now()}`;
    await page.fill('#top-comment-input', commentText);
    await page.click('#btn-submit-top-comment');

    // Verify comment appears in the tree
    const rootCommentCard = page.locator('.comment-card', { hasText: commentText });
    await expect(rootCommentCard).toBeVisible();

    // 4. Post Nested Reply (Level 2)
    const rootNode = page.locator('.comment-node', { hasText: commentText }).first();
    const replyBtn = rootNode.locator('.btn-reply').first();
    await replyBtn.click();

    const replyInput = rootNode.locator('.comment-textarea').first();
    await expect(replyInput).toBeVisible();
    const replyText = `Child reply by John ${Date.now()}`;
    await replyInput.fill(replyText);
    await rootNode.locator('button[type="submit"]', { hasText: 'Post Reply' }).click();

    // Verify child reply rendered in nested container
    await expect(page.locator('.replies-container', { hasText: replyText })).toBeVisible();

    // 5. Author Edit Comment
    const editBtn = rootNode.locator('.btn-edit').first();
    await editBtn.click();

    const editInput = rootNode.locator('.comment-textarea').first();
    await expect(editInput).toBeVisible();
    const updatedCommentText = `${commentText} (Updated Content)`;
    await editInput.fill(updatedCommentText);
    await rootNode.locator('button[type="submit"]', { hasText: 'Save Changes' }).click();

    // Verify edited content and (edited) badge
    const updatedCard = page.locator('.comment-card', { hasText: updatedCommentText });
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard.locator('.comment-time')).toContainText('(edited)');

    // 6. Cascade Deletion of Root Comment (Must remove parent and nested replies)
    const deleteBtn = rootNode.locator('.btn-delete').first();
    await deleteBtn.click();

    // Confirm in modal
    await expect(page.locator('#delete-confirm-modal')).toHaveClass(/active/);
    await page.click('#btn-confirm-delete');

    // Verify both root comment and nested reply are completely gone
    await expect(page.locator('.comment-card', { hasText: updatedCommentText })).toBeHidden();
    await expect(page.locator('.comment-card', { hasText: replyText })).toBeHidden();
  });

  test('Negative: Anonymous User Sees Guest Prompt and Cannot Comment Directly', async ({ page, request }) => {
    // 1. Visit blog page without logging in
    await page.goto('/blog/deep-dive-into-multi-level-comment-hierarchies');
    await expect(page.locator('#discussions')).toBeVisible();

    // Guest prompt box is rendered, comment input is not available for guests
    await expect(page.locator('.guest-prompt-box')).toBeVisible();
    await expect(page.locator('#top-comment-input')).toHaveCount(0);

    // 2. Direct API call without authentication header must return 401
    const res = await request.post('/api/blogs/2/comments', {
      data: { content: 'Malicious guest attempt' }
    });
    expect(res.status()).toBe(401);
  });

  test('Negative: Empty or Whitespace-Only Comment Submission is Rejected', async ({ request }) => {
    // 1. Login as Reader (John) to get cookie
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'john@reader.com', password: 'Reader@123' }
    });
    expect(loginRes.status()).toBe(200);

    // 2. Attempt empty comment
    const emptyRes = await request.post('/api/blogs/2/comments', {
      data: { content: '   ' }
    });
    expect(emptyRes.status()).toBe(400);
    const body = await emptyRes.json();
    expect(body.error).toContain('cannot be empty');
  });

});

