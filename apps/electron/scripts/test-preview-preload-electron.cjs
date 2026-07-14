const path = require('node:path');
const { app, BrowserWindow, protocol } = require('electron');

const imagePath = process.argv[2];
if (!imagePath) throw new Error('An image path is required');

protocol.registerSchemesAsPrivileged([{
  scheme: 'preload-preview-test',
  privileges: { standard: true, secure: true },
}]);

app.whenReady().then(async () => {
  protocol.handle('preload-preview-test', () => new Response('<!doctype html><body>test</body>', {
    headers: {
      'Content-Type': 'text/html',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  }));
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, 'test-preview-preload-worker.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('preload error', preloadPath, error);
  });
  await window.loadURL('preload-preview-test://bundle/index.html');
  try {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const buffer = new SharedArrayBuffer(1200 * 800 * 4);
      const data = await previewTest.render(${JSON.stringify(imagePath)}, buffer);
      return { ...data, rendererNonZero: new Uint8ClampedArray(buffer).some(Boolean), isolated: crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer };
    })()`);
    throw new Error(`Expected Context Bridge to reject SAB, received: ${JSON.stringify(result)}`);
  } catch (error) {
    if (!String(error).includes('could not be cloned')) throw error;
    console.log(JSON.stringify({ contextBridgeSharedArrayBuffer: false, expectedError: 'An object could not be cloned.' }));
  }
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
