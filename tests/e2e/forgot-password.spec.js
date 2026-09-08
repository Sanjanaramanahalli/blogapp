const { test, expect } = require('@playwright/test');
const { db } = require('../../server/db/database');

test.describe('[ISSUE-12] Forgot Password Option with Email OTP Verification & Password Reset', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  // ==========================================
  // ✅ POSITIVE TEST CASES — BLUEPRINT
  // ==========================================

  test('Positive 1 & 2 & 3: End-to-End Forgot Password Journey (Registered email -> Valid OTP -> Password Reset -> Login)', async ({ page }) => {
    // 1. Open Login page & verify Forgot Password option is visible
    const forgotLink = page.locator('#link-forgot-password');
    await expect(forgotLink).toBeVisible();

    // 2. Click Forgot Password
    await forgotLink.click();
    await expect(page.locator('#forgot-password-card')).toBeVisible();
    await expect(page.locator('#login-card')).toBeHidden();

    // 3. Enter a registered email ID
    const registeredEmail = 'john@reader.com';
    await page.fill('#forgot-email', registeredEmail);

    // 4. Click Send OTP
    await page.click('#btn-send-otp');

    // Positive 1 Verification: OTP is successfully sent to the registered email address
    await expect(page.locator('#step-forgot-otp')).toBeVisible();
    await expect(page.locator('#otp-display-email')).toHaveText(registeredEmail);
    await expect(page.locator('#forgot-success-alert')).toBeVisible();
    await expect(page.locator('#forgot-success-alert')).toContainText('successfully sent');

    // Fetch the OTP from database or window
    const otpRecord = db.prepare('SELECT otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(registeredEmail);
    expect(otpRecord).toBeDefined();
    const validOtp = otpRecord.otp;
    expect(validOtp).toMatch(/^\d{6}$/);

    // Positive 2: Enter valid OTP and click Verify OTP
    await page.fill('#forgot-otp', validOtp);
    await page.click('#btn-verify-otp');

    // Positive 2 Verification: OTP verified successfully and password reset screen is displayed
    await expect(page.locator('#step-forgot-reset')).toBeVisible();
    await expect(page.locator('#step-forgot-otp')).toBeHidden();

    // Positive 3: Enter valid new password, confirm password, click Reset Password
    const newPassword = 'NewReader@2026';
    await page.fill('#forgot-new-password', newPassword);
    await page.fill('#forgot-confirm-password', newPassword);
    await page.click('#btn-submit-reset-password');

    // Positive 3 Verification: Password updated successfully, redirects to login, and reader logs in
    await expect(page.locator('#login-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#login-email')).toHaveValue(registeredEmail);

    // Log in with the newly reset password
    await page.fill('#login-password', newPassword);
    await page.click('#btn-submit-login');

    // Successfully logged in and redirected to home page
    await expect(page).toHaveURL('/');
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.role-badge')).toHaveText('reader');

    // Restore original reader password so other test suites remain stable
    const bcrypt = require('bcryptjs');
    const originalHash = bcrypt.hashSync('Reader@123', 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(originalHash, registeredEmail);
  });

  // ==========================================
  // ❌ NEGATIVE TEST CASES
  // ==========================================

  test('Negative 1: Unregistered email rejects and does not send OTP', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'unregistered_user@example.com');
    await page.click('#btn-send-otp');

    // System should reject the email and display error
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('No account found with this email address');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 2: Invalid email format displays validation message and prevents OTP request', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'not-an-email');
    await page.click('#btn-send-otp');

    // System displays validation error and does not transition
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Please enter a valid email address');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 3: Incorrect OTP displays invalid OTP error and prevents password reset', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'john@reader.com');
    await page.click('#btn-send-otp');

    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // Enter incorrect OTP
    await page.fill('#forgot-otp', '000000');
    await page.click('#btn-verify-otp');

    // Verify error and reset screen prevented
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Invalid OTP code entered');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();
  });

  test('Negative 4: Expired OTP is rejected and requires a new OTP', async ({ page }) => {
    const testEmail = 'john@reader.com';

    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);
    await page.click('#btn-send-otp');

    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // Retrieve generated OTP
    const otpRecord = db.prepare('SELECT id, otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(otpRecord).toBeDefined();

    // Mark the OTP as expired (10 minutes ago)
    const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    db.prepare('UPDATE password_resets SET expires_at = ? WHERE id = ?').run(expiredTime, otpRecord.id);

    // Enter the expired OTP
    await page.fill('#forgot-otp', otpRecord.otp);
    await page.click('#btn-verify-otp');

    // System should reject the expired OTP
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('OTP has expired');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();
  });

  test('Negative 5: Reused OTP is rejected when attempted again', async ({ page }) => {
    const testEmail = 'john@reader.com';

    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);
    await page.click('#btn-send-otp');

    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // Retrieve generated OTP
    const otpRecord = db.prepare('SELECT id, otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(otpRecord).toBeDefined();

    // Mark the OTP as already used
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(otpRecord.id);

    // Enter the already used OTP
    await page.fill('#forgot-otp', otpRecord.otp);
    await page.click('#btn-verify-otp');

    // Reused OTP must be rejected
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('OTP has already been used');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();
  });

  test('Negative 6: Mismatched passwords displays mismatch error and prevents reset', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'john@reader.com');
    await page.click('#btn-send-otp');

    const otpRecord = db.prepare('SELECT otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get('john@reader.com');
    await page.fill('#forgot-otp', otpRecord.otp);
    await page.click('#btn-verify-otp');

    await expect(page.locator('#step-forgot-reset')).toBeVisible();

    // Enter mismatched passwords
    await page.fill('#forgot-new-password', 'FirstPassword123');
    await page.fill('#forgot-confirm-password', 'DifferentPassword456');
    await page.click('#btn-submit-reset-password');

    // Error must be displayed
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('do not match');
  });

  test('Negative 7: Empty email field displays required-field validation message', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', '');
    await page.click('#btn-send-otp');

    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Email address is required');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 8: Empty OTP field displays required-field validation message', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'john@reader.com');
    await page.click('#btn-send-otp');

    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // Leave OTP empty and click verify
    await page.fill('#forgot-otp', '');
    await page.click('#btn-verify-otp');

    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('OTP code is required');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();
  });

});
