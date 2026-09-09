/**
 * Public Feed Controller
 * Handles article search, category filtering, tag filtering, sorting, pagination,
 * active filter chips, URL query sync, and responsive dynamic card rendering.
 */

let currentPage = 1;
let currentSearch = '';
let currentCategory = '';
let currentTag = '';
let currentSort = 'newest';
let searchTimeout = null;

const categoryLookup = {};
const tagLookup = {};

// Estimate Reading Time (words / 200 WPM)
function calculateReadingTime(htmlContent) {
  const plainText = (htmlContent || '').replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

// Read URL Query Parameters on initialization or popstate
function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  currentSearch = (params.get('search') || '').trim();
  currentCategory = (params.get('category') || '').trim();
  currentTag = (params.get('tag') || '').trim();
  currentSort = params.get('sort') || 'newest';
  const pageParam = parseInt(params.get('page'), 10);
  currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = currentSearch;

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = currentSort;
}

// Synchronize current state with browser history / URL query string
function syncUrlParams() {
  const params = new URLSearchParams();
  if (currentSearch) params.set('search', currentSearch);
  if (currentCategory) params.set('category', currentCategory);
  if (currentTag) params.set('tag', currentTag);
  if (currentSort && currentSort !== 'newest') params.set('sort', currentSort);
  if (currentPage > 1) params.set('page', currentPage);

  const queryString = params.toString();
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  window.history.pushState(null, '', newUrl);
}

// Load Categories & Tags for the filter bar
async function loadTaxonomy() {
  try {
    const data = await API.request('/api/blogs/taxonomy');
    const catContainer = document.getElementById('categories-row');
    const tagContainer = document.getElementById('tags-row');

    // Populate Categories
    if (catContainer && data.categories) {
      data.categories.forEach(c => {
        categoryLookup[c.slug] = c.name;
      });

      let catHtml = `<button class="filter-pill ${currentCategory === '' ? 'active' : ''}" data-category="">All Categories</button>`;
      data.categories.forEach(cat => {
        const isActive = currentCategory === cat.slug;
        catHtml += `
          <button class="filter-pill ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat.slug)}">
            ${escapeHtml(cat.name)} (${cat.blog_count})
          </button>
        `;
      });
      catContainer.innerHTML = catHtml;

      catContainer.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          catContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentCategory = btn.getAttribute('data-category');
          currentPage = 1;
          syncUrlParams();
          renderActiveFilterChips();
          loadBlogs();
        });
      });
    }

    // Populate Popular Tags
    if (tagContainer && data.tags) {
      data.tags.forEach(t => {
        tagLookup[t.slug] = t.name;
      });

      let tagHtml = `<span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.25rem;">Popular Tags:</span>`;
      data.tags.forEach(t => {
        const isActive = currentTag === t.slug;
        tagHtml += `
          <button type="button" class="tag-pill ${isActive ? 'active' : ''}" data-tag="${escapeHtml(t.slug)}">
            #${escapeHtml(t.name)}
          </button>
        `;
      });
      tagContainer.innerHTML = tagHtml;

      tagContainer.querySelectorAll('.tag-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const clickedTag = btn.getAttribute('data-tag');
          if (currentTag === clickedTag) {
            currentTag = '';
            btn.classList.remove('active');
          } else {
            currentTag = clickedTag;
            tagContainer.querySelectorAll('.tag-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }
          currentPage = 1;
          syncUrlParams();
          renderActiveFilterChips();
          loadBlogs();
        });
      });
    }
  } catch (err) {
    console.error('Failed to load taxonomy:', err);
  }
}

