export type CropParams = {
  enabled: boolean;
  ratio: string;
  rotation: number;
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
  texture: number;
  clarity: number;
  dehaze: number;
  vignette: number;
  grain: number;
  sharpening: number;
  luminanceNoise: number;
  colorNoise: number;
  removeCa: boolean;
  lensCorrection: boolean;
  moire: number;
  defringe: number;
  crop: CropParams;
  remove: RemoveParams;
  mask: MaskParams;
};

export type EngineWorkerRenderRequest = {
  requestId: number;
  imagePath: string;
  params: EditParams;
  preview: {
    maxWidth: number;
    maxHeight: number;
  };
};

export type EngineWorkerRenderResponse = {
  requestId: number;
  imageUrl: string;
  engine: 'stub' | 'cpp' | 'cpp-opencv';
};

export type EngineWorkerExportRequest = {
  imagePath: string;
  outputPath: string;
  params: EditParams;
};
