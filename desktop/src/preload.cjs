const { ipcRenderer, contextBridge } = require('electron');

// Keep Electron access in the isolated preload world. No generic IPC or Node
// capabilities are exposed to the website. Controls are bundled with the app.
if (process.isMainFrame) {
  const localImageCache = new Map();
  async function resolveLocalImage(image) {
    const source = image.getAttribute('src');
    if (!source?.startsWith('playcrew-local://')) return;
    try {
      let resolved = localImageCache.get(source);
      if (!resolved) {
        resolved = await ipcRenderer.invoke('playcrew:read-local-image', source);
        localImageCache.set(source, resolved);
      }
      if (image.getAttribute('src') === source) image.setAttribute('src', resolved);
    } catch (error) {
      console.error('Cannot display local PlayCrew image:', error.message);
    }
  }
  function resolveLocalImages(root) {
    if (root instanceof HTMLImageElement) void resolveLocalImage(root);
    if (root.querySelectorAll) root.querySelectorAll('img[src^="playcrew-local://"]').forEach((image) => void resolveLocalImage(image));
  }

  contextBridge.exposeInMainWorld('playcrewDesktop', {
    getCloseBehavior: () => ipcRenderer.invoke('playcrew:close-behavior'),
    setCloseBehavior: (value) => ipcRenderer.invoke('playcrew:close-behavior', value),
    getImageStorageSettings: () => ipcRenderer.invoke('playcrew:image-storage-settings'),
    setImageStorageSettings: (value) => ipcRenderer.invoke('playcrew:image-storage-settings', value),
    openLocalImagesFolder: () => ipcRenderer.invoke('playcrew:open-local-images'),
    saveLocalImage: (category, key, dataUrl) => ipcRenderer.invoke('playcrew:save-local-image', category, key, dataUrl),
    saveLocalImageToPath: (category, pathSegments, dataUrl) => ipcRenderer.invoke('playcrew:save-local-image-to-path', category, pathSegments, dataUrl),
    deleteLocalImage: (url) => ipcRenderer.invoke('playcrew:delete-local-image', url)
  });
  window.addEventListener('DOMContentLoaded', () => {
    resolveLocalImages(document);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') resolveLocalImages(mutation.target);
        mutation.addedNodes.forEach(resolveLocalImages);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    const controls = document.createElement('div');
    controls.id = 'playcrew-desktop-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Desktop window controls');
    const icons = {
      minimize: '<path d="M3 8h10"/>',
      maximize: '<rect x="3" y="3" width="10" height="10" rx="1"/>',
      restore: '<path d="M6 3h7v7M3 6h7v7H3z"/>',
      close: '<path d="m4 4 8 8m0-8-8 8"/>'
    };
    const buttons = {};
    function setIcon(button, icon) {
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${icons[icon]}</svg>`;
    }
    for (const [action, label] of [['minimize', 'Minimize window'], ['maximize', 'Maximize window'], ['close', 'Close to tray']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.title = label;
      button.setAttribute('aria-label', label);
      setIcon(button, action);
      button.addEventListener('click', () => ipcRenderer.send('playcrew:window-control', action));
      controls.append(button);
      buttons[action] = button;
    }
    const drag = document.createElement('div');
    drag.id = 'playcrew-desktop-drag';
    drag.title = 'Drag to move window';
    drag.setAttribute('aria-hidden', 'true');

    function mount() {
      const top = document.querySelector('.navbar-top-shell');
      const side = document.querySelector('.navbar-sidebar-shell');
      const compactSlot = document.querySelector('[data-playcrew-desktop-controls-slot]');
      const mobile = [...document.querySelectorAll('nav')].find((nav) => nav !== top && nav !== side && nav.getBoundingClientRect().height > 0);
      const visible = (node) => node && getComputedStyle(node).display !== 'none';
      const compactNavbar = window.matchMedia('(min-width: 640px) and (max-width: 1023px)').matches && visible(compactSlot);
      const gamingPill = document.documentElement.dataset.navbarLayout === 'sidebar';
      const target = compactNavbar ? compactSlot : gamingPill ? document.body : visible(top) ? top : visible(side) ? side : mobile || document.body;
      const mode = target === compactSlot ? 'compact' : target === top ? 'top' : target === side ? 'sidebar' : target === document.body ? 'floating' : 'top';
      if (controls.dataset.layout !== mode) controls.dataset.layout = mode;
      if (controls.parentElement !== target) target.append(controls);
      if (!drag.isConnected) document.body.append(drag);
      // Only the thin, otherwise empty window edge is draggable; links, sliders,
      // and other navbar controls retain normal pointer behavior.
    }
    let scheduled = false;
    const scheduleMount = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; mount(); });
    };
    new MutationObserver(scheduleMount).observe(document.body, { childList: true, subtree: true });
    // Theme/layout switches can hide the existing navbar without replacing it.
    new MutationObserver(scheduleMount).observe(document.documentElement, { attributes: true, attributeFilter: ['data-navbar-layout'] });
    window.addEventListener('resize', scheduleMount);
    ipcRenderer.on('playcrew:window-state', (_event, state) => {
      const closeLabel = state.closeBehavior === 'quit' ? 'Close PlayCrew' : 'Close to tray';
      buttons.close.title = closeLabel;
      buttons.close.setAttribute('aria-label', closeLabel);
      const restored = state.maximized || state.fullscreen;
      const label = state.fullscreen ? 'Exit full screen' : restored ? 'Restore window' : 'Maximize window';
      buttons.maximize.title = label;
      buttons.maximize.setAttribute('aria-label', label);
      setIcon(buttons.maximize, restored ? 'restore' : 'maximize');
    });
    mount();
    ipcRenderer.send('playcrew:window-control', 'state');
  });
}
