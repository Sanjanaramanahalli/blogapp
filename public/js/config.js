/**
 * TownTalk / ApexBlog Frontend Runtime Configuration
 * 
 * When deploying the frontend on Vercel and the backend on Render:
 * Set window.__API_URL__ to your Render backend URL, e.g.:
 * window.__API_URL__ = 'https://your-backend-name.onrender.com';
 * 
 * If left empty '', the frontend makes relative requests to the same origin
 * or uses Vercel rewrites in vercel.json.
 */
(function() {
  const urlParam = new URLSearchParams(window.location.search).get('apiUrl');
  if (urlParam) {
    if (urlParam === 'clear' || urlParam === 'reset') {
      localStorage.removeItem('__blog_api_url__');
    } else {
      localStorage.setItem('__blog_api_url__', urlParam.replace(/\/+$/, ''));
    }
  }
  const isVercel = typeof window !== 'undefined' && window.location && window.location.hostname.endsWith('vercel.app');
  let effectiveApiUrl = '';
  if (urlParam && urlParam !== 'clear' && urlParam !== 'reset') {
    effectiveApiUrl = urlParam.replace(/\/+$/, '');
  } else {
    const stored = localStorage.getItem('__blog_api_url__') || '';
    if (isVercel && (stored.includes('localhost') || stored.includes('127.0.0.1'))) {
      localStorage.removeItem('__blog_api_url__');
      effectiveApiUrl = '';
    } else {
      effectiveApiUrl = stored;
    }
  }
  window.__API_URL__ = window.__API_URL__ || window.VITE_API_URL || (isVercel && !urlParam ? '' : effectiveApiUrl) || '';
})();
