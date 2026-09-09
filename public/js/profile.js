/**
 * Profile Controller
 * Manages user profile display, avatar uploads, bio/email editing,
 * password updates, and saved articles collection.
 */

let currentUserProfile = null;
let uploadedAvatarUrl = null;

// Ensure user is authenticated before proceeding
async function ensureAuthenticated() {
  await API.checkAuth();
  if (!API.isLoggedIn()) {
    window.location.href = '/login?redirect=/profile';
    return false;
  }
  return true;
}

// Format date helper
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Render User Header Profile Card
function renderHeaderProfile(user) {
  if (!user) return;
  const displayName = document.getElementById('profile-display-name');
  const displayEmail = document.getElementById('profile-display-email');
  const displayBio = document.getElementById('profile-display-bio');
  const roleBadge = document.getElementById('profile-role-badge');
  const memberSince = document.getElementById('profile-member-since');
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');

  if (displayName) displayName.textContent = user.name || 'User';
  if (displayEmail) displayEmail.textContent = user.email || '';
  if (displayBio) {
    displayBio.textContent = user.bio && user.bio.trim() ? user.bio : 'No bio added yet.';
  }
  if (roleBadge) {
    roleBadge.textContent = user.role || 'reader';
    roleBadge.className = `role-badge role-${user.role || 'reader'}`;
  }
  if (memberSince) {
    memberSince.textContent = formatDate(user.created_at);
  }

  const avatar = user.avatar_url || uploadedAvatarUrl;
  if (avatar) {
    if (avatarImg) {
      avatarImg.src = avatar;
      avatarImg.style.display = 'block';
    }
    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarPlaceholder) {
      const initials = (user.name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
      avatarPlaceholder.textContent = initials;
      avatarPlaceholder.style.display = 'inline-block';
    }
  }
}

// Load Profile Data
async function loadUserProfile() {
  try {
    const res = await API.request('/api/user/profile');
    currentUserProfile = res.user;
    uploadedAvatarUrl = currentUserProfile.avatar_url;

    renderHeaderProfile(currentUserProfile);

    // Populate form fields
    const nameInput = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');
    const bioInput = document.getElementById('profile-bio-input');

    if (nameInput) nameInput.value = currentUserProfile.name || '';
    if (emailInput) emailInput.value = currentUserProfile.email || '';
    if (bioInput) bioInput.value = currentUserProfile.bio || '';

  } catch (err) {
    console.error('Error loading profile:', err);
    showProfileAlert('Failed to load profile details.', 'error');
  }
}

// Show alert banner
function showProfileAlert(message, type = 'error') {
  const errorAlert = document.getElementById('profile-error-alert');
  const successAlert = document.getElementById('profile-success-alert');

  if (type === 'error') {
    if (successAlert) successAlert.style.display = 'none';
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.style.display = 'block';
    }
    if (typeof showToast === 'function') showToast(message, 'error');
  } else {
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) {
      successAlert.textContent = message;
      successAlert.style.display = 'block';
    }
    if (typeof showToast === 'function') showToast(message, 'success');
  }
}

function clearProfileAlerts() {
  const errorAlert = document.getElementById('profile-error-alert');
  const successAlert = document.getElementById('profile-success-alert');
  if (errorAlert) errorAlert.style.display = 'none';
  if (successAlert) successAlert.style.display = 'none';
}

// Setup Avatar Upload with file format validation
function initAvatarUpload() {
  const fileInput = document.getElementById('avatar-file-input');
  const statusDiv = document.getElementById('avatar-upload-status');
  const filenameDisplay = document.getElementById('avatar-filename-display');

  if (!fileInput) return;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (filenameDisplay) filenameDisplay.textContent = file.name;

    // Direct upload via FormData
    const formData = new FormData();
    formData.append('avatar', file);

    if (statusDiv) {
      statusDiv.style.color = 'var(--accent-light)';
      statusDiv.textContent = 'Uploading profile image...';
    }

    try {
      const data = await API.request('/api/uploads', {
        method: 'POST',
        body: formData
      });

      uploadedAvatarUrl = data.url;
      if (statusDiv) {
        statusDiv.style.color = 'var(--success-light)';
        statusDiv.textContent = '✓ ' + (data.message || 'Profile photo uploaded successfully.');
      }

      // Update avatar preview
      const avatarImg = document.getElementById('profile-avatar-img');
      const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
      if (avatarImg) {
        avatarImg.src = uploadedAvatarUrl;
        avatarImg.style.display = 'block';
      }
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';

      showProfileAlert(data.message || 'Profile photo uploaded successfully.', 'success');
    } catch (err) {
      const errMsg = err.message || 'Image upload rejected.';
      if (statusDiv) {
        statusDiv.style.color = 'var(--danger-light)';
        statusDiv.textContent = '✗ ' + errMsg;
      }
      showProfileAlert(errMsg, 'error');
    }
  });
}

