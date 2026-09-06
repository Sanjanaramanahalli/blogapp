const assert = require('node:assert');
const http = require('node:http');
const app = require('../server/app');
const { seedDatabase } = require('../server/db/seed');

console.log('--- Running Complete Backend API Integration Suite ---');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {};
    let payload = null;

    if (body && Object.keys(body).length > 0) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    } else {
      headers['Content-Length'] = 0;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : {};
        } catch (e) {
          json = { raw: data };
        }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  // 1. Reset DB
  seedDatabase();

  // 2. Start server on ephemeral port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // TEST 1: Login as Admin
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@blog.com',
      password: 'Admin@123456'
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed with 200');
    assert.strictEqual(adminLogin.data.user.role, 'admin', 'User role must be admin');
    const adminToken = adminLogin.data.token;
    console.log('PASS: Admin login.');

    // TEST 2: Login as Reader
    const readerLogin = await request('POST', '/api/auth/login', {
      email: 'john@reader.com',
      password: 'Reader@123'
    });
    assert.strictEqual(readerLogin.status, 200, 'Reader login must succeed with 200');
    assert.strictEqual(readerLogin.data.user.role, 'reader', 'User role must be reader');
    const readerToken = readerLogin.data.token;
    console.log('PASS: Reader login.');

    // TEST 3: Reader Registration
    const newReaderEmail = `alice-${Date.now()}@reader.com`;
    const registerRes = await request('POST', '/api/auth/register', {
      name: 'Alice Wonder',
      email: newReaderEmail,
      password: 'Password@123'
    });
    assert.strictEqual(registerRes.status, 201, 'Registration should return 201');
    assert.strictEqual(registerRes.data.user.role, 'reader', 'New user should have reader role');
    const aliceToken = registerRes.data.token;
    console.log('PASS: Public Reader registration.');

    // TEST 4: Duplicate Registration Rejection (Negative test)
    const duplicateReg = await request('POST', '/api/auth/register', {
      name: 'Alice Clone',
      email: newReaderEmail,
      password: 'Password@123'
    });
    assert.strictEqual(duplicateReg.status, 409, 'Duplicate email must return 409 Conflict');
    console.log('PASS: Duplicate registration rejected.');

    // TEST 5: Role-Based Access Control (Reader attempting Admin action -> 403)
    const unauthorizedCreate = await request('POST', '/api/blogs', {
      title: 'Hacked Blog',
      body: '<p>Should fail</p>'
    }, readerToken);
    assert.strictEqual(unauthorizedCreate.status, 403, 'Reader creating blog must be rejected with 403');
    console.log('PASS: RBAC blocks reader from creating blog.');

    // TEST 6: Admin creates blog with categories and tags
    const createBlogRes = await request('POST', '/api/blogs', {
      title: 'Test Engineering Mastery 2026',
      body: '<h2>Quality First</h2><p>Zero regression architecture.</p>',
      status: 'published',
      categories: [1, 2],
      tags: ['testing', 'architecture']
    }, adminToken);
    assert.strictEqual(createBlogRes.status, 201, 'Admin creating blog should return 201');
    assert.strictEqual(createBlogRes.data.blog.title, 'Test Engineering Mastery 2026');
    const newBlogId = createBlogRes.data.blog.id;
    const newBlogSlug = createBlogRes.data.blog.slug;
    console.log('PASS: Admin blog creation with taxonomy.');

    // TEST 7: Search and Filter blogs
    const searchRes = await request('GET', `/api/blogs?search=Mastery`);
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.data.blogs.length, 1);
    assert.strictEqual(searchRes.data.blogs[0].id, newBlogId);
    console.log('PASS: Blog keyword search.');

    // TEST 8: Binary Like / Unlike Toggle
    const like1 = await request('POST', `/api/blogs/${newBlogId}/likes/toggle`, {}, readerToken);
    assert.strictEqual(like1.status, 200);
    assert.strictEqual(like1.data.liked, true, 'First click should like');
    assert.strictEqual(like1.data.likeCount, 1, 'Like count should be 1');

    const like2 = await request('POST', `/api/blogs/${newBlogId}/likes/toggle`, {}, readerToken);
    assert.strictEqual(like2.status, 200);
    assert.strictEqual(like2.data.liked, false, 'Second click should unlike');
    assert.strictEqual(like2.data.likeCount, 0, 'Like count should be 0');
    console.log('PASS: Like/unlike binary toggle.');

    // TEST 9: Multi-Level Nested Discussions (Comment -> Reply -> Nested Reply)
    // Level 1 Comment
    const commentRes = await request('POST', `/api/blogs/${newBlogId}/comments`, {
      content: 'Top-level discussion point by John.'
    }, readerToken);
    assert.strictEqual(commentRes.status, 201);
    const parentCommentId = commentRes.data.comment.id;

    // Level 2 Reply by Alice
    const replyRes = await request('POST', `/api/blogs/${newBlogId}/comments`, {
      content: 'Nested reply by Alice.',
      parent_id: parentCommentId
    }, aliceToken);
    assert.strictEqual(replyRes.status, 201);
    const childReplyId = replyRes.data.comment.id;

    // Level 3 Grandchild Reply by Admin
    const grandReplyRes = await request('POST', `/api/blogs/${newBlogId}/comments`, {
      content: 'Deeply nested response by Admin.',
      parent_id: childReplyId
    }, adminToken);
    assert.strictEqual(grandReplyRes.status, 201);

    // Fetch and verify recursive tree structure
    const treeRes = await request('GET', `/api/blogs/${newBlogId}/comments`);
    assert.strictEqual(treeRes.status, 200);
    assert.strictEqual(treeRes.data.totalCount, 3, 'Total comment count should be 3');
    assert.strictEqual(treeRes.data.comments.length, 1, 'Root comments count should be 1');
    assert.strictEqual(treeRes.data.comments[0].replies.length, 1, 'Child reply count should be 1');
    assert.strictEqual(treeRes.data.comments[0].replies[0].replies.length, 1, 'Grandchild reply count should be 1');
    console.log('PASS: Multi-level nested discussions tree.');

    // TEST 10: Author Comment Editing
    const editComment = await request('PUT', `/api/comments/${parentCommentId}`, {
      content: 'Edited top-level discussion point by John.'
    }, readerToken);
    assert.strictEqual(editComment.status, 200);
    assert.strictEqual(editComment.data.comment.content, 'Edited top-level discussion point by John.');

    // Non-author attempt to edit should fail (Negative test)
    const unauthorizedEdit = await request('PUT', `/api/comments/${parentCommentId}`, {
      content: 'Malicious edit by Alice.'
    }, aliceToken);
    assert.strictEqual(unauthorizedEdit.status, 403, 'Non-author must not be able to edit comment');
    console.log('PASS: Comment author editing and security enforcement.');

    // TEST 11: Cascade Deletion on Comment (Deleting parent removes all nested replies)
    const deleteCommentRes = await request('DELETE', `/api/comments/${parentCommentId}`, {}, readerToken);
    assert.strictEqual(deleteCommentRes.status, 200);

    const treeAfterDelete = await request('GET', `/api/blogs/${newBlogId}/comments`);
    assert.strictEqual(treeAfterDelete.data.totalCount, 0, 'Parent delete must cascade-delete all child replies');
    assert.strictEqual(treeAfterDelete.data.comments.length, 0);
    console.log('PASS: Recursive comment cascade deletion.');

    // TEST 12: Admin User Management
    const usersList = await request('GET', '/api/admin/users', {}, adminToken);
    assert.strictEqual(usersList.status, 200);
    assert(usersList.data.users.length >= 3, 'Must return seeded users and registered users');

    const adminOverview = await request('GET', '/api/admin/overview', {}, adminToken);
    assert.strictEqual(adminOverview.status, 200);
    assert(adminOverview.data.stats.totalBlogs >= 3);
    console.log('PASS: Admin user management and overview analytics.');

    console.log('===========================================================');
    console.log('🎯 ALL 12 BACKEND INTEGRATION TESTS PASSED WITH 100% SUCCESS');
    console.log('===========================================================');
  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error('Backend Integration Test Failure:', err);
  if (server) server.close();
  process.exit(1);
});
