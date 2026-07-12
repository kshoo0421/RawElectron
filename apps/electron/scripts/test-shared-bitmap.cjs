const path = require('node:path');

if (process.platform === 'win32') {
  const runtimeDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'third_party',
    'opencv',
    'install',
    'x64',
    'vc17',
    'bin',
  );
  process.env.PATH = `${runtimeDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

const addon = require('../native/build/Release/rawelectron_engine.node');
const bitmap = addon.createSharedBitmap(2, 2);

if (!(bitmap.data instanceof Uint8ClampedArray)) {
  throw new Error('Expected Uint8ClampedArray pixel storage');
}
if (bitmap.stride !== 8 || bitmap.data.byteLength !== 16) {
  throw new Error('Unexpected RGBA8 bitmap layout');
}

bitmap.data.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const jsToCppChecksum = addon.checksumSharedBitmap(bitmap);
const originalBuffer = bitmap.data.buffer;
const returned = addon.fillSharedBitmap(bitmap, 0x11223344);

if (returned.data.buffer !== originalBuffer) {
  throw new Error('Native fill replaced or copied the pixel buffer');
}

for (let offset = 0; offset < bitmap.data.length; offset += 4) {
  const pixel = bitmap.data.subarray(offset, offset + 4);
  if (pixel[0] !== 0x11 || pixel[1] !== 0x22 || pixel[2] !== 0x33 || pixel[3] !== 0x44) {
    throw new Error('Native pixel write is not visible from JavaScript');
  }
}

console.log(JSON.stringify({
  layout: {
    width: bitmap.width,
    height: bitmap.height,
    stride: bitmap.stride,
    bytes: bitmap.data.byteLength,
  },
  jsToCppChecksum,
  zeroCopy: true,
  firstPixel: [...bitmap.data.subarray(0, 4)],
}));
