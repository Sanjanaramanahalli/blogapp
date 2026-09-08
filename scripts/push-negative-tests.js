const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'Sanjanaramanahalli/blogapp';

const testCases = [
  {
    num: 1,
    scenario: 'Unregistered email',
    expected: 'System should reject the email and should not send an OTP.',
    notExpected: 'OTP is sent to an unregistered email address.',
    details: 'When a user submits an email address that does not exist in the database, the system must not generate or send an OTP. Appropriate security practices should be followed (displaying an error indicating the email is not registered or generic messaging preventing account enumeration, while strictly ensuring no OTP dispatch occurs).'
  },
  {
    num: 2,
    scenario: 'Invalid email format',
    expected: 'System should display a validation message and prevent OTP request.',
    notExpected: 'OTP request is processed with an invalid email format.',
    details: 'When an email address missing "@", domain, or having malformed characters (e.g., "plainaddress", "test@.com") is entered, client-side and server-side validation should immediately trigger a validation error without sending any network request to the OTP dispatcher.'
  },
  {
    num: 3,
    scenario: 'Incorrect OTP',
    expected: 'System should display an invalid OTP error and prevent password reset.',
    notExpected: 'Incorrect OTP is accepted and password reset is allowed.',
    details: 'When the user inputs an incorrect OTP code, the backend must return a 400/401 verification failure, retain the user on the verification step with an explicit "Invalid OTP" error message, and strictly deny password modification.'
  },
  {
    num: 4,
    scenario: 'Expired OTP',
    expected: 'System should reject the expired OTP and require a new OTP.',
    notExpected: 'Expired OTP is accepted.',
    details: 'OTPs have a strict TTL (time-to-live). If submitted past the expiration window, the system must reject the code with an "OTP has expired. Please request a new one" message and invalidate the pending session.'
  },
  {
    num: 5,
    scenario: 'Reused OTP',
    expected: 'System should reject an OTP that has already been successfully used.',
    notExpected: 'Previously used OTP is accepted again.',
    details: 'Once an OTP has been used to verify or reset credentials, its token record must be immediately revoked/deleted or marked used. Subsequent submission attempts with the same OTP must fail unconditionally.'
  },
  {
    num: 6,
    scenario: 'Mismatched passwords',
    expected: 'System should display a password mismatch error and prevent the reset.',
    notExpected: 'Password is updated despite the passwords not matching.',
    details: 'When entering "New Password" and "Confirm Password", if the strings do not match character-for-character, form submission must be blocked and a clear "Passwords do not match" warning must be shown.'
  },
  {
    num: 7,
    scenario: 'Empty email field',
    expected: 'System should display a required-field validation message.',
    notExpected: 'OTP request is submitted without an email address.',
    details: 'Submitting the email form while blank, whitespace-only, or empty must trigger client-side HTML5/JS required field indicators and fail backend validation with HTTP 400 Bad Request.'
  },
  {
    num: 8,
    scenario: 'Empty OTP field',
    expected: 'System should display a required-field validation message.',
    notExpected: 'OTP verification proceeds without an OTP.',
    details: 'Submitting the OTP verification form with empty or missing digits must prevent form submission, display a required-field validation error, and abort OTP evaluation.'
  }
];

const tempDir = path.join(__dirname, '../.tmp_negative_issues');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

