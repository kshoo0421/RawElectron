const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');

const imagePath = process.argv[2];
const maxWidth = Number(process.argv[3] || 1200);
const maxHeight = Number(process.argv[4] || 800);

if (!imagePath) {
  throw new Error('Usage: node scripts/test-preview-file.cjs <image-path> [max-width] [max-height]');
}

const workers = {
  proxy: new Worker(path.resolve(__dirname, '..', '.vite', 'build', 'engineHost.js')),
  original: new Worker(path.resolve(__dirname, '..', '.vite', 'build', 'engineHost.js')),
};
const pending = new Map();
let nextCommandId = 1;

for (const [quality, worker] of Object.entries(workers)) {
  worker.on('message', (message) => {
    const command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error));
    else command.resolve(message.result);
  });
  worker.on('error', (error) => console.error(`${quality} worker error:`, error));
}

function call(worker, type, payload, timeoutMs) {
  const id = nextCommandId++;
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${type} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve({ result, durationMs: Math.round(performance.now() - startedAt) });
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    worker.postMessage({ id, type, payload });
  });
}

async function render(quality, imageId) {
  const buffer = new SharedArrayBuffer(maxWidth * maxHeight * 4);
  const { result, durationMs } = await call(workers[quality], 'renderPreviewShared', {
    request: {
      requestId: quality === 'proxy' ? 1 : 2,
      imageId,
      quality,
      params: {},
      preview: { maxWidth, maxHeight },
    },
    buffer,
  }, quality === 'proxy' ? 10000 : 120000);
  const pixels = new Uint8ClampedArray(buffer, 0, result.stride * result.height);
  return {
    quality,
    durationMs,
    width: result.width,
    height: result.height,
    stride: result.stride,
    nonZero: pixels.some(Boolean),
  };
}

async function main() {
  const opened = await call(workers.proxy, 'openImage', { imagePath }, 30000);
  console.log(JSON.stringify({ stage: 'open', durationMs: opened.durationMs, image: opened.result }));
  const proxy = await render('proxy', opened.result.id);
  console.log(JSON.stringify({ stage: 'proxy', ...proxy }));
  const previewPath = path.resolve(__dirname, '..', 'native', 'build', 'preview-file-test.png');
  const filePreview = await call(workers.proxy, 'renderPreviewFile', {
    request: {
      requestId: 3,
      imageId: opened.result.id,
      quality: 'proxy',
      params: {},
      preview: { maxWidth, maxHeight },
    },
    outputPath: previewPath,
  }, 10000);
  const signature = fs.readFileSync(previewPath).subarray(0, 8).toString('hex');
  const bytes = fs.statSync(previewPath).size;
  fs.unlinkSync(previewPath);
  console.log(JSON.stringify({ stage: 'preview-file', durationMs: filePreview.durationMs, bytes, signature }));
  const original = await render('original', opened.result.id);
  console.log(JSON.stringify({ stage: 'original', ...original }));
}

main()
  .finally(() => Promise.all(Object.values(workers).map((worker) => worker.terminate())))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
