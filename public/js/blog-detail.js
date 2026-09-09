/**
 * Blog Detail & Reading Page Controller
 * Renders full rich text content, metadata, like button toggle, and triggers comment tree.
 */

let currentBlog = null;

// Extract slug or ID from pathname /blog/:slug
function getSlugFromPath() {
  const pathname = window.location.pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'blog') {
    return decodeURIComponent(parts[1]);
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('slug') || urlParams.get('id') || null;
}

// Load and Render Blog Detail
async function loadBlogDetail() {
  const slug = getSlugFromPath();
  const container = document.getElementById('article-container');
  const socialBar = document.getElementById('social-bar');
  const discussions = document.getElementById('discussions');

  if (!slug) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>No Article Specified</h2>
          <p>Please return to the home page to select an article.</p>
          <a href="/" class="btn btn-primary btn-sm">Browse Articles</a>
        </div>
      `;
    }
    return;
  }

  try {
    const data = await API.request(`/api/blogs/${encodeURIComponent(slug)}`);
    currentBlog = data.blog;

    // Check user role for admin/author management controls
    await API.checkAuth();
    const isUserAdmin = API.isAdmin();
    const currentUser = API.getUser();
    const isAuthor = currentUser && currentUser.id === currentBlog.author_id;
    const canManage = isUserAdmin || isAuthor;

    document.title = `${currentBlog.title} — ApexBlog`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && currentBlog.body) {
      const cleanDesc = currentBlog.body.replace(/<[^>]*>/g, '').trim().substring(0, 160);
      metaDesc.setAttribute('content', cleanDesc);
    }

    // Render Article
    const cover = currentBlog.cover_image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80';
    const plainText = currentBlog.body.replace(/<[^>]*>/g, '');
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

    const categoriesHtml = (currentBlog.categories || [])
      .map(c => `<span class="category-badge">${escapeHtml(c.name)}</span>`)
      .join('');

    const tagsHtml = (currentBlog.tags || [])
      .map(t => `<span class="tag-badge">#${escapeHtml(t.name)}</span>`)
      .join('');

    const adminBarHtml = canManage ? `
      <div class="admin-post-toolbar" style="display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
          <span style="font-size: 1.2rem;">🛡️</span>
          <span><strong>${isUserAdmin ? 'Administrator Post Controls' : 'Author Controls'}:</strong> Article written by <strong>${escapeHtml(currentBlog.author_name)}</strong> (${escapeHtml(currentBlog.author_email || 'User')})</span>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          ${isUserAdmin ? `<a href="/admin" class="btn btn-outline btn-sm" style="font-size: 0.8rem;">Admin Dashboard</a>` : ''}
          <button type="button" class="btn btn-danger btn-sm" id="btn-admin-delete-blog" onclick="openDeleteArticleModal()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
            🗑️ Delete Article ${isUserAdmin ? '(Admin)' : ''}
          </button>
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      ${adminBarHtml}
      <article class="article-detail-view">
        <header class="article-header">
          <div class="article-categories" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem;">
            <span class="edition-tag" style="padding: 0.25rem 0.65rem;">${escapeHtml(currentBlog.edition ? currentBlog.edition.toUpperCase() : 'INDIA')} EDITION</span>
            ${currentBlog.video_url ? `<span class="video-badge">▶ Video Broadcast</span>` : ''}
            ${categoriesHtml || '<span class="category-badge">News</span>'}
          </div>
          <h1 class="article-title">${escapeHtml(currentBlog.title)}</h1>
          <div class="article-author-row">
            <div class="user-avatar" style="width: 2.75rem; height: 2.75rem; font-size: 1rem;">
              ${escapeHtml(currentBlog.author_name.substring(0, 2).toUpperCase())}
            </div>
            <div class="article-author-info">
              <div class="article-author-name">${escapeHtml(currentBlog.author_name)}</div>
              <div class="article-date-meta">
                Published <time datetime="${escapeHtml(currentBlog.created_at)}" class="article-date">${formatRelativeTime(currentBlog.created_at)}</time>
                <span class="reading-time-sep" style="margin: 0 0.35rem; color: var(--text-muted);">•</span>
                <span class="article-reading-time">${readingTime}</span>
              </div>
            </div>
          </div>
        </header>

        ${currentBlog.video_url ? `
          <div class="article-video-wrapper" style="margin-bottom: 2rem; border-radius: var(--radius-lg); overflow: hidden; background: #000; box-shadow: var(--shadow-lg);">
            <div style="padding: 0.6rem 1rem; background: rgba(0,0,0,0.8); color: #fff; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600;">
              <span style="color: #ef4444;">▶</span> Featured News Broadcast Video
            </div>
            ${(currentBlog.video_url.includes('youtube.com') || currentBlog.video_url.includes('youtu.be')) ? `
              <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                <iframe src="${escapeHtml(currentBlog.video_url.includes('embed') ? currentBlog.video_url : (currentBlog.video_url.includes('youtu.be/') ? 'https://www.youtube.com/embed/' + currentBlog.video_url.split('youtu.be/')[1].split('?')[0] : 'https://www.youtube.com/embed/' + currentBlog.video_url.split('v=')[1]?.split('&')[0]))}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
              </div>
            ` : `
              <video controls playsinline style="width: 100%; max-height: 480px; display: block;" poster="${escapeHtml(cover)}">
                <source src="${escapeHtml(currentBlog.video_url)}" type="video/mp4">
                Your browser does not support HTML5 video playback.
              </video>
            `}
          </div>
        ` : `
          <div class="article-cover-wrapper">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(currentBlog.title)}" class="article-cover-img">
          </div>
        `}

        <div class="article-body">
          ${currentBlog.body}
        </div>

        ${tagsHtml ? `<div class="article-tags-row"><strong style="color: var(--text-muted); font-size: 0.85rem;">Tags:</strong> ${tagsHtml}</div>` : ''}
      </article>
    `;

    // Initialize Social Bar
    if (socialBar) {
      socialBar.style.display = 'flex';
      updateLikeButtonUI(currentBlog.user_liked, currentBlog.like_count);
      updateSaveButtonUI(currentBlog.user_saved);

      const readingTimeBadge = document.getElementById('reading-time-badge');
      if (readingTimeBadge) readingTimeBadge.textContent = readingTime;

      document.getElementById('btn-like')?.addEventListener('click', handleLikeToggle);
      document.getElementById('btn-save-blog')?.addEventListener('click', handleSaveToggle);
      document.getElementById('btn-share-blog')?.addEventListener('click', handleShareClick);
    }

    // Initialize Discussions
    if (discussions) {
      discussions.style.display = 'block';
      initComments(currentBlog.id);
    }

  } catch (err) {
    console.error('Error loading article:', err);
    if (container) {
      const is404 = err.status === 404 || (err.message && err.message.toLowerCase().includes('not found'));
      const isDraft403 = err.status === 403 || (err.message && (err.message.toLowerCase().includes('draft') || err.message.toLowerCase().includes('denied')));

      if (is404) {
        document.title = 'Blog Not Found — ApexBlog';
        container.innerHTML = `
          <div class="empty-state not-found-state" style="border-color: var(--border-strong); padding: 4rem 2rem;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔍</div>
            <h2 class="empty-title">Blog Not Found</h2>
            <p class="empty-text" style="max-width: 520px; margin: 0 auto 1.5rem; color: var(--text-secondary);">
              The requested article does not exist, has been deleted, or the slug/ID is invalid.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <a href="/" class="btn btn-primary btn-sm" id="btn-return-home">Browse All Articles</a>
            </div>
          </div>
        `;
      } else if (isDraft403) {
        document.title = 'Access Denied — ApexBlog';
        container.innerHTML = `
          <div class="empty-state draft-access-state" style="border-color: var(--danger); padding: 4rem 2rem;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔒</div>
            <h2 class="empty-title">Article Unavailable: Access Denied</h2>
            <p class="empty-text" style="max-width: 520px; margin: 0 auto 1.5rem; color: var(--text-secondary);">
              ${escapeHtml(err.message || 'This article is currently an unpublished draft and is restricted to administrators.')}
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <a href="/" class="btn btn-secondary btn-sm">Return to Articles</a>
              <a href="/login" class="btn btn-primary btn-sm">Sign In as Admin</a>
            </div>
          </div>
        `;
      } else {
        document.title = 'Article Unavailable — ApexBlog';
        container.innerHTML = `
          <div class="empty-state" style="border-color: var(--danger); padding: 4rem 2rem;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">⚠️</div>
            <h2 class="empty-title">Article Unavailable</h2>
            <p class="empty-text" style="max-width: 520px; margin: 0 auto 1.5rem; color: var(--text-secondary);">
              ${escapeHtml(err.message || 'The article could not be loaded.')}
            </p>
            <a href="/" class="btn btn-primary btn-sm">Return to Articles</a>
          </div>
        `;
      }
    }
  }
}

