const path = require('node:path');
const fs = require('node:fs');

if (process.platform === 'win32') {
  const runtimeDir = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin');
  process.env.PATH = `${runtimeDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

const addon = require('../native/build/Release/rawelectron_engine.node');
const sourceImagePath = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
const imagePath = path.resolve(__dirname, '..', 'native', 'build', '한글 경로 JPEG 테스트.jpg');
fs.copyFileSync(sourceImagePath, imagePath);
const opened = addon.openImage(imagePath);
const imageId = opened.id;
if (opened.width <= 0 || opened.height <= 0 || opened.pixelFormat !== 'rgba8') {
  throw new Error('C++ openImage did not return decoded image metadata');
}
const directBuffer = new SharedArrayBuffer(320 * 240 * 4);
const directBitmap = {
  width: 320,
  height: 240,
  stride: 320 * 4,
  pixelFormat: 'rgba8',
  data: new Uint8ClampedArray(directBuffer),
};
const directPreview = addon.renderPreviewInto({
  requestId: 76,
  imageId,
  quality: 'proxy',
  imageInfo: opened,
  params: { exposure: 0, contrast: 0, saturation: 0 },
  preview: { maxWidth: 320, maxHeight: 240 },
}, directBitmap);
const directPixels = new Uint8ClampedArray(
  directBuffer,
  0,
  directPreview.stride * directPreview.height,
);
if (!directPixels.some(Boolean)) {
  throw new Error('C++ did not render directly into shared storage');
}
const preview = addon.renderPreview({
  requestId: 77,
  imageId,
  quality: 'original',
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

const exportPath = path.resolve(__dirname, '..', 'native', 'build', '한글 경로 PNG 출력.png');
addon.exportRenderedImage({
  imageId,
  outputPath: exportPath,
  params: { exposure: 0.25, contrast: 5, saturation: 10 },
});
if (!fs.existsSync(exportPath) || fs.statSync(exportPath).size === 0) {
  throw new Error('Engine export failed');
}
const exportBytes = fs.statSync(exportPath).size;
const exportedImage = addon.openImage(exportPath);
if (exportedImage.width !== opened.width || exportedImage.height !== opened.height) {
  throw new Error('C++ could not reopen the Unicode-path PNG export');
}
addon.closeImage(exportedImage.id);

addon.closeImage(imageId);
let closedHandleRejected = false;
try {
  addon.renderPreview({ requestId: 78, imageId, quality: 'proxy', params: {}, preview: { maxWidth: 10, maxHeight: 10 } });
} catch (error) {
  closedHandleRejected = /ImageId was not found/.test(String(error));
}

if (!closedHandleRejected) {
  throw new Error('Closed ImageId was not rejected');
}

fs.unlinkSync(imagePath);
fs.unlinkSync(exportPath);

console.log(JSON.stringify({
  imageId,
  preview: {
    width: preview.width,
    height: preview.height,
    stride: preview.stride,
    bytes: preview.data.length,
  },
  directSharedRender: {
    width: directPreview.width,
    height: directPreview.height,
    bytes: directPixels.length,
  },
  exportBytes,
  unicodeJpegAndPng: true,
  engine: preview.engine,
  closedHandleRejected,
}));
