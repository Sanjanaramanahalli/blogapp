/**
 * Public Feed Controller
 * Handles article search, category filtering, sorting, pagination, and dynamic card rendering.
 */

let currentPage = 1;
let currentSearch = '';
let currentCategory = '';
let currentSort = 'newest';
let searchTimeout = null;

// Estimate Reading Time (words / 200 WPM)
function calculateReadingTime(htmlContent) {
  const plainText = htmlContent.replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

// Load Categories for the filter bar
async function loadCategories() {
  try {
    const data = await API.request('/api/blogs/taxonomy');
    const container = document.getElementById('categories-row');
    if (!container) return;

    let html = `<button class="filter-pill ${currentCategory === '' ? 'active' : ''}" data-category="">All Categories</button>`;

    data.categories.forEach(cat => {
      const isActive = currentCategory === cat.slug;
      html += `
        <button class="filter-pill ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat.slug)}">
          ${escapeHtml(cat.name)} (${cat.blog_count})
        </button>
      `;
    });

    container.innerHTML = html;

    // Attach pill click events
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category');
        currentPage = 1;
        loadBlogs();
      });
    });
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// Load Blogs with search, filter, sort, and pagination
async function loadBlogs() {
  const grid = document.getElementById('blog-grid');
  const paginationContainer = document.getElementById('pagination-container');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0; color: var(--text-muted);">
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚡</div>
      Loading articles...
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

    const data = await API.request(`/api/blogs?${params.toString()}`);
    const blogs = data.blogs;
    const pagination = data.pagination;

    if (blogs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h2 class="empty-title">No Articles Found</h2>
          <p class="empty-text">No articles matched your search criteria. Try adjusting your search query or selecting a different category.</p>
          <button id="btn-reset-filters" class="btn btn-primary btn-sm">Clear Filters</button>
        </div>
      `;

      document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        currentSearch = '';
        currentCategory = '';
        currentPage = 1;
        document.querySelectorAll('.filter-pill').forEach((p, idx) => {
          p.classList.toggle('active', idx === 0);
        });
        loadBlogs();
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
              ${escapeHtml(blog.body.replace(/<[^>]*>/g, ''))}
            </div>
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
          </div>
        </article>
      `;
    }).join('');

    // Render Pagination
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

// Pagination Controls
function renderPagination(pagination) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="page-btn" id="prev-page" ${!pagination.hasPrev ? 'disabled' : ''} aria-label="Previous Page">
      ←
    </button>
  `;

  for (let p = 1; p <= pagination.totalPages; p++) {
    html += `
      <button class="page-btn ${p === pagination.page ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  html += `
    <button class="page-btn" id="next-page" ${!pagination.hasNext ? 'disabled' : ''} aria-label="Next Page">
      →
    </button>
  `;

  container.innerHTML = html;

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadBlogs();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    if (currentPage < pagination.totalPages) {
      currentPage++;
      loadBlogs();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  });

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.getAttribute('data-page'), 10);
      loadBlogs();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadBlogs();

  // Search input debouncer
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        loadBlogs();
      }, 350);
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadBlogs();
    });
  }
});
