/**
 * QuickBuzz API Base URL Resolver
 * Allows seamless switching between relative URLs (local dev or reverse proxy)
 * and external backend URLs (when frontend is deployed to Vercel and backend to Render/Railway).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
