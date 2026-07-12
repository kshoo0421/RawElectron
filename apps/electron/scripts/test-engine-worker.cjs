const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const worker = new Worker(path.resolve(__dirname, '..', '.vite', 'build', 'engineHost.js'));
let nextId = 1;
const pending = new Map();

worker.on('message', (message) => {
  const command = pending.get(message.id);
  if (!command) return;
  pending.delete(message.id);
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

async function main() {
  const imagePath = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
  const outputPath = path.resolve(__dirname, '..', 'native', 'build', 'engine-worker-export.png');
  const imageId = await call('openImage', { imagePath });
  const preview = await call('renderPreview', {
    requestId: 91,
    imageId,
    params: { exposure: 0.1, contrast: 3, saturation: 5 },
    preview: { maxWidth: 320, maxHeight: 240 },
  });
  if (!(preview.data instanceof Uint8ClampedArray) || preview.data.length !== preview.stride * preview.height) {
    throw new Error('Worker did not transfer a valid RGBA8 preview');
  }
  await call('exportImage', { imageId, outputPath, params: { exposure: 0, contrast: 0, saturation: 0 } });
  const exportBytes = fs.statSync(outputPath).size;
  fs.unlinkSync(outputPath);
  await call('closeImage', { imageId });
  console.log(JSON.stringify({
    imageId,
    preview: { width: preview.width, height: preview.height, bytes: preview.data.length },
    exportBytes,
    workerThread: true,
  }));
}

main()
  .finally(() => worker.terminate())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
