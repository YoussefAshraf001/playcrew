const APP_URL = 'https://playcrew.vercel.app';
function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}
function isAppUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && url.origin === APP_URL && !url.username && !url.password);
}
function isExternalUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password);
}
function canGrantPermission(permission, origin) {
  return isAppUrl(origin) && ['fullscreen', 'clipboard-sanitized-write'].includes(permission);
}
module.exports = { APP_URL, isAppUrl, isExternalUrl, canGrantPermission };
