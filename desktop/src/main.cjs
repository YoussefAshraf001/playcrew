const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain, Tray } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { APP_URL, isAppUrl, isExternalUrl, canGrantPermission } = require('./policy.cjs');

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
try {
  if (JSON.parse(fs.readFileSync(settingsFile, 'utf8')).closeBehavior === 'quit') closeBehavior = 'quit';
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
    backgroundColor: '#080b10', icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  startupWindow.setMenu(null);
  startupWindow.on('close', () => { if (!quitting) app.quit(); });
  void startupWindow.loadFile(path.join(__dirname, 'startup.html')).catch(finishStartup);
  // Slow or unreachable servers lead to the reconnect screen, never an endless splash.
  startupTimer = setTimeout(showOffline, 20000);
  startupTimer.unref();
  loadApp();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('before-quit', () => { quitting = true; clearTimeout(startupTimer); });
  app.on('will-quit', () => { if (tray && !tray.isDestroyed()) tray.destroy(); });
  app.on('second-instance', showMainWindow);
  app.whenReady().then(() => {
    ipcMain.handle('playcrew:close-behavior', (event, value) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || !isAppUrl(event.senderFrame.url)) throw new Error('Untrusted settings request');
      if (value !== undefined) {
        if (value !== 'tray' && value !== 'quit') throw new Error('Invalid close behavior');
        fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
        fs.writeFileSync(settingsFile, JSON.stringify({ closeBehavior: value }));
        closeBehavior = value;
        sendWindowState();
      }
      return closeBehavior;
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
