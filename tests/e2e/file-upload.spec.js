const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

test.describe('[ISSUE-03] File Upload Engine for Blog Cover Images', () => {

  // Generate test fixtures
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1. Valid 1x1 PNG image buffer
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const testPngPath = path.join(fixturesDir, 'test-cover.png');
  fs.writeFileSync(testPngPath, validPngBuffer);

  // 2. Disguised executable / script file
  const testScriptPath = path.join(fixturesDir, 'malicious.sh');
  fs.writeFileSync(testScriptPath, '#!/bin/bash\necho "exploit"');

  // 3. Fake oversized file > 5MB
  const testOversizedPath = path.join(fixturesDir, 'oversized.png');
  const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB
  fs.writeFileSync(testOversizedPath, oversizedBuffer);

  test.afterAll(() => {
    try {
      if (fs.existsSync(fixturesDir)) {
        fs.rmSync(fixturesDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  });

  test('Positive: Admin uploads valid cover image and accesses it via public URL', async ({ request }) => {
    // 1. Authenticate as Admin
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@blog.com', password: 'Admin@123456' }
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();

    // 2. Upload cover image via /api/uploads/cover
    const uploadRes = await request.post('/api/uploads/cover', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        image: {
          name: 'test-cover.png',
          mimeType: 'image/png',
          buffer: validPngBuffer
        }
      }
    });

    expect(uploadRes.status()).toBe(200);
    const body = await uploadRes.json();
    expect(body.url).toMatch(/^\/uploads\/.*\.png$/);
    expect(body.filename).toBeDefined();

    // 3. Verify public static access to the uploaded image
    const getFileRes = await request.get(body.url);
    expect(getFileRes.status()).toBe(200);
    expect(getFileRes.headers()['content-type']).toContain('image/png');
  });

  test('Positive: Root /api/uploads endpoint also accepts image upload', async ({ request }) => {
    // 1. Authenticate as Admin
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@blog.com', password: 'Admin@123456' }
    });
    const { token } = await loginRes.json();

    // 2. Upload via /api/uploads
    const uploadRes = await request.post('/api/uploads', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        image: {
          name: 'root-cover.png',
          mimeType: 'image/png',
          buffer: validPngBuffer
        }
      }
    });

    expect(uploadRes.status()).toBe(200);
    const body = await uploadRes.json();
    expect(body.url).toMatch(/^\/uploads\/.*\.png$/);
  });

  test('Negative: Anonymous or Reader upload attempt is rejected (401 / 403)', async ({ request }) => {
    // 1. Anonymous upload attempt
    const anonRes = await request.post('/api/uploads/cover', {
      multipart: {
        image: {
          name: 'anon.png',
          mimeType: 'image/png',
          buffer: validPngBuffer
        }
      }
    });
    expect([401, 403]).toContain(anonRes.status());

    // 2. Reader role upload attempt
    const readerLogin = await request.post('/api/auth/login', {
      data: { email: 'john@reader.com', password: 'Reader@123' }
    });
    const { token: readerToken } = await readerLogin.json();

    const readerUploadRes = await request.post('/api/uploads/cover', {
      headers: { Authorization: `Bearer ${readerToken}` },
      multipart: {
        image: {
          name: 'reader.png',
          mimeType: 'image/png',
          buffer: validPngBuffer
        }
      }
    });
    expect(readerUploadRes.status()).toBe(403);
  });

  test('Negative: Uploading non-image file is rejected with 400 Bad Request', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@blog.com', password: 'Admin@123456' }
    });
    const { token } = await loginRes.json();

    const nonImageRes = await request.post('/api/uploads/cover', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        image: {
          name: 'malicious.sh',
          mimeType: 'application/x-sh',
          buffer: Buffer.from('#!/bin/bash\necho "test"')
        }
      }
    });

    expect(nonImageRes.status()).toBe(400);
    const body = await nonImageRes.json();
    expect(body.error).toMatch(/Only image files/i);
  });

  test('Negative: Uploading file exceeding 5MB is rejected', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { email: 'admin@blog.com', password: 'Admin@123456' }
    });
    const { token } = await loginRes.json();

    const oversizedRes = await request.post('/api/uploads/cover', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        image: {
          name: 'oversized.png',
          mimeType: 'image/png',
          buffer: oversizedBuffer
        }
      }
    });

    expect([400, 413]).toContain(oversizedRes.status());
    const body = await oversizedRes.json();
    expect(body.error).toMatch(/5MB/i);
  });

  test('Positive: Admin UI triggers file upload and displays live preview in modal', async ({ page }) => {
    // 1. Login as Admin
    await page.goto('/login');
    await page.click('#btn-fill-admin');
    await page.click('#btn-submit-login');
    await expect(page).toHaveURL('/admin');

    // 2. Open Create Blog Modal
    await page.click('#btn-create-blog-top');
    await expect(page.locator('#blog-modal')).toHaveClass(/active/);

    // 3. Set file input using test image fixture
    const fileInput = page.locator('#cover-file-input');
    await fileInput.setInputFiles(testPngPath);

    // 4. Verify preview image appears and hidden URL input is populated
    const previewImg = page.locator('#cover-preview-img');
    await expect(previewImg).toBeVisible();
    await expect(previewImg).toHaveAttribute('src', /^\/uploads\//);

    const coverUrlVal = await page.locator('#blog-cover-url').inputValue();
    expect(coverUrlVal).toMatch(/^\/uploads\//);
  });
});
