const { app, BrowserWindow, Menu, shell, Tray, nativeImage, globalShortcut, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');

const APP_URL = 'https://main.d1uanrj3qjhflx.amplifyapp.com/';
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const ICON_PATH = path.join(__dirname, '..', 'build', 'chaticon.png');

let mainWindow;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let currentHotkey = null;

function isSafeExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function getDefaultSettings() {
  return {
    startWithWindows: true,
    hotkeyEnabled: true,
    hotkey: 'Control+Alt+K'
  };
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      ...getDefaultSettings(),
      ...parsed,
      startWithWindows: Boolean(parsed.startWithWindows),
      hotkeyEnabled: Boolean(parsed.hotkeyEnabled),
      hotkey: typeof parsed.hotkey === 'string' ? parsed.hotkey : getDefaultSettings().hotkey
    };
  } catch {
    return getDefaultSettings();
  }
}

function saveSettings(settings) {
  const normalized = {
    ...getDefaultSettings(),
    ...settings,
    startWithWindows: Boolean(settings.startWithWindows),
    hotkeyEnabled: Boolean(settings.hotkeyEnabled),
    hotkey: typeof settings.hotkey === 'string' ? settings.hotkey : getDefaultSettings().hotkey
  };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalized, null, 2));
  return normalized;
}

function unregisterHotkey() {
  if (currentHotkey) {
    globalShortcut.unregister(currentHotkey);
    currentHotkey = null;
  }
}

function registerHotkey(hotkey) {
  if (!hotkey) {
    unregisterHotkey();
    return;
  }

  if (currentHotkey === hotkey) {
    return;
  }

  unregisterHotkey();
  const registered = globalShortcut.register(hotkey, () => {
    toggleWindow();
  });

  if (registered) {
    currentHotkey = hotkey;
  } else {
    console.warn(`Global hotkey registration failed for ${hotkey}.`);
  }
}

function applySettings(settings) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: Boolean(settings.startWithWindows),
      path: process.execPath,
      args: ['--processStart', 'keyuser-popup']
    });
  }

  if (settings.hotkeyEnabled) {
    registerHotkey(settings.hotkey);
  } else {
    unregisterHotkey();
  }
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(ICON_PATH);

  tray = new Tray(trayIcon.isEmpty() ? undefined : trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Keyuser',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
          return;
        }

        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Keyuser Popup');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 360,
    height: 270,
    resizable: false,
    show: false,
    title: 'Keyuser Popup Settings',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 16px; color: #1f2937; }
      h2 { margin-top: 0; font-size: 18px; }
      label { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
      .field { margin-top: 12px; }
      input[type="text"] { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
      button { padding: 8px 12px; border: 0; border-radius: 6px; cursor: pointer; }
      button.primary { background: #2563eb; color: #fff; }
      button.secondary { background: #e5e7eb; color: #111827; }
      #status { font-size: 12px; color: #4b5563; margin-top: 10px; }
    </style>
  </head>
  <body>
    <h2>Settings</h2>
    <label><input type="checkbox" id="startWithWindows" /> Start with Windows</label>
    <label><input type="checkbox" id="hotkeyEnabled" /> Enable global hotkey</label>
    <div class="field">
      <label for="hotkey">Hotkey</label>
      <input type="text" id="hotkey" value="Control+Alt+K" />
    </div>
    <div class="actions">
      <button id="close" class="secondary" type="button">Close</button>
      <button id="save" class="primary" type="button">Save</button>
    </div>
    <div id="status">Loading…</div>
    <script>
      const { electronSettings } = window;

      async function loadSettings() {
        const settings = await electronSettings.getSettings();
        document.getElementById('startWithWindows').checked = Boolean(settings.startWithWindows);
        document.getElementById('hotkeyEnabled').checked = Boolean(settings.hotkeyEnabled);
        document.getElementById('hotkey').value = settings.hotkey || 'Control+Alt+K';
        document.getElementById('status').textContent = 'Ready';
      }

      document.getElementById('save').addEventListener('click', async () => {
        const settings = {
          startWithWindows: document.getElementById('startWithWindows').checked,
          hotkeyEnabled: document.getElementById('hotkeyEnabled').checked,
          hotkey: document.getElementById('hotkey').value
        };

        const saved = await electronSettings.saveSettings(settings);
        document.getElementById('status').textContent = 'Saved successfully';
        if (!saved.hotkeyEnabled) {
          document.getElementById('status').textContent = 'Saved successfully. Hotkey disabled.';
        }
      });

      document.getElementById('close').addEventListener('click', () => window.close());
      loadSettings();
    </script>
  </body>
</html>`;

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  void settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 720,
    minWidth: 360,
    minHeight: 520,
    show: false,
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Keyuser Popup',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const wantsReload =
      input.key === 'F5' ||
      ((input.control || input.meta) && input.key.toLowerCase() === 'r');

    if (wantsReload) {
      event.preventDefault();
      mainWindow.webContents.reload();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('minimize', () => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  void mainWindow.loadURL(APP_URL).catch((error) => {
    console.error('Could not load the web application:', error);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('settings:get', () => loadSettings());

  ipcMain.handle('settings:save', (_event, incomingSettings) => {
    const saved = saveSettings(incomingSettings);
    applySettings(saved);
    return saved;
  });

  // Configure and initialize auto-updater
  autoUpdater.checkForUpdatesAndNotify();

  app.whenReady().then(() => {
    app.setAppUserModelId('com.keyuser.popup');
    Menu.setApplicationMenu(null);

    const initialSettings = loadSettings();
    applySettings(initialSettings);
    createTray();
    createWindow();

    // Auto-updater event handlers
    autoUpdater.on('update-available', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: 'A new version of Keyuser Popup is available.',
        detail: 'The update will be downloaded and installed. You will be prompted to restart.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update has been downloaded and will be installed on restart.',
        detail: 'The application will be relaunched to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('before-quit', () => {
    unregisterHotkey();
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
