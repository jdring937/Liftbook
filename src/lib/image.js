// Resize images on the device before storing them
export async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  try { await img.decode(); } catch (e) { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }); }
  return img;
}
export function canvasBlob(canvas, quality = 0.85) {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality));
}
// Draw any source (img, video, canvas) into a box no larger than max on its long side,
// optionally cropping to an aspect ratio (w/h) from the centre and mirroring.
export function drawScaled(source, sw, sh, { max = 1440, aspect = null, mirror = false } = {}) {
  let cx = 0, cy = 0, cw = sw, ch = sh;
  if (aspect) {
    if (sw / sh > aspect) { cw = sh * aspect; cx = (sw - cw) / 2; } else { ch = sw / aspect; cy = (sh - ch) / 2; }
  }
  const scale = Math.min(1, max / Math.max(cw, ch));
  const c = document.createElement('canvas');
  c.width = Math.round(cw * scale); c.height = Math.round(ch * scale);
  const g = c.getContext('2d');
  if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(source, cx, cy, cw, ch, 0, 0, c.width, c.height);
  return c;
}
export async function makeVersions(canvas) {
  const full = await canvasBlob(canvas, 0.85);
  const tc = drawScaled(canvas, canvas.width, canvas.height, { max: 360 });
  const thumb = await canvasBlob(tc, 0.78);
  return { full, thumb, w: canvas.width, h: canvas.height };
}
