# PlayCrew Desktop (Windows)

The installed app opens **https://playcrew.vercel.app** using its own bundled Electron runtime. Users do not need Node.js, VS Code, or a local development server. Internet access is required.

## Build an installer

From the repository root, on Windows with Node.js 22.12+ (for desktop build tools only):

```powershell
npm run desktop:install
npm run desktop:test
npm run desktop:dist
```

Installer: `desktop/dist/PlayCrew-Setup-0.1.2-x64.exe`.

For a local desktop preview against the live site: `npm run desktop:dev`.
For an unpacked executable: `npm run desktop:pack` (keep the entire `win-unpacked` folder together).
Run `npm --prefix desktop run smoke` after packaging to test the actual executable with an isolated account profile.

## Included

- Frameless window with minimize, maximize/restore, and close inside PlayCrew's navbar/sidebar. A compact floating group remains available on the main menu and reconnect page. Drag the top edge to move the window; F11 toggles full screen.
- App icon, Start menu and desktop shortcuts.
- Close (including Alt+F4) hides the window to the system tray and keeps music playing. Click the tray icon or choose **Open PlayCrew** to return. Choose **Quit PlayCrew** from the tray menu to exit completely.
- Persistent Firebase/web session storage in a dedicated Electron profile.
- External website links open in the default browser.
- Existing file pickers, downloads, and music playback use Chromium's native capabilities.
- Reconnect screen and retry when the site cannot be reached.
- Single running instance, remembered window size, and keyboard navigation.
- Press **Alt** for the app menu; **Alt+Left/Right** to navigate, **Ctrl+R** to reload, **F11** for fullscreen.

The desktop shell has no access to server credentials. Only `src`, the icon, and package metadata are packaged. Remote content has Node integration disabled, context isolation enabled, and sandboxing enabled. The isolated preload owns the desktop-only controls; its limited window-control messages validate the sending window, frame, and origin. No Electron API is exposed to website JavaScript.

## Release notes

- This build is unsigned unless you configure a Windows signing certificate in electron-builder. Windows may show an unrecognized publisher warning. Production distribution should use signing.
- Website deployments appear in the app after reload. Unpublished local website edits do not appear automatically.
- Desktop shell/runtime updates currently require installing a newer installer; automatic updates are not configured.
- Existing email/password login is used. Adding Google or other OAuth login later requires a supported system-browser authentication flow.
- Offline game editing is not included. Account-specific login, uploads to cloud storage, and full Library behavior should be checked with a test account before public release.

The npm lockfile pins build dependencies. Update Electron regularly and rebuild to deliver browser security updates. Increment `desktop/package.json` version before a new desktop release.
