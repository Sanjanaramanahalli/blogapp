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

    document.title = `${currentBlog.title} — ApexBlog`;

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

    container.innerHTML = `
      <article>
        <header class="article-header">
          <div class="article-categories">
            ${categoriesHtml || '<span class="category-badge">Engineering</span>'}
          </div>
          <h1 class="article-title">${escapeHtml(currentBlog.title)}</h1>
          <div class="article-author-row">
            <div class="user-avatar" style="width: 2.75rem; height: 2.75rem; font-size: 1rem;">
              ${escapeHtml(currentBlog.author_name.substring(0, 2).toUpperCase())}
            </div>
            <div class="article-author-info">
              <div class="article-author-name">${escapeHtml(currentBlog.author_name)}</div>
              <div class="article-date">Published ${formatRelativeTime(currentBlog.created_at)} • ${readingTime}</div>
            </div>
          </div>
        </header>

        <div class="article-cover-wrapper">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(currentBlog.title)}" class="article-cover-img">
        </div>

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

      const readingTimeBadge = document.getElementById('reading-time-badge');
      if (readingTimeBadge) readingTimeBadge.textContent = readingTime;

      document.getElementById('btn-like')?.addEventListener('click', handleLikeToggle);
    }

    // Initialize Discussions
    if (discussions) {
      discussions.style.display = 'block';
      initComments(currentBlog.id);
    }

  } catch (err) {
    console.error('Error loading article:', err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="border-color: var(--danger);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
          <h2 class="empty-title">Article Unavailable</h2>
          <p class="empty-text">${escapeHtml(err.message || 'The article could not be loaded.')}</p>
          <a href="/" class="btn btn-primary btn-sm">Return to Articles</a>
        </div>
      `;
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
  if (!likeBtn || !currentBlog) return;

  try {
    likeBtn.disabled = true;
    const res = await API.request(`/api/blogs/${currentBlog.id}/likes/toggle`, {
      method: 'POST'
    });

    currentBlog.user_liked = res.liked;
    currentBlog.like_count = res.likeCount;
    updateLikeButtonUI(res.liked, res.likeCount);

    showToast(res.liked ? 'Added to your liked articles!' : 'Removed like.');
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

  if (likeBtn) {
    likeBtn.classList.toggle('liked', !!liked);
  }
  if (likeCount) {
    likeCount.textContent = count;
  }
  if (likeText) {
    likeText.textContent = liked ? 'Liked' : 'Like';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadBlogDetail();
});