// Client-side Password Complexity Validation Helper
function validatePasswordRules(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

// Profile Save Handler
function initProfileForm() {
  const form = document.getElementById('profile-form');
  const saveBtn = document.getElementById('btn-save-profile');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearProfileAlerts();

    const name = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    if (!name) {
      showProfileAlert('Full name is required.', 'error');
      return;
    }

    // Negative 8: Submit an empty/invalid email in the profile
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showProfileAlert('A valid email address is required.', 'error');
      return;
    }

    // Password validation if newPassword entered
    if (newPassword) {
      if (!currentPassword) {
        showProfileAlert('Current password is required to set a new password.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showProfileAlert('New password and confirmation do not match.', 'error');
        return;
      }
      const pwError = validatePasswordRules(newPassword);
      if (pwError) {
        showProfileAlert(pwError, 'error');
        return;
      }
    }

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      const payload = {
        name,
        email,
        bio,
        avatar_url: uploadedAvatarUrl
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await API.request('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      currentUserProfile = res.user;
      API.setUser(res.user);
      renderHeaderProfile(currentUserProfile);
      showProfileAlert('Profile information saved successfully! 🎉', 'success');

      // Clear password fields
      document.getElementById('profile-current-password').value = '';
      document.getElementById('profile-new-password').value = '';
      document.getElementById('profile-confirm-password').value = '';

    } catch (err) {
      showProfileAlert(err.message || 'Failed to update profile.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Profile';
      }
    }
  });
}

// Tab Switching (Edit Profile vs Saved Articles)
function switchProfileTab(tabName) {
  const tabEdit = document.getElementById('btn-tab-profile');
  const tabSaved = document.getElementById('btn-tab-saved');
  const secEdit = document.getElementById('section-edit-profile');
  const secSaved = document.getElementById('section-saved-articles');

  if (tabName === 'edit') {
    tabEdit?.classList.add('active');
    tabSaved?.classList.remove('active');
    if (secEdit) secEdit.style.display = 'block';
    if (secSaved) secSaved.style.display = 'none';
  } else {
    tabEdit?.classList.remove('active');
    tabSaved?.classList.add('active');
    if (secEdit) secEdit.style.display = 'none';
    if (secSaved) secSaved.style.display = 'block';
    loadSavedArticles();
  }
}

// Load Saved Articles
async function loadSavedArticles() {
  const listContainer = document.getElementById('saved-articles-list');
  const countBadge = document.getElementById('saved-count-badge');
  const summaryText = document.getElementById('saved-summary-text');

  if (!listContainer) return;

  try {
    const res = await API.request('/api/user/saved-blogs');
    const blogs = res.savedBlogs || [];

    if (countBadge) countBadge.textContent = blogs.length;
    if (summaryText) summaryText.textContent = `${blogs.length} article${blogs.length === 1 ? '' : 's'} saved`;

    if (blogs.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px dashed var(--border);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🔖</div>
          <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem;">No Saved Articles Yet</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.5rem;">
            When you find interesting news or blog stories on TownTalk, click the <strong>Save</strong> button to bookmark them here.
          </p>
          <a href="/" class="btn btn-primary btn-sm">Explore Articles</a>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = blogs.map(b => {
      const cover = b.cover_image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80';
      const cleanSnippet = (b.body || '').replace(/<[^>]*>/g, '').substring(0, 110) + '...';
      return `
        <article class="saved-article-card" id="saved-card-${b.id}">
          <img src="${cover}" alt="${escapeHtml(b.title)}" class="saved-article-thumb">
          <div style="flex: 1; min-width: 0;">
            <h3 style="font-size: 1.05rem; margin-bottom: 0.35rem; line-height: 1.3;">
              <a href="/blog/${b.slug}" style="color: var(--text-primary); text-decoration: none;">
                ${escapeHtml(b.title)}
              </a>
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem; line-height: 1.4;">
              ${escapeHtml(cleanSnippet)}
            </p>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              By ${escapeHtml(b.author_name || 'Author')} • Saved on ${formatDate(b.saved_at)}
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
            <a href="/blog/${b.slug}" class="btn btn-outline btn-sm" style="font-size: 0.8rem;">Read</a>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-remove-saved-${b.id}" onclick="removeSavedArticle(${b.id})" style="font-size: 0.8rem; color: var(--danger-light);" title="Remove bookmark">
              Remove
            </button>
          </div>
        </article>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading saved articles:', err);
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--danger-light);">
        Failed to load saved articles. Please try again.
      </div>
    `;
  }
}

// Remove saved article
async function removeSavedArticle(blogId) {
  try {
    await API.request(`/api/user/saved-blogs/${blogId}`, {
      method: 'DELETE'
    });
    showToast('Article removed from bookmarks.');
    loadSavedArticles();
  } catch (err) {
    showToast(err.message || 'Failed to remove saved article.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await ensureAuthenticated();
  if (!authed) return;

  await loadUserProfile();
  initAvatarUpload();
  initProfileForm();

  // Pre-load saved count
  try {
    const res = await API.request('/api/user/saved-blogs');
    const badge = document.getElementById('saved-count-badge');
    if (badge && res.savedBlogs) badge.textContent = res.savedBlogs.length;
  } catch {
    // Non-critical
  }
});