// Render Active Filter Chips with One-Click Removal and Clear All
function renderActiveFilterChips() {
  const chipsBar = document.getElementById('active-filters-bar');
  if (!chipsBar) return;

  const hasFilters = Boolean(currentSearch || currentCategory || currentTag);
  if (!hasFilters) {
    chipsBar.style.display = 'none';
    chipsBar.innerHTML = '';
    return;
  }

  chipsBar.style.display = 'flex';
  let html = `<span class="active-filter-label">Active Filters:</span>`;

  if (currentSearch) {
    html += `
      <span class="filter-chip" id="chip-search">
        <span>🔍 Search: &ldquo;${escapeHtml(currentSearch)}&rdquo;</span>
        <button type="button" class="filter-chip-remove" data-clear="search" title="Remove search filter" aria-label="Remove search filter">✕</button>
      </span>
    `;
  }

  if (currentCategory) {
    const catName = categoryLookup[currentCategory] || currentCategory;
    html += `
      <span class="filter-chip" id="chip-category">
        <span>📁 Category: ${escapeHtml(catName)}</span>
        <button type="button" class="filter-chip-remove" data-clear="category" title="Remove category filter" aria-label="Remove category filter">✕</button>
      </span>
    `;
  }

  if (currentTag) {
    const tagName = tagLookup[currentTag] || currentTag;
    html += `
      <span class="filter-chip" id="chip-tag">
        <span>🏷️ Tag: #${escapeHtml(tagName)}</span>
        <button type="button" class="filter-chip-remove" data-clear="tag" title="Remove tag filter" aria-label="Remove tag filter">✕</button>
      </span>
    `;
  }

  html += `<button type="button" class="filter-chip-clear" id="btn-clear-all-chips">Clear All</button>`;
  chipsBar.innerHTML = html;

  // Attach chip removal events
  chipsBar.querySelectorAll('.filter-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const clearType = btn.getAttribute('data-clear');
      if (clearType === 'search') {
        currentSearch = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
      } else if (clearType === 'category') {
        currentCategory = '';
        document.querySelectorAll('#categories-row .filter-pill').forEach((p, idx) => {
          p.classList.toggle('active', idx === 0);
        });
      } else if (clearType === 'tag') {
        currentTag = '';
        document.querySelectorAll('#tags-row .tag-pill').forEach(p => p.classList.remove('active'));
      }
      currentPage = 1;
      syncUrlParams();
      renderActiveFilterChips();
      loadBlogs();
    });
  });

  // Attach Clear All event
  document.getElementById('btn-clear-all-chips')?.addEventListener('click', () => {
    resetAllFilters();
  });
}

// Global Filter Reset
function resetAllFilters() {
  currentSearch = '';
  currentCategory = '';
  currentTag = '';
  currentPage = 1;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('#categories-row .filter-pill').forEach((p, idx) => {
    p.classList.toggle('active', idx === 0);
  });

  document.querySelectorAll('#tags-row .tag-pill').forEach(p => p.classList.remove('active'));

  syncUrlParams();
  renderActiveFilterChips();
  loadBlogs();
}

// Load Blogs with search, filter, sort, and pagination
async function loadBlogs() {
  const grid = document.getElementById('blog-grid');
  const paginationContainer = document.getElementById('pagination-container');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 0; color: var(--text-muted);">
      <div style="font-size: 1.8rem; margin-bottom: 0.75rem; animation: spin 1s infinite linear;">⚡</div>
      Loading published articles...
    </div>
  `;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 6,
      sort: currentSort
    });

    if (currentSearch.trim()) params.append('search', currentSearch.trim());
    if (currentCategory) params.append('category', currentCategory);
    if (currentTag) params.append('tag', currentTag);

    const data = await API.request(`/api/blogs?${params.toString()}`);
    const blogs = data.blogs;
    const pagination = data.pagination;

    // Handle out-of-range page requests gracefully
    if (pagination.total > 0 && currentPage > pagination.totalPages) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📄</div>
          <h2 class="empty-title">Page Out of Range</h2>
          <p class="empty-text">You requested page ${currentPage}, but there are only ${pagination.totalPages} page(s) available for the current query.</p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1rem;">
            <button id="btn-goto-last-page" class="btn btn-primary btn-sm">Go to Page ${pagination.totalPages}</button>
            <button id="btn-goto-page-1" class="btn btn-secondary btn-sm">Go to Page 1</button>
          </div>
        </div>
      `;

      document.getElementById('btn-goto-last-page')?.addEventListener('click', () => {
        currentPage = pagination.totalPages;
        syncUrlParams();
        loadBlogs();
      });

      document.getElementById('btn-goto-page-1')?.addEventListener('click', () => {
        currentPage = 1;
        syncUrlParams();
        loadBlogs();
      });

      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    if (blogs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h2 class="empty-title">No blogs found matching your query</h2>
          <p class="empty-text">We couldn't find any articles matching your search criteria. Try adjusting keywords or clearing category/tag filters.</p>
          <button id="btn-reset-filters" class="btn btn-primary btn-sm">Reset All Filters</button>
        </div>
      `;

      document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        resetAllFilters();
      });

      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    // Render Cards
    grid.innerHTML = blogs.map(blog => {
      const cover = blog.cover_image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80';
      const readTime = calculateReadingTime(blog.body);
      const primaryCategory = blog.categories && blog.categories[0] ? blog.categories[0].name : 'Architecture';
      const formattedDate = formatRelativeTime(blog.created_at);

      const tagsHtml = (blog.tags || []).length > 0
        ? `<div class="blog-card-tags">
            ${blog.tags.map(t => `<button type="button" class="card-tag-badge" data-tag="${escapeHtml(t.slug)}" title="Filter by #${escapeHtml(t.name)}">#${escapeHtml(t.name)}</button>`).join('')}
           </div>`
        : '';

      return `
        <article class="blog-card" id="blog-${blog.id}">
          <div class="blog-card-media">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(blog.title)}" class="blog-card-img" loading="lazy">
          </div>
          <div class="blog-card-content">
            <div class="blog-card-meta">
              <span class="blog-card-category">${escapeHtml(primaryCategory)}</span>
              <span>•</span>
              <span>${readTime}</span>
              <span>•</span>
              <span>${formattedDate}</span>
            </div>
            <h2 class="blog-card-title">
              <a href="/blog/${escapeHtml(blog.slug)}">${escapeHtml(blog.title)}</a>
            </h2>
            <div class="blog-card-snippet">
              ${escapeHtml((blog.body || '').replace(/<[^>]*>/g, ''))}
            </div>
            ${tagsHtml}
            <div class="blog-card-footer">
              <div style="font-weight: 500;">By ${escapeHtml(blog.author_name)}</div>
              <div class="card-stats">
                <span class="stat-item ${blog.user_liked ? 'liked' : ''}" title="Likes">
                  ❤️ <strong>${blog.like_count}</strong>
                </span>
                <span class="stat-item" title="Comments">
                  💬 <strong>${blog.comment_count}</strong>
                </span>
              </div>
            </div>
            ${API.isAdmin() ? `
              <div class="admin-card-bar" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <span class="role-badge role-admin" style="font-size: 0.7rem;">Admin</span>
                <button type="button" class="btn btn-danger btn-sm btn-delete-card" onclick="handleCardAdminDelete(${blog.id}, '${escapeHtml(blog.title).replace(/'/g, "\\'")}', '${escapeHtml(blog.author_name || 'User').replace(/'/g, "\\'")}', event)" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">
                  🗑️ Delete Post
                </button>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    // Attach click listeners to card tag badges
    grid.querySelectorAll('.card-tag-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tagSlug = badge.getAttribute('data-tag');
        currentTag = tagSlug;
        currentPage = 1;

        // Update active state in tag row if present
        document.querySelectorAll('#tags-row .tag-pill').forEach(pill => {
          pill.classList.toggle('active', pill.getAttribute('data-tag') === tagSlug);
        });

        syncUrlParams();
        renderActiveFilterChips();
        loadBlogs();
      });
    });

    // Render Pagination Controls
    renderPagination(pagination);
  } catch (err) {
    console.error('Error loading blogs:', err);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; border-color: var(--danger);">
        <h2 class="empty-title" style="color: var(--danger-light);">Failed to Load Articles</h2>
        <p class="empty-text">An error occurred while communicating with the server. Please try again.</p>
        <button onclick="loadBlogs()" class="btn btn-secondary btn-sm">Retry</button>
      </div>
    `;
  }
}

