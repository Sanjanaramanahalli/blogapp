const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-05] Public Blog Feed, Keyword Search, Multi-Taxonomy Filter & Pagination', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Positive: Feed renders published articles with categories, tags, and pagination controls', async ({ page }) => {
    // 1. Verify page elements
    await expect(page.locator('.brand')).toContainText('ApexBlog');
    await expect(page.locator('h1.hero-title')).toBeVisible();
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#categories-row')).toBeVisible();
    await expect(page.locator('#tags-row')).toBeVisible();

    // 2. Verify blog cards exist
    const cards = page.locator('.blog-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // 3. Verify card elements (Category, reading time, author, stats, tags)
    await expect(cards.first().locator('.blog-card-category')).toBeVisible();
    await expect(cards.first().locator('.blog-card-meta')).toContainText(/min read/i);
    await expect(cards.first().locator('.card-stats')).toBeVisible();
  });

  test('Positive: Keyword Search filters published blogs in real-time (e.g. "Architect")', async ({ page }) => {
    await page.fill('#search-input', 'Architect');
    await page.waitForTimeout(500); // Debounce wait

    const cards = page.locator('.blog-card');
    await expect(cards.first()).toBeVisible();
    const firstTitle = await cards.first().locator('.blog-card-title').innerText();
    expect(firstTitle).toMatch(/Architect/i);

    // Verify search chip is rendered
    const searchChip = page.locator('#chip-search');
    await expect(searchChip).toBeVisible();
    await expect(searchChip).toContainText('Architect');
  });

  test('Positive: Filter by category "Technology" updates catalog to matching blogs', async ({ page }) => {
    // Wait for categories to load
    const techPill = page.locator('#categories-row button[data-category="technology"]');
    await expect(techPill).toBeVisible();
    await techPill.click();
    await page.waitForTimeout(400);

    // Verify active pill state
    await expect(techPill).toHaveClass(/active/);

    // Verify active filter chip
    const catChip = page.locator('#chip-category');
    await expect(catChip).toBeVisible();
    await expect(catChip).toContainText('Technology');

    // Verify cards are filtered
    const cards = page.locator('.blog-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Positive: Click Page 2 loads next page of results with active state and smooth navigation', async ({ page }) => {
    // Check if Page 2 button exists
    const page2Btn = page.locator('.page-btn[data-page="2"]');
    await expect(page2Btn).toBeVisible();

    // Capture first card title from Page 1
    const page1FirstTitle = await page.locator('.blog-card .blog-card-title').first().innerText();

    // Click Page 2
    await page2Btn.click();
    await page.waitForTimeout(500);

    // Verify active page state
    await expect(page2Btn).toHaveClass(/active/);

    // Verify cards updated
    const page2FirstTitle = await page.locator('.blog-card .blog-card-title').first().innerText();
    expect(page2FirstTitle).not.toBe(page1FirstTitle);

    // Verify URL synced
    expect(page.url()).toContain('page=2');
  });

  test('Positive: Combine Search + Category Filter returns intersection of matching blogs', async ({ page }) => {
    // 1. Select Technology category
    const techPill = page.locator('#categories-row button[data-category="technology"]');
    await expect(techPill).toBeVisible();
    await techPill.click();
    await page.waitForTimeout(300);

    // 2. Type keyword 'Architecture' or 'Web'
    await page.fill('#search-input', 'Web');
    await page.waitForTimeout(500);

    // 3. Both filter chips should be visible
    await expect(page.locator('#chip-category')).toBeVisible();
    await expect(page.locator('#chip-search')).toBeVisible();

    const cards = page.locator('.blog-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Positive: Active filter chips allow one-click removal and Clear All', async ({ page }) => {
    // Set a search
    await page.fill('#search-input', 'Architect');
    await page.waitForTimeout(400);

    // Select category
    const techPill = page.locator('#categories-row button[data-category="technology"]');
    await techPill.click();
    await page.waitForTimeout(400);

    const activeBar = page.locator('#active-filters-bar');
    await expect(activeBar).toBeVisible();

    // Click remove on search chip
    await page.click('#chip-search .filter-chip-remove');
    await page.waitForTimeout(300);
    await expect(page.locator('#chip-search')).not.toBeVisible();
    expect(await page.locator('#search-input').inputValue()).toBe('');

    // Click Clear All button
    await page.click('#btn-clear-all-chips');
    await page.waitForTimeout(300);
    await expect(activeBar).not.toBeVisible();
  });

  test('Positive: Clicking a tag badge on a blog card filters the feed by that tag', async ({ page }) => {
    const firstTagBadge = page.locator('.card-tag-badge').first();
    await expect(firstTagBadge).toBeVisible();
    const tagText = await firstTagBadge.innerText();
    const rawTag = tagText.replace('#', '').trim();

    await firstTagBadge.click();
    await page.waitForTimeout(400);

    // Tag chip appears
    const tagChip = page.locator('#chip-tag');
    await expect(tagChip).toBeVisible();
    await expect(tagChip).toContainText(rawTag);
  });

  test('Negative: Search for non-existent keyword shows empty state with reset button', async ({ page }) => {
    await page.fill('#search-input', 'ZzzzNonExistentKeyword999');
    await page.waitForTimeout(500);

    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator('.empty-title')).toContainText(/No blogs found/i);

    // Click reset button
    const resetBtn = page.locator('#btn-reset-filters');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(400);

    // Grid returns
    await expect(page.locator('.blog-card').first()).toBeVisible();
  });

  test('Negative: Direct navigation to out-of-range page (?page=999) renders graceful notice', async ({ page }) => {
    await page.goto('/?page=999');
    await page.waitForTimeout(500);

    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Page Out of Range/i);

    // Click Go to Page 1
    const page1Btn = page.locator('#btn-goto-page-1');
    await expect(page1Btn).toBeVisible();
    await page1Btn.click();
    await page.waitForTimeout(400);

    await expect(page.locator('.blog-card').first()).toBeVisible();
  });

  test('API Quality Gate: /api/blogs rejects unpublished drafts to anonymous requests', async ({ request }) => {
    const res = await request.get('/api/blogs?limit=50');
    expect(res.status()).toBe(200);
    const data = await res.json();
    for (const blog of data.blogs) {
      expect(blog.status).toBe('published');
    }
  });

  test('Responsive Design: Feed renders cleanly on mobile (375px) and 4K (2560px)', async ({ page }) => {
    // 1. Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('.blog-card').first()).toBeVisible();

    // 2. 4K viewport
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('.blog-card').first()).toBeVisible();
  });
});
