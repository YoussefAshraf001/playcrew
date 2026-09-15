const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const profile = path.resolve(__dirname, `../test-results/tray-profile-${Date.now()}`);
  fs.mkdirSync(profile, { recursive: true });
  const env = { ...process.env, PLAYCREW_DESKTOP_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await electron.launch({
    executablePath: path.resolve(__dirname, '../dist/win-unpacked/PlayCrew.exe'),
    // Keep lifecycle tests deterministic and independent of production latency.
    args: ['--host-resolver-rules=MAP playcrew.vercel.app ~NOTFOUND'],
    env
  });
  try {
    const page = await desktop.firstWindow();
    await page.getByRole('link', { name: 'Try again' }).waitFor();
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.textContent = 'Start test audio';
      button.onclick = async () => {
        window.testAudio = new AudioContext();
        const tone = window.testAudio.createOscillator();
        const gain = window.testAudio.createGain();
        gain.gain.value = 0;
        tone.connect(gain).connect(window.testAudio.destination);
        tone.start();
        await window.testAudio.resume();
      };
      document.body.append(button);
    });
    await page.getByRole('button', { name: 'Start test audio' }).click();
    await page.getByRole('button', { name: 'Close to tray' }).click();
    await desktop.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1800)));
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    assert.equal(await page.evaluate(() => window.testAudio.state), 'running');
    console.log('PASS Close hides to tray, stays hidden, and keeps audio running');
    await desktop.evaluate(({ app }) => {
      const runtime = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs');
      runtime.getTray().emit('click');
    });
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
    console.log('PASS Tray icon restores the existing window');
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await desktop.evaluate(({ app }) => {
      const menu = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs').getTrayMenu();
      menu.items.find((item) => item.label === 'Open PlayCrew').click();
    });
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
    console.log('PASS Native close hides and Open PlayCrew restores');
    const closed = desktop.waitForEvent('close');
    await desktop.evaluate(({ app }) => {
      const menu = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')('./src/main.cjs').getTrayMenu();
      setTimeout(() => menu.items.find((item) => item.label === 'Quit PlayCrew').click(), 50);
    });
    await closed;
    console.log('PASS Quit PlayCrew exits completely');
  } finally {
    await desktop.close().catch(() => {});
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
