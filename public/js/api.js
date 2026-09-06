/**
 * API Client & Global Helpers
 * Manages HTTP communications, authentication state, theme toggling, and toasts.
 */

const API = {
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

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
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

  async checkAuth() {
    const token = this.getToken();
    if (!token) {
      this.setUser(null);
      return null;
    }
    try {
      const res = await this.request('/api/auth/me');
      if (res.user) {
        this.setUser(res.user);
        return res.user;
      } else {
        this.setToken(null);
        this.setUser(null);
        return null;
      }
    } catch {
      this.setToken(null);
      this.setUser(null);
      return null;
    }
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

  if (adminNavTab) {
    adminNavTab.style.display = API.isAdmin() ? 'inline-flex' : 'none';
  }

  if (!navActions) return;

  if (user) {
    const initials = user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    navActions.innerHTML = `
      <button class="theme-toggle" title="Toggle Theme">☀️</button>
      <div class="user-menu">
        <div class="user-avatar" title="${escapeHtml(user.name)}">${initials}</div>
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
