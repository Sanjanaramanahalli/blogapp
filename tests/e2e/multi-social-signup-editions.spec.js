const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-15] Multi-Provider Social Signup & Edition-Based News Access', () => {

  // ==========================================
  // POSITIVE TEST SCENARIOS
  // ==========================================

  test('Positive 1: Multi-Provider Signup Options Displayed on Register Page', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL('/register');

    // Verify all 4 signup mechanisms are visible
    const googleBtn = page.locator('#btn-google-signup');
    const linkedinBtn = page.locator('#btn-linkedin-signup');
    const githubBtn = page.locator('#btn-github-signup');
    const registerForm = page.locator('#register-form');

    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toContainText('Continue with Google');

    await expect(linkedinBtn).toBeVisible();
    await expect(linkedinBtn).toContainText('Continue with LinkedIn');

    await expect(githubBtn).toBeVisible();
    await expect(githubBtn).toContainText('Continue with GitHub');

    await expect(registerForm).toBeVisible();
    await expect(page.locator('#reg-name')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
  });

  test('Positive 2: Google Signup Flow from Register Page', async ({ page }) => {
    await page.goto('/register');
    await page.click('#btn-google-signup');

    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    const testGoogleEmail = `alex.google.${Date.now()}@gmail.com`;

    await page.fill('#google-email', testGoogleEmail);
    await page.fill('#google-password', 'ValidPassGoogle123!');

    await page.click('#btn-google-signin-submit');
    await page.waitForURL(/\/\?.*login=google_success/, { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe(testGoogleEmail.toLowerCase());
    expect(meRes.user.role).toBe('reader');
    expect(meRes.user.auth_provider).toBe('google');
  });

  test('Positive 3: LinkedIn Signup Flow creates user with reader role', async ({ page }) => {
    await page.goto('/register');
    await page.click('#btn-linkedin-signup');

    await expect(page).toHaveURL(/\/auth\/linkedin\/screen/);
    const testLinkedInEmail = `sarah.linkedin.${Date.now()}@linkedin-corp.com`;

    await page.fill('#social-email', testLinkedInEmail);
    await page.fill('#social-password', 'ValidLinkedInPass123!');

    await page.click('#btn-social-signin-submit');
    await page.waitForURL(/\/\?.*login=linkedin_success/, { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe(testLinkedInEmail.toLowerCase());
    expect(meRes.user.role).toBe('reader');
    expect(meRes.user.auth_provider).toBe('linkedin');
  });

  test('Positive 4: GitHub Signup Flow creates user with reader role', async ({ page }) => {
    await page.goto('/register');
    await page.click('#btn-github-signup');

    await expect(page).toHaveURL(/\/auth\/github\/screen/);
    const testGithubEmail = `dev.github.${Date.now()}@github-user.io`;

    await page.fill('#social-email', testGithubEmail);
    await page.fill('#social-password', 'ValidGitHubPass123!');

    await page.click('#btn-social-signin-submit');
    await page.waitForURL(/\/\?.*login=github_success/, { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user).toBeDefined();
    expect(meRes.user.email).toBe(testGithubEmail.toLowerCase());
    expect(meRes.user.role).toBe('reader');
    expect(meRes.user.auth_provider).toBe('github');
  });

  test('Positive 5: Account Deduplication & Linking for Existing Reader', async ({ page }) => {
    // john@reader.com was created via seed data
    await page.goto('/auth/linkedin');
    await expect(page).toHaveURL(/\/auth\/linkedin\/screen/);

    await page.fill('#social-email', 'john@reader.com');
    await page.fill('#social-password', 'ValidLinkedInPass123!');

    await page.click('#btn-social-signin-submit');
    await page.waitForURL(/\/\?.*login=linkedin_success/, { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user.email).toBe('john@reader.com');
    expect(meRes.user.name).toBe('John Reader');
    expect(meRes.user.role).toBe('reader');
  });

  test('Positive 6: Account Deduplication preserves Admin Role', async ({ page }) => {
    // admin@blog.com was created via seed data as admin
    await page.goto('/auth/github');
    await expect(page).toHaveURL(/\/auth\/github\/screen/);

    await page.fill('#social-email', 'admin@blog.com');
    await page.fill('#social-password', 'ValidGitHubPass123!');

    await page.click('#btn-social-signin-submit');
    await page.waitForURL(/\/\?.*login=github_success/, { timeout: 10000 });
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    expect(meRes.user.email).toBe('admin@blog.com');
    expect(meRes.user.role).toBe('admin'); // Role strictly preserved!
  });

  test('Positive 7: Multi-Provider Login Options Displayed on Login Page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    const googleBtn = page.locator('#btn-google-login');
    const linkedinBtn = page.locator('#btn-linkedin-login');
    const githubBtn = page.locator('#btn-github-login');

    await expect(googleBtn).toBeVisible();
    await expect(linkedinBtn).toBeVisible();
    await expect(githubBtn).toBeVisible();
  });

  test('Positive 8: India News Edition Feed default and filtering', async ({ page }) => {
    await page.goto('/?edition=india');

    const indiaBtn = page.locator('#edition-india');
    await expect(indiaBtn).toHaveClass(/active/);

    const cards = page.locator('.blog-card');
    await expect(cards.first()).toBeVisible();

    // Verify edition tags on rendered cards are INDIA
    const firstCardEdition = cards.first().locator('.edition-tag');
    await expect(firstCardEdition).toContainText('INDIA');
  });

  test('Positive 9: World News Edition Switcher and Feed Filtering', async ({ page }) => {
    await page.goto('/');

    const worldBtn = page.locator('#edition-world');
    await expect(worldBtn).toBeVisible();
    await worldBtn.click();

    // Verify URL synced with edition=world
    await expect(page).toHaveURL(/edition=world/);
    await expect(worldBtn).toHaveClass(/active/);

    const cards = page.locator('.blog-card');
    await expect(cards.first()).toBeVisible();

    // Verify edition tags on rendered cards are WORLD
    const firstCardEdition = cards.first().locator('.edition-tag');
    await expect(firstCardEdition).toContainText('WORLD');
  });

  test('Positive 10: Category Navigation for Sports, Movies, and Weather', async ({ page }) => {
    await page.goto('/?edition=india');

    // Category button for Sports
    const sportsPill = page.locator('#categories-row .filter-pill', { hasText: 'Sports' });
    await expect(sportsPill).toBeVisible({ timeout: 10000 });
    await sportsPill.click();

    await expect(page).toHaveURL(/category=sports/);
    const sportsCard = page.locator('.blog-card').first();
    await expect(sportsCard).toBeVisible();
    await expect(sportsCard).toContainText('Cricket');

    // Switch to Movies
    const moviesPill = page.locator('#categories-row .filter-pill', { hasText: 'Movies' });
    await expect(moviesPill).toBeVisible({ timeout: 10000 });
    await moviesPill.click();
    await expect(page).toHaveURL(/category=movies/);
    const movieCard = page.locator('.blog-card').first();
    await expect(movieCard).toBeVisible();
    await expect(movieCard).toContainText('Cinema');

    // Switch to Weather
    const weatherPill = page.locator('#categories-row .filter-pill', { hasText: 'Weather' });
    await expect(weatherPill).toBeVisible({ timeout: 10000 });
    await weatherPill.click();
    await expect(page).toHaveURL(/category=weather/);
    const weatherCard = page.locator('.blog-card').first();
    await expect(weatherCard).toBeVisible();
    await expect(weatherCard).toContainText('Monsoon');
  });

  test('Positive 11: Video Badge and Video Player on Article Detail Page', async ({ page }) => {
    await page.goto('/?edition=india&category=sports');
    await expect(page.locator('.blog-card').first()).toBeVisible();

    // Blog card with video should show video badge
    const videoBadge = page.locator('.blog-card .video-badge').first();
    await expect(videoBadge).toBeVisible();
    await expect(videoBadge).toContainText('Video');

    // Click article to open detail page
    const articleLink = page.locator('.blog-card-title a').first();
    await articleLink.click();

    await expect(page).toHaveURL(/\/blog\/india-cricket-championship-victory/);

    // Verify video player element is rendered and playable
    const videoPlayer = page.locator('video');
    await expect(videoPlayer).toBeVisible();
    const videoSource = videoPlayer.locator('source');
    await expect(videoSource).toHaveAttribute('src', /BigBuckBunny\.mp4/);
  });

  test('Positive 12: Admin Publishing with Edition Selection and Video URL', async ({ page }) => {
    // 1. Log in as admin
    await page.goto('/login');
    await page.fill('#login-email', 'admin@blog.com');
    await page.fill('#login-password', 'Admin@123456');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL(/\/admin|\//);

    // 2. Open write page
    await page.goto('/write');
    await expect(page).toHaveURL('/write');

    const testTitle = `Breaking International Space Discovery ${Date.now()}`;
    await page.fill('#blog-title', testTitle);
    await page.selectOption('#blog-edition', 'world');
    await page.fill('#blog-video-url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
    await page.fill('#tags-input', 'space, science, world');
    await page.fill('#blog-body', '<h2>Historic Astronomical Milestone</h2><p>Deep space telescopes capture revolutionary cosmic phenomena.</p>');

    await page.click('#btn-publish');
    await page.waitForURL(/\/blog\//, { timeout: 10000 });

    // Verify newly created blog detail renders World edition tag and video player
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator('.article-title')).toHaveText(testTitle);
    await expect(page.locator('.edition-tag')).toContainText('WORLD');
    await expect(page.locator('video')).toBeVisible();
  });

  // ==========================================
  // NEGATIVE TEST SCENARIOS
  // ==========================================

  test('Negative 1: LinkedIn Invalid Account Credentials', async ({ page }) => {
    await page.goto('/auth/linkedin/screen');
    await page.fill('#social-email', 'invalid_user@unknown.xyz');
    await page.fill('#social-password', 'ValidPass123!');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Couldn't find a LinkedIn account");
  });

  test('Negative 2: LinkedIn Incorrect Password', async ({ page }) => {
    await page.goto('/auth/linkedin/screen');
    await page.fill('#social-email', 'sarah.dev@linkedin.com');
    await page.fill('#social-password', 'wrongpassword');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("That's not the right password");
  });

  test('Negative 3: LinkedIn Cancel Authentication', async ({ page }) => {
    await page.goto('/auth/linkedin/screen');
    await page.click('#btn-social-cancel');

    await expect(page).toHaveURL(/\/login\?error=cancelled/);
    const loginAlert = page.locator('#login-error-alert');
    await expect(loginAlert).toBeVisible();
  });

  test('Negative 4: GitHub Invalid Account Credentials', async ({ page }) => {
    await page.goto('/auth/github/screen');
    await page.fill('#social-email', 'nonexistent_github_dev@unknown.xyz');
    await page.fill('#social-password', 'ValidPass123!');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Incorrect username or password');
  });

  test('Negative 5: GitHub Incorrect Password', async ({ page }) => {
    await page.goto('/auth/github/screen');
    await page.fill('#social-email', 'coder@github.com');
    await page.fill('#social-password', 'wrongpassword');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Incorrect username or password');
  });

  test('Negative 6: GitHub Cancel Authentication', async ({ page }) => {
    await page.goto('/auth/github/screen');
    await page.click('#btn-social-cancel');

    await expect(page).toHaveURL(/\/login\?error=cancelled/);
    const loginAlert = page.locator('#login-error-alert');
    await expect(loginAlert).toBeVisible();
  });

  test('Negative 7: Empty Email Field on Social Authentication Screen', async ({ page }) => {
    await page.goto('/auth/linkedin/screen');
    await page.fill('#social-email', '');
    await page.fill('#social-password', 'SomePass123!');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
  });

  test('Negative 8: Empty Password Field on Social Authentication Screen', async ({ page }) => {
    await page.goto('/auth/github/screen');
    await page.fill('#social-email', 'coder@github.com');
    await page.fill('#social-password', '');
    await page.click('#btn-social-signin-submit');

    const alert = page.locator('#social-error-alert');
    await expect(alert).toBeVisible();
  });

  test('Negative 9: Malformed Social OAuth Callback (missing code)', async ({ page }) => {
    await page.goto('/auth/linkedin/callback');
    await expect(page).toHaveURL(/\/login\?error=missing_code/);
  });

  test('Negative 10: Expired or Nonexistent OAuth Code on Callback', async ({ page }) => {
    await page.goto('/auth/github/callback?code=fake_nonexistent_code_12345');
    await expect(page).toHaveURL(/\/login\?error=invalid_or_expired_code/);
  });

  test('Negative 11: OAuth State Mismatch on Callback', async ({ page }) => {
    // Set a cookie state then supply mismatched state in query
    await page.context().addCookies([{
      name: 'oauth_state',
      value: 'legitimate_state_secret_123',
      domain: '127.0.0.1',
      path: '/'
    }]);

    await page.goto('/auth/linkedin/callback?code=some_code&state=attack_mismatched_state');
    await expect(page).toHaveURL(/\/login\?error=state_mismatch/);
  });

  test('Negative 12: Invalid Social Provider route rejected', async ({ page }) => {
    await page.goto('/auth/unsupported_provider');
    await expect(page).toHaveURL(/\/login\?error=invalid_provider/);
  });

  test('Negative 13: Unauthenticated Writer Access to /write is Blocked', async ({ page }) => {
    // Clear cookies and localStorage to guarantee unauthenticated state
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/write');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('Negative 14: Article Creation with Missing Required Fields', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('#login-email', 'admin@blog.com');
    await page.fill('#login-password', 'Admin@123456');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL(/\/admin|\//);

    await page.goto('/write');
    // Try publishing empty article
    await page.click('#btn-publish');

    // Title field gets focused and form submission is stopped
    await expect(page.locator('#blog-title')).toBeFocused();
  });

});
