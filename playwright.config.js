const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1, // Single worker to avoid SQLite database lock contention during tests
  retries: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.CI ? {
    command: 'node server/server.js',
    url: 'http://127.0.0.1:3000',
    timeout: 30000
  } : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