async function createAllIssues() {
  console.log(`Creating Negative Test Case GitHub Issues in ${REPO}...`);

  // 1. Create Parent / Tracking Issue
  const parentTitle = '[ISSUE-12] Negative Test Cases: Password Reset & OTP Flow';
  const parentBody = `### ❌ Negative Test Cases: Password Reset & OTP Flow

### Summary
Comprehensive tracking issue for the negative test scenarios regarding the Password Reset and One-Time Password (OTP) verification engine.

### Negative Test Cases Matrix

| # | Scenario | Expected Outcome | Not Expected Outcome |
|---|---|---|---|
| 1 | Unregistered email | System should reject the email and should not send an OTP. | OTP is sent to an unregistered email address. |
| 2 | Invalid email format | System should display a validation message and prevent OTP request. | OTP request is processed with an invalid email format. |
| 3 | Incorrect OTP | System should display an invalid OTP error and prevent password reset. | Incorrect OTP is accepted and password reset is allowed. |
| 4 | Expired OTP | System should reject the expired OTP and require a new OTP. | Expired OTP is accepted. |
| 5 | Reused OTP | System should reject an OTP that has already been successfully used. | Previously used OTP is accepted again. |
| 6 | Mismatched passwords | System should display a password mismatch error and prevent the reset. | Password is updated despite the passwords not matching. |
| 7 | Empty email field | System should display a required-field validation message. | OTP request is submitted without an email address. |
| 8 | Empty OTP field | System should display a required-field validation message. | OTP verification proceeds without an OTP. |

### Technical Scope & Verification
- **Frontend Validation**: Ensure instant feedback, disabled submission on empty/invalid inputs, and clear human-readable error alerts.
- **Backend Enforcements**: Validate inputs with strict schemas, rate-limiting, secure OTP hashing/TTL expiration, and state invalidation upon use.
- **Automated QA**: Cover all 8 negative test vectors in end-to-end integration tests.

### Checklist
- [ ] Test Case #1: Unregistered email
- [ ] Test Case #2: Invalid email format
- [ ] Test Case #3: Incorrect OTP
- [ ] Test Case #4: Expired OTP
- [ ] Test Case #5: Reused OTP
- [ ] Test Case #6: Mismatched passwords
- [ ] Test Case #7: Empty email field
- [ ] Test Case #8: Empty OTP field
`;

  const parentBodyPath = path.join(tempDir, 'parent_issue.md');
  fs.writeFileSync(parentBodyPath, parentBody, 'utf8');

  let parentIssueUrl = '';
  try {
    const parentCmd = `gh issue create --title "${parentTitle}" --body-file "${parentBodyPath}" --milestone "M4: Governance & Quality Gate" -l "qa" -l "auth" -l "security" --repo ${REPO}`;
    parentIssueUrl = execSync(parentCmd).toString().trim();
    console.log(`[Created Parent Issue] ${parentTitle} -> ${parentIssueUrl}`);
  } catch (err) {
    console.error('Error creating parent issue:', err.message);
  }

  // 2. Create 8 individual issues
  const createdSubIssues = [];
  for (const tc of testCases) {
    const title = `[Negative Test #${tc.num}] ${tc.scenario} - Password Reset & OTP Flow`;
    const body = `### Negative Test Scenario #${tc.num}: ${tc.scenario}

### Overview
| Attribute | Detail |
|---|---|
| **Test Scenario** | ${tc.scenario} |
| **Category** | Negative Test Case / Security & Input Validation |
| **Component** | Authentication / Password Reset & OTP Flow |
| **Parent Tracking Issue** | ${parentIssueUrl || 'Password Reset & OTP Flow'} |

---

### Expected Outcome
> ${tc.expected}

### Not Expected Outcome (Failure Mode)
> ❌ ${tc.notExpected}

---

### Detailed Behavior & Validation Requirements
${tc.details}

### Acceptance Criteria
- [ ] Validation occurs at both client-side and server-side.
- [ ] System handles failure gracefully without unhandled exceptions or state leakage.
- [ ] User receives clear and accessible error feedback.
- [ ] Negative test case automated in test suite.
`;

    const bodyPath = path.join(tempDir, `issue_${tc.num}.md`);
    fs.writeFileSync(bodyPath, body, 'utf8');

    try {
      const cmd = `gh issue create --title "${title}" --body-file "${bodyPath}" --milestone "M4: Governance & Quality Gate" -l "qa" -l "auth" -l "security" --repo ${REPO}`;
      const url = execSync(cmd).toString().trim();
      console.log(`[Created #${tc.num}] ${title} -> ${url}`);
      createdSubIssues.push({ num: tc.num, scenario: tc.scenario, url });
    } catch (err) {
      console.error(`Error creating test case #${tc.num}:`, err.message);
    }
  }

  // Clean up temporary files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n--- Summary of Created Issues ---');
  if (parentIssueUrl) console.log(`Parent Issue: ${parentIssueUrl}`);
  createdSubIssues.forEach(i => console.log(`- #${i.num} (${i.scenario}): ${i.url}`));
}

createAllIssues();
