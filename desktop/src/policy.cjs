const PRODUCTION_APP_URL = 'https://playcrew.vercel.app';
function localDevelopmentUrl(value) {
  try {
    const url = new URL(value);
    const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return url.protocol === 'http:' && localHost && !url.username && !url.password
      ? url.origin
      : null;
  } catch { return null; }
}
const APP_URL = localDevelopmentUrl(process.env.PLAYCREW_DESKTOP_URL) || PRODUCTION_APP_URL;
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
