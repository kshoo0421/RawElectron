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
  vignetteShape: { vignette: -70, vignetteMidpoint: 25, vignetteRoundness: 60, vignetteFeather: 20, vignetteHighlights: 40 },
  grainShape: { grain: 70, grainSize: 80, grainRoughness: 90 },
  sharpeningControls: { sharpening: 100, sharpeningRadius: 2.2, sharpeningDetail: 80, sharpeningMasking: 35 },
  luminanceNoiseControls: { luminanceNoise: 70, luminanceNoiseDetail: 20, luminanceNoiseContrast: 60 },
  colorNoiseControls: { colorNoise: 70, colorNoiseDetail: 20, colorNoiseSmoothness: 90 },
  removeCa: true,
  lensCorrection: true,
  colorMixer: { redHue: 45, redSaturation: 35, greenHue: -30, greenSaturation: 20, blueHue: 25, blueSaturation: 40 },
  colorGrading: { shadowHue: 220, shadowSaturation: 35, midtoneHue: 35, midtoneSaturation: 20, highlightHue: 55, highlightSaturation: 30, colorGradingBlending: 65, colorGradingBalance: 15 },
  curves: {
    rgb: [{ x: 0.25, y: 0.1 }, { x: 0.7, y: 0.85 }],
    red: [{ x: 0.5, y: 0.25 }],
    green: [],
    blue: [],
  },
};

const differences = Object.fromEntries(Object.entries(cases).map(([name, value]) => {
  const pixels = render(typeof value === 'object' && !Array.isArray(value) && name !== 'curves'
    ? value
    : { [name]: value });
  let changedBytes = 0;
  let absoluteDifference = 0;
  for (let index = 0; index < baseline.length; index += 1) {
    if (pixels[index] !== baseline[index]) changedBytes += 1;
    absoluteDifference += Math.abs(pixels[index] - baseline[index]);
  }
  return [name, { changedBytes, absoluteDifference }];
}));

const unchanged = Object.entries(differences).filter(([, result]) => result.changedBytes === 0);
if (unchanged.length) throw new Error(`Adjustments did not change pixels: ${unchanged.map(([name]) => name).join(', ')}`);
const moirePixels = render({ moire: 100 });
const defringePixels = render({ defringe: 100 });
if (Buffer.compare(Buffer.from(moirePixels), Buffer.from(defringePixels)) === 0) {
  throw new Error('Moire and defringe must use distinct processing algorithms');
}
const dependentCases = {
  vignetteMidpoint: [{ vignette: 40, vignetteMidpoint: 50 }, { vignette: 40, vignetteMidpoint: 15 }],
  vignetteRoundness: [{ vignette: 40, vignetteRoundness: 0 }, { vignette: 40, vignetteRoundness: 75 }],
  vignetteFeather: [{ vignette: 40, vignetteFeather: 50 }, { vignette: 40, vignetteFeather: 10 }],
  vignetteHighlights: [{ vignette: 40, vignetteHighlights: 0 }, { vignette: 40, vignetteHighlights: 80 }],
  grainSize: [{ grain: 50, grainSize: 25 }, { grain: 50, grainSize: 80 }],
  grainRoughness: [{ grain: 50, grainRoughness: 50 }, { grain: 50, grainRoughness: 90 }],
  sharpeningRadius: [{ sharpening: 60, sharpeningRadius: 1 }, { sharpening: 60, sharpeningRadius: 2.5 }],
  sharpeningDetail: [{ sharpening: 60, sharpeningDetail: 25 }, { sharpening: 60, sharpeningDetail: 90 }],
  sharpeningMasking: [{ sharpening: 60, sharpeningMasking: 0 }, { sharpening: 60, sharpeningMasking: 80 }],
  luminanceNoiseDetail: [{ luminanceNoise: 50, luminanceNoiseDetail: 50 }, { luminanceNoise: 50, luminanceNoiseDetail: 10 }],
  luminanceNoiseContrast: [{ luminanceNoise: 50, luminanceNoiseContrast: 0 }, { luminanceNoise: 50, luminanceNoiseContrast: 80 }],
  colorNoiseDetail: [{ colorNoise: 50, colorNoiseDetail: 50 }, { colorNoise: 50, colorNoiseDetail: 10 }],
  colorNoiseSmoothness: [{ colorNoise: 50, colorNoiseSmoothness: 50 }, { colorNoise: 50, colorNoiseSmoothness: 90 }],
  colorGradingBlending: [
    { midtoneHue: 35, midtoneSaturation: 30, colorGradingBlending: 20 },
    { midtoneHue: 35, midtoneSaturation: 30, colorGradingBlending: 90 },
  ],
  colorGradingBalance: [
    { shadowHue: 220, shadowSaturation: 25, highlightHue: 50, highlightSaturation: 25, colorGradingBalance: -60 },
    { shadowHue: 220, shadowSaturation: 25, highlightHue: 50, highlightSaturation: 25, colorGradingBalance: 60 },
  ],
};
const inactiveDependent = Object.entries(dependentCases).filter(([, [before, after]]) =>
  Buffer.compare(Buffer.from(render(before)), Buffer.from(render(after))) === 0);
if (inactiveDependent.length) {
  throw new Error(`Dependent adjustments did not change pixels: ${inactiveDependent.map(([name]) => name).join(', ')}`);
}
addon.closeImage(image.id);
console.log(JSON.stringify(differences));
