const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain, Tray, protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { APP_URL, isAppUrl, isExternalUrl, canGrantPermission } = require('./policy.cjs');
const { findPlaytimeUrl } = require('./playnite-integration.cjs');
const { desktopReleaseTagPattern, parseDesktopReleaseVersion } = require('./desktop-update.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'playcrew-local', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

// Automated checks use an isolated profile, without touching real accounts.
if (process.env.PLAYCREW_DESKTOP_PROFILE) {
  app.setPath('userData', path.resolve(process.env.PLAYCREW_DESKTOP_PROFILE));
}
app.setAppUserModelId('app.playcrew.desktop');
let mainWindow;
let startupWindow;
let startupTimer;
function finishStartup() {
  clearTimeout(startupTimer);
  if (startupWindow && !startupWindow.isDestroyed()) startupWindow.destroy();
  startupWindow = null;
  if (!quitting && !hiddenToTray && mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
}
let tray;
let trayMenu;
let quitting = false;
let hiddenToTray = false;
let offline = false;
let closeBehavior = 'tray';
const settingsFile = path.join(app.getPath('userData'), 'desktop-settings.json');
const localImagesRoot = path.join(app.getPath('userData'), 'images');
const imageStorageDefaults = { profileImage: false, wallpaper: false, customGameCovers: false, screenshots: false };
const cloudCopyDefaults = { profileImage: true, wallpaper: true, customGameCovers: true, screenshots: true };
const desktopReleasesUrl = 'https://api.github.com/repos/YoussefAshraf001/playcrew/releases?per_page=20';
const trustedUpdateHosts = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);
let updateDownloadActive = false;
const pendingPlaytimeEvents = [];
const deliveredPlaytimeEventIds = new Set();
const compareVersions = (left, right) => {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
};
function readDesktopSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return {}; }
}
function writeDesktopSettings(patch) {
  const next = { ...readDesktopSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2));
  return next;
}
try {
  if (readDesktopSettings().closeBehavior === 'quit') closeBehavior = 'quit';
} catch { /* Default to tray on first launch. */ }
const offlineFile = path.join(__dirname, 'offline.html');
const controlsCss = fs.readFileSync(path.join(__dirname, 'window-controls.css'), 'utf8');

function showMainWindow() {
  hiddenToTray = false;
  if (startupWindow && !startupWindow.isDestroyed()) { startupWindow.show(); startupWindow.focus(); return; }
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function queuePlaytimeEvent(payload) {
  if (!payload) return;
  const dedupeKey = payload.eventId || `${payload.gameId}:${payload.gameName}:${payload.elapsedSeconds}`;
  if (deliveredPlaytimeEventIds.has(dedupeKey)) return;
  deliveredPlaytimeEventIds.add(dedupeKey);
  if (deliveredPlaytimeEventIds.size > 100) deliveredPlaytimeEventIds.delete(deliveredPlaytimeEventIds.values().next().value);
  pendingPlaytimeEvents.push(payload);
  if (pendingPlaytimeEvents.length > 20) pendingPlaytimeEvents.shift();
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
    // Keep the event queued until the renderer explicitly consumes it. IPC
    // messages sent while React is mounting have no delivery acknowledgement.
    mainWindow.webContents.send('playcrew:playtime-logged', payload);
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/icon.ico'));
  tray.setToolTip('PlayCrew — running in the background');
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open PlayCrew', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit PlayCrew', click: () => app.quit() }
  ]);
  tray.setContextMenu(trayMenu);
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

// Main-process access for integration tests; never exposed to the web page.
module.exports = { getTray: () => tray, getTrayMenu: () => trayMenu };

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('playcrew:window-state', {
    maximized: mainWindow.isMaximized(), fullscreen: mainWindow.isFullScreen(), closeBehavior
  });
}

