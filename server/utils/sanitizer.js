/**
 * Lightweight HTML Sanitizer for Serverless environments
 * Strips script tags, javascript: URIs, on* event handlers, and dangerous iframe/object tags.
 */

function sanitize(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove dangerous embed tags
    .replace(/<(iframe|object|embed|applet|meta|link|base)[^>]*>/gi, '')
    // Remove inline event handlers (e.g. onclick=, onerror=, onload=)
    .replace(/ on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '')
    // Remove javascript: and vbscript: URIs
    .replace(/(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript|data):[^"']*["']/gi, (match) => {
      // allow safe data:image/ images
      if (/data:image\//i.test(match)) return match;
      return 'href="#"';
    });
}

module.exports = sanitize;