// Render Structured Pagination
function renderPagination(pagination) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="page-btn" id="prev-page" ${!pagination.hasPrev ? 'disabled' : ''} aria-label="Previous Page">
      ← Prev
    </button>
  `;

  for (let p = 1; p <= pagination.totalPages; p++) {
    html += `
      <button class="page-btn ${p === pagination.page ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}">
        ${p}
      </button>
    `;
  }

  html += `
    <button class="page-btn" id="next-page" ${!pagination.hasNext ? 'disabled' : ''} aria-label="Next Page">
      Next →
    </button>
  `;

  container.innerHTML = html;

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      syncUrlParams();
      loadBlogs();
      window.scrollTo({ top: 380, behavior: 'smooth' });
    }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    if (currentPage < pagination.totalPages) {
      currentPage++;
      syncUrlParams();
      loadBlogs();
      window.scrollTo({ top: 380, behavior: 'smooth' });
    }
  });

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.getAttribute('data-page'), 10);
      syncUrlParams();
      loadBlogs();
      window.scrollTo({ top: 380, behavior: 'smooth' });
    });
  });
}

// Administrator Card-Level Post Deletion
async function handleCardAdminDelete(blogId, title, authorName, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const authorSuffix = authorName ? ` written by "${authorName}"` : '';
  if (!confirm(`Administrator Action: Permanently delete article "${title}"${authorSuffix}? All associated comments and likes will be permanently erased.`)) {
    return;
  }

  try {
    const res = await API.request(`/api/blogs/${blogId}`, { method: 'DELETE' });
    showToast(res.message || 'Article deleted by administrator.');
    await loadBlogs();
  } catch (err) {
    showToast(err.message || 'Failed to delete article.', 'error');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await API.checkAuth();
  readUrlParams();
  loadTaxonomy().then(() => {
    renderActiveFilterChips();
    loadBlogs();
  });

  // Handle browser back/forward history navigation
  window.addEventListener('popstate', () => {
    readUrlParams();
    renderActiveFilterChips();
    loadBlogs();
  });

  // Search input debouncer (300ms)
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        syncUrlParams();
        renderActiveFilterChips();
        loadBlogs();
      }, 300);
    });
  }

  // Sort dropdown change
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      syncUrlParams();
      loadBlogs();
    });
  }

  // Global shortcut '/' to focus search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });
});
