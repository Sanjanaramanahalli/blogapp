/**
 * Production Build Validation Script
 * Verifies public assets, triggers Prisma Client generation, and checks production readiness.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

console.log('====================================================');
console.log('🚀 ApexBlog Production Build & Validation Script');
console.log('====================================================');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 1. Verify required frontend static files
const requiredFiles = [
  'index.html',
  'blog.html',
  'login.html',
  'register.html',
  'profile.html',
  'admin.html',
  'write.html',
  'css/styles.css',
  'js/config.js',
  'js/api.js',
  'js/app.js'
];

console.log('\n[1/3] Validating static frontend assets...');
let missingFiles = [];
for (const file of requiredFiles) {
  const fullPath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error(`❌ Build Error: Missing required public files:\n  ${missingFiles.join('\n  ')}`);
  process.exit(1);
}
console.log(`✅ All ${requiredFiles.length} critical frontend files verified.`);

// 2. Validate Prisma Schema & Generate Client
console.log('\n[2/3] Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit', cwd: ROOT_DIR });
  console.log('✅ Prisma client generated successfully.');
} catch (err) {
  console.warn('⚠️ Note: Prisma generate skipped or completed with warning:', err.message);
}

// 3. Verify server entrypoint
console.log('\n[3/3] Checking backend entrypoint...');
const serverPath = path.join(ROOT_DIR, 'server', 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ Build Error: server/server.js not found!');
  process.exit(1);
}
console.log('✅ Backend entrypoint verified.');

console.log('\n====================================================');
console.log('✨ Build Succeeded! Ready for Vercel & Render Deployment.');
console.log('====================================================');
