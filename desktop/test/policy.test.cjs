const { test } = require('node:test');
const assert = require('node:assert/strict');
const { APP_URL, isAppUrl, isExternalUrl, canGrantPermission } = require('../src/policy.cjs');
test('uses the production application by default', () => {
  assert.equal(APP_URL, 'https://playcrew.vercel.app');
});
test('only production PlayCrew pages can navigate within the app', () => {
  assert.equal(isAppUrl(`${APP_URL}/game/123?tab=review`), true);
  for (const url of ['http://playcrew.vercel.app', 'https://playcrew.vercel.app.evil.test', 'https://evil.test/?url=' + APP_URL, 'https://user:pass@playcrew.vercel.app', 'file:///etc/passwd', 'javascript:alert(1)', 'not a URL']) assert.equal(isAppUrl(url), false, url);
});
test('external links cannot launch scripts, local files, or arbitrary protocols', () => {
  for (const url of ['https://store.steampowered.com/app/1', 'http://example.com', 'mailto:help@example.com']) assert.equal(isExternalUrl(url), true);
  for (const url of ['javascript:alert(1)', 'file:///C:/Windows/System32/cmd.exe', 'powershell:hello', 'data:text/html,hello', 'https://user:password@example.com', 'invalid']) assert.equal(isExternalUrl(url), false);
});
test('sensitive permissions are denied and trusted fullscreen remains available', () => {
  assert.equal(canGrantPermission('fullscreen', APP_URL), true);
  assert.equal(canGrantPermission('clipboard-sanitized-write', `${APP_URL}/games`), true);
  for (const permission of ['media', 'geolocation', 'clipboard-read', 'notifications', 'unknown']) assert.equal(canGrantPermission(permission, APP_URL), false);
  assert.equal(canGrantPermission('fullscreen', 'https://example.com'), false);
});
