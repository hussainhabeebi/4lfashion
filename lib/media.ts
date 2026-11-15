// Small versions of product photos for cards, rails and thumbnails.
// Store uploads: /api/media/<key>?w=640 serves a 640px WebP made at upload time
// (or the original until one exists). Unsplash sample photos are resized by Unsplash.
export const THUMB_WIDTH = 640;
export function thumb(url?: string) {
  const u = String(url || '');
  if (/^\/api\/media\/[a-f0-9-]{36}$/.test(u)) return u + '?w=' + THUMB_WIDTH;
  if (u.startsWith('https://images.unsplash.com/')) return u.replace(/([?&])w=\d+/, '$1w=' + THUMB_WIDTH);
  return u;
}
