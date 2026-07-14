const path = require('node:path');
const { app, BrowserWindow, MessageChannelMain, protocol } = require('electron');

const imagePath = process.argv[2];
if (!imagePath) throw new Error('An image path is required');

protocol.registerSchemesAsPrivileged([{
  scheme: 'preview-test',
  privileges: { standard: true, secure: true },
}]);

async function main() {
  const addon = require(path.resolve(__dirname, '..', 'native', 'build', 'Release', 'rawelectron_engine.node'));
  const image = addon.openImage(imagePath);
  protocol.handle('preview-test', () => new Response('<!doctype html><body>preview test</body>', {
    headers: {
      'Content-Type': 'text/html',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  }));

  const window = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.resolve(__dirname, 'test-preview-port-preload.cjs') },
  });
  await window.loadURL('preview-test://bundle/index.html');

  await window.webContents.executeJavaScript(`globalThis.previewResult = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('renderer response timed out')), 10000);
    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'test-preview-port' || !event.ports[0]) return;
      const port = event.ports[0];
      port.onmessage = ({ data }) => {
        if (data.probe === 'ok') {
          port.postMessage({
            request: { requestId: 1, imageId: ${image.id}, quality: 'proxy', params: {}, preview: { maxWidth: 1200, maxHeight: 800 } },
            buffer: new SharedArrayBuffer(1200 * 800 * 4),
          });
          return;
        }
        clearTimeout(timer);
        resolve({ ...data, isolated: crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer });
      };
      port.start();
      port.postMessage({ probe: true });
    }, { once: true });
  }); true`);

  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', ({ data }) => {
    try {
      if (data === null) {
        console.log(JSON.stringify({ stage: 'shared-buffer-became-null' }));
        port2.postMessage({ sabCloneSupported: false });
        return;
      }
      if (data.probe) {
        console.log(JSON.stringify({ stage: 'probe-received' }));
        port2.postMessage({ probe: 'ok' });
        return;
      }
      console.log(JSON.stringify({ stage: 'shared-buffer-received' }));
      const pixels = new Uint8ClampedArray(data.buffer);
      const preview = addon.renderPreviewInto(data.request, {
        width: 1200,
        height: 800,
        stride: 1200 * 4,
        pixelFormat: 'rgba8',
        data: pixels,
      });
      port2.postMessage({ requestId: preview.requestId, width: preview.width, height: preview.height, nonZero: pixels.some(Boolean) });
    } catch (error) {
      port2.postMessage({ error: error.message });
    }
  });
  port2.start();
  window.webContents.mainFrame.postMessage('test-preview-port', null, [port1]);

  console.log(JSON.stringify(await window.webContents.executeJavaScript('globalThis.previewResult')));
  window.destroy();
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