// Like / Unlike Toggle Handler
async function handleLikeToggle() {
  if (!API.isLoggedIn()) {
    openGuestModal();
    return;
  }

  const likeBtn = document.getElementById('btn-like');
  if (!likeBtn || !currentBlog || likeBtn.disabled) return;

  try {
    likeBtn.disabled = true;
    // Call standard endpoint /api/blogs/:id/like
    const res = await API.request(`/api/blogs/${currentBlog.id}/like`, {
      method: 'POST'
    });

    currentBlog.user_liked = res.liked;
    currentBlog.like_count = res.likeCount;
    updateLikeButtonUI(res.liked, res.likeCount);

    showToast(res.liked ? 'Added to your liked articles! ❤️' : 'Removed like.');
  } catch (err) {
    showToast(err.message || 'Failed to update like status.', 'error');
  } finally {
    likeBtn.disabled = false;
  }
}

function updateLikeButtonUI(liked, count) {
  const likeBtn = document.getElementById('btn-like');
  const likeCount = document.getElementById('like-count');
  const likeText = document.getElementById('like-text');

  const isLiked = Boolean(liked);
  const numericCount = Number(count) || 0;

  if (likeBtn) {
    likeBtn.classList.toggle('liked', isLiked);
    likeBtn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
    likeBtn.setAttribute('title', isLiked ? 'Unlike this article' : 'Like this article');
  }
  if (likeCount) {
    likeCount.textContent = numericCount;
    likeCount.setAttribute('aria-label', `${numericCount} likes`);
  }
  if (likeText) {
    likeText.textContent = isLiked ? 'Liked' : 'Like';
  }
}

