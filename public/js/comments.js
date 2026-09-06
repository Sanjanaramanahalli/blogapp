/**
 * Multi-Level Nested Discussions Engine
 * Renders recursive comments, manages inline reply composers, author editing, and cascade deletions.
 */

let activeBlogId = null;
let pendingDeleteCommentId = null;

// Initialize comments for the current blog
async function initComments(blogId) {
  activeBlogId = blogId;
  renderComposerArea();
  await loadComments();
}

// Render Top-Level Composer or Guest Login Prompt
function renderComposerArea() {
  const container = document.getElementById('comment-composer-area');
  if (!container) return;

  if (API.isLoggedIn()) {
    const user = API.getUser();
    container.innerHTML = `
      <form id="top-comment-form" class="comment-composer">
        <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-secondary);">
          Commenting as <strong style="color: var(--text-primary);">${escapeHtml(user.name)}</strong> (${user.role})
        </div>
        <textarea id="top-comment-input" class="comment-textarea" placeholder="Share your insights, constructive feedback, or architectural questions..." required></textarea>
        <div class="composer-footer">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Markdown formatting and code tags supported</span>
          <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-top-comment">Post Comment</button>
        </div>
      </form>
    `;

    document.getElementById('top-comment-form')?.addEventListener('submit', handleTopCommentSubmit);
  } else {
    container.innerHTML = `
      <div class="guest-prompt-box">
        <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">Join the Community Discussion</h3>
        <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.25rem;">
          Sign in or create a free reader account to leave comments, reply to fellow engineers, and like articles.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <a href="/login" class="btn btn-outline btn-sm">Sign In</a>
          <a href="/register" class="btn btn-primary btn-sm">Create Account</a>
        </div>
      </div>
    `;
  }
}

// Fetch and render comments tree
async function loadComments() {
  const treeContainer = document.getElementById('comment-tree');
  const countBadge = document.getElementById('total-comments-count');
  const socialCount = document.getElementById('social-comment-count');
  if (!treeContainer) return;

  try {
    const data = await API.request(`/api/blogs/${activeBlogId}/comments`);
    const comments = data.comments;
    const totalCount = data.totalCount;

    if (countBadge) countBadge.textContent = totalCount;
    if (socialCount) socialCount.textContent = `${totalCount} comment${totalCount === 1 ? '' : 's'}`;

    if (comments.length === 0) {
      treeContainer.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div style="font-size: 1.75rem; margin-bottom: 0.5rem;">💬</div>
          <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">No Comments Yet</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Be the first to start the conversation on this article.</p>
        </div>
      `;
      return;
    }

    treeContainer.innerHTML = comments.map(c => renderCommentNode(c, 0)).join('');
    attachCommentEventListeners();
  } catch (err) {
    console.error('Error loading comments:', err);
    treeContainer.innerHTML = `
      <div style="color: var(--danger-light); text-align: center; padding: 2rem;">
        Failed to load discussion comments.
      </div>
    `;
  }
}

// Recursive Comment Node Generator
function renderCommentNode(comment, depth = 0) {
  const currentUser = API.getUser();
  const isAuthor = currentUser && currentUser.id === comment.user_id;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  const initials = comment.user_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const repliesHtml = comment.replies && comment.replies.length > 0
    ? `<div class="replies-container">
         ${comment.replies.map(reply => renderCommentNode(reply, depth + 1)).join('')}
       </div>`
    : '';

  return `
    <div class="comment-node" id="comment-node-${comment.id}" data-comment-id="${comment.id}">
      <div class="comment-card" id="comment-card-${comment.id}">
        <div class="comment-header">
          <div class="comment-user-info">
            <div class="comment-avatar">${initials}</div>
            <div>
              <span class="comment-username">${escapeHtml(comment.user_name)}</span>
              <span class="role-badge role-${comment.user_role}" style="font-size: 0.65rem; margin-left: 0.25rem;">
                ${comment.user_role}
              </span>
            </div>
          </div>
          <div class="comment-time">
            ${formatRelativeTime(comment.created_at)}
            ${isEdited ? '<span style="font-style: italic; color: var(--text-muted); margin-left: 0.25rem;">(edited)</span>' : ''}
          </div>
        </div>

        <div class="comment-body" id="comment-content-${comment.id}">
          ${escapeHtml(comment.content)}
        </div>

        <div class="comment-actions">
          ${API.isLoggedIn() ? `
            <button class="comment-action-btn btn-reply" data-id="${comment.id}" title="Reply to this comment">
              ↩ Reply
            </button>
          ` : `
            <button class="comment-action-btn" onclick="openGuestModal()" title="Sign in to reply">
              ↩ Reply
            </button>
          `}

          ${isAuthor ? `
            <button class="comment-action-btn btn-edit" data-id="${comment.id}" title="Edit your comment">
              ✏️ Edit
            </button>
          ` : ''}

          ${(isAuthor || isAdmin) ? `
            <button class="comment-action-btn delete btn-delete" data-id="${comment.id}" title="Delete comment and all replies">
              🗑️ Delete
            </button>
          ` : ''}
        </div>

        <!-- Inline Reply Form Container -->
        <div class="inline-form-container" id="reply-form-container-${comment.id}" style="display: none;"></div>

        <!-- Inline Edit Form Container -->
        <div class="inline-form-container" id="edit-form-container-${comment.id}" style="display: none;"></div>
      </div>

      ${repliesHtml}
    </div>
  `;
}

// Attach Event Listeners for Reply, Edit, and Delete
function attachCommentEventListeners() {
  // 1. Reply Button
  document.querySelectorAll('.btn-reply').forEach(btn => {
    btn.onclick = () => {
      const commentId = btn.getAttribute('data-id');
      toggleReplyForm(commentId);
    };
  });

  // 2. Edit Button
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => {
      const commentId = btn.getAttribute('data-id');
      toggleEditForm(commentId);
    };
  });

  // 3. Delete Button
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => {
      const commentId = btn.getAttribute('data-id');
      openDeleteModal(commentId);
    };
  });
}

// Toggle Inline Reply Form
function toggleReplyForm(commentId) {
  const container = document.getElementById(`reply-form-container-${commentId}`);
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  // Close any open edit form
  const editContainer = document.getElementById(`edit-form-container-${commentId}`);
  if (editContainer) {
    editContainer.style.display = 'none';
    editContainer.innerHTML = '';
  }

  container.style.display = 'block';
  container.innerHTML = `
    <form class="inline-form" id="form-reply-${commentId}">
      <textarea class="comment-textarea" style="min-height: 80px;" id="reply-input-${commentId}" placeholder="Write a direct reply..." required></textarea>
      <div class="inline-actions">
        <button type="button" class="btn btn-secondary btn-sm" onclick="cancelReplyForm(${commentId})">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Post Reply</button>
      </div>
    </form>
  `;

  const input = document.getElementById(`reply-input-${commentId}`);
  input?.focus();

  document.getElementById(`form-reply-${commentId}`)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    try {
      await API.request(`/api/blogs/${activeBlogId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          parent_id: parseInt(commentId, 10)
        })
      });

      showToast('Reply posted successfully!');
      container.style.display = 'none';
      container.innerHTML = '';
      await loadComments();
    } catch (err) {
      showToast(err.message || 'Failed to post reply.', 'error');
    }
  });
}

