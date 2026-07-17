import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  nativeImage,
  net,
  protocol,
  session,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { EngineWorker } from './engine/engineWorker';
import type {
  EditParams,
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
  DebugLogEntry,
  DebugLogLevel,
  ExportFormat,
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
const previewRoot = path.join(app.getPath('temp'), 'RawElectron', 'preview');
const editStatePath = path.join(app.getPath('userData'), 'edit-states.json');
const libraryStatePath = path.join(app.getPath('userData'), 'library-state.json');
const debugLogs: DebugLogEntry[] = [];
const imagePaths = new Map<number, string>();
const openImagesByPath = new Map<string, ImageFile>();
const initialPreviewLogged = new Set<number>();
let nextDebugLogId = 1;

function debugLog(level: DebugLogLevel, source: string, message: string) {
  const entry: DebugLogEntry = {
    id: nextDebugLogId++,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };
  debugLogs.push(entry);
  if (debugLogs.length > 1000) debugLogs.shift();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('debug-log:entry', entry);
  }
}

ipcMain.handle('debug-logs:list', () => debugLogs);
ipcMain.on('debug-logs:report-error', (_event, payload: { source?: unknown; message?: unknown }) => {
  const source = typeof payload?.source === 'string' ? payload.source.slice(0, 40) : 'UI';
  const message = typeof payload?.message === 'string' ? payload.message.slice(0, 1000) : '알 수 없는 UI 오류';
  debugLog('error', source, message);
});
ipcMain.on('debug-logs:report-info', (_event, payload: { source?: unknown; message?: unknown }) => {
  const source = typeof payload?.source === 'string' ? payload.source.slice(0, 40) : 'UI';
  const message = typeof payload?.message === 'string' ? payload.message.slice(0, 1000) : 'UI 상태 알림';
  debugLog('debug', source, message);
});

type ImageFile = {
  id: number;
  name: string;
  path: string;
  width: number;
  height: number;
  pixelFormat: 'rgba8';
};

type StoredEditStates = Record<string, unknown>;
type LibraryFolder = { id: string; name: string; parentId?: string | null };
type LibraryEntry = { path: string; alias?: string; folderId?: string | null };
type LibraryState = { folders: LibraryFolder[]; entries: LibraryEntry[] };

function readLibraryState(): LibraryState {
  try {
    const parsed = JSON.parse(fs.readFileSync(libraryStatePath, 'utf8')) as Partial<LibraryState>;
    return {
      folders: Array.isArray(parsed.folders)
        ? parsed.folders.filter((item): item is LibraryFolder =>
          typeof item?.id === 'string' && typeof item?.name === 'string').slice(0, 200)
        : [],
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter((item): item is LibraryEntry =>
          typeof item?.path === 'string').slice(0, 5000)
        : [],
    };
  } catch {
    return { folders: [], entries: [] };
  }
}

function writeLibraryState(state: LibraryState) {
  fs.mkdirSync(path.dirname(libraryStatePath), { recursive: true });
  fs.writeFileSync(libraryStatePath, JSON.stringify(state, null, 2), 'utf8');
}

