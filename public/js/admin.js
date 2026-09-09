/**
 * Admin Dashboard Controller
 * Powers metrics, blog creation/editing with image upload, user management, comment moderation, and profile settings.
 */

let allCategories = [];
let pendingDeleteBlogId = null;

// Ensure Admin Authorization Guard
async function checkAdminAccess() {
  await API.checkAuth();
  if (!API.isAdmin()) {
    showToast('Administrator access required.', 'error');
    setTimeout(() => {
      window.location.href = '/login';
    }, 800);
    return false;
  }
  return true;
}

// Tab Switching Logic
function initTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      const activeContent = document.getElementById(`tab-${target}`);
      if (activeContent) activeContent.style.display = 'block';

      if (target === 'overview') loadOverview();
      if (target === 'blogs') loadAdminBlogs();
      if (target === 'users') loadAdminUsers();
      if (target === 'moderation') loadAdminModeration();
      if (target === 'settings') loadAdminProfile();
    });
  });
}

// 1. Load Overview Stats & Feeds
async function loadOverview() {
  try {
    const data = await API.request('/api/admin/overview');
    const stats = data.stats;

    document.getElementById('stat-total-blogs').textContent = stats.totalBlogs;
    document.getElementById('stat-published-blogs').textContent = stats.publishedBlogs;
    document.getElementById('stat-draft-blogs').textContent = stats.draftBlogs;
    document.getElementById('stat-total-readers').textContent = stats.totalUsers;
    document.getElementById('stat-total-comments').textContent = stats.totalComments;
    document.getElementById('stat-total-likes').textContent = stats.totalLikes;

    // Recent Blogs
    const blogsEl = document.getElementById('overview-recent-blogs');
    if (blogsEl) {
      if (data.recentBlogs.length === 0) {
        blogsEl.innerHTML = '<p style="color: var(--text-muted);">No articles published yet.</p>';
      } else {
        blogsEl.innerHTML = data.recentBlogs.map(b => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
            <div>
              <a href="/blog/${escapeHtml(b.slug)}" style="font-weight: 600; color: var(--text-primary);">${escapeHtml(b.title)}</a>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${formatRelativeTime(b.created_at)}</div>
            </div>
            <span class="role-badge ${b.status === 'published' ? 'role-reader' : 'role-admin'}">${b.status}</span>
          </div>
        `).join('');
      }
    }

    // Recent Comments
    const commentsEl = document.getElementById('overview-recent-comments');
    if (commentsEl) {
      if (data.recentComments.length === 0) {
        commentsEl.innerHTML = '<p style="color: var(--text-muted);">No comments submitted yet.</p>';
      } else {
        commentsEl.innerHTML = data.recentComments.map(c => `
          <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
              <strong style="color: var(--text-primary);">${escapeHtml(c.user_name)}</strong> on 
              <a href="/blog/${escapeHtml(c.blog_slug)}">${escapeHtml(c.blog_title)}</a>
            </div>
            <div style="font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(c.content.substring(0, 100))}...</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

// 2. Load Articles Table
async function loadAdminBlogs() {
  const tbody = document.getElementById('blogs-table-body');
  if (!tbody) return;

  try {
    const data = await API.request('/api/blogs?limit=50&sort=newest');
    const blogs = data.blogs;

    if (blogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No articles found. Click "+ New Article" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = blogs.map(b => {
      const categoriesStr = (b.categories || []).map(c => `<span class="category-badge" style="font-size: 0.7rem;">${escapeHtml(c.name)}</span>`).join(' ') || '—';
      const isPublished = b.status === 'published';

      return `
        <tr id="admin-blog-row-${b.id}">
          <td>
            <a href="/blog/${escapeHtml(b.slug)}" style="font-weight: 600; color: var(--text-primary);">
              ${escapeHtml(b.title)}
            </a>
          </td>
          <td>
            <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(b.author_name || 'Anonymous User')}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(b.author_email || '')}</div>
          </td>
          <td>
            <span class="role-badge ${isPublished ? 'role-reader' : 'role-admin'}">
              ${b.status}
            </span>
          </td>
          <td>${categoriesStr}</td>
          <td>
            <div style="display: inline-flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm btn-action-like ${b.user_liked ? 'liked' : ''}" id="admin-like-btn-${b.id}" onclick="handleAdminLikeBlog(${b.id})" title="${b.user_liked ? 'Unlike article' : 'Like article'}">
                ❤️ <span id="admin-like-count-${b.id}">${b.like_count}</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-action-comment" id="admin-comment-btn-${b.id}" onclick="openAdminCommentModal(${b.id}, '${escapeHtml(b.title).replace(/'/g, "\\'")}')" title="Discussions">
                💬 <span id="admin-comment-count-${b.id}">${b.comment_count}</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-action-share" id="admin-share-btn-${b.id}" onclick="openAdminShareModal(${b.id}, '${escapeHtml(b.title).replace(/'/g, "\\'")}', '${escapeHtml(b.slug)}')" title="Share Article">
                🔗 Share
              </button>
            </div>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${formatRelativeTime(b.created_at)}</td>
          <td style="text-align: right;">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn btn-outline btn-sm" onclick="toggleBlogStatus(${b.id})" title="Toggle draft/published">
                ${isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="openEditBlogModal(${b.id})">
                Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="openDeleteBlogModal(${b.id}, '${escapeHtml(b.title).replace(/'/g, "\\'")}', '${escapeHtml(b.author_name || 'User').replace(/'/g, "\\'")}')">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading admin blogs:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="color: var(--danger-light); text-align: center;">Failed to load articles.</td></tr>`;
  }
}

// Toggle Article Status (Draft / Published)
async function toggleBlogStatus(blogId) {
  try {
    const res = await API.request(`/api/blogs/${blogId}/status`, { method: 'PATCH' });
    showToast(res.message);
    await loadAdminBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to toggle status.', 'error');
  }
}

// 3. Load Users Table
async function loadAdminUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  try {
    const data = await API.request('/api/admin/users');
    const users = data.users;
    const currentUser = API.getUser();

    tbody.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.id === u.id;
      return `
        <tr>
          <td><strong>${escapeHtml(u.name)}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="role-badge role-${u.role}">${u.role}</span></td>
          <td>💬 ${u.comment_count}</td>
          <td>❤️ ${u.like_count}</td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${formatRelativeTime(u.created_at)}</td>
          <td style="text-align: right;">
            ${isSelf ? '<span style="font-size: 0.8rem; color: var(--text-muted);">Current Admin</span>' : `
              <button class="btn btn-danger btn-sm" onclick="deleteUserAccount(${u.id}, '${escapeHtml(u.name)}')">
                Delete User
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="color: var(--danger-light); text-align: center;">Failed to load user accounts.</td></tr>';
  }
}

// Delete User Account
async function deleteUserAccount(userId, userName) {
  if (!confirm(`Are you sure you want to delete reader "${userName}"? All comments and likes submitted by this user will be permanently removed.`)) {
    return;
  }

  try {
    const res = await API.request(`/api/admin/users/${userId}`, { method: 'DELETE' });
    showToast(res.message);
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message || 'Failed to delete user account.', 'error');
  }
}

// 4. Load Comment Moderation Table
async function loadAdminModeration() {
  const tbody = document.getElementById('moderation-table-body');
  if (!tbody) return;

  try {
    const data = await API.request('/api/admin/comments');
    const comments = data.comments;

    if (comments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No comments found on any article.</td></tr>';
      return;
    }

    tbody.innerHTML = comments.map(c => `
      <tr>
        <td>
          <strong>${escapeHtml(c.user_name)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(c.user_email)}</div>
        </td>
        <td style="max-width: 320px; word-break: break-word;">
          ${escapeHtml(c.content)}
          ${c.parent_id ? '<span style="font-size: 0.75rem; color: var(--accent-light); display: block;">↳ Nested Reply</span>' : ''}
        </td>
        <td>
          <a href="/blog/${escapeHtml(c.blog_slug)}" target="_blank" style="font-weight: 500;">
            ${escapeHtml(c.blog_title)}
          </a>
        </td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${formatRelativeTime(c.created_at)}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-sm" onclick="moderateDeleteComment(${c.id})">
            Remove
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading comments for moderation:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="color: var(--danger-light); text-align: center;">Failed to load comments for moderation.</td></tr>';
  }
}

// Delete comment via moderation
async function moderateDeleteComment(commentId) {
  if (!confirm('Moderate and delete this comment? All child replies nested beneath it will also be permanently removed.')) {
    return;
  }

  try {
    const res = await API.request(`/api/comments/${commentId}`, { method: 'DELETE' });
    showToast(res.message);
    await loadAdminModeration();
  } catch (err) {
    showToast(err.message || 'Failed to moderate comment.', 'error');
  }
}

// 5. Admin Profile Settings
function loadAdminProfile() {
  const user = API.getUser();
  if (user) {
    document.getElementById('admin-name').value = user.name || '';
    document.getElementById('admin-email').value = user.email || '';
  }
}

// Rich Text Editor Toolbar Helpers
function insertTag(startTag, endTag) {
  const textarea = document.getElementById('blog-body-input');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const replacement = startTag + selected + endTag;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + startTag.length, end + startTag.length);
}

function formatDoc(command) {
  if (command === 'bold') insertTag('<strong>', '</strong>');
  if (command === 'italic') insertTag('<em>', '</em>');
}

function insertList(type) {
  const textarea = document.getElementById('blog-body-input');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end).trim();
  const tag = type === 'ol' ? 'ol' : 'ul';
  let itemsHtml = '';
  if (selected) {
    itemsHtml = selected.split('\n').filter(l => l.trim().length > 0).map(l => `  <li>${l.trim()}</li>`).join('\n');
  } else {
    itemsHtml = '  <li>List item 1</li>\n  <li>List item 2</li>';
  }
  const replacement = `\n<${tag}>\n${itemsHtml}\n</${tag}>\n`;
  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();
}

// Load Categories for Modal Checkboxes
async function loadCategoryCheckboxes(selectedIds = []) {
  const container = document.getElementById('blog-category-checks');
  if (!container) return;

  try {
    if (allCategories.length === 0) {
      const data = await API.request('/api/blogs/taxonomy');
      allCategories = data.categories || [];
    }

    container.innerHTML = allCategories.map(cat => {
      const checked = selectedIds.includes(cat.id) ? 'checked' : '';
      return `
        <label class="category-check-item">
          <input type="checkbox" name="categories" value="${cat.id}" ${checked}>
          <span>${escapeHtml(cat.name)}</span>
        </label>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load category checkboxes:', err);
  }
}

// Cover Image File Upload Engine
function initCoverImageUpload() {
  const uploadBox = document.getElementById('cover-upload-box');
  const fileInput = document.getElementById('cover-file-input');
  const previewImg = document.getElementById('cover-preview-img');
  const promptText = document.getElementById('upload-prompt-text');
  const coverUrlInput = document.getElementById('blog-cover-url');

  if (!uploadBox || !fileInput) return;

  uploadBox.onclick = () => fileInput.click();

  uploadBox.ondragover = (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = 'var(--accent)';
  };

  uploadBox.ondragleave = () => {
    uploadBox.style.borderColor = 'var(--border-strong)';
  };

  uploadBox.ondrop = (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = 'var(--border-strong)';
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
      handleImageUpload(fileInput.files[0]);
    }
  };

  async function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (PNG, JPG, WEBP).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.', 'error');
      return;
    }

    promptText.textContent = '⏳ Uploading image to server...';

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await API.request('/api/uploads/cover', {
        method: 'POST',
        body: formData
      });

      coverUrlInput.value = res.url;
      previewImg.src = res.url;
      previewImg.style.display = 'block';
      promptText.textContent = '✓ Image uploaded! Click to replace.';
      showToast('Cover image uploaded.');
    } catch (err) {
      promptText.textContent = '❌ Upload failed. Click to try again.';
      showToast(err.message || 'Image upload failed.', 'error');
    }
  }
}

// Blog Modal Controls
function openCreateBlogModal() {
  document.getElementById('blog-modal-title').textContent = 'Create New Article';
  document.getElementById('blog-edit-id').value = '';
  document.getElementById('blog-form').reset();
  document.getElementById('blog-cover-url').value = '';
  document.getElementById('cover-preview-img').style.display = 'none';
  document.getElementById('upload-prompt-text').textContent = '📁 Click or drop an image file here to upload (PNG, JPG, WEBP, max 5MB)';
  document.getElementById('status-draft').checked = true;

  loadCategoryCheckboxes([]);
  document.getElementById('blog-modal')?.classList.add('active');
}

async function openEditBlogModal(blogId) {
  try {
    const data = await API.request(`/api/blogs/${blogId}`);
    const blog = data.blog;

    document.getElementById('blog-modal-title').textContent = 'Edit Article';
    document.getElementById('blog-edit-id').value = blog.id;
    document.getElementById('blog-title-input').value = blog.title;
    document.getElementById('blog-body-input').value = blog.body;
    document.getElementById('blog-cover-url').value = blog.cover_image || '';
    document.getElementById('blog-tags-input').value = (blog.tags || []).map(t => t.name).join(', ');

    const preview = document.getElementById('cover-preview-img');
    const promptText = document.getElementById('upload-prompt-text');
    if (blog.cover_image) {
      preview.src = blog.cover_image;
      preview.style.display = 'block';
      promptText.textContent = '✓ Current cover image. Click to replace.';
    } else {
      preview.style.display = 'none';
      promptText.textContent = '📁 Click or drop an image file here to upload';
    }

    if (blog.status === 'published') {
      document.getElementById('status-published').checked = true;
    } else {
      document.getElementById('status-draft').checked = true;
    }

    const selectedCategoryIds = (blog.categories || []).map(c => c.id);
    await loadCategoryCheckboxes(selectedCategoryIds);

    document.getElementById('blog-modal')?.classList.add('active');
  } catch (err) {
    showToast(err.message || 'Failed to load article data for editing.', 'error');
  }
}

function closeBlogModal() {
  document.getElementById('blog-modal')?.classList.remove('active');
}

// Delete Blog Confirmation Modal
function openDeleteBlogModal(blogId, blogTitle, authorName = '') {
  pendingDeleteBlogId = blogId;
  const authorSuffix = authorName ? ` (Author: ${authorName})` : '';
  const titleEl = document.getElementById('delete-blog-title-text');
  if (titleEl) {
    titleEl.textContent = `Are you sure you want to delete "${blogTitle}"${authorSuffix}?`;
  }
  document.getElementById('delete-blog-modal')?.classList.add('active');
}

function closeDeleteBlogModal() {
  pendingDeleteBlogId = null;
  document.getElementById('delete-blog-modal')?.classList.remove('active');
}

// Blog Form Submission (Create or Update)
async function handleBlogFormSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('blog-edit-id').value;
  const title = document.getElementById('blog-title-input').value.trim();
  const body = document.getElementById('blog-body-input').value.trim();
  const cover_image = document.getElementById('blog-cover-url').value.trim();
  const status = document.querySelector('input[name="blog-status"]:checked').value;

  // Selected Categories
  const categoryBoxes = document.querySelectorAll('input[name="categories"]:checked');
  const categories = Array.from(categoryBoxes).map(cb => parseInt(cb.value, 10));

  // Tags
  const tagsInput = document.getElementById('blog-tags-input').value;
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

  if (!title) {
    showToast('Title is required.', 'error');
    return;
  }
  if (!body) {
    showToast('Body content is required.', 'error');
    return;
  }

  const payload = {
    title,
    body,
    cover_image,
    status,
    categories,
    tags
  };

  const saveBtn = document.getElementById('btn-save-blog');
  try {
    saveBtn.disabled = true;

    if (editId) {
      await API.request(`/api/blogs/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Article updated successfully!');
    } else {
      await API.request('/api/blogs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Article created successfully!');
    }

    closeBlogModal();
    await loadAdminBlogs();
    await loadOverview();
  } catch (err) {
    showToast(err.message || 'Failed to save article.', 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await checkAdminAccess();
  if (!hasAccess) return;

  initTabs();
  initCoverImageUpload();
  loadOverview();

  document.getElementById('btn-create-blog-top')?.addEventListener('click', openCreateBlogModal);
  document.getElementById('btn-create-blog')?.addEventListener('click', openCreateBlogModal);
  document.getElementById('blog-form')?.addEventListener('submit', handleBlogFormSubmit);

  // Confirm Blog Delete
  document.getElementById('btn-confirm-delete-blog')?.addEventListener('click', async () => {
    if (!pendingDeleteBlogId) return;

    try {
      const res = await API.request(`/api/blogs/${pendingDeleteBlogId}`, { method: 'DELETE' });
      showToast(res.message);
      closeDeleteBlogModal();
      await loadAdminBlogs();
      await loadOverview();
    } catch (err) {
      showToast(err.message || 'Failed to delete article.', 'error');
    }
  });

  // Admin Profile Form
  document.getElementById('admin-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const currentPassword = document.getElementById('admin-current-password').value;
    const newPassword = document.getElementById('admin-new-password').value;

    try {
      const payload = { name, email };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await API.request('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      API.setUser(res.user);
      updateNavbarAuth();
      showToast('Profile updated successfully!');
      document.getElementById('admin-current-password').value = '';
      document.getElementById('admin-new-password').value = '';
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    }
  });

  // Admin password visibility toggles
  function setupAdminPwToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    const SVG_EYE_OPEN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const SVG_EYE_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    btn.innerHTML = SVG_EYE_OPEN;
    btn.addEventListener('click', () => {
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
      btn.innerHTML = isPassword ? SVG_EYE_OFF : SVG_EYE_OPEN;
      btn.style.color = isPassword ? 'var(--accent-light, #38bdf8)' : 'var(--text-muted)';
    });
  }

  setupAdminPwToggle('btn-toggle-admin-curr', 'admin-current-password');
  setupAdminPwToggle('btn-toggle-admin-new', 'admin-new-password');

  // Admin Modal Comment Form
  document.getElementById('admin-modal-comment-form')?.addEventListener('submit', handleAdminModalCommentSubmit);
});

// ==========================================
// Admin Engagement Actions: Like, Comment, Share
// ==========================================

// 1. Admin Like / Unlike handler
async function handleAdminLikeBlog(blogId) {
  try {
    const res = await API.request(`/api/blogs/${blogId}/like`, { method: 'POST' });
    const btn = document.getElementById(`admin-like-btn-${blogId}`);
    const countEl = document.getElementById(`admin-like-count-${blogId}`);

    if (countEl) countEl.textContent = res.likeCount;
    if (btn) {
      if (res.liked) {
        btn.classList.add('liked');
        btn.title = 'Unlike article';
      } else {
        btn.classList.remove('liked');
        btn.title = 'Like article';
      }
    }

    showToast(res.liked ? 'Blog liked ❤️' : 'Blog unliked');
    const statLikes = document.getElementById('stat-total-likes');
    if (statLikes && statLikes.textContent !== '-') {
      const current = parseInt(statLikes.textContent, 10) || 0;
      statLikes.textContent = Math.max(0, current + (res.liked ? 1 : -1));
    }
  } catch (err) {
    showToast(err.message || 'Failed to update like status.', 'error');
  }
}

// 2. Admin Comment Modal handlers
let currentCommentBlogId = null;

async function openAdminCommentModal(blogId, blogTitle) {
  currentCommentBlogId = blogId;
  const modal = document.getElementById('admin-comment-modal');
  const titleEl = document.getElementById('admin-comment-modal-title');
  const blogIdInput = document.getElementById('admin-modal-blog-id');
  const commentInput = document.getElementById('admin-modal-comment-input');

  if (titleEl) titleEl.textContent = `Discussions: "${blogTitle}"`;
  if (blogIdInput) blogIdInput.value = blogId;
  if (commentInput) commentInput.value = '';

  if (modal) modal.classList.add('active');
  await loadAdminCommentsForBlog(blogId);
}

function closeAdminCommentModal() {
  const modal = document.getElementById('admin-comment-modal');
  if (modal) modal.classList.remove('active');
  currentCommentBlogId = null;
}

async function loadAdminCommentsForBlog(blogId) {
  const listEl = document.getElementById('admin-comment-modal-list');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-muted);">Loading comments...</div>';

  try {
    const data = await API.request(`/api/blogs/${blogId}/comments`);
    const comments = data.comments || [];

    function flattenTree(items, depth = 0) {
      let result = [];
      for (const item of items) {
        result.push({ ...item, depth });
        if (item.replies && item.replies.length > 0) {
          result = result.concat(flattenTree(item.replies, depth + 1));
        }
      }
      return result;
    }

    const flat = flattenTree(comments);

    if (flat.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md);">
          No comments yet on this article. Be the first to start the discussion!
        </div>
      `;
      return;
    }

    listEl.innerHTML = flat.map(c => `
      <div class="admin-comment-card" style="margin-left: ${c.depth * 1.5}rem;">
        <div class="admin-comment-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong>${escapeHtml(c.user_name)}</strong>
            <span class="role-badge role-${c.user_role}" style="font-size: 0.65rem;">${c.user_role}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${formatRelativeTime(c.created_at)}</span>
          </div>
          <button type="button" class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="deleteAdminComment(${c.id}, ${blogId})">
            Delete 🗑️
          </button>
        </div>
        <div class="admin-comment-card-body">${escapeHtml(c.content)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading comments in modal:', err);
    listEl.innerHTML = `<div style="color: var(--danger-light); text-align: center;">Failed to load discussions.</div>`;
  }
}

async function deleteAdminComment(commentId, blogId) {
  if (!confirm('Are you sure you want to delete this comment? Any child replies will also be removed.')) {
    return;
  }

  try {
    const res = await API.request(`/api/comments/${commentId}`, { method: 'DELETE' });
    showToast(res.message || 'Comment deleted.');
    await loadAdminCommentsForBlog(blogId);
    await loadAdminBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to delete comment.', 'error');
  }
}

async function handleAdminModalCommentSubmit(e) {
  e.preventDefault();
  const blogId = document.getElementById('admin-modal-blog-id').value || currentCommentBlogId;
  const input = document.getElementById('admin-modal-comment-input');
  const submitBtn = document.getElementById('btn-submit-admin-comment');
  const content = input.value.trim();

  if (!content) {
    showToast('Please enter a comment.', 'error');
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    await API.request(`/api/blogs/${blogId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    showToast('Comment posted successfully! 💬');
    input.value = '';
    await loadAdminCommentsForBlog(blogId);
    await loadAdminBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to post comment.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// 3. Admin Share Modal handlers
let currentShareUrl = '';
let currentShareTitle = '';

function openAdminShareModal(blogId, blogTitle, blogSlug) {
  currentShareTitle = blogTitle;
  currentShareUrl = `${window.location.origin}/blog/${blogSlug}`;

  const modal = document.getElementById('admin-share-modal');
  const titleEl = document.getElementById('admin-share-modal-title');
  const inputEl = document.getElementById('admin-share-url-input');
  const nativeBtn = document.getElementById('btn-native-share');

  if (titleEl) titleEl.textContent = `Share "${blogTitle}"`;
  if (inputEl) inputEl.value = currentShareUrl;
  if (nativeBtn && navigator.share) {
    nativeBtn.style.display = 'inline-flex';
  }

  if (modal) modal.classList.add('active');
}

function closeAdminShareModal() {
  const modal = document.getElementById('admin-share-modal');
  if (modal) modal.classList.remove('active');
}

async function copyAdminShareUrl() {
  const btn = document.getElementById('btn-copy-share-url');
  const input = document.getElementById('admin-share-url-input');

  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      copied = true;
    } catch (_) {}
  }
  if (!copied && input) {
    input.select();
    try {
      document.execCommand('copy');
      copied = true;
    } catch (_) {}
  }

  showToast('Article link copied to clipboard! 📋');
  if (btn) {
    const oldText = btn.innerHTML;
    btn.innerHTML = 'Copied! ✅';
    setTimeout(() => { btn.innerHTML = oldText; }, 2000);
  }
}

function shareToTwitter() {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentShareTitle)}&url=${encodeURIComponent(currentShareUrl)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function shareToLinkedIn() {
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentShareUrl)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function shareViaEmail() {
  const subject = encodeURIComponent(currentShareTitle);
  const body = encodeURIComponent(`Read this article on ApexBlog: ${currentShareUrl}`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function triggerNativeShare() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: currentShareTitle,
        url: currentShareUrl
      });
    } catch (err) {
      // User cancelled
    }
  }
}

