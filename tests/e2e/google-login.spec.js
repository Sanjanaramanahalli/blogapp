const { test, expect } = require('@playwright/test');

test.describe('[ISSUE-14] Google Login Option for User Authentication', () => {

  test('Positive 1: Login using valid Google account', async ({ page }) => {
    // 1. Open the Login page
    await page.goto('/login');
    await expect(page).toHaveURL('/login');

    // Verify Login with Google option is clearly available
    const googleLoginBtn = page.locator('#btn-google-login');
    await expect(googleLoginBtn).toBeVisible();
    await expect(googleLoginBtn).toContainText('Login with Google');

    // 2. Click Login with Google
    await googleLoginBtn.click();

    // Verify redirection to the Google authentication screen
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    await expect(page.locator('.google-title')).toHaveText('Sign in');
    await expect(page.locator('#google-email')).toBeVisible();
    await expect(page.locator('#google-password')).toBeVisible();

    // 3. Enter valid Google account credentials
    const testGoogleEmail = `google.user.${Date.now()}@gmail.com`;
    await page.fill('#google-email', testGoogleEmail);
    await page.fill('#google-password', 'ValidGooglePassword123!');

    // 4. Complete authentication
    await Promise.all([
      page.waitForURL(url => url.pathname === '/' || url.pathname === ''),
      page.click('#btn-google-signin-submit')
    ]);

    // Verify user is successfully logged in and redirected to the application
    await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#nav-actions')).toContainText('Sign out');

    // User should not remain on the login page or receive an authentication error
    await expect(page).not.toHaveURL('/login');
    await expect(page.locator('#login-error-alert')).not.toBeVisible();

    // Verify authenticated user session
    const meRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });
    expect(meRes.user).not.toBeNull();
    expect(meRes.user.email).toBe(testGoogleEmail.toLowerCase());
    expect(meRes.user.role).toBe('reader');
  });

  test('Negative 1: Login using invalid Google account credentials', async ({ page }) => {
    // 1. Open login and initiate Google authentication
    await page.goto('/login');
    await page.click('#btn-google-login');
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // 2. Enter invalid account credentials
    await page.fill('#google-email', 'invalid_google_account@unknown.xyz');
    await page.fill('#google-password', 'ValidPassword123!');
    await page.click('#btn-google-signin-submit');

    // 3. Expected: User should see an appropriate authentication error and should not be logged in
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Couldn't find your Google Account");

    // User should not be granted access to the application
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    await expect(page.locator('#btn-logout')).not.toBeVisible();
  });

  test('Negative 2: Login with incorrect password', async ({ page }) => {
    // 1. Open login and initiate Google authentication
    await page.goto('/login');
    await page.click('#btn-google-login');
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // 2. Enter valid email but incorrect password
    await page.fill('#google-email', 'alex.tester@gmail.com');
    await page.fill('#google-password', 'wrongpassword');
    await page.click('#btn-google-signin-submit');

    // 3. Expected: User should see an invalid password error and remain unauthenticated
    const errorAlert = page.locator('#google-error-alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Wrong password');

    // User should not be logged in with incorrect credentials
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
    await expect(page.locator('#btn-logout')).not.toBeVisible();
  });

  test('Negative 3: Cancel Google authentication', async ({ page }) => {
    // 1. Open login and initiate Google authentication
    await page.goto('/login');
    await page.click('#btn-google-login');
    await expect(page).toHaveURL(/\/auth\/google\/screen/);

    // 2. User cancels Google authentication
    await page.click('#btn-google-cancel');

    // 3. Expected: User should be redirected back to the login page without being authenticated
    await expect(page).toHaveURL(/\/login\?error=cancelled/);
    await expect(page.locator('#login-card')).toBeVisible();

    // User should see cancellation alert and remain unauthenticated
    const loginErrorAlert = page.locator('#login-error-alert');
    await expect(loginErrorAlert).toBeVisible();
    await expect(loginErrorAlert).toContainText('Google authentication was cancelled');
    await expect(page.locator('#btn-logout')).not.toBeVisible();
  });

  test('Registration page also provides Sign up with Google option', async ({ page }) => {
    // Open registration page
    await page.goto('/register');
    const googleSignupBtn = page.locator('#btn-google-signup');
    await expect(googleSignupBtn).toBeVisible();
    await expect(googleSignupBtn).toContainText('Sign up with Google');

    // Clicking redirects to Google authentication
    await googleSignupBtn.click();
    await expect(page).toHaveURL(/\/auth\/google\/screen/);
  });

});
