import {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  shell,
  clipboard,
  Notification,
  Tray,
  Menu,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { ipcMain } from "electron";
import fs from "fs";

import pkg from 'electron-updater';
const { autoUpdater } = pkg;

let mainWindow;
let tray = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path for favorites and recents
const dataFilePath = path.join(app.getPath("userData"), "data.json");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    resizable: false,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  mainWindow.setBounds({ x: 0, y: 0, width, height });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWindow.hide();

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    mainWindow.hide();
    return { action: "deny" };
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "build", "tray-icon.png")); // small 32x32 icon

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show GIFfire",
      click: () => {
        mainWindow.setFocusable(true);
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("GIFfire - Instant GIF Launcher");
  tray.setContextMenu(contextMenu);

  // 👇 Add left-click to show app
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.setFocusable(true);
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Listen for close-app command
ipcMain.on("close-app", () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Handle read-data from renderer
ipcMain.handle("read-data", async () => {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return { favorites: [], recents: [] };
    }
    const data = fs.readFileSync(dataFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading data file:", error);
    return { favorites: [], recents: [] };
  }
});

// Handle write-data from renderer
ipcMain.handle("write-data", async (event, newData) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Error writing data file:", error);
    return { success: false, error: error.message };
  }
});

// Load favorites for hotkeys
function loadFavorites() {
  try {
    if (!fs.existsSync(dataFilePath)) return [];
    const data = fs.readFileSync(dataFilePath, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.favorites || [];
  } catch (error) {
    console.error("Error loading favorites:", error);
    return [];
  }
}

// Register favorite hotkeys (Alt+P+0 to Alt+P+9)
function registerFavoriteHotkeys() {
  for (let i = 1; i <= 9; i++) {
    const shortcut = `Alt+Q+${i}`;

    globalShortcut.register(shortcut, () => {
      const favorites = loadFavorites();
      const favorite = favorites.find((fav) => fav.hotkey === i);

      if (favorite && favorite?.images?.fixed_height?.url) {
        const url = favorite.images.fixed_height.url;

        clipboard.writeText(url);

        if (Notification.isSupported()) {
          new Notification({
            title: "🔥 GIFfire",
            body: `Favorite ${i} copied to clipboard!`,
          }).show();
        }
      } else {
        if (Notification.isSupported()) {
          new Notification({
            title: "🔥 GIFfire",
            body: `Favorite ${i} not assigned!`,
          }).show();
        }
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  autoUpdater.checkForUpdatesAndNotify();

  registerFavoriteHotkeys(); // Register Alt+P+0..9 hotkeys

  // Toggle launcher overlay
  globalShortcut.register("Alt+A", () => {
    if (mainWindow.isVisible()) {
      mainWindow.setFocusable(false);
      mainWindow.hide();
    } else {
      mainWindow.setFocusable(true);
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Hard reload
  globalShortcut.register("Control+R", () => {
    if (mainWindow) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // ESC to close launcher
  globalShortcut.register("Escape", () => {
    if (mainWindow.isVisible()) {
      mainWindow.setFocusable(false);
      mainWindow.hide();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
