const { test, expect } = require('@playwright/test');

test.describe('M2: Content Publishing, Discovery & Taxonomy', () => {

  test('Positive: Public Blog Feed Renders with Cards and Metadata', async ({ page }) => {
    await page.goto('/');

    // Check brand and hero header
    await expect(page.locator('.brand')).toContainText('ApexBlog');
    await expect(page.locator('h1.hero-title')).toBeVisible();

    // Check blog cards
    const cards = page.locator('.blog-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify metadata: Category, Author, Likes, Comments
    await expect(cards.first().locator('.blog-card-category')).toBeVisible();
    await expect(cards.first().locator('.card-stats')).toBeVisible();
  });

  test('Positive: Keyword Search Filters Articles in Real-Time', async ({ page }) => {
    await page.goto('/');

    // Type keyword 'Architecting' in search bar
    await page.fill('#search-input', 'Architecting');
    await page.waitForTimeout(600); // Debounce wait

    const cards = page.locator('.blog-card');
    await expect(cards.first()).toContainText('Architecting Modern Web Applications');
  });

  test('Positive: Category Filter Updates Article Catalog', async ({ page }) => {
    await page.goto('/');

    // Wait for categories to load
    const categoryPills = page.locator('.filter-pill');
    await expect(categoryPills.first()).toBeVisible();

    // Click 'Web Development' category pill if available or second pill
    const webDevPill = page.locator('.filter-pill', { hasText: 'Web Development' });
    if (await webDevPill.isVisible()) {
      await webDevPill.click();
      await page.waitForTimeout(500);

      const cards = page.locator('.blog-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('Positive: Article Detail Reading View Renders Sanitized Content', async ({ page }) => {
    await page.goto('/');

    // Click on the first blog title link
    const firstTitleLink = page.locator('.blog-card-title a').first();
    const expectedTitle = await firstTitleLink.innerText();
    await firstTitleLink.click();

    // Verify reader page elements
    await expect(page.locator('.article-title')).toHaveText(expectedTitle);
    await expect(page.locator('.article-body')).toBeVisible();
    await expect(page.locator('.article-cover-wrapper')).toBeVisible();
    await expect(page.locator('#social-bar')).toBeVisible();
    await expect(page.locator('#discussions')).toBeVisible();
  });

  test('Negative: Unpublished Draft is Inaccessible to Anonymous Guests', async ({ page }) => {
    // Attempt to access draft post slug
    await page.goto('/blog/internal-roadmap-platform-vision');

    // Expect access rejection or Article Unavailable message
    await expect(page.locator('.empty-state')).toContainText('Article Unavailable');
  });

  test('Positive: Admin Creates and Publishes a New Blog Post', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 2. Open Create Blog Modal
    await page.click('#btn-create-blog-top');
    await expect(page.locator('#blog-modal')).toHaveClass(/active/);

    // 3. Fill details
    const timestamp = Date.now();
    const testTitle = `Scalable Systems ${timestamp}`;
    await page.fill('#blog-title-input', testTitle);
    await page.fill('#blog-body-input', '<h2>Scalability Matrix</h2><p>Proven high-concurrency microservices design.</p>');
    await page.fill('#blog-tags-input', 'scalability, performance');

    // Select Published radio
    await page.check('#status-published');

    // Check first available category
    const firstCatCheck = page.locator('input[name="categories"]').first();
    if (await firstCatCheck.isVisible()) {
      await firstCatCheck.check();
    }

    // Submit form
    await page.click('#btn-save-blog');

    // Verify success toast and table update
    await expect(page.locator('.toast-success')).toBeVisible();
    await page.waitForTimeout(1000);

    // Navigate to home and verify new blog appears on public feed
    await page.goto('/');
    await expect(page.locator('.blog-card', { hasText: testTitle })).toBeVisible();
  });

});
