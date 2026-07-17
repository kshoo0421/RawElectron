export type CropParams = {
  enabled: boolean;
  ratio: string;
  rotation: number;
  quarterTurns: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  applyCrop?: boolean;
};

export type RemoveParams = {
  brushSize: number;
  detectObjects: boolean;
  generativeAi: boolean;
};

export type MaskParams = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  saturation: number;
  hue: number;
  texture: number;
  clarity: number;
  dehaze: number;
  noise: number;
  sharpness: number;
  moire: number;
  defringe: number;
  fineAdjust: boolean;
};

export type EditParams = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  redHue: number;
  redSaturation: number;
  greenHue: number;
  greenSaturation: number;
  blueHue: number;
  blueSaturation: number;
  shadowHue: number;
  shadowSaturation: number;
  midtoneHue: number;
  midtoneSaturation: number;
  highlightHue: number;
  highlightSaturation: number;
  colorGradingBlending: number;
  colorGradingBalance: number;
  texture: number;
  clarity: number;
  dehaze: number;
  vignette: number;
  vignetteMidpoint: number;
  vignetteRoundness: number;
  vignetteFeather: number;
  vignetteHighlights: number;
  grain: number;
  grainSize: number;
  grainRoughness: number;
  sharpening: number;
  sharpeningRadius: number;
  sharpeningDetail: number;
  sharpeningMasking: number;
  luminanceNoise: number;
  luminanceNoiseDetail: number;
  luminanceNoiseContrast: number;
  colorNoise: number;
  colorNoiseDetail: number;
  colorNoiseSmoothness: number;
  removeCa: boolean;
  lensCorrection: boolean;
  moire: number;
  defringe: number;
  curves: {
    rgb: Array<{ x: number; y: number }>;
    red: Array<{ x: number; y: number }>;
    green: Array<{ x: number; y: number }>;
    blue: Array<{ x: number; y: number }>;
  };
  crop: CropParams;
  remove: RemoveParams;
  mask: MaskParams;
};

export type EngineWorkerRenderRequest = {
  requestId: number;
  imageId: number;
  quality: 'proxy' | 'original';
  params: EditParams;
  preview: {
    maxWidth: number;
    maxHeight: number;
  };
};

export type EngineWorkerRenderResponse = {
  requestId: number;
  quality: 'proxy' | 'original';
  bitmap: {
    width: number;
    height: number;
    stride: number;
    pixelFormat: 'rgba8';
    data: Uint8ClampedArray;
  };
  engine: 'stub' | 'cpp' | 'cpp-opencv';
};

export type EngineWorkerExportRequest = {
  imageId: number;
  outputPath: string;
  params: EditParams;
};

export type ExportFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'tiff'
  | 'bmp'
  | 'jpeg2000'
  | 'ppm'
  | 'hdr'
  | 'ras';

export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DebugLogEntry = {
  id: number;
  timestamp: string;
  level: DebugLogLevel;
  source: string;
  message: string;
};
