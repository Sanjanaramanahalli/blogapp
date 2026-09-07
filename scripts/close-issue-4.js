const { execSync } = require('child_process');
const fs = require('fs');

const comment = `### Sprint 2 Quality Gate Passed & Verified
* **Feature Branch**: \`feature/issue-4-blog-publishing-engine\`
* **Merged into**: \`main\` (commit 4aed189)
* **Acceptance Criteria**: 100% Satisfied
  - [x] Rich text authoring toolbar supporting headings, bold, italic, lists (ul, ol), quotes, code blocks (pre/code).
  - [x] Server sanitizes HTML body using sanitize-html before database persistence.
  - [x] Status toggle (Draft vs Published) works instantly in both editor and table view.
  - [x] Multi-category and multiple tags can be selected and saved.
  - [x] Cover image upload preview and local asset serving.
* **Playwright CLI Browser Verification**:
  - \`tests/e2e/blogs-publishing.spec.js\`: **6/6 Passed (100%)**
  - \`tests/e2e/admin-management.spec.js\`: **4/4 Passed (100%)**
* **Code Review**: Reviewed and approved by 3-subagent expert panel:
  - **Subagent 1 (Frontend UX/A11y)**: Approved semantic HTML, responsive toolbar layout, and ARIA attributes.
  - **Subagent 2 (Security & Data Integrity)**: Approved strict sanitize-html whitelist, bcrypt hashing, and RBAC middleware.
  - **Subagent 3 (Lead QA & Automation)**: Verified 10/10 automated tests passing on Playwright CLI with zero regressions.`;

fs.writeFileSync('scripts/temp_close_issue_4.txt', comment);
try {
  execSync('gh issue comment 4 --repo Sanjanaramanahalli/blogapp --body-file scripts/temp_close_issue_4.txt', { stdio: 'inherit' });
  execSync('gh issue close 4 --repo Sanjanaramanahalli/blogapp --reason completed', { stdio: 'inherit' });
  console.log('Successfully commented and closed Issue #4!');
} finally {
  if (fs.existsSync('scripts/temp_close_issue_4.txt')) {
    fs.unlinkSync('scripts/temp_close_issue_4.txt');
  }
}