function readEditStates(): StoredEditStates {
  try {
    const parsed = JSON.parse(fs.readFileSync(editStatePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as StoredEditStates : {};
  } catch {
    return {};
  }
}

function editStateKey(filePath: string) {
  return path.resolve(filePath).toLocaleLowerCase('en-US');
}

function writeEditStates(states: StoredEditStates) {
  fs.mkdirSync(path.dirname(editStatePath), { recursive: true });
  fs.writeFileSync(editStatePath, JSON.stringify(states, null, 2), 'utf8');
}

const imageOpenFilters = [
  {
    name: 'Images',
    extensions: [
      'jpg', 'jpeg', 'jpe', 'png', 'apng', 'webp', 'bmp', 'dib',
      'tif', 'tiff', 'jp2', 'j2k', 'jpc', 'pnm', 'pbm', 'pgm', 'ppm', 'pam', 'pfm',
      'sr', 'ras', 'hdr', 'pic', 'exr',
      'avif', 'jxr', 'wdp', 'hdp',
      '3fr', 'ari', 'arw', 'bay', 'bmq', 'cap', 'cine', 'cr2', 'cr3', 'crw', 'cs1',
      'dc2', 'dcr', 'dng', 'erf', 'fff', 'ia', 'iqe', 'k25', 'kdc', 'mdc', 'mef',
      'mos', 'mrw', 'nef', 'nrw', 'orf', 'ori', 'pef', 'ptx', 'pxn', 'qtk', 'raf',
      'raw', 'rdc', 'rw2', 'rwl', 'rwz', 'sr2', 'srf', 'srw', 'sti', 'x3f',
    ],
  },
];

const imageExportFormats: Record<ExportFormat, { name: string; extension: string; extensions: string[] }> = {
  jpeg: { name: 'JPEG', extension: 'jpg', extensions: ['jpg', 'jpeg', 'jpe'] },
  png: { name: 'PNG', extension: 'png', extensions: ['png'] },
  webp: { name: 'WebP', extension: 'webp', extensions: ['webp'] },
  tiff: { name: 'TIFF', extension: 'tiff', extensions: ['tif', 'tiff'] },
  bmp: { name: 'Bitmap', extension: 'bmp', extensions: ['bmp', 'dib'] },
  jpeg2000: { name: 'JPEG 2000', extension: 'jp2', extensions: ['jp2', 'j2k', 'jpc'] },
  ppm: { name: 'Portable Pixmap', extension: 'ppm', extensions: ['ppm'] },
  hdr: { name: 'Radiance HDR', extension: 'hdr', extensions: ['hdr', 'pic'] },
  ras: { name: 'Sun raster', extension: 'ras', extensions: ['sr', 'ras'] },
};

function outputPathForFormat(filePath: string, format: ExportFormat) {
  const definition = imageExportFormats[format];
  const parsed = path.parse(filePath);
  if (definition.extensions.includes(parsed.ext.slice(1).toLowerCase())) return filePath;
  return path.join(parsed.dir, `${parsed.name}.${definition.extension}`);
}

async function toImageFile(filePath: string): Promise<ImageFile> {
  const resolvedPath = path.resolve(filePath);
  const pathKey = resolvedPath.toLocaleLowerCase('en-US');
  const existing = openImagesByPath.get(pathKey);
  if (existing) return existing;
  const opened = await engineWorker.openImage(resolvedPath);
  imagePaths.set(opened.id, resolvedPath);

  const image = {
    id: opened.id,
    name: path.basename(filePath),
    path: resolvedPath,
    width: opened.width,
    height: opened.height,
    pixelFormat: opened.pixelFormat,
  };
  openImagesByPath.set(pathKey, image);
  return image;
}

async function openImagePaths(filePaths: string[]) {
  const uniquePaths = [...new Set(filePaths.filter((filePath) => typeof filePath === 'string' && filePath))];
  return Promise.all(uniquePaths.map(toImageFile));
}

ipcMain.handle('images:open', async (): Promise<ImageFile[]> => {
  debugLog('info', '파일', '이미지 선택 창을 열었습니다.');
  const result = await dialog.showOpenDialog({
    title: 'Open images',
    properties: ['openFile', 'multiSelections'],
    filters: imageOpenFilters,
  });

  if (result.canceled) {
    debugLog('debug', '파일', '이미지 열기가 취소되었습니다.');
    return [];
  }
  debugLog('info', '엔진', `${result.filePaths.length}개 이미지를 불러오는 중입니다.`);
  try {
    const images = await openImagePaths(result.filePaths);
    debugLog('info', '엔진', `${images.length}개 이미지 로드를 완료했습니다.`);
    return images;
  } catch (error) {
    debugLog('error', '엔진', `이미지 로드 실패: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});

ipcMain.handle('images:open-paths', async (_event, filePaths: unknown): Promise<ImageFile[]> => {
  if (!Array.isArray(filePaths) || filePaths.some((filePath) => typeof filePath !== 'string')) {
    throw new Error('Invalid dropped image paths');
  }
  debugLog('info', '파일', `${filePaths.length}개 드롭 파일을 불러오는 중입니다.`);
  return openImagePaths(filePaths);
});

ipcMain.handle('library:load', async () => {
  const state = readLibraryState();
  const existingEntries = state.entries.filter((entry) => fs.existsSync(entry.path));
  if (existingEntries.length !== state.entries.length) {
    writeLibraryState({ ...state, entries: existingEntries });
  }
  return { folders: state.folders, entries: existingEntries };
});

ipcMain.handle('library:open-entry', async (_event, filePath: unknown) => {
  if (typeof filePath !== 'string' || !filePath || !fs.existsSync(filePath)) return null;
  return toImageFile(filePath);
});

ipcMain.handle('library:save', (_event, value: unknown) => {
  const serialized = JSON.stringify(value);
  if (serialized.length > 1_000_000) throw new Error('Library state is too large');
  const parsed = JSON.parse(serialized) as Partial<LibraryState>;
  const state: LibraryState = {
    folders: Array.isArray(parsed.folders)
      ? parsed.folders.filter((item): item is LibraryFolder =>
        typeof item?.id === 'string' && typeof item?.name === 'string').slice(0, 200)
      : [],
    entries: Array.isArray(parsed.entries)
      ? parsed.entries.filter((item): item is LibraryEntry => typeof item?.path === 'string').slice(0, 5000)
      : [],
  };
  writeLibraryState(state);
  return true;
});

ipcMain.handle('images:close', async (_event, imageId: number) => {
  if (!Number.isSafeInteger(imageId) || imageId <= 0) throw new Error('Invalid image id');
  await engineWorker.closeImage(imageId);
  const closedPath = imagePaths.get(imageId);
  imagePaths.delete(imageId);
  if (closedPath) openImagesByPath.delete(closedPath.toLocaleLowerCase('en-US'));
  debugLog('debug', '파일', `이미지 #${imageId}를 목록에서 닫았습니다.`);
  return true;
});

ipcMain.handle('edit-state:load', (_event, imageId: number) => {
  const filePath = imagePaths.get(imageId);
  if (!filePath) return null;
  return readEditStates()[editStateKey(filePath)] ?? null;
});

ipcMain.handle('edit-state:save', (_event, imageId: number, state: unknown) => {
  const filePath = imagePaths.get(imageId);
  if (!filePath) throw new Error('Image is not open');
  const serialized = JSON.stringify(state);
  if (serialized.length > 100_000) throw new Error('Edit state is too large');
  const states = readEditStates();
  states[editStateKey(filePath)] = JSON.parse(serialized);
  writeEditStates(states);
  return true;
});

ipcMain.handle('images:export', async (
  _event,
  imageId: number,
  params: EditParams,
  requestedFormat: ExportFormat,
) => {
  debugLog('info', '내보내기', `이미지 #${imageId} 저장 위치를 선택하는 중입니다.`);
  const sourcePath = engineWorker.getImagePath(imageId);
  const parsedSource = path.parse(sourcePath);
  const format = typeof requestedFormat === 'string' && requestedFormat in imageExportFormats
    ? requestedFormat as ExportFormat
    : 'jpeg';
  const definition = imageExportFormats[format];
  const result = await dialog.showSaveDialog({
    title: 'Export image',
    defaultPath: `${parsedSource.name}.${definition.extension}`,
    filters: [{ name: definition.name, extensions: definition.extensions }],
  });

  if (result.canceled || !result.filePath) {
    debugLog('debug', '내보내기', '내보내기가 취소되었습니다.');
    return { canceled: true };
  }
  try {
    debugLog('info', '내보내기', `이미지 #${imageId} 렌더링을 시작합니다.`);
    const outputPath = outputPathForFormat(result.filePath, format);
    await engineWorker.exportRenderedImage({ imageId, outputPath, params });
    debugLog('info', '내보내기', `저장을 완료했습니다: ${result.filePath}`);
    return { canceled: false, path: outputPath };
  } catch (error) {
    debugLog('error', '내보내기', `저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});

ipcMain.handle('images:drag-export', async (
  event,
  imageId: number,
  params: EditParams,
  requestedFormat: ExportFormat,
) => {
  const format = typeof requestedFormat === 'string' && requestedFormat in imageExportFormats
    ? requestedFormat as ExportFormat
    : 'jpeg';
  const definition = imageExportFormats[format];
  const sourcePath = engineWorker.getImagePath(imageId);
  const dragRoot = path.join(app.getPath('temp'), 'RawElectron', 'drag-export');
  fs.mkdirSync(dragRoot, { recursive: true });
  const outputPath = path.join(dragRoot, `${path.parse(sourcePath).name}.${definition.extension}`);
  await engineWorker.exportRenderedImage({ imageId, outputPath, params });
  const icon = nativeImage.createFromPath(outputPath).resize({ width: 64, height: 64 });
  event.sender.startDrag({ file: outputPath, icon });
  return { path: outputPath };
});

ipcMain.handle(
  'engine-worker:export-rendered-image',
  async (_event, request: EngineWorkerExportRequest) => engineWorker.exportRenderedImage(request),
);

const maximumPreviewPixels = 4096 * 4096;
const maximumOriginalPixels = 64_000_000;

function validRenderDimensions(width: unknown, height: unknown, quality: 'proxy' | 'original') {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || (width as number) <= 0 || (height as number) <= 0) return false;
  const maximumPixels = quality === 'original' ? maximumOriginalPixels : maximumPreviewPixels;
  return (width as number) * (height as number) <= maximumPixels;
}

ipcMain.handle('engine-preview-file:render', async (_event, request: EngineWorkerRenderRequest) => {
  const width = request.preview?.maxWidth;
  const height = request.preview?.maxHeight;
  if (!Number.isSafeInteger(request.requestId) || !Number.isSafeInteger(request.imageId)
      || !validRenderDimensions(width, height, request.quality)) {
    throw new Error('Invalid preview file request');
  }
  fs.mkdirSync(previewRoot, { recursive: true });
  const fileName = `${request.imageId}-${request.quality}-${request.requestId}.png`;
  const outputPath = path.join(previewRoot, fileName);
  const startedAt = performance.now();
  const shouldLog = request.quality !== 'proxy' || !initialPreviewLogged.has(request.imageId);
  if (shouldLog) {
    initialPreviewLogged.add(request.imageId);
    debugLog('debug', '프리뷰', `이미지 #${request.imageId} 최초 프리뷰 렌더링 시작 (${width}×${height})`);
  }
  try {
    const result = await engineWorker.renderPreviewFile(request, outputPath);
    if (shouldLog) debugLog('info', '프리뷰', `이미지 #${request.imageId} 최초 프리뷰 표시 준비 완료 (${Math.round(performance.now() - startedAt)}ms)`);
    return { ...result, url: `rawelectron://preview/${fileName}` };
  } catch (error) {
    debugLog('error', '프리뷰', `이미지 #${request.imageId} 렌더링 실패: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});

ipcMain.on('shared-preview:connect', (event) => {
  debugLog('debug', '공유 메모리', 'UI의 공유 메모리 채널 연결 요청을 받았습니다.');
  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', async ({ data }) => {
    if (data === null) {
      debugLog('error', '공유 메모리', '렌더러에서 보낸 메시지가 null로 변환되었습니다. SharedArrayBuffer를 프로세스 경계로 전달할 수 없습니다.');
      return;
    }
    if (data?.type === 'shared-preview-displayed') {
      if (data.quality === 'original') {
        debugLog('info', '공유 메모리', `이미지 #${data.imageId} 원본 이미지를 UI에서 모두 읽어 교체했습니다.`);
      } else if (!initialPreviewLogged.has(data.imageId)) {
        initialPreviewLogged.add(data.imageId);
        debugLog('info', '공유 메모리', `이미지 #${data.imageId} 축소 프리뷰를 UI에 최초 표시했습니다.`);
      }
      return;
    }
    if (data?.type !== 'render-shared-preview') return;
    const request = data.request as EngineWorkerRenderRequest;
    const width = request.preview?.maxWidth;
    const height = request.preview?.maxHeight;
    if (!validRenderDimensions(width, height, request.quality)) {
      port2.postMessage({ type: 'shared-preview-error', requestId: request.requestId, error: 'Invalid shared preview dimensions' });
      return;
    }
    const sharedBuffer = new SharedArrayBuffer(width * height * 4);
    const startedAt = performance.now();
    try {
      const result = await engineWorker.renderPreviewShared(request, sharedBuffer);
      const pixels = Uint8ClampedArray.from(
        new Uint8ClampedArray(sharedBuffer, 0, result.stride * result.height),
      );
      if (request.quality === 'original') {
        debugLog('info', '공유 메모리', `이미지 #${request.imageId} 원본 이미지 적재 완료 (${result.width}×${result.height}, ${Math.round(performance.now() - startedAt)}ms)`);
      }
      port2.postMessage({ type: 'shared-preview-ready', ...result, data: pixels });
    } catch (error) {
      debugLog('error', '공유 메모리', `${request.quality} 이미지 적재 실패: ${error instanceof Error ? error.message : String(error)}`);
      port2.postMessage({ type: 'shared-preview-error', requestId: request.requestId, error: error instanceof Error ? error.message : String(error) });
    }
  });
  port2.start();
  event.senderFrame.postMessage('shared-preview-port', null, [port1]);
  debugLog('debug', '공유 메모리', '공유 메모리 채널을 preload로 전달했습니다.');
});

const createWindow = () => {
  debugLog('info', '앱', '메인 창을 생성합니다.');
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
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedDevelopmentUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
      && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    if (!url.startsWith('rawelectron://') && !allowedDevelopmentUrl) event.preventDefault();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('rawelectron://bundle/index.html');
  }

  mainWindow.webContents.once('did-finish-load', () => {
    debugLog('info', '앱', 'GUI 로드를 완료했습니다.');
  });

};

app.whenReady().then(() => {
  debugLog('info', '앱', 'Electron 초기화를 완료했습니다.');
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
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
    const parsedUrl = new URL(request.url);
    if (parsedUrl.host === 'preview') {
      const fileName = path.basename(decodeURIComponent(parsedUrl.pathname));
      if (!/^\d+-(proxy|original)-\d+\.png$/.test(fileName)) {
        return new Response('Not found', { status: 404 });
      }
      const response = await net.fetch(pathToFileURL(path.join(previewRoot, fileName)).toString());
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(response.body, { status: response.status, headers });
    }
    const relativePath = decodeURIComponent(parsedUrl.pathname)
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
