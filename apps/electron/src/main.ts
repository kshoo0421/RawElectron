import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  net,
  protocol,
  session,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { EngineWorker } from './engine/engineWorker';
import type {
  EditParams,
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from './shared/engineTypes';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'rawelectron',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const engineWorker = new EngineWorker();

type ImageFile = {
  id: number;
  name: string;
  width: number;
  height: number;
  pixelFormat: 'rgba8';
};

const imageFilters = [
  {
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'],
  },
];

async function toImageFile(filePath: string): Promise<ImageFile> {
  const opened = await engineWorker.openImage(filePath);

  return {
    id: opened.id,
    name: path.basename(filePath),
    width: opened.width,
    height: opened.height,
    pixelFormat: opened.pixelFormat,
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

ipcMain.handle('images:export', async (_event, imageId: number, params: EditParams) => {
  const sourcePath = engineWorker.getImagePath(imageId);
  const result = await dialog.showSaveDialog({
    title: 'Export image',
    defaultPath: path.basename(sourcePath),
    filters: imageFilters,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await engineWorker.exportRenderedImage({
    imageId,
    outputPath: result.filePath,
    params,
  });
  return { canceled: false, path: result.filePath };
});

ipcMain.on('engine-preview-port:connect', (event) => {
  const { port1, port2 } = new MessageChannelMain();

  port2.on('message', async ({ data }) => {
    const request = data.request as EngineWorkerRenderRequest;
    const buffer = data.buffer as SharedArrayBuffer | ArrayBuffer;
    try {
      const result = await engineWorker.renderPreviewShared(request, buffer);
      port2.postMessage(result);
    } catch (error) {
      port2.postMessage({
        requestId: request.requestId,
        quality: request.quality,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  port2.start();
  event.senderFrame.postMessage('engine-preview-port', null, [port1]);
});

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
    mainWindow.loadURL('rawelectron://bundle/index.html');
  }

};

app.whenReady().then(() => {
  // Vite development responses need the isolation policy injected. Packaged
  // responses get the same policy from the custom protocol handler below.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Cross-Origin-Opener-Policy': ['same-origin'],
          'Cross-Origin-Embedder-Policy': ['require-corp'],
        },
      });
    });
  }
  const rendererRoot = path.resolve(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}`,
  );
  protocol.handle('rawelectron', async (request) => {
    const relativePath = decodeURIComponent(new URL(request.url).pathname)
      .replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(rendererRoot, relativePath);
    if (filePath !== rendererRoot && !filePath.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Not found', { status: 404 });
    }
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
  createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void engineWorker.dispose();
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