function openExternal(url) {
  if (isExternalUrl(url)) void shell.openExternal(url).catch((error) => console.error('Cannot open link:', error.message));
}
function loadApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  offline = false;
  void mainWindow.loadURL(APP_URL).catch(showOffline);
}
function showOffline() {
  if (!mainWindow || mainWindow.isDestroyed() || offline) return;
  offline = true;
  void mainWindow.loadFile(offlineFile).catch((error) => { console.error(error.message); finishStartup(); });
}
function createWindow() {
  let state = {};
  const stateFile = path.join(app.getPath('userData'), 'window.json');
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* First launch. */ }
  mainWindow = new BrowserWindow({
    title: 'PlayCrew',
    frame: false,
    width: Number.isFinite(state.width) ? Math.min(2560, Math.max(900, state.width)) : 1440,
    height: Number.isFinite(state.height) ? Math.min(1600, Math.max(650, state.height)) : 960,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#080b10',
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:playcrew',
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: true,
      // Let Chromium idle hidden/minimized UI while background audio continues.
      backgroundThrottling: true
    }
  });
  if (state.maximized) mainWindow.maximize();
  const contents = mainWindow.webContents;
  contents.on('dom-ready', () => {
    if (isAppUrl(contents.getURL()) || contents.getURL() === pathToFileURL(offlineFile).href) {
      void contents.insertCSS(controlsCss).catch((error) => console.error(error.message));
      sendWindowState();
    }
  });
  for (const event of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) mainWindow.on(event, sendWindowState);
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) void mainWindow.loadURL(url).catch(showOffline);
    else openExternal(url);
    return { action: 'deny' };
  });
  const guardNavigation = (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); openExternal(url); }
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) showOffline();
  });
  contents.on('did-finish-load', () => { offline = !isAppUrl(contents.getURL()); if (startupWindow) finishStartup(); });
  contents.on('render-process-gone', showOffline);
  mainWindow.on('session-end', () => { quitting = true; });
  mainWindow.on('close', (event) => {
    const bounds = mainWindow.getNormalBounds();
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({ width: bounds.width, height: bounds.height, maximized: mainWindow.isMaximized() }));
    } catch (error) { console.error('Cannot save window size:', error.message); }
    if (!quitting && closeBehavior === 'quit') {
      event.preventDefault();
      app.quit();
      return;
    }
    if (!quitting && tray && !tray.isDestroyed()) {
      event.preventDefault();
      hiddenToTray = true;
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  startupWindow = new BrowserWindow({
    title: 'Starting PlayCrew', width: 460, height: 280, resizable: false,
    maximizable: false, minimizable: false, autoHideMenuBar: true,
    frame: false, show: false, transparent: true,
    backgroundColor: '#00000000', icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  startupWindow.setMenu(null);
  startupWindow.once('ready-to-show', () => {
    if (!startupWindow || startupWindow.isDestroyed()) return;
    startupWindow.show();
  });
  startupWindow.on('close', () => { if (!quitting) app.quit(); });
  void startupWindow.loadFile(path.join(__dirname, 'startup.html')).catch(finishStartup);
  // Slow or unreachable servers lead to the reconnect screen, never an endless splash.
  startupTimer = setTimeout(showOffline, 20000);
  startupTimer.unref();
  loadApp();
}

if (process.platform === 'win32') {
  // Register before checking the single-instance lock. This lets a newly
  // launched development process repair a stale handler even when an older
  // PlayCrew/Electron instance is still running.
  if (process.defaultApp && process.argv[1]) {
    const appEntry = path.resolve(process.argv[1]);
    // Electron considers the executable alone to be a different registration
    // from the executable + app entry, so explicitly remove the old form.
    app.removeAsDefaultProtocolClient('playcrew', process.execPath, []);
    if (!app.setAsDefaultProtocolClient('playcrew', process.execPath, [appEntry])) {
      console.error('Could not register the playcrew:// development protocol handler');
    }
  } else {
    if (!app.setAsDefaultProtocolClient('playcrew')) {
      console.error('Could not register the playcrew:// protocol handler');
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('before-quit', () => {
    quitting = true;
    clearTimeout(startupTimer);
  });
  app.on('will-quit', () => { if (tray && !tray.isDestroyed()) tray.destroy(); });
  app.on('second-instance', (_event, argv) => {
    const payload = findPlaytimeUrl(argv);
    if (!app.isPackaged) console.log('[PlayCrew Playnite] protocol received:', payload || argv.find((value) => typeof value === 'string' && value.startsWith('playcrew:')) || 'no URL');
    queuePlaytimeEvent(payload);
    showMainWindow();
  });
  app.whenReady().then(() => {
    const startupPayload = findPlaytimeUrl(process.argv);
    if (!app.isPackaged && process.argv.some((value) => typeof value === 'string' && value.startsWith('playcrew:'))) console.log('[PlayCrew Playnite] startup protocol:', startupPayload || 'rejected');
    queuePlaytimeEvent(startupPayload);
    protocol.handle('playcrew-local', (request) => {
      const parsed = new URL(request.url);
      const relative = decodeURIComponent(`${parsed.hostname}${parsed.pathname}`).replace(/^[/\\]+/, '');
      const target = path.resolve(localImagesRoot, relative);
      const root = path.resolve(localImagesRoot) + path.sep;
      if (!target.startsWith(root)) return new Response('Not found', { status: 404 });
      try {
        const extension = path.extname(target).toLowerCase();
        const contentType = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[extension];
        if (!contentType) return new Response('Unsupported image', { status: 415 });
        return new Response(fs.readFileSync(target), {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': APP_URL
          }
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    ipcMain.handle('playcrew:close-behavior', (event, value) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || !isAppUrl(event.senderFrame.url)) throw new Error('Untrusted settings request');
      if (value !== undefined) {
        if (value !== 'tray' && value !== 'quit') throw new Error('Invalid close behavior');
        writeDesktopSettings({ closeBehavior: value });
        closeBehavior = value;
        sendWindowState();
      }
      return closeBehavior;
    });
    ipcMain.handle('playcrew:take-playtime-event', (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || !isAppUrl(event.senderFrame.url)) throw new Error('Untrusted integration request');
      return pendingPlaytimeEvents.shift() || null;
    });
    const assertTrusted = (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || !isAppUrl(event.senderFrame.url)) throw new Error('Untrusted settings request');
    };
    ipcMain.handle('playcrew:version', (event) => {
      assertTrusted(event);
      return app.getVersion();
    });
    ipcMain.handle('playcrew:image-storage-settings', (event, value) => {
      assertTrusted(event);
      if (value === undefined) return { ...imageStorageDefaults, ...(readDesktopSettings().imageStorage || {}) };
      const next = {};
      for (const key of Object.keys(imageStorageDefaults)) next[key] = value?.[key] === true;
      writeDesktopSettings({ imageStorage: next });
      return next;
    });
    ipcMain.handle('playcrew:cloud-copy-settings', (event, value) => {
      assertTrusted(event);
      if (value === undefined) return { ...cloudCopyDefaults, ...(readDesktopSettings().cloudCopies || {}) };
      const next = {};
      for (const key of Object.keys(cloudCopyDefaults)) next[key] = value?.[key] !== false;
      writeDesktopSettings({ cloudCopies: next });
      return next;
    });
    ipcMain.handle('playcrew:check-for-update', async (event) => {
      assertTrusted(event);
      const response = await net.fetch(desktopReleasesUrl, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PlayCrew-Desktop' }
      });
      if (!response.ok) throw new Error(`GitHub update check failed (${response.status})`);
      const releases = await response.json();
      const release = Array.isArray(releases)
        ? releases.find((item) => !item?.draft && !item?.prerelease && desktopReleaseTagPattern.test(item?.tag_name || ''))
        : null;
      if (!release) throw new Error('No PlayCrew Desktop release was found');
      const latestVersion = parseDesktopReleaseVersion(release.tag_name);
      if (!latestVersion) throw new Error('Invalid PlayCrew Desktop release tag');
      const installer = Array.isArray(release.assets)
        ? release.assets.find((asset) => /^PlayCrew-Setup-.*-x64\.exe$/i.test(asset?.name || ''))
        : null;
      if (!installer?.browser_download_url) throw new Error('The desktop installer is not attached to this release');
      return {
        currentVersion: app.getVersion(),
        latestVersion,
        updateAvailable: compareVersions(latestVersion, app.getVersion()) > 0,
        downloadUrl: installer.browser_download_url
      };
    });
    ipcMain.handle('playcrew:open-update-download', async (event, value) => {
      assertTrusted(event);
      const url = typeof value === 'string' ? new URL(value) : null;
      if (!url || url.protocol !== 'https:' || !['github.com', 'objects.githubusercontent.com'].includes(url.hostname)) throw new Error('Invalid update URL');
      await shell.openExternal(url.href);
      return true;
    });
    ipcMain.handle('playcrew:install-update', async (event, value) => {
      assertTrusted(event);
      if (updateDownloadActive) throw new Error('An update is already downloading');
      const requestedUrl = typeof value?.downloadUrl === 'string' ? new URL(value.downloadUrl) : null;
      const version = typeof value?.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version) ? value.version : null;
      if (!requestedUrl || requestedUrl.protocol !== 'https:' || !trustedUpdateHosts.has(requestedUrl.hostname) || !version || !/^PlayCrew-Setup-.*-x64\.exe$/i.test(path.basename(requestedUrl.pathname))) throw new Error('Invalid update installer');
      updateDownloadActive = true;
      const installerPath = path.join(app.getPath('temp'), `PlayCrew-Setup-${version}-x64.exe`);
      const sendProgress = (payload) => {
        if (!mainWindow?.isDestroyed()) mainWindow.webContents.send('playcrew:update-progress', payload);
      };
      try {
        sendProgress({ status: 'downloading', percent: 0, transferred: 0, total: 0 });
        const response = await net.fetch(requestedUrl.href, {
          headers: { Accept: 'application/octet-stream', 'User-Agent': 'PlayCrew-Desktop' }
        });
        if (!response.ok || !response.body) throw new Error(`Update download failed (${response.status})`);
        const total = Number(response.headers.get('content-length')) || 0;
        const writer = fs.createWriteStream(installerPath);
        const reader = response.body.getReader();
        let transferred = 0;
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          const buffer = Buffer.from(chunk);
          transferred += buffer.length;
          if (!writer.write(buffer)) await once(writer, 'drain');
          sendProgress({
            status: 'downloading',
            percent: total ? Math.min(100, Math.round((transferred / total) * 100)) : null,
            transferred,
            total
          });
        }
        writer.end();
        await once(writer, 'finish');
        sendProgress({ status: 'installing', percent: 100, transferred, total });
        const installer = spawn(installerPath, ['--updated', '/S', '--force-run'], {
          detached: true,
          stdio: 'ignore'
        });
        installer.unref();
        quitting = true;
        setTimeout(() => app.quit(), 700).unref();
        return true;
      } catch (error) {
        try { fs.unlinkSync(installerPath); } catch { /* Missing partial file is fine. */ }
        sendProgress({ status: 'error', message: error.message });
        throw error;
      } finally {
        updateDownloadActive = false;
      }
    });
    ipcMain.handle('playcrew:open-local-images', async (event) => {
      assertTrusted(event);
      fs.mkdirSync(localImagesRoot, { recursive: true });
      const error = await shell.openPath(localImagesRoot);
      if (error) await shell.openExternal(pathToFileURL(localImagesRoot).href);
    });
    const saveLocalImage = (category, pathSegments, dataUrl) => {
      if (!Object.keys(imageStorageDefaults).includes(category)) throw new Error('Invalid image category');
      if (!Array.isArray(pathSegments) || pathSegments.length < 2 || pathSegments.length > 6 || pathSegments.some((segment) => typeof segment !== 'string' || !/^[^<>:"/\\|?*\x00-\x1F]{1,120}$/.test(segment) || /[. ]$/.test(segment))) throw new Error('Invalid image path');
      const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!match) throw new Error('Unsupported image data');
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error('Image must be 30 MB or smaller');
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[match[1]];
      const directory = path.join(localImagesRoot, ...pathSegments.slice(0, -1));
      const key = pathSegments.at(-1);
      fs.mkdirSync(directory, { recursive: true });
      for (const oldExt of ['jpg', 'png', 'webp', 'gif']) {
        if (oldExt !== ext) try { fs.unlinkSync(path.join(directory, `${key}.${oldExt}`)); } catch { /* Missing is fine. */ }
      }
      fs.writeFileSync(path.join(directory, `${key}.${ext}`), bytes);
      const relative = [...pathSegments.slice(0, -1), `${key}.${ext}`].map(encodeURIComponent).join('/');
      return `playcrew-local://${relative}?v=${Date.now()}`;
    };
    ipcMain.handle('playcrew:save-local-image-to-path', (event, category, pathSegments, dataUrl) => {
      assertTrusted(event);
      return saveLocalImage(category, pathSegments, dataUrl);
    });
    ipcMain.handle('playcrew:save-local-image', (event, category, key, dataUrl) => {
      assertTrusted(event);
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(key)) throw new Error('Invalid image key');
      return saveLocalImage(category, [category, key], dataUrl);
    });
    ipcMain.handle('playcrew:delete-local-image', (event, value) => {
      assertTrusted(event);
      if (typeof value !== 'string' || !value.startsWith('playcrew-local://')) return false;
      const parsed = new URL(value);
      const relative = decodeURIComponent(`${parsed.hostname}${parsed.pathname}`).replace(/^[/\\]+/, '');
      const target = path.resolve(localImagesRoot, relative);
      if (!target.startsWith(path.resolve(localImagesRoot) + path.sep)) return false;
      try { fs.unlinkSync(target); return true; } catch { return false; }
    });
    ipcMain.handle('playcrew:read-local-image', (event, value) => {
      assertTrusted(event);
      if (typeof value !== 'string' || !value.startsWith('playcrew-local://')) throw new Error('Invalid local image URL');
      const parsed = new URL(value);
      const relative = decodeURIComponent(`${parsed.hostname}${parsed.pathname}`).replace(/^[/\\]+/, '');
      const target = path.resolve(localImagesRoot, relative);
      if (!target.startsWith(path.resolve(localImagesRoot) + path.sep)) throw new Error('Invalid local image path');
      const extension = path.extname(target).toLowerCase();
      const contentType = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[extension];
      if (!contentType) throw new Error('Unsupported local image');
      const bytes = fs.readFileSync(target);
      if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error('Invalid local image size');
      return `data:${contentType};base64,${bytes.toString('base64')}`;
    });
    ipcMain.on('playcrew:window-control', (event, action) => {
      // Accept only this window's top-level PlayCrew page or bundled reconnect page.
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) return;
      const url = event.senderFrame.url;
      if (!isAppUrl(url) && url !== pathToFileURL(offlineFile).href) return;
      switch (action) {
        case 'minimize': mainWindow.minimize(); break;
        case 'maximize':
          if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
          else if (mainWindow.isMaximized()) mainWindow.unmaximize();
          else mainWindow.maximize();
          break;
        case 'close': mainWindow.close(); break;
        case 'state': sendWindowState(); break;
      }
    });
    const browserSession = session.fromPartition('persist:playcrew');
    browserSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      callback(canGrantPermission(permission, details.requestingUrl || contents.getURL()));
    });
    browserSession.setPermissionCheckHandler((_contents, permission, origin) => canGrantPermission(permission, origin));
    browserSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: 'Save from PlayCrew' });
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'PlayCrew', submenu: [
        { label: 'Home', accelerator: 'Alt+Home', click: loadApp },
        { label: 'Open in browser', click: () => openExternal(isAppUrl(mainWindow?.webContents.getURL()) ? mainWindow.webContents.getURL() : APP_URL) },
        { type: 'separator' }, { role: 'quit' }
      ] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => { if (mainWindow?.webContents.navigationHistory.canGoBack()) mainWindow.webContents.navigationHistory.goBack(); } },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => { if (mainWindow?.webContents.navigationHistory.canGoForward()) mainWindow.webContents.navigationHistory.goForward(); } },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => { if (offline) loadApp(); else mainWindow?.webContents.reload(); } },
        { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])
      ] },
      { label: 'Help', submenu: [{ label: 'About PlayCrew', click: () => dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'PlayCrew', message: `PlayCrew Desktop ${app.getVersion()}`,
        detail: 'Your games, your progress, your crew.\n\nConnects to playcrew.vercel.app. Internet access is required.\nPress Alt to show the application menu.'
      }) }] }
    ]));
    createTray();
    createWindow();
    app.on('activate', showMainWindow);
  }).catch((error) => { dialog.showErrorBox('PlayCrew could not start', error.message); app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
