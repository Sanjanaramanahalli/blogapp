const assert = require('node:assert');
const { db } = require('./database');
const { seedDatabase } = require('./seed');

console.log('--- Running ISSUE-01 Cascade Integrity & Constraint Suite ---');

// 1. Reset database
seedDatabase();

// 2. Test Cascade Deletion: Blog deletion cascades to comments, blog_categories, blog_tags, and likes
const blog1 = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('architecting-modern-web-applications');
assert(blog1, 'Blog 1 must exist');

const commentsBefore = db.prepare('SELECT COUNT(*) as count FROM comments WHERE blog_id = ?').get(blog1.id).count;
const likesBefore = db.prepare('SELECT COUNT(*) as count FROM likes WHERE blog_id = ?').get(blog1.id).count;
assert(commentsBefore > 0, 'Must have comments before deletion');
assert(likesBefore > 0, 'Must have likes before deletion');

db.prepare('DELETE FROM blogs WHERE id = ?').run(blog1.id);

const blog1After = db.prepare('SELECT id FROM blogs WHERE id = ?').get(blog1.id);
assert.strictEqual(blog1After, undefined, 'Blog must be deleted');

const commentsAfter = db.prepare('SELECT COUNT(*) as count FROM comments WHERE blog_id = ?').get(blog1.id).count;
const likesAfter = db.prepare('SELECT COUNT(*) as count FROM likes WHERE blog_id = ?').get(blog1.id).count;
assert.strictEqual(commentsAfter, 0, 'All comments must be cascade deleted when blog is deleted');
assert.strictEqual(likesAfter, 0, 'All likes must be cascade deleted when blog is deleted');

console.log('PASS: Blog deletion cascade verified.');

// 3. Test Comment Tree Cascade Deletion: Parent comment deletion cascades to all child and grandchild replies
seedDatabase();

const blog = db.prepare('SELECT id FROM blogs WHERE slug = ?').get('architecting-modern-web-applications');
const rootComment = db.prepare('SELECT id FROM comments WHERE parent_id IS NULL AND blog_id = ?').get(blog.id);
assert(rootComment, 'Root comment must exist');

const childRepliesBefore = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id = ?').get(rootComment.id).count;
assert(childRepliesBefore > 0, 'Child reply must exist before delete');

// Delete root comment
db.prepare('DELETE FROM comments WHERE id = ?').run(rootComment.id);

const rootAfter = db.prepare('SELECT id FROM comments WHERE id = ?').get(rootComment.id);
assert.strictEqual(rootAfter, undefined, 'Root comment must be deleted');

const childRepliesAfter = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id = ?').get(rootComment.id).count;
assert.strictEqual(childRepliesAfter, 0, 'Child replies must be cascade deleted when parent comment is deleted');

console.log('PASS: Comment recursive cascade deletion verified.');

// 4. Test Duplicate Like Unique Constraint
const johnUser = db.prepare('SELECT id FROM users WHERE email = ?').get('john@reader.com');
let duplicateLikeRejected = false;
try {
  db.prepare('INSERT INTO likes (blog_id, user_id) VALUES (?, ?)').run(blog.id, johnUser.id);
  // Try inserting duplicate
  db.prepare('INSERT INTO likes (blog_id, user_id) VALUES (?, ?)').run(blog.id, johnUser.id);
} catch (err) {
  duplicateLikeRejected = err.message.includes('UNIQUE constraint failed');
}
assert.strictEqual(duplicateLikeRejected, true, 'Duplicate like must be rejected by UNIQUE constraint');

console.log('PASS: Duplicate like rejection verified.');

// Reset database back to clean seeded state
seedDatabase();
console.log('--- ALL ISSUE-01 DATABASE VERIFICATIONS PASSED ---');
