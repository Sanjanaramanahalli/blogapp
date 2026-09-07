const { execSync } = require('child_process');

const REPO = 'Sanjanaramanahalli/blogapp';

const extraLabels = [
  { name: 'authentication', color: 'e99695', description: 'User login, registration and authentication' },
  { name: 'testing', color: '2ea44f', description: 'E2E browser tests and integration tests' }
];

for (const label of extraLabels) {
  try {
    execSync(`gh label create "${label.name}" --color "${label.color}" --description "${label.description}" --repo ${REPO}`, { stdio: 'ignore' });
    console.log(`+ Created label: ${label.name}`);
  } catch (e) {}
}

const issueUpdates = [
  {
    num: 1,
    milestone: 'M1: Core Engine & Identity',
    labels: ['backend', 'database', 'task', 'P0 - Blocker']
  },
  {
    num: 2,
    milestone: 'M1: Core Engine & Identity',
    labels: ['backend', 'authentication', 'security', 'rbac', 'jwt', 'P0 - Blocker']
  },
  {
    num: 3,
    milestone: 'M1: Core Engine & Identity',
    labels: ['backend', 'uploads', 'P1 - High']
  },
  {
    num: 4,
    milestone: 'M2: Publishing & Discovery',
    labels: ['fullstack', 'frontend', 'backend', 'cms', 'rich-text', 'admin', 'P0 - Blocker']
  },
  {
    num: 5,
    milestone: 'M2: Publishing & Discovery',
    labels: ['frontend', 'search', 'filter', 'pagination', 'P0 - Blocker']
  },
  {
    num: 6,
    milestone: 'M2: Publishing & Discovery',
    labels: ['frontend', 'P1 - High']
  },
  {
    num: 7,
    milestone: 'M3: Community Engagement',
    labels: ['fullstack', 'frontend', 'backend', 'likes', 'P0 - Blocker']
  },
  {
    num: 8,
    milestone: 'M3: Community Engagement',
    labels: ['fullstack', 'frontend', 'backend', 'comments', 'threading', 'P0 - Blocker']
  },
  {
    num: 9,
    milestone: 'M4: Governance & Quality Gate',
    labels: ['fullstack', 'frontend', 'backend', 'admin', 'security', 'P1 - High']
  },
  {
    num: 10,
    milestone: 'M4: Governance & Quality Gate',
    labels: ['task', 'qa', 'testing', 'playwright', 'P0 - Blocker']
  },
  {
    num: 11,
    milestone: 'M4: Governance & Quality Gate',
    labels: ['documentation', 'task', 'enhancement', 'presentation', 'P1 - High']
  }
];

console.log('Reopening and syncing all 11 GitHub issues in ' + REPO + '...');

for (const item of issueUpdates) {
  try {
    // Reopen issue
    execSync(`gh issue reopen ${item.num} --repo ${REPO}`, { stdio: 'ignore' });
    
    // Update milestone and labels
    const labelsArg = item.labels.map(l => `--add-label "${l}"`).join(' ');
    execSync(`gh issue edit ${item.num} --milestone "${item.milestone}" ${labelsArg} --repo ${REPO}`, { stdio: 'ignore' });
    console.log(`[Synced] Issue #${item.num} -> Milestone: ${item.milestone}, Status: Open`);
  } catch (err) {
    console.error(`Error on issue #${item.num}:`, err.message);
  }
}

console.log('All 11 issues are now OPEN and active on GitHub!');
