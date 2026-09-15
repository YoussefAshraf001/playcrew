const { ipcRenderer } = require('electron');

// Keep Electron access in the isolated preload world. No generic IPC or Node
// capabilities are exposed to the website. Controls are bundled with the app.
if (process.isMainFrame) {
  window.addEventListener('DOMContentLoaded', () => {
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
      const mobile = [...document.querySelectorAll('nav')].find((nav) => nav !== top && nav !== side && nav.getBoundingClientRect().height > 0);
      const visible = (node) => node && getComputedStyle(node).display !== 'none';
      const target = visible(top) ? top : visible(side) ? side : mobile || document.body;
      const mode = target === top ? 'top' : target === side ? 'sidebar' : target === document.body ? 'floating' : 'top';
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
