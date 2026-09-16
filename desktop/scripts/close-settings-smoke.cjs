const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const profile = path.resolve(__dirname, `../test-results/close-settings-${Date.now()}`);
  const env = { ...process.env, PLAYCREW_DESKTOP_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const firstRun of [true, false]) {
    const desktop = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..'), '--host-resolver-rules=MAP playcrew.vercel.app ~NOTFOUND'], env });
    try {
      const page = await require('./wait-main-window.cjs')(desktop);
      await page.getByRole('link', { name: 'Try again' }).waitFor();
      await page.route('https://playcrew.vercel.app/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body>Settings test</body></html>' }));
      await page.goto('https://playcrew.vercel.app/settings');
      assert.equal(await page.evaluate(() => window.playcrewDesktop.getCloseBehavior()), firstRun ? 'tray' : 'quit');
      if (firstRun) {
        assert.equal(await page.evaluate(() => window.playcrewDesktop.setCloseBehavior('quit')), 'quit');
        await assert.rejects(page.evaluate(() => window.playcrewDesktop.setCloseBehavior('invalid')));
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'desktop-settings.json'), 'utf8')).closeBehavior, 'quit');
      }
      const closed = desktop.waitForEvent('close');
      await page.getByRole('button', { name: 'Close PlayCrew', exact: true }).click();
      await closed;
      console.log(`PASS ${firstRun ? 'Save close preference and quit' : 'Restore preference after restart and quit'}`);
    } finally { await desktop.close().catch(() => {}); }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
