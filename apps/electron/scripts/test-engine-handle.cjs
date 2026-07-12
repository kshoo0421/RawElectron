const path = require('node:path');
const fs = require('node:fs');

if (process.platform === 'win32') {
  const runtimeDir = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin');
  process.env.PATH = `${runtimeDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

const addon = require('../native/build/Release/rawelectron_engine.node');
const imagePath = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
const imageId = addon.openImage(imagePath);
const preview = addon.renderPreview({
  requestId: 77,
  imageId,
  params: {
    exposure: 0,
    contrast: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    sharpening: 0,
  },
  preview: { maxWidth: 320, maxHeight: 240 },
});

if (preview.requestId !== 77 || preview.data.length === 0 || preview.stride !== preview.width * 4) {
  throw new Error('Handle-based preview failed');
}

const exportPath = path.resolve(__dirname, '..', 'native', 'build', 'engine-handle-export.png');
addon.exportRenderedImage({
  imageId,
  outputPath: exportPath,
  params: { exposure: 0.25, contrast: 5, saturation: 10 },
});
if (!fs.existsSync(exportPath) || fs.statSync(exportPath).size === 0) {
  throw new Error('Engine export failed');
}
const exportBytes = fs.statSync(exportPath).size;
fs.unlinkSync(exportPath);

addon.closeImage(imageId);
let closedHandleRejected = false;
try {
  addon.renderPreview({ requestId: 78, imageId, params: {}, preview: { maxWidth: 10, maxHeight: 10 } });
} catch (error) {
  closedHandleRejected = /ImageId was not found/.test(String(error));
}

if (!closedHandleRejected) {
  throw new Error('Closed ImageId was not rejected');
}

console.log(JSON.stringify({
  imageId,
  preview: {
    width: preview.width,
    height: preview.height,
    stride: preview.stride,
    bytes: preview.data.length,
  },
  exportBytes,
  engine: preview.engine,
  closedHandleRejected,
}));