function cancelReplyForm(commentId) {
  const container = document.getElementById(`reply-form-container-${commentId}`);
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

// Toggle Inline Edit Form
function toggleEditForm(commentId) {
  const container = document.getElementById(`edit-form-container-${commentId}`);
  const contentEl = document.getElementById(`comment-content-${commentId}`);
  if (!container || !contentEl) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    container.innerHTML = '';
    contentEl.style.display = 'block';
    return;
  }

  // Close any open reply form
  const replyContainer = document.getElementById(`reply-form-container-${commentId}`);
  if (replyContainer) {
    replyContainer.style.display = 'none';
    replyContainer.innerHTML = '';
  }

  const originalContent = contentEl.textContent.trim();
  contentEl.style.display = 'none';
  container.style.display = 'block';

  container.innerHTML = `
    <form class="inline-form" id="form-edit-${commentId}">
      <textarea class="comment-textarea" style="min-height: 80px;" id="edit-input-${commentId}" required>${escapeHtml(originalContent)}</textarea>
      <div class="inline-actions">
        <button type="button" class="btn btn-secondary btn-sm" onclick="cancelEditForm(${commentId})">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Save Changes</button>
      </div>
    </form>
  `;

  const input = document.getElementById(`edit-input-${commentId}`);
  input?.focus();

  document.getElementById(`form-edit-${commentId}`)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedContent = input.value.trim();
    if (!updatedContent) return;

    try {
      await API.request(`/api/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: updatedContent })
      });

      showToast('Comment updated successfully!');
      container.style.display = 'none';
      container.innerHTML = '';
      contentEl.textContent = updatedContent;
      contentEl.style.display = 'block';
      await loadComments();
    } catch (err) {
      showToast(err.message || 'Failed to update comment.', 'error');
    }
  });
}

function cancelEditForm(commentId) {
  const container = document.getElementById(`edit-form-container-${commentId}`);
  const contentEl = document.getElementById(`comment-content-${commentId}`);
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
  if (contentEl) {
    contentEl.style.display = 'block';
  }
}

// Delete Confirmation & Cascade Removal
function openDeleteModal(commentId) {
  pendingDeleteCommentId = commentId;
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.classList.add('active');

  const confirmBtn = document.getElementById('btn-confirm-delete');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        confirmBtn.disabled = true;
        const res = await API.request(`/api/comments/${pendingDeleteCommentId}`, {
          method: 'DELETE'
        });

        showToast(res.message || 'Comment deleted.');
        closeDeleteModal();
        await loadComments();
      } catch (err) {
        showToast(err.message || 'Failed to delete comment.', 'error');
      } finally {
        confirmBtn.disabled = false;
      }
    };
  }
}

function closeDeleteModal() {
  pendingDeleteCommentId = null;
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.classList.remove('active');
}

// Top-Level Comment Submission Handler
async function handleTopCommentSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('top-comment-input');
  const submitBtn = document.getElementById('btn-submit-top-comment');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    showToast('Please enter comment content.', 'error');
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    await API.request(`/api/blogs/${activeBlogId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    input.value = '';
    showToast('Comment posted successfully!');
    await loadComments();
  } catch (err) {
    showToast(err.message || 'Failed to post comment.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Guest Modal Controls
function openGuestModal() {
  const modal = document.getElementById('guest-modal');
  if (modal) modal.classList.add('active');
}

function closeGuestModal() {
  const modal = document.getElementById('guest-modal');
  if (modal) modal.classList.remove('active');
}
