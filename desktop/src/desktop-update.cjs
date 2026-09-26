const desktopReleaseTagPattern = /^(?:desktop-v|v)?(\d+\.\d+\.\d+)$/;

function parseDesktopReleaseVersion(value) {
  return typeof value === 'string' ? desktopReleaseTagPattern.exec(value)?.[1] || null : null;
}

module.exports = { desktopReleaseTagPattern, parseDesktopReleaseVersion };
