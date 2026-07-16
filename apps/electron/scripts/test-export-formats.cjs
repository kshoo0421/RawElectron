const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (process.platform === 'win32') {
  const runtimeDir = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin');
  process.env.PATH = `${runtimeDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

const addon = require('../native/build/Release/rawelectron_engine.node');
const source = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rawelectron-export-'));
const extensions = [
  'jpg', 'jpeg', 'jpe', 'png', 'webp', 'tif', 'tiff', 'bmp', 'dib',
  'jp2', 'j2k', 'jpc', 'pbm', 'pgm', 'ppm', 'pam', 'pnm',
  'hdr', 'pic', 'sr', 'ras',
];

const image = addon.openImage(source);
try {
  for (const extension of extensions) {
    process.stdout.write(`Checking .${extension}... `);
    const outputPath = path.join(outputDir, `export.${extension}`);
    addon.exportRenderedImage({ imageId: image.id, outputPath, params: {} });
    if (!fs.statSync(outputPath).size) throw new Error(`${extension} export is empty`);
    const signature = fs.readFileSync(outputPath).subarray(0, 8).toString('hex');
    if (['jpg', 'jpeg', 'jpe'].includes(extension) && !signature.startsWith('ffd8ff')) {
      throw new Error(`${extension} export does not contain JPEG data`);
    }
    if (extension === 'png' && signature !== '89504e470d0a1a0a') {
      throw new Error('png export does not contain PNG data');
    }
    const reopened = addon.openImage(outputPath);
    addon.closeImage(reopened.id);
    console.log('ok');
  }
} finally {
  addon.closeImage(image.id);
  fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log(`Verified ${extensions.length} export extensions.`);
