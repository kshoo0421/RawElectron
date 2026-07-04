import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { EngineWorker } from './engine/engineWorker';
import type {
  EditParams,
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from './shared/engineTypes';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const engineWorker = new EngineWorker();

type ImageFile = {
  name: string;
  path: string;
  url: string;
};

const imageFilters = [
  {
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'],
  },
];

const imageMimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

async function toImageFile(filePath: string): Promise<ImageFile> {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = imageMimeTypes[extension] ?? 'application/octet-stream';

  return {
    name: path.basename(filePath),
    path: filePath,
    url: `data:${mimeType};base64,${buffer.toString('base64')}`,
  };
}

ipcMain.handle('images:open', async (): Promise<ImageFile[]> => {
  const result = await dialog.showOpenDialog({
    title: 'Open images',
    properties: ['openFile', 'multiSelections'],
    filters: imageFilters,
  });

  if (result.canceled) {
    return [];
  }

  return Promise.all(result.filePaths.map(toImageFile));
});

ipcMain.handle('images:export', async (_event, sourcePath: string, params: EditParams) => {
  const result = await dialog.showSaveDialog({
    title: 'Export image',
    defaultPath: path.basename(sourcePath),
    filters: imageFilters,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await engineWorker.exportRenderedImage({
    imagePath: sourcePath,
    outputPath: result.filePath,
    params,
  });
  return { canceled: false, path: result.filePath };
});

ipcMain.handle(
  'engine-worker:render-preview',
  async (_event, request: EngineWorkerRenderRequest) => engineWorker.renderPreview(request),
);

ipcMain.handle(
  'engine-worker:export-rendered-image',
  async (_event, request: EngineWorkerExportRequest) => engineWorker.exportRenderedImage(request),
);

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
