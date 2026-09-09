const { test, expect } = require('@playwright/test');
const { db } = require('../../server/db/database');

test.describe('[ISSUE-13] OTP Generation and Delivery to Registered Email for Forgot Password Flow', () => {

  const testEmail = 'john@reader.com';

  test.beforeEach(async ({ page }) => {
    // Clean slate for test email to ensure rate-limit test isolation
    db.prepare('DELETE FROM password_resets WHERE email = ?').run(testEmail);
    // Navigate to Login page
    await page.goto('/login');
  });

  // ==========================================
  // ✅ POSITIVE TEST CASES — BLUEPRINT
  // ==========================================

  test('Positive 1: Generate OTP for registered email', async ({ page }) => {
    // 1. Open Sign-in page
    await expect(page.locator('#link-forgot-password')).toBeVisible();

    // 2. Click Forgot Password
    await page.click('#link-forgot-password');
    await expect(page.locator('#forgot-password-card')).toBeVisible();

    // 3. Enter a registered email ID
    await page.fill('#forgot-email', testEmail);

    // 4. Click Submit / Continue (Send OTP)
    await page.click('#btn-send-otp');

    // Expected: OTP is generated and sent to the user's registered email ID
    await expect(page.locator('#step-forgot-otp')).toBeVisible();
    await expect(page.locator('#otp-display-email')).toHaveText(testEmail);
    await expect(page.locator('#forgot-success-alert')).toBeVisible();
    await expect(page.locator('#forgot-success-alert')).toContainText('successfully sent');

    // Verify OTP existence in database
    const record = db.prepare('SELECT otp, used FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(record).toBeDefined();
    expect(record.otp).toMatch(/^\d{6}$/);
    expect(record.used).toBe(0);
  });

  test('Positive 2: Verify received OTP', async ({ page }) => {
    // 1. Request OTP using a registered email ID
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);
    await page.click('#btn-send-otp');
    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // 2. Retrieve generated OTP from registered email record
    const record = db.prepare('SELECT otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(record).toBeDefined();

    // 3. Enter the received OTP and submit verification
    await page.fill('#forgot-otp', record.otp);
    await page.click('#btn-verify-otp');

    // Expected: OTP is accepted and the user can proceed to reset the password
    await expect(page.locator('#step-forgot-reset')).toBeVisible();
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
    await expect(page.locator('#forgot-new-password')).toBeVisible();
    await expect(page.locator('#forgot-confirm-password')).toBeVisible();
  });

  test('Positive 3: Generate a new OTP via Resend OTP', async ({ page }) => {
    // Clear recent requests for clean test isolation
    db.prepare("DELETE FROM password_resets WHERE email = ?").run(testEmail);

    // 1. Request initial OTP
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);
    await page.click('#btn-send-otp');
    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    const firstRecord = db.prepare('SELECT id, otp, used FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(firstRecord).toBeDefined();
    const firstOtp = firstRecord.otp;

    // 2. Click Resend OTP
    const resendBtn = page.locator('#btn-resend-otp');
    await expect(resendBtn).toBeVisible();
    await resendBtn.click();

    // Verify success confirmation
    await expect(page.locator('#forgot-success-alert')).toBeVisible();
    await expect(page.locator('#forgot-success-alert')).toContainText('successfully sent');

    // 3. Check the registered email record: A new OTP is generated and sent
    const secondRecord = db.prepare('SELECT id, otp, used FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    expect(secondRecord).toBeDefined();
    expect(secondRecord.id).toBeGreaterThan(firstRecord.id);

    // Verify the previous OTP is marked used/invalidated
    const previousStatus = db.prepare('SELECT used FROM password_resets WHERE id = ?').get(firstRecord.id);
    expect(previousStatus.used).toBe(1);

    // Verify second OTP can be verified successfully
    await page.fill('#forgot-otp', secondRecord.otp);
    await page.click('#btn-verify-otp');
    await expect(page.locator('#step-forgot-reset')).toBeVisible();
  });

  // ==========================================
  // ❌ NEGATIVE TEST CASES
  // ==========================================

  test('Negative 1: Enter an unregistered email ID and select Forgot Password', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'unregistered_account_99@example.com');
    await page.click('#btn-send-otp');

    // Expected: OTP should not be generated or sent. Appropriate error message displayed
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('No account found with this email address');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 2: Enter an invalid email format', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', 'invalid-email-format-without-at');
    await page.click('#btn-send-otp');

    // Expected: System rejects input and displays email validation message
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Please enter a valid email address');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 3: Leave the email field blank and submit', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', '');
    await page.click('#btn-send-otp');

    // Expected: System displays required-field validation message
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Email address is required');
    await expect(page.locator('#step-forgot-otp')).toBeHidden();
  });

  test('Negative 4: Enter an incorrect / expired OTP', async ({ page }) => {
    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);
    await page.click('#btn-send-otp');
    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // 4a. Incorrect OTP
    await page.fill('#forgot-otp', '999999');
    await page.click('#btn-verify-otp');
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Invalid OTP code entered');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();

    // 4b. Expired OTP
    const latestRecord = db.prepare('SELECT id, otp FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    const expiredTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    db.prepare('UPDATE password_resets SET expires_at = ? WHERE id = ?').run(expiredTime, latestRecord.id);

    await page.fill('#forgot-otp', latestRecord.otp);
    await page.click('#btn-verify-otp');
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('OTP has expired');
    await expect(page.locator('#step-forgot-reset')).toBeHidden();
  });

  test('Negative 5: Request OTP repeatedly beyond the allowed limit (Rate Limiting)', async ({ page }) => {
    // Clear existing resets for clean rate-limit window
    db.prepare("DELETE FROM password_resets WHERE email = ?").run(testEmail);

    await page.click('#link-forgot-password');
    await page.fill('#forgot-email', testEmail);

    // 1st request -> Allowed
    await page.click('#btn-send-otp');
    await expect(page.locator('#step-forgot-otp')).toBeVisible();

    // 2nd request via Resend -> Allowed
    await page.click('#btn-resend-otp');
    await expect(page.locator('#btn-resend-otp')).toBeEnabled();
    await expect(page.locator('#forgot-success-alert')).toBeVisible();
    await expect(page.locator('#btn-resend-otp')).toHaveText('Resend OTP');

    // 3rd request via Resend -> Allowed (Reaches maximum limit of 3)
    await page.click('#btn-resend-otp');
    await expect(page.locator('#btn-resend-otp')).toBeEnabled();
    await expect(page.locator('#forgot-success-alert')).toBeVisible();
    await expect(page.locator('#btn-resend-otp')).toHaveText('Resend OTP');

    // 4th request via Resend -> Exceeds rate limit (429)
    await page.click('#btn-resend-otp');
    await expect(page.locator('#btn-resend-otp')).toBeEnabled();

    // Expected: System restricts further OTP requests and displays rate-limit message
    await expect(page.locator('#forgot-error-alert')).toBeVisible();
    await expect(page.locator('#forgot-error-alert')).toContainText('Too many OTP requests');
  });

});