// Save / Bookmark Toggle Handler
async function handleSaveToggle() {
  if (!API.isLoggedIn()) {
    openGuestModal();
    return;
  }

  if (!currentBlog) {
    showToast('Cannot save unavailable or non-existent article.', 'error');
    return;
  }

  const saveBtn = document.getElementById('btn-save-blog');

  try {
    if (saveBtn) saveBtn.disabled = true;
    const res = await API.request(`/api/blogs/${currentBlog.id}/save`, {
      method: 'POST'
    });

    currentBlog.user_saved = res.saved;
    updateSaveButtonUI(res.saved);
    showToast(res.saved ? 'Article saved to your bookmarks! 🔖' : 'Article removed from bookmarks.');
  } catch (err) {
    showToast(err.message || 'Failed to update saved status.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function updateSaveButtonUI(saved) {
  const saveBtn = document.getElementById('btn-save-blog');
  const saveText = document.getElementById('save-text');
  const isSaved = Boolean(saved);

  if (saveBtn) {
    saveBtn.classList.toggle('saved', isSaved);
    saveBtn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    saveBtn.setAttribute('title', isSaved ? 'Remove bookmark' : 'Save article');
    if (isSaved) {
      saveBtn.style.background = 'rgba(99, 102, 241, 0.2)';
      saveBtn.style.borderColor = 'var(--accent-light)';
    } else {
      saveBtn.style.background = '';
      saveBtn.style.borderColor = '';
    }
  }
  if (saveText) {
    saveText.textContent = isSaved ? 'Saved' : 'Save';
  }
}

// Share Article Handler
async function handleShareClick() {
  if (!currentBlog || !currentBlog.title) {
    showToast('Cannot share unavailable or non-existent article.', 'error');
    return;
  }

  const shareUrl = window.location.href;
  const shareData = {
    title: currentBlog.title,
    text: `Check out this article on ApexBlog: ${currentBlog.title}`,
    url: shareUrl
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      showToast('Article shared successfully! 🔗');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback to clipboard copy
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Article link copied to clipboard! 🔗');
    } else {
      showToast('Article link copied to clipboard! 🔗');
    }
  } catch {
    showToast('Article link copied to clipboard! 🔗');
  }
}

// Article Deletion Handlers (Admin or Author)
function openDeleteArticleModal() {
  if (!currentBlog) return;
  const modal = document.getElementById('delete-article-modal');
  const warningText = document.getElementById('delete-article-warning-text');
  if (warningText) {
    const authorInfo = currentBlog.author_name ? ` written by <strong>${escapeHtml(currentBlog.author_name)}</strong>` : '';
    warningText.innerHTML = `Are you sure you want to permanently delete <strong>"${escapeHtml(currentBlog.title)}"</strong>${authorInfo}?`;
  }
  if (modal) modal.classList.add('active');
}

function closeDeleteArticleModal() {
  const modal = document.getElementById('delete-article-modal');
  if (modal) modal.classList.remove('active');
}

async function confirmDeleteArticle() {
  if (!currentBlog) return;
  const confirmBtn = document.getElementById('btn-confirm-delete-article');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
  }

  try {
    const res = await API.request(`/api/blogs/${currentBlog.id}`, {
      method: 'DELETE'
    });
    showToast(res.message || 'Article permanently deleted.');
    closeDeleteArticleModal();
    setTimeout(() => {
      window.location.href = API.isAdmin() ? '/admin' : '/';
    }, 800);
  } catch (err) {
    showToast(err.message || 'Failed to delete article.', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Permanently Delete';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadBlogDetail();
  document.getElementById('btn-confirm-delete-article')?.addEventListener('click', confirmDeleteArticle);

  // Dynamic Scroll Reading Progress Bar
  window.addEventListener('scroll', () => {
    const bar = document.getElementById('reading-progress-bar');
    if (!bar) return;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    const percent = docHeight > 0 ? (scrollPos / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }, { passive: true });
});

window.handleShareClick = handleShareClick;
window.handleSaveToggle = handleSaveToggle;

