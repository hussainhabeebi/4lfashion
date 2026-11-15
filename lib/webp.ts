// Converts a photo to WebP in the browser before it is uploaded, scaling it down so the
// longest side is at most `max` pixels. Smaller, modern files make the storefront load faster.
// If the browser cannot encode WebP, the original file is returned unchanged.
export async function toWebp(file: Blob, name = 'photo', max = 1600, quality = 0.82): Promise<File> {
  const original = file instanceof File ? file : new File([file], name, {type: file.type});
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return original;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return original; }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return original; }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', quality));
  // Safari versions without WebP encoding silently return PNG: keep the original then.
  if (!blob || blob.type !== 'image/webp') return original;
  if (file.type === 'image/webp' && blob.size >= file.size && scale === 1) return original;
  return new File([blob], name.replace(/\.[a-z0-9]+$/i, '') + '.webp', {type: 'image/webp'});
}
