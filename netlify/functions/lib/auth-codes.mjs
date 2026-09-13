/* Legacy credentials stay valid. This module must never enter a browser bundle. */
const SECRET = 'gehstock:hideout:2026:kellergewoelbe';
function hash(text) {
  let h = 0x811c9dc5;
  for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  return h;
}
export function roleForCode(code) {
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) return null;
  const h = hash('code:' + code + ':' + SECRET);
  return h % 97 === 0 ? ['S', 'K', 'A'][Math.floor(h / 97) % 3] : null;
}
export const legacyCodes = Array.from({ length: 10000 }, (_, n) => String(n).padStart(4, '0')).filter(roleForCode);
export const serviceKey = code => String(hash('bnd:' + code + ':' + SECRET) % 1000000).padStart(6, '0');
export function serviceLabel(code) {
  let h = hash('kennung:' + code + ':' + SECRET), label = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 4; i++) { label += chars[h % chars.length]; h = Math.floor(h / chars.length); }
  return label.slice(0, 2) + '-' + label.slice(2);
}
