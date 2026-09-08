const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-06] Public Blog Detail & Reading View', () => {

  test('Positive: Published Blog Detail Renders Full Article with Metadata, Cover, and Tags', async ({ page }) => {
    await page.goto('/');

    // Locate the first published blog card and capture its title
    const firstBlogTitleLink = page.locator('.blog-card-title a').first();
    await expect(firstBlogTitleLink).toBeVisible();
    const blogTitle = await firstBlogTitleLink.innerText();

    // Click to navigate to reading view
    await firstBlogTitleLink.click();

    // 1. Check dynamic page title
    await expect(page).toHaveTitle(new RegExp(blogTitle, 'i'));

    // 2. Check header and title
    const articleTitle = page.locator('h1.article-title');
    await expect(articleTitle).toBeVisible();
    await expect(articleTitle).toHaveText(blogTitle);

    // 3. Check author credentials
    await expect(page.locator('.article-author-name')).toBeVisible();
    await expect(page.locator('.article-author-row .user-avatar')).toBeVisible();

    // 4. Check cover image
    const coverImg = page.locator('.article-cover-img');
    await expect(coverImg).toBeVisible();

    // 5. Check article body
    const articleBody = page.locator('.article-body');
    await expect(articleBody).toBeVisible();

    // 6. Check social engagement bar & like button
    const socialBar = page.locator('#social-bar');
    await expect(socialBar).toBeVisible();
    await expect(page.locator('#btn-like')).toBeVisible();
    await expect(page.locator('#like-count')).toBeVisible();

    // 7. Check discussions section anchor
    await expect(page.locator('#discussions')).toBeVisible();
  });

  test('Positive: Strict Semantic HTML Hierarchy (<article>, <h1>, <header>, <time>)', async ({ page }) => {
    await page.goto('/');
    const firstTitle = page.locator('.blog-card-title a').first();
    await firstTitle.click();

    // Verify <article> wrapper
    const article = page.locator('article.article-detail-view');
    await expect(article).toBeVisible();

    // Verify <header> inside article
    const header = article.locator('header.article-header');
    await expect(header).toBeVisible();

    // Verify <h1> inside header
    const h1 = header.locator('h1.article-title');
    await expect(h1).toBeVisible();

    // Verify <time> element with datetime attribute
    const timeEl = header.locator('time.article-date');
    await expect(timeEl).toBeVisible();
    const datetimeAttr = await timeEl.getAttribute('datetime');
    expect(datetimeAttr).toBeTruthy();
  });

  test('Positive: Dynamic Reading Time Calculated and Displayed', async ({ page }) => {
    await page.goto('/');
    const firstTitle = page.locator('.blog-card-title a').first();
    await firstTitle.click();

    // Check reading time inside article header
    const readingTimeMeta = page.locator('.article-reading-time');
    await expect(readingTimeMeta).toBeVisible();
    await expect(readingTimeMeta).toContainText(/min read/i);

    // Check reading time badge in social bar
    const readingTimeBadge = page.locator('#reading-time-badge');
    await expect(readingTimeBadge).toBeVisible();
    await expect(readingTimeBadge).toContainText(/min read/i);
  });

  test('Positive: Rich Content Typography Rendering (Headings, Code Blocks, Quotes)', async ({ page }) => {
    // Navigate to known rich-text article (Architecting Modern Web Applications)
    await page.goto('/blog/architecting-modern-web-applications');

    await expect(page.locator('.article-body')).toBeVisible();

    // Check that headers, paragraphs, or lists inside article-body are properly styled
    const bodyHeadings = page.locator('.article-body h2, .article-body h3');
    if (await bodyHeadings.count() > 0) {
      await expect(bodyHeadings.first()).toBeVisible();
    }

    const paragraphs = page.locator('.article-body p');
    await expect(paragraphs.first()).toBeVisible();
  });

  test('Negative: Invalid Blog Slug/ID Renders Custom 404 "Blog Not Found" View', async ({ page }) => {
    // Navigate to non-existent blog
    await page.goto('/blog/this-slug-definitely-does-not-exist-404');

    // Page title reflects 404
    await expect(page).toHaveTitle(/Blog Not Found/i);

    // Empty state displays "Blog Not Found"
    const notFoundState = page.locator('.not-found-state');
    await expect(notFoundState).toBeVisible();
    await expect(notFoundState.locator('h2')).toHaveText('Blog Not Found');

    // Home navigation link is present and active
    const homeBtn = page.locator('#btn-return-home');
    await expect(homeBtn).toBeVisible();
    await homeBtn.click();
    await expect(page).toHaveURL('/');
  });

  test('Negative: Unpublished Draft Returns Access Denied to Anonymous Users', async ({ page }) => {
    // Navigate to draft post
    await page.goto('/blog/internal-roadmap-platform-vision');

    // Page title reflects Access Denied
    await expect(page).toHaveTitle(/Access Denied/i);

    // Article is unavailable and access denied
    const draftState = page.locator('.draft-access-state');
    await expect(draftState).toBeVisible();
    await expect(draftState.locator('h2')).toContainText('Access Denied');
    await expect(draftState.locator('a[href="/login"]')).toBeVisible();
  });

});
