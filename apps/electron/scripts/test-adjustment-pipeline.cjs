const path = require('node:path');

if (process.platform === 'win32') {
  const runtimeDir = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin');
  process.env.PATH = `${runtimeDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

const addon = require('../native/build/Release/rawelectron_engine.node');
const source = path.resolve(__dirname, '..', '..', '..', 'third_party', 'opencv', 'samples', 'data', 'lena.jpg');
const image = addon.openImage(source);

const render = (params) => addon.renderPreview({
  requestId: 1,
  imageId: image.id,
  quality: 'proxy',
  params,
  preview: { maxWidth: 256, maxHeight: 256 },
}).data;

const baseline = render({});
const cases = {
  exposure: 1,
  contrast: 100,
  highlights: 100,
  shadows: 100,
  whites: 100,
  blacks: 100,
  temperature: 100,
  tint: 100,
  vibrance: 100,
  saturation: 100,
  texture: 100,
  clarity: 100,
  dehaze: 100,
  vignette: 100,
  grain: 100,
  sharpening: 100,
  luminanceNoise: 100,
  colorNoise: 100,
  moire: 100,
  defringe: 100,
};

const differences = Object.fromEntries(Object.entries(cases).map(([name, value]) => {
  const pixels = render({ [name]: value });
  let changedBytes = 0;
  let absoluteDifference = 0;
  for (let index = 0; index < baseline.length; index += 1) {
    if (pixels[index] !== baseline[index]) changedBytes += 1;
    absoluteDifference += Math.abs(pixels[index] - baseline[index]);
  }
  return [name, { changedBytes, absoluteDifference }];
}));

addon.closeImage(image.id);
const unchanged = Object.entries(differences).filter(([, result]) => result.changedBytes === 0);
if (unchanged.length) throw new Error(`Adjustments did not change pixels: ${unchanged.map(([name]) => name).join(', ')}`);
console.log(JSON.stringify(differences));
