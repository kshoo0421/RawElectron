const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const worker = new Worker(path.resolve(__dirname, '..', '.vite', 'build', 'engineHost.js'));
const originalWorker = new Worker(path.resolve(__dirname, '..', '.vite', 'build', 'engineHost.js'));
let nextId = 1;
const pending = new Map();
const originalPending = new Map();

worker.on('message', (message) => {
  const command = pending.get(message.id);
  if (!command) return;
  pending.delete(message.id);
  if (message.error) command.reject(new Error(message.error));
  else command.resolve(message.result);
});

originalWorker.on('message', (message) => {
  const command = originalPending.get(message.id);
  if (!command) return;
  originalPending.delete(message.id);
  if (message.error) command.reject(new Error(message.error));
  else command.resolve(message.result);
});

function call(type, payload) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

function callOriginal(type, payload) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    originalPending.set(id, { resolve, reject });
    originalWorker.postMessage({ id, type, payload });
  });
}

async function main() {
  const imagePath = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
  const outputPath = path.resolve(__dirname, '..', 'native', 'build', 'engine-worker-export.png');
  const opened = await call('openImage', { imagePath });
  const imageId = opened.id;
  const sharedBuffer = new SharedArrayBuffer(320 * 240 * 4);
  const preview = await call('renderPreviewShared', {
    request: {
      requestId: 91,
      imageId,
      quality: 'proxy',
      params: { exposure: 0.1, contrast: 3, saturation: 5 },
      preview: { maxWidth: 320, maxHeight: 240 },
    },
    buffer: sharedBuffer,
  });
  const previewPixels = new Uint8ClampedArray(sharedBuffer, 0, preview.stride * preview.height);
  if (preview.data !== undefined || previewPixels.length !== preview.stride * preview.height || !previewPixels.some(Boolean)) {
    throw new Error('Worker did not write a valid shared RGBA8 preview');
  }
  const fullBuffer = new SharedArrayBuffer(opened.width * opened.height * 4);
  const full = await callOriginal('renderPreviewShared', {
    request: {
      requestId: 92,
      imageId,
      quality: 'original',
      params: { exposure: 0.1, contrast: 3, saturation: 5 },
      preview: { maxWidth: opened.width, maxHeight: opened.height },
    },
    buffer: fullBuffer,
  });
  const fullPixels = new Uint8ClampedArray(fullBuffer, 0, full.stride * full.height);
  if (full.width !== opened.width || full.height !== opened.height || !fullPixels.some(Boolean)) {
    throw new Error('Worker did not replace the proxy with the full bitmap');
  }
  await call('exportImage', { imageId, outputPath, params: { exposure: 0, contrast: 0, saturation: 0 } });
  const exportBytes = fs.statSync(outputPath).size;
  fs.unlinkSync(outputPath);
  await call('closeImage', { imageId });
  console.log(JSON.stringify({
    imageId,
    imageInfo: opened,
    preview: { width: preview.width, height: preview.height, bytes: previewPixels.length },
    full: { width: full.width, height: full.height, bytes: fullPixels.length },
    exportBytes,
    workerThread: true,
    sharedMemory: true,
  }));
}

main()
  .finally(() => Promise.all([worker.terminate(), originalWorker.terminate()]))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
