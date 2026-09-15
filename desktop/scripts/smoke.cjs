const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
const executablePath = process.env.PLAYCREW_TEST_EXECUTABLE || path.join(root, 'dist/win-unpacked/PlayCrew.exe');
const profile = path.join(results, `profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const checks = [];
const env = { ...process.env, PLAYCREW_DESKTOP_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };

async function launch() {
  desktop = await electron.launch({ executablePath, env, timeout: 60000 });
  const page = await desktop.firstWindow();
  page.on('pageerror', (error) => console.error('PAGE ERROR', error.message));
  page.setDefaultTimeout(20000);
  await page.waitForURL('https://playcrew.vercel.app/**', { timeout: 60000, waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  return page;
}

(async () => {
  let page = await launch();
  await page.getByRole('button', { name: 'Maximize window', exact: true }).click();
  await page.getByRole('button', { name: 'Restore window', exact: true }).waitFor();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
  await page.getByRole('button', { name: 'Restore window', exact: true }).click();
  await page.getByRole('button', { name: 'Maximize window', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Minimize window', exact: true }).click();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  pass('bundled minimize and maximize/restore controls work on the live site');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.getByRole('heading', { name: 'Log in to PlayCrew' }).waitFor();
  await page.getByPlaceholder('you@example.com').fill('desktop-check@example.invalid');
  assert.equal(await page.getByPlaceholder('you@example.com').inputValue(), 'desktop-check@example.invalid');
  await page.getByPlaceholder('you@example.com').clear();
  await page.screenshot({ path: path.join(results, 'desktop-login.png'), animations: 'disabled' });
  pass('live login button opens a usable email/password form (no credentials submitted)');
  await page.getByRole('button', { name: 'Close auth modal', exact: true }).click();
  await page.getByRole('heading', { name: 'Log in to PlayCrew' }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Library', exact: true }).waitFor();
  await page.screenshot({ path: path.join(results, 'desktop-live.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  console.log('Library click dispatched', page.url());
  await page.waitForURL('https://playcrew.vercel.app/games', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('nav #playcrew-desktop-controls').waitFor();
  await page.screenshot({ path: path.join(results, 'desktop-navbar.png'), animations: 'disabled' });
  pass('live Library button navigates inside the desktop window');
  console.log('LIVE PAGE', (await page.locator('body').innerText()).slice(0, 1400));
  pass('packaged executable loads production site without a local server');
  const prefs = await desktop.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity };
  });
  assert.deepEqual(prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  pass('remote page is sandboxed with no Node access');

  // Exercise native browser capabilities with a controlled response at the app origin.
  // No real account or production data is created or changed.
  await desktop.context().route('https://playcrew.vercel.app/desktop-test', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Desktop checks</title><nav class="navbar-top-shell">Top navigation</nav><nav class="navbar-sidebar-shell" style="display:none">Sidebar</nav><h1>Desktop checks</h1><input type="file" aria-label="Upload"><audio id="music" loop></audio><button id="play">Play</button>'
  }));
  await page.goto('https://playcrew.vercel.app/desktop-test');
  await page.locator('.navbar-top-shell #playcrew-desktop-controls').waitFor();
  await page.evaluate(() => {
    document.querySelector('.navbar-top-shell').style.display = 'none';
    document.querySelector('.navbar-sidebar-shell').style.display = 'flex';
    document.documentElement.dataset.navbarLayout = 'sidebar';
  });
  await page.locator('.navbar-sidebar-shell #playcrew-desktop-controls').waitFor();
  pass('desktop controls follow top-navbar and sidebar layout changes');
  await page.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('test-upload') });
  assert.equal(await page.locator('input').evaluate((input) => input.files[0].name), 'cover.png');
  pass('file input accepts a local cover selection');
  await page.evaluate(() => {
    const bytes = new Uint8Array(44 + 8000);
    const view = new DataView(bytes.buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, 'data'); view.setUint32(40, 8000, true); bytes.fill(128, 44);
    const audio = document.querySelector('audio');
    audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    document.querySelector('#play').onclick = () => audio.play();
    localStorage.setItem('desktop-persistence-check', 'retained');
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > 0);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  assert.equal(await page.locator('audio').evaluate((audio) => audio.paused), false);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  pass('audio starts from a button and remains playing when minimized');
  await page.getByRole('button', { name: 'Close to tray', exact: true }).click();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  assert.equal(await page.locator('audio').evaluate((audio) => audio.paused), false);
  await desktop.evaluate(({ app }) => {
    const menu = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs').getTrayMenu();
    menu.items.find((item) => item.label === 'Open PlayCrew').click();
  });
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  pass('music continues in tray and Open PlayCrew restores the window');

  await desktop.evaluate(({ shell }) => {
    globalThis.openedLinks = [];
    shell.openExternal = async (url) => { globalThis.openedLinks.push(url); };
  });
  await page.evaluate(() => window.open('https://example.com/game'));
  assert.deepEqual(await desktop.evaluate(() => globalThis.openedLinks), ['https://example.com/game']);
  assert.equal(desktop.windows().length, 1);
  pass('external links go to the browser without creating privileged windows');

  await desktop.context().unrouteAll();
  await desktop.evaluate(({ session }) => {
    session.fromPartition('persist:playcrew').webRequest.onBeforeRequest({ urls: ['https://playcrew.vercel.app/*'] }, (_details, callback) => callback({ cancel: true }));
  });
  await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  await page.getByRole('link', { name: 'Try again' }).waitFor();
  assert.ok(page.url().endsWith('/offline.html'));
  await page.getByRole('button', { name: 'Maximize window', exact: true }).click();
  await page.getByRole('button', { name: 'Restore window', exact: true }).click();
  pass('window controls remain usable on the offline screen');
  await page.screenshot({ path: path.join(results, 'desktop-offline.png') });
  pass('connection failure shows a useful reconnect screen');
  await desktop.evaluate(({ session }) => session.fromPartition('persist:playcrew').webRequest.onBeforeRequest(null));
  await page.getByRole('link', { name: 'Try again' }).click();
  await page.waitForURL('https://playcrew.vercel.app/**', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  pass('retry returns to the live site');
  await desktop.close();
  desktop = null;
  page = await launch();
  assert.equal(await page.evaluate(() => localStorage.getItem('desktop-persistence-check')), 'retained');
  pass('site storage survives restarting the packaged app');
  await page.getByRole('button', { name: 'Close to tray', exact: true }).click();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  await desktop.evaluate(({ app }) => process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs').getTray().emit('click'));
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  pass('close hides to tray and clicking the tray icon restores the window');
  const closed = desktop.waitForEvent('close');
  await desktop.evaluate(({ app }) => {
    const menu = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs').getTrayMenu();
    setTimeout(() => menu.items.find((item) => item.label === 'Quit PlayCrew').click(), 50);
  });
  await closed;
  desktop = null;
  pass('Quit PlayCrew exits completely');
  fs.writeFileSync(path.join(results, 'smoke-report.json'), JSON.stringify({ executablePath, checks }, null, 2));
})().catch(async (error) => {
  console.error(error);
  if (desktop) {
    const page = desktop.windows()[0];
    if (page) {
      console.error('FAILED PAGE', page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 1200));
      await page.screenshot({ path: path.join(results, 'desktop-failure.png'), timeout: 5000 }).catch(() => {});
    }
  }
  if (desktop) await desktop.close().catch(() => {});
  process.exitCode = 1;
});
