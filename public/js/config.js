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
    localStorage.setItem('__blog_api_url__', urlParam.replace(/\/+$/, ''));
  }
  const storedApiUrl = localStorage.getItem('__blog_api_url__') || '';
  window.__API_URL__ = window.__API_URL__ || window.VITE_API_URL || storedApiUrl || '';
})();
