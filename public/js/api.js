/**
 * API Client & Global Helpers
 * Manages HTTP communications, authentication state, theme toggling, and toasts.
 */

var API_BASE = (typeof window !== 'undefined' && (window.__API_URL__ || window.VITE_API_URL || window.API_BASE_URL)) || '';
if (typeof window !== 'undefined') window.API_BASE = API_BASE;

var API = {
  getBaseUrl() {
    return API_BASE;
  },

  // Base request wrapper
  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.error || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth token persistence
  getToken() {
    return localStorage.getItem('blog_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('blog_token', token);
    } else {
      localStorage.removeItem('blog_token');
    }
  },

  // Cached User State
  getUser() {
    try {
      const u = localStorage.getItem('blog_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('blog_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('blog_user');
    }
  },

  isLoggedIn() {
    return !!this.getUser();
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // Extract token from URL query parameters (e.g. from OAuth redirect)
  extractTokenFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        this.setToken(urlToken);
        params.delete('token');
        const remainingQuery = params.toString();
        const cleanUrl = window.location.pathname + (remainingQuery ? '?' + remainingQuery : '');
        window.history.replaceState(null, '', cleanUrl);
        return urlToken;
      }
    } catch {
      // Ignore URL parsing errors
    }
    return null;
  },

  async checkAuth() {
    this.extractTokenFromUrl();
    const token = this.getToken();
    if (!token) {
      this.setUser(null);
      if (typeof updateNavbarAuth === 'function') updateNavbarAuth();
      return null;
    }

    try {
      const res = await this.request('/api/auth/me');
      if (res && res.user) {
        this.setUser(res.user);
        if (typeof updateNavbarAuth === 'function') updateNavbarAuth();
        return res.user;
      }
    } catch (err) {
      // Only clear credentials if server explicitly returned 401 / 403 unauthorized
      if (err.status === 401 || err.status === 403) {
        this.setToken(null);
        this.setUser(null);
        if (typeof updateNavbarAuth === 'function') updateNavbarAuth();
      }
      // On network errors or offline, retain existing user state if available
      return this.getUser();
    }
    return null;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout network errors
    }
    this.setToken(null);
    this.setUser(null);
    window.location.href = '/';
  }
};

if (typeof window !== 'undefined') {
  window.API = API;
}

// Toast Notifications System
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <div>${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global HTML Escaper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Relative Time Formatter
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (isNaN(diffInSeconds)) return dateString;
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Theme Switcher Logic
function initTheme() {
  const savedTheme = localStorage.getItem('blog_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const toggleBtns = document.querySelectorAll('.theme-toggle');
  toggleBtns.forEach(btn => {
    btn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${savedTheme === 'dark' ? 'light' : 'dark'} mode`);
    btn.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('blog_theme', next);
      toggleBtns.forEach(b => {
        b.innerHTML = next === 'dark' ? '☀️' : '🌙';
      });
    };
  });
}

// Navbar Authentication State Updater
function updateNavbarAuth() {
  const user = API.getUser();
  const navActions = document.getElementById('nav-actions');
  const adminNavTab = document.getElementById('nav-admin-link');
  const writeNavTab = document.getElementById('nav-write-link');

  if (adminNavTab) {
    adminNavTab.style.display = API.isAdmin() ? 'inline-flex' : 'none';
  }
  if (writeNavTab) {
    writeNavTab.style.display = user ? 'inline-flex' : 'none';
    const link = writeNavTab.querySelector('a');
    if (link) link.textContent = 'Publish';
  }

  if (!navActions) return;

  if (user) {
    const initials = user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const avatarHtml = user.avatar_url 
      ? `<img src="${user.avatar_url}" alt="${escapeHtml(user.name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
      : initials;

    const writeBtnHtml = `<a href="/write" class="btn btn-primary btn-sm" id="nav-write-btn" style="display: inline-flex; align-items: center; gap: 0.35rem;">✍️ Publish</a>`;

    navActions.innerHTML = `
      <button class="theme-toggle" title="Toggle Theme">☀️</button>
      ${writeBtnHtml}
      <a href="/profile" class="btn btn-outline btn-sm" id="nav-profile-btn" style="display: inline-flex; align-items: center; gap: 0.35rem;">👤 Profile</a>
      <div class="user-menu">
        <a href="/profile" style="text-decoration: none;">
          <div class="user-avatar" title="${escapeHtml(user.name)}" style="overflow: hidden;">${avatarHtml}</div>
        </a>
        <span class="role-badge role-${user.role}">${user.role}</span>
        <button id="btn-logout" class="btn btn-outline btn-sm" title="Log out">Sign out</button>
      </div>
    `;

    document.getElementById('btn-logout').onclick = () => API.logout();
  } else {
    navActions.innerHTML = `
      <button class="theme-toggle" title="Toggle Theme">☀️</button>
      <a href="/login" class="btn btn-outline btn-sm">Sign in</a>
      <a href="/register" class="btn btn-primary btn-sm">Sign up</a>
    `;
  }

  initTheme();
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await API.checkAuth();
  updateNavbarAuth();
});
