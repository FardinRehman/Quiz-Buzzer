/**
 * QuickBuzz API Base URL Resolver
 * Connects to live Render backend when hosted on GitHub Pages or Vercel,
 * and uses relative paths when running directly on Render or localhost.
 */
const isRemoteFrontend = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('vercel.app')
);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (isRemoteFrontend ? 'https://quiz-buzzer-z8hm.onrender.com' : '')
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
