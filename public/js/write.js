/**
 * Public Article Creator Controller
 * Allows authenticated readers and administrators to write and publish articles.
 */

let selectedCategoryIds = new Set();
let uploadedCoverUrl = '';

// Guard authentication
async function checkWriterAccess() {
  await API.checkAuth();
  if (!API.isLoggedIn()) {
    showToast('Please sign in to write an article.', 'error');
    setTimeout(() => {
      window.location.href = '/login?redirect=/write';
    }, 800);
    return false;
  }
  return true;
}

// Load Categories Taxonomy
async function loadCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  try {
    const data = await API.request('/api/blogs/taxonomy');
    const categories = data.categories || [];

    if (categories.length === 0) {
      container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No categories available</span>';
      return;
    }

    container.innerHTML = categories.map(c => `
      <div class="category-chip" data-id="${c.id}" onclick="toggleCategoryChip(${c.id}, this)">
        ${escapeHtml(c.name)}
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading taxonomy:', err);
    container.innerHTML = '<span style="color: var(--danger-light); font-size: 0.85rem;">Failed to load categories</span>';
  }
}

// Toggle Category Chip Selection
function toggleCategoryChip(id, el) {
  if (selectedCategoryIds.has(id)) {
    selectedCategoryIds.delete(id);
    el.classList.remove('selected');
  } else {
    selectedCategoryIds.add(id);
    el.classList.add('selected');
  }
}

// Setup Cover Image Upload
function initCoverUpload() {
  const fileInput = document.getElementById('cover-file-input');
  const urlInput = document.getElementById('cover-url-input');
  const previewImg = document.getElementById('cover-preview-img');
  const placeholderText = document.getElementById('cover-placeholder-text');

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      const url = urlInput.value.trim();
      if (url) {
        uploadedCoverUrl = url;
        previewImg.src = url;
        previewImg.style.display = 'block';
        if (placeholderText) placeholderText.style.display = 'none';
      } else {
        uploadedCoverUrl = '';
        previewImg.style.display = 'none';
        if (placeholderText) placeholderText.style.display = 'block';
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('cover', file);

      try {
        const token = API.getToken();
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed.');
        }

        uploadedCoverUrl = data.url;
        if (urlInput) urlInput.value = data.url;
        previewImg.src = data.url;
        previewImg.style.display = 'block';
        if (placeholderText) placeholderText.style.display = 'none';
        showToast('Cover image uploaded successfully!');
      } catch (err) {
        showToast(err.message || 'Failed to upload cover image.', 'error');
      }
    });
  }
}

// Textarea formatting utilities
function wrapSelection(before, after) {
  const textarea = document.getElementById('blog-body');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);

  textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
  textarea.focus();
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
}

function formatDoc(type) {
  if (type === 'bold') wrapSelection('<strong>', '</strong>');
  if (type === 'italic') wrapSelection('<em>', '</em>');
}

function formatHeading(level) {
  wrapSelection(`<h${level}>`, `</h${level}>\n`);
}

function formatBlockquote() {
  wrapSelection('<blockquote>', '</blockquote>\n');
}

function formatCode() {
  wrapSelection('<pre><code>', '</code></pre>\n');
}

function formatList(type) {
  wrapSelection('<ul>\n  <li>', '</li>\n</ul>\n');
}

// Save or Publish Article
async function submitArticle(status = 'published') {
  const title = document.getElementById('blog-title').value.trim();
  const body = document.getElementById('blog-body').value.trim();
  const tagsInput = document.getElementById('tags-input').value.trim();
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  const categories = Array.from(selectedCategoryIds);

  if (!title) {
    showToast('Please enter an article title.', 'error');
    document.getElementById('blog-title').focus();
    return;
  }

  if (!body) {
    showToast('Please enter article content.', 'error');
    document.getElementById('blog-body').focus();
    return;
  }

  const payload = {
    title,
    body,
    cover_image: uploadedCoverUrl || null,
    status,
    categories,
    tags
  };

  const publishBtn = document.getElementById('btn-publish');
  const draftBtn = document.getElementById('btn-save-draft');

  try {
    if (publishBtn) publishBtn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;

    const res = await API.request('/api/blogs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast(status === 'published' ? 'Article published successfully! 🎉' : 'Article draft saved! 💾');

    setTimeout(() => {
      if (res.blog && res.blog.slug) {
        window.location.href = `/blog/${res.blog.slug}`;
      } else {
        window.location.href = '/';
      }
    }, 900);
  } catch (err) {
    showToast(err.message || 'Failed to submit article.', 'error');
    if (publishBtn) publishBtn.disabled = false;
    if (draftBtn) draftBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await checkWriterAccess();
  if (!hasAccess) return;

  loadCategories();
  initCoverUpload();

  document.getElementById('btn-publish')?.addEventListener('click', () => submitArticle('published'));
  document.getElementById('btn-save-draft')?.addEventListener('click', () => submitArticle('draft'));
});
