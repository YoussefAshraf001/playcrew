const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDesktopReleaseVersion } = require('../src/desktop-update.cjs');

test('accepts current and legacy PlayCrew desktop release tags', () => {
  assert.equal(parseDesktopReleaseVersion('0.1.17'), '0.1.17');
  assert.equal(parseDesktopReleaseVersion('v0.1.17'), '0.1.17');
  assert.equal(parseDesktopReleaseVersion('desktop-v0.1.17'), '0.1.17');
});

test('rejects malformed and prerelease desktop tags', () => {
  for (const value of ['desktop-0.1.17', '0.1', '0.1.17-beta', '', null]) {
    assert.equal(parseDesktopReleaseVersion(value), null, String(value));
  }
});
