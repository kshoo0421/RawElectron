import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DebugLogEntry, EditParams, ExportFormat } from './shared/engineTypes';
import type { PresetValues } from './shared/presetXmp';
import './index.css';

type ThemeMode = 'dark' | 'light';
type ToolSectionId = 'light' | 'color' | 'effects' | 'detail' | 'optics';

type SliderOption = {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
};

type ToolSection = {
  id: ToolSectionId;
  title: string;
  controls: SliderOption[];
};

type CurveChannel = 'rgb' | 'red' | 'green' | 'blue';
type CurvePoint = { x: number; y: number };
type Curves = Record<CurveChannel, CurvePoint[]>;
type CropState = EditParams['crop'];
type EditState = { sections: ToolSection[]; curves: Curves; crop: CropState };
type PersistedEditState = { values: Record<string, number>; curves: Curves; crop?: CropState };
const identityCurves: Curves = {
  rgb: [],
  red: [],
  green: [],
  blue: [],
};
const identityCrop: CropState = {
  enabled: false,
  ratio: '원본',
  rotation: 0,
  quarterTurns: 0,
  flipHorizontal: false,
  flipVertical: false,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

type ImageFile = {
  id: number;
  name: string;
  path: string;
  width: number;
  height: number;
  pixelFormat: 'rgba8';
};

type LibraryFolder = { id: string; name: string; parentId?: string | null };
type LibraryEntry = { path: string; alias?: string; folderId?: string | null };

type SharedPreviewResult = {
  type: 'shared-preview-ready';
  requestId: number;
  quality: 'proxy' | 'original';
  width: number;
  height: number;
  stride: number;
  engine: 'cpp' | 'cpp-opencv';
  data: Uint8ClampedArray;
};

type Histograms = {
  luminance: number[];
  red: number[];
  green: number[];
  blue: number[];
};
type AutoAdjustmentPreset = 'balanced' | 'warm' | 'cool' | 'vivid' | 'soft';

function histogramPercentile(values: number[], percentile: number) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0.5;
  const target = total * percentile;
  let accumulated = 0;
  for (let index = 0; index < values.length; index += 1) {
    accumulated += values[index];
    if (accumulated >= target) return (index + 0.5) / values.length;
  }
  return 1;
}

function histogramMean(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0.5;
  return values.reduce((sum, value, index) =>
    sum + value * ((index + 0.5) / values.length), 0) / total;
}

function calculateHistograms(result: SharedPreviewResult): Histograms {
  const histograms: Histograms = {
    luminance: Array(64).fill(0),
    red: Array(64).fill(0),
    green: Array(64).fill(0),
    blue: Array(64).fill(0),
  };
  const sampleStep = Math.max(1, Math.floor((result.width * result.height) / 250_000));
  let pixelIndex = 0;
  for (let row = 0; row < result.height; row += 1) {
    const rowOffset = row * result.stride;
    for (let column = 0; column < result.width; column += 1, pixelIndex += 1) {
      if (pixelIndex % sampleStep !== 0) continue;
      const offset = rowOffset + column * 4;
      const red = result.data[offset];
      const green = result.data[offset + 1];
      const blue = result.data[offset + 2];
      const luminance = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
      histograms.red[Math.min(63, red >> 2)] += 1;
      histograms.green[Math.min(63, green >> 2)] += 1;
      histograms.blue[Math.min(63, blue >> 2)] += 1;
      histograms.luminance[Math.min(63, luminance >> 2)] += 1;
    }
  }
  return histograms;
}

function automaticAdjustments(histograms: Histograms, preset: AutoAdjustmentPreset) {
  const low = histogramPercentile(histograms.luminance, 0.05);
  const middle = histogramPercentile(histograms.luminance, 0.5);
  const high = histogramPercentile(histograms.luminance, 0.95);
  const red = histogramMean(histograms.red);
  const green = histogramMean(histograms.green);
  const blue = histogramMean(histograms.blue);
  const exposure = Math.max(-1.5, Math.min(1.5, Math.log2(0.48 / Math.max(0.05, middle))));
  const neutralTemperature = Math.max(-35, Math.min(35, (blue - red) * 95));
  const neutralTint = Math.max(-25, Math.min(25, (green - (red + blue) * 0.5) * 85));
  const values: Record<string, number> = {
    exposure,
    contrast: Math.max(-20, Math.min(30, (0.78 - (high - low)) * 75)),
    highlights: Math.max(-45, Math.min(25, (0.88 - high) * 140)),
    shadows: Math.max(-20, Math.min(45, (0.12 - low) * 180)),
    whites: Math.max(-20, Math.min(30, (0.96 - high) * 120)),
    blacks: Math.max(-25, Math.min(20, (0.04 - low) * 150)),
    temperature: neutralTemperature,
    tint: neutralTint,
    vibrance: 12,
    saturation: 0,
    clarity: 5,
  };
  if (preset === 'warm') Object.assign(values, {
    temperature: neutralTemperature + 22, tint: neutralTint + 4, vibrance: 18, saturation: 3,
  });
  if (preset === 'cool') Object.assign(values, {
    temperature: neutralTemperature - 22, tint: neutralTint - 2, vibrance: 14, saturation: -2,
  });
  if (preset === 'vivid') Object.assign(values, {
    contrast: values.contrast + 14, vibrance: 30, saturation: 8, clarity: 18, texture: 10,
  });
  if (preset === 'soft') Object.assign(values, {
    contrast: values.contrast - 14, highlights: values.highlights - 8,
    shadows: values.shadows + 12, vibrance: 8, saturation: -6, clarity: -15, texture: -8,
  });
  return values;
}

declare global {
  interface Window {
    rawElectron: {
      openImages: () => Promise<ImageFile[]>;
      openDroppedImages: (files: File[]) => Promise<ImageFile[]>;
      closeImage: (imageId: number) => Promise<boolean>;
      loadLibrary: () => Promise<{ folders: LibraryFolder[]; entries: LibraryEntry[] }>;
      openLibraryEntry: (filePath: string) => Promise<ImageFile | null>;
      saveLibrary: (state: { folders: LibraryFolder[]; entries: LibraryEntry[] }) => Promise<boolean>;
      loadEditState: (imageId: number) => Promise<PersistedEditState | null>;
      saveEditState: (imageId: number, state: PersistedEditState) => Promise<boolean>;
      importXmpPreset: () => Promise<{ canceled: boolean; values?: PresetValues }>;
      exportXmpPreset: (values: PresetValues) => Promise<{ canceled: boolean; path?: string }>;
      exportImage: (
        imageId: number,
        params: EditParams,
        format: ExportFormat,
      ) => Promise<{ canceled: boolean; path?: string }>;
      dragExportImage: (
        imageId: number,
        params: EditParams,
        format: ExportFormat,
      ) => Promise<{ path: string }>;
      getDebugLogs: () => Promise<DebugLogEntry[]>;
      onDebugLog: (callback: (entry: DebugLogEntry) => void) => () => void;
      requestSharedPreviewChannel: () => void;
      reportDebugError: (source: string, message: string) => void;
    };
  }
}

const editSections: ToolSection[] = [
  {
    id: 'light',
    title: '밝기',
    controls: [
      { id: 'exposure', label: '노출', min: -5, max: 5, value: 0, step: 0.1 },
      { id: 'contrast', label: '대비', min: -100, max: 100, value: 0 },
      { id: 'highlights', label: '하이라이트', min: -100, max: 100, value: 0 },
      { id: 'shadows', label: '그림자', min: -100, max: 100, value: 0 },
      { id: 'whites', label: '흰색', min: -100, max: 100, value: 0 },
      { id: 'blacks', label: '검정', min: -100, max: 100, value: 0 },
    ],
  },
  {
    id: 'color',
    title: '색상',
    controls: [
      { id: 'temperature', label: '색온도', min: -100, max: 100, value: 0 },
      { id: 'tint', label: '색조', min: -100, max: 100, value: 0 },
      { id: 'vibrance', label: '생동감', min: -100, max: 100, value: 0 },
      { id: 'saturation', label: '채도', min: -100, max: 100, value: 0 },
      { id: 'redHue', label: '빨강 색조', min: -100, max: 100, value: 0 },
      { id: 'redSaturation', label: '빨강 채도', min: -100, max: 100, value: 0 },
      { id: 'greenHue', label: '초록 색조', min: -100, max: 100, value: 0 },
      { id: 'greenSaturation', label: '초록 채도', min: -100, max: 100, value: 0 },
      { id: 'blueHue', label: '파랑 색조', min: -100, max: 100, value: 0 },
      { id: 'blueSaturation', label: '파랑 채도', min: -100, max: 100, value: 0 },
      { id: 'shadowHue', label: '어두운 영역 색조', min: 0, max: 360, value: 0 },
      { id: 'shadowSaturation', label: '어두운 영역 채도', min: 0, max: 100, value: 0 },
      { id: 'midtoneHue', label: '중간 영역 색조', min: 0, max: 360, value: 0 },
      { id: 'midtoneSaturation', label: '중간 영역 채도', min: 0, max: 100, value: 0 },
      { id: 'highlightHue', label: '밝은 영역 색조', min: 0, max: 360, value: 0 },
      { id: 'highlightSaturation', label: '밝은 영역 채도', min: 0, max: 100, value: 0 },
      { id: 'colorGradingBlending', label: '혼합', min: 0, max: 100, value: 50 },
      { id: 'colorGradingBalance', label: '균형', min: -100, max: 100, value: 0 },
    ],
  },
  {
    id: 'effects',
    title: '효과',
    controls: [
      { id: 'texture', label: '텍스처', min: -100, max: 100, value: 0 },
      { id: 'clarity', label: '명료도', min: -100, max: 100, value: 0 },
      { id: 'dehaze', label: '안개 제거', min: -100, max: 100, value: 0 },
      { id: 'vignette', label: '비네팅', min: -100, max: 100, value: 0 },
      { id: 'vignetteMidpoint', label: '중간점', min: 0, max: 100, value: 50 },
      { id: 'vignetteRoundness', label: '원형률', min: -100, max: 100, value: 0 },
      { id: 'vignetteFeather', label: '페더', min: 0, max: 100, value: 50 },
      { id: 'vignetteHighlights', label: '밝은 영역', min: 0, max: 100, value: 0 },
      { id: 'grain', label: '그레인', min: 0, max: 100, value: 0 },
      { id: 'grainSize', label: '크기', min: 0, max: 100, value: 25 },
      { id: 'grainRoughness', label: '거칠기', min: 0, max: 100, value: 50 },
    ],
  },
  {
    id: 'detail',
    title: '디테일',
    controls: [
      { id: 'sharpening', label: '선명 효과', min: 0, max: 150, value: 0 },
      { id: 'sharpeningRadius', label: '반경', min: 0.5, max: 3, value: 1, step: 0.1 },
      { id: 'sharpeningDetail', label: '세부 정보', min: 0, max: 100, value: 25 },
      { id: 'sharpeningMasking', label: '마스킹', min: 0, max: 100, value: 0 },
      { id: 'luminanceNoise', label: '노이즈 감소', min: 0, max: 100, value: 0 },
      { id: 'luminanceNoiseDetail', label: '세부 정보', min: 0, max: 100, value: 50 },
      { id: 'luminanceNoiseContrast', label: '대비', min: 0, max: 100, value: 0 },
      { id: 'colorNoise', label: '색상 노이즈 감소', min: 0, max: 100, value: 0 },
      { id: 'colorNoiseDetail', label: '세부 정보', min: 0, max: 100, value: 50 },
      { id: 'colorNoiseSmoothness', label: '매끄러움', min: 0, max: 100, value: 50 },
    ],
  },
  {
    id: 'optics',
    title: '아티팩트 감소',
    controls: [
      { id: 'removeCa', label: 'CA 제거', min: 0, max: 1, value: 0, step: 1 },
      { id: 'lensCorrection', label: '렌즈 교정 사용', min: 0, max: 1, value: 0, step: 1 },
      { id: 'moire', label: '모아레 감소', min: 0, max: 100, value: 0 },
      { id: 'defringe', label: '프린지 제거', min: 0, max: 100, value: 0 },
    ],
  },
];

function sliderValue(sections: ToolSection[], id: string, fallback = 0) {
  for (const section of sections) {
    const control = section.controls.find((item) => item.id === id);
    if (control) return control.value;
  }
  return fallback;
}

function buildEditParams(sections: ToolSection[], curves: Curves, crop: CropState): EditParams {
  return {
    exposure: sliderValue(sections, 'exposure'),
    contrast: sliderValue(sections, 'contrast'),
    highlights: sliderValue(sections, 'highlights'),
    shadows: sliderValue(sections, 'shadows'),
    whites: sliderValue(sections, 'whites'),
    blacks: sliderValue(sections, 'blacks'),
    temperature: sliderValue(sections, 'temperature'),
    tint: sliderValue(sections, 'tint'),
    vibrance: sliderValue(sections, 'vibrance'),
    saturation: sliderValue(sections, 'saturation'),
    redHue: sliderValue(sections, 'redHue'),
    redSaturation: sliderValue(sections, 'redSaturation'),
    greenHue: sliderValue(sections, 'greenHue'),
    greenSaturation: sliderValue(sections, 'greenSaturation'),
    blueHue: sliderValue(sections, 'blueHue'),
    blueSaturation: sliderValue(sections, 'blueSaturation'),
    shadowHue: sliderValue(sections, 'shadowHue'),
    shadowSaturation: sliderValue(sections, 'shadowSaturation'),
    midtoneHue: sliderValue(sections, 'midtoneHue'),
    midtoneSaturation: sliderValue(sections, 'midtoneSaturation'),
    highlightHue: sliderValue(sections, 'highlightHue'),
    highlightSaturation: sliderValue(sections, 'highlightSaturation'),
    colorGradingBlending: sliderValue(sections, 'colorGradingBlending', 50),
    colorGradingBalance: sliderValue(sections, 'colorGradingBalance'),
    texture: sliderValue(sections, 'texture'),
    clarity: sliderValue(sections, 'clarity'),
    dehaze: sliderValue(sections, 'dehaze'),
    vignette: sliderValue(sections, 'vignette'),
    vignetteMidpoint: sliderValue(sections, 'vignetteMidpoint', 50),
    vignetteRoundness: sliderValue(sections, 'vignetteRoundness'),
    vignetteFeather: sliderValue(sections, 'vignetteFeather', 50),
    vignetteHighlights: sliderValue(sections, 'vignetteHighlights'),
    grain: sliderValue(sections, 'grain'),
    grainSize: sliderValue(sections, 'grainSize', 25),
    grainRoughness: sliderValue(sections, 'grainRoughness', 50),
    sharpening: sliderValue(sections, 'sharpening'),
    sharpeningRadius: sliderValue(sections, 'sharpeningRadius', 1),
    sharpeningDetail: sliderValue(sections, 'sharpeningDetail', 25),
    sharpeningMasking: sliderValue(sections, 'sharpeningMasking'),
    luminanceNoise: sliderValue(sections, 'luminanceNoise'),
    luminanceNoiseDetail: sliderValue(sections, 'luminanceNoiseDetail', 50),
    luminanceNoiseContrast: sliderValue(sections, 'luminanceNoiseContrast'),
    colorNoise: sliderValue(sections, 'colorNoise'),
    colorNoiseDetail: sliderValue(sections, 'colorNoiseDetail', 50),
    colorNoiseSmoothness: sliderValue(sections, 'colorNoiseSmoothness', 50),
    removeCa: sliderValue(sections, 'removeCa') >= 0.5,
    lensCorrection: sliderValue(sections, 'lensCorrection') >= 0.5,
    moire: sliderValue(sections, 'moire'),
    defringe: sliderValue(sections, 'defringe'),
    curves,
    crop,
    remove: { brushSize: 0, detectObjects: false, generativeAi: false },
    mask: {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      temperature: 0, tint: 0, saturation: 0,
      hue: 0,
      texture: 0, clarity: 0, dehaze: 0, noise: 0, sharpness: 0, moire: 0, defringe: 0,
      fineAdjust: false,
    },
  };
}

function updateSlider(sections: ToolSection[], sectionId: ToolSectionId, controlId: string, value: number) {
  return sections.map((section) => section.id === sectionId ? {
    ...section,
    controls: section.controls.map((control) =>
      control.id === controlId ? { ...control, value } : control),
  } : section);
}

function maximumCropForRotation(imageAspect: number, degrees: number) {
  const width = Math.max(0.0001, imageAspect);
  const height = 1;
  const angle = Math.abs(degrees) * Math.PI / 180;
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const boundingWidth = width * cos + height * sin;
  const boundingHeight = width * sin + height * cos;
  if (sin < 0.000001) return { x: 0, y: 0, width: 1, height: 1 };

  const widthIsLonger = width >= height;
  const longSide = widthIsLonger ? width : height;
  const shortSide = widthIsLonger ? height : width;
  let cropWidth: number;
  let cropHeight: number;
  if (shortSide <= 2 * sin * cos * longSide || Math.abs(sin - cos) < 0.000001) {
    const x = 0.5 * shortSide;
    cropWidth = widthIsLonger ? x / sin : x / cos;
    cropHeight = widthIsLonger ? x / cos : x / sin;
  } else {
    const cos2 = cos * cos - sin * sin;
    cropWidth = (width * cos - height * sin) / cos2;
    cropHeight = (height * cos - width * sin) / cos2;
  }
  const normalizedWidth = Math.min(1, Math.max(0.01, cropWidth / boundingWidth));
  const normalizedHeight = Math.min(1, Math.max(0.01, cropHeight / boundingHeight));
  return {
    x: (1 - normalizedWidth) / 2,
    y: (1 - normalizedHeight) / 2,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

function boundingAspectForRotation(imageAspect: number, degrees: number) {
  const radians = Math.abs(degrees) * Math.PI / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return (imageAspect * cos + sin) / (imageAspect * sin + cos);
}

function maximumFixedRatioCrop(imageAspect: number, degrees: number, targetAspect: number) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const boundingWidth = imageAspect * Math.abs(cos) + Math.abs(sin);
  const boundingHeight = imageAspect * Math.abs(sin) + Math.abs(cos);
  const fits = (halfHeight: number) => {
    const halfWidth = halfHeight * targetAspect;
    for (const x of [-halfWidth, halfWidth]) {
      for (const y of [-halfHeight, halfHeight]) {
        const sourceX = x * cos + y * sin;
        const sourceY = -x * sin + y * cos;
        if (Math.abs(sourceX) > imageAspect / 2 + 0.000001 ||
            Math.abs(sourceY) > 0.5 + 0.000001) return false;
      }
    }
    return true;
  };
  let low = 0;
  let high = Math.min(boundingHeight / 2, boundingWidth / (2 * targetAspect));
  for (let index = 0; index < 40; index += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  const width = Math.min(1, (low * 2 * targetAspect) / boundingWidth);
  const height = Math.min(1, (low * 2) / boundingHeight);
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

function constrainCropPosition(
  imageAspect: number,
  degrees: number,
  crop: Pick<CropState, 'x' | 'y' | 'width' | 'height'>,
) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const boundingWidth = imageAspect * Math.abs(cos) + Math.abs(sin);
  const boundingHeight = imageAspect * Math.abs(sin) + Math.abs(cos);
  const halfWidth = crop.width * boundingWidth / 2;
  const halfHeight = crop.height * boundingHeight / 2;
  const extentX = Math.abs(cos) * halfWidth + Math.abs(sin) * halfHeight;
  const extentY = Math.abs(sin) * halfWidth + Math.abs(cos) * halfHeight;
  const centerX = (crop.x + crop.width / 2 - 0.5) * boundingWidth;
  const centerY = (crop.y + crop.height / 2 - 0.5) * boundingHeight;
  const sourceX = centerX * cos - centerY * sin;
  const sourceY = centerX * sin + centerY * cos;
  const constrainedSourceX = Math.min(
    Math.max(0, imageAspect / 2 - extentX),
    Math.max(-Math.max(0, imageAspect / 2 - extentX), sourceX),
  );
  const constrainedSourceY = Math.min(
    Math.max(0, 0.5 - extentY),
    Math.max(-Math.max(0, 0.5 - extentY), sourceY),
  );
  const constrainedCenterX = constrainedSourceX * cos + constrainedSourceY * sin;
  const constrainedCenterY = -constrainedSourceX * sin + constrainedSourceY * cos;
  return {
    x: constrainedCenterX / boundingWidth + 0.5 - crop.width / 2,
    y: constrainedCenterY / boundingHeight + 0.5 - crop.height / 2,
  };
}

function serializeEditState(state: EditState): PersistedEditState {
  return {
    values: Object.fromEntries(state.sections.flatMap((section) =>
      section.controls.map((control) => [control.id, control.value]))),
    curves: state.curves,
    crop: state.crop,
  };
}

function deserializeEditState(stored: PersistedEditState | null): EditState {
  if (!stored || typeof stored !== 'object') {
    return { sections: editSections, curves: identityCurves, crop: identityCrop };
  }
  const values = stored.values && typeof stored.values === 'object' ? stored.values : {};
  const sections = editSections.map((section) => ({
    ...section,
    controls: section.controls.map((control) => {
      const value = values[control.id];
      return {
        ...control,
        value: typeof value === 'number' && Number.isFinite(value)
          ? Math.min(control.max, Math.max(control.min, value))
          : control.value,
      };
    }),
  }));
  const curves = stored.curves && typeof stored.curves === 'object'
    ? {
        rgb: Array.isArray(stored.curves.rgb) ? stored.curves.rgb : [],
        red: Array.isArray(stored.curves.red) ? stored.curves.red : [],
        green: Array.isArray(stored.curves.green) ? stored.curves.green : [],
        blue: Array.isArray(stored.curves.blue) ? stored.curves.blue : [],
      }
    : identityCurves;
  const crop = stored.crop && typeof stored.crop === 'object'
    ? { ...identityCrop, ...stored.crop }
    : identityCrop;
  return { sections, curves, crop };
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [libraryWidth, setLibraryWidth] = useState(220);
  const [controlsWidth, setControlsWidth] = useState(330);
  const [resizingPanel, setResizingPanel] = useState<'library' | 'controls' | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [failedPaths, setFailedPaths] = useState<Set<string>>(new Set());
  const [draggedLibraryPath, setDraggedLibraryPath] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [lastSelectedFolderId, setLastSelectedFolderId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<{
    title: string;
    value: string;
    description?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const libraryLoaded = useRef(false);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewQuality, setPreviewQuality] = useState<'proxy' | 'original' | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [histograms, setHistograms] = useState<Histograms | null>(null);
  const [sourceHistograms, setSourceHistograms] = useState<Histograms | null>(null);
  const [statusMessage, setStatusMessage] = useState('이미지를 열어 편집을 시작하세요.');
  const [viewportPixels, setViewportPixels] = useState({ width: 1280, height: 960 });
  const [sections, setSections] = useState<ToolSection[]>(editSections);
  const [curves, setCurves] = useState<Curves>(identityCurves);
  const [crop, setCrop] = useState<CropState>(identityCrop);
  const [controlTab, setControlTab] = useState<'adjustments' | 'crop'>('adjustments');
  const [renderQuality, setRenderQuality] = useState<'proxy' | 'original'>('original');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showHistograms, setShowHistograms] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ path: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    kind: 'image' | 'folder'; id: number | string; x: number; y: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const panStart = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const engineRequestId = useRef(0);
  const generatedPreviewUrl = useRef<string | null>(null);
  const sourceHistogramCache = useRef(new Map<number, Histograms>());
  const sharedPreviewPort = useRef<MessagePort | null>(null);
  const sharedPreviewRequests = useRef(new Map<number, {
    resolve: (value: SharedPreviewResult) => void;
    reject: (reason: Error) => void;
  }>());
  const [sharedPreviewReady, setSharedPreviewReady] = useState(false);
  const editStateRef = useRef<EditState>({ sections: editSections, curves: identityCurves, crop: identityCrop });
  const undoStack = useRef<EditState[]>([]);
  const redoStack = useRef<EditState[]>([]);
  const transactionStart = useRef<EditState | null>(null);
  const editLoadRequest = useRef(0);
  const [, setHistoryVersion] = useState(0);

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
  const cropImageAspect = selectedImage
    ? (crop.quarterTurns % 2 === 0
        ? selectedImage.width / selectedImage.height
        : selectedImage.height / selectedImage.width)
    : 1;
  const cropStage = useMemo(() => {
    if (!selectedImage) return null;
    const deviceScale = window.devicePixelRatio || 1;
    const availableWidth = Math.max(120, viewportPixels.width / deviceScale - 72);
    const availableHeight = Math.max(120, viewportPixels.height / deviceScale - 180);
    const sourceWidth = selectedImage.width;
    const sourceHeight = selectedImage.height;
    // The engine applies quarter turns clockwise, then applies a positive fine
    // rotation counter-clockwise. CSS uses clockwise-positive angles, so the
    // equivalent screen-space angle is quarterTurns * 90 - rotation.
    const displayRotation = crop.quarterTurns * 90 - crop.rotation;
    const radians = Math.abs(displayRotation) * Math.PI / 180;
    const boundingWidth = sourceWidth * Math.abs(Math.cos(radians)) +
      sourceHeight * Math.abs(Math.sin(radians));
    const boundingHeight = sourceWidth * Math.abs(Math.sin(radians)) +
      sourceHeight * Math.abs(Math.cos(radians));
    const scale = Math.min(availableWidth / boundingWidth, availableHeight / boundingHeight);
    return {
      width: boundingWidth * scale,
      height: boundingHeight * scale,
      imageWidth: sourceWidth * scale,
      imageHeight: sourceHeight * scale,
      displayRotation,
    };
  }, [selectedImage, viewportPixels, crop.rotation, crop.quarterTurns]);
  const editParams = useMemo(() => buildEditParams(sections, curves, crop), [sections, curves, crop]);
  const [renderParams, setRenderParams] = useState(editParams);
  const cropPreviewParams = useMemo(
    () => buildEditParams(sections, curves, { ...identityCrop, applyCrop: false }),
    [sections, curves],
  );
  const previewRenderParams = useMemo(
    () => controlTab === 'crop' ? cropPreviewParams : renderParams,
    [renderParams, cropPreviewParams, controlTab],
  );
  const fittedPreviewSize = useMemo(() => {
    if (previewSize.width <= 0 || previewSize.height <= 0) return undefined;
    const deviceScale = window.devicePixelRatio || 1;
    const availableWidth = Math.max(1, viewportPixels.width / deviceScale);
    const availableHeight = Math.max(1, viewportPixels.height / deviceScale);
    const scale = Math.min(
      availableWidth / previewSize.width,
      availableHeight / previewSize.height,
    );
    return {
      width: previewSize.width * scale,
      height: previewSize.height * scale,
    };
  }, [previewSize, viewportPixels]);
  const cloneEditState = (state: EditState): EditState => ({
    sections: state.sections.map((section) => ({
      ...section,
      controls: section.controls.map((control) => ({ ...control })),
    })),
    curves: {
      rgb: state.curves.rgb.map((point) => ({ ...point })),
      red: state.curves.red.map((point) => ({ ...point })),
      green: state.curves.green.map((point) => ({ ...point })),
      blue: state.curves.blue.map((point) => ({ ...point })),
    },
    crop: { ...state.crop },
  });
  const restoreEditState = (state: EditState) => {
    const restored = cloneEditState(state);
    editStateRef.current = restored;
    setSections(restored.sections);
    setCurves(restored.curves);
    setCrop(restored.crop);
    setRenderQuality('proxy');
  };
  const pushUndo = (state: EditState) => {
    undoStack.current = [...undoStack.current.slice(-99), cloneEditState(state)];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
  };
  const beginEdit = () => {
    if (!transactionStart.current) transactionStart.current = cloneEditState(editStateRef.current);
  };
  const endEdit = () => {
    const start = transactionStart.current;
    transactionStart.current = null;
    if (start && JSON.stringify(start) !== JSON.stringify(editStateRef.current)) pushUndo(start);
    setRenderQuality('original');
  };
  const undo = () => {
    endEdit();
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(cloneEditState(editStateRef.current));
    restoreEditState(previous);
    if (selectedImageId !== null) {
      void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    }
    setHistoryVersion((value) => value + 1);
  };
  const redo = () => {
    endEdit();
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneEditState(editStateRef.current));
    restoreEditState(next);
    if (selectedImageId !== null) {
      void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    }
    setHistoryVersion((value) => value + 1);
  };
  const changeSliderValue = (sectionId: ToolSectionId, controlId: string, value: number) => {
    const nextSections = updateSlider(editStateRef.current.sections, sectionId, controlId, value);
    editStateRef.current = { ...editStateRef.current, sections: nextSections };
    setSections(nextSections);
    setRenderQuality('proxy');
    if (selectedImageId !== null) {
      void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    }
  };
  const changeCurve = (channel: CurveChannel, points: CurvePoint[]) => {
    const nextCurves = { ...editStateRef.current.curves, [channel]: points };
    editStateRef.current = { ...editStateRef.current, curves: nextCurves };
    setCurves(nextCurves);
    setRenderQuality('proxy');
    if (selectedImageId !== null) {
      void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    }
  };
  const changeCrop = (nextCrop: CropState) => {
    editStateRef.current = { ...editStateRef.current, crop: nextCrop };
    setCrop(nextCrop);
    setRenderQuality('proxy');
    if (selectedImageId !== null) {
      void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    }
  };
  const applyAutomaticAdjustment = (preset: AutoAdjustmentPreset) => {
    if (!sourceHistograms || selectedImageId === null) return;
    const values = automaticAdjustments(sourceHistograms, preset);
    const nextSections = editStateRef.current.sections.map((section) => ({
      ...section,
      controls: section.controls.map((control) => {
        const value = values[control.id];
        return value === undefined ? control : {
          ...control,
          value: Math.min(control.max, Math.max(control.min, value)),
        };
      }),
    }));
    if (JSON.stringify(nextSections) === JSON.stringify(editStateRef.current.sections)) return;
    pushUndo(editStateRef.current);
    const nextState = { ...editStateRef.current, sections: nextSections };
    editStateRef.current = nextState;
    setSections(nextSections);
    setRenderQuality('original');
    void window.rawElectron.saveEditState(selectedImageId, serializeEditState(nextState));
  };
  const applyPresetValues = (values: PresetValues) => {
    if (selectedImageId === null) return;
    const nextSections = editStateRef.current.sections.map((section) => ({
      ...section,
      controls: section.controls.map((control) => {
        const presetValue = values[control.id as keyof PresetValues];
        if (presetValue === undefined) return control;
        const numeric = typeof presetValue === 'boolean' ? (presetValue ? 1 : 0) : presetValue;
        return { ...control, value: Math.min(control.max, Math.max(control.min, numeric)) };
      }),
    }));
    if (JSON.stringify(nextSections) === JSON.stringify(editStateRef.current.sections)) return;
    pushUndo(editStateRef.current);
    const nextState = { ...editStateRef.current, sections: nextSections };
    editStateRef.current = nextState;
    setSections(nextSections);
    setRenderQuality('original');
    void window.rawElectron.saveEditState(selectedImageId, serializeEditState(nextState));
  };
  const importXmpPreset = async () => {
    try {
      const result = await window.rawElectron.importXmpPreset();
      if (!result.canceled && result.values) {
        applyPresetValues(result.values);
        setStatusMessage('XMP 프리셋을 적용했습니다.');
      }
    } catch (error) {
      setStatusMessage(`XMP 프리셋 가져오기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const exportXmpPreset = async () => {
    try {
      const values = Object.fromEntries(editStateRef.current.sections.flatMap((section) =>
        section.controls.map((control) => [
          control.id,
          control.id === 'removeCa' || control.id === 'lensCorrection'
            ? control.value >= 0.5
            : control.value,
        ]))) as PresetValues;
      const result = await window.rawElectron.exportXmpPreset(values);
      if (!result.canceled) setStatusMessage(`XMP 프리셋 저장 완료: ${result.path ?? ''}`);
    } catch (error) {
      setStatusMessage(`XMP 프리셋 내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => {
    let active = true;
    void window.rawElectron.loadLibrary().then((library) => {
      if (!active) return;
      setLibraryFolders(library.folders);
      setLibraryEntries(library.entries);
      setSelectedLibraryPath(library.entries[0]?.path ?? null);
      setLoadingPaths(new Set(library.entries.map((entry) => entry.path)));
      libraryLoaded.current = true;
      if (library.entries.length) setStatusMessage(`${library.entries.length}개 파일 목록을 복원했습니다. 이미지를 불러오는 중입니다.`);
      void (async () => {
        for (const entry of library.entries) {
          if (!active) return;
          try {
            const image = await window.rawElectron.openLibraryEntry(entry.path);
            if (!active || !image) throw new Error('파일을 열 수 없습니다.');
            setImages((current) => current.some((item) => item.path === image.path) ? current : [...current, image]);
          } catch {
            if (active) setFailedPaths((current) => new Set(current).add(entry.path));
          } finally {
            if (active) setLoadingPaths((current) => {
              const next = new Set(current);
              next.delete(entry.path);
              return next;
            });
          }
        }
        if (active) setStatusMessage('저장된 파일 목록을 불러왔습니다.');
      })();
    }).catch((error) => {
      libraryLoaded.current = true;
      setStatusMessage(`파일 목록 복원 실패: ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!libraryLoaded.current) return;
    const timer = window.setTimeout(() => {
      void window.rawElectron.saveLibrary({ folders: libraryFolders, entries: libraryEntries });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [libraryFolders, libraryEntries]);

  useEffect(() => {
    if (!selectedLibraryPath) return;
    const loaded = images.find((image) => image.path === selectedLibraryPath);
    if (loaded && loaded.id !== selectedImageId) setSelectedImageId(loaded.id);
  }, [images, selectedLibraryPath, selectedImageId]);

  useEffect(() => {
    const requestId = ++editLoadRequest.current;
    undoStack.current = [];
    redoStack.current = [];
    transactionStart.current = null;
    setHistoryVersion((value) => value + 1);
    if (selectedImageId === null) {
      restoreEditState({ sections: editSections, curves: identityCurves, crop: identityCrop });
      setRenderQuality('original');
      return;
    }
    void window.rawElectron.loadEditState(selectedImageId).then((stored) => {
      if (requestId !== editLoadRequest.current) return;
      restoreEditState(deserializeEditState(stored));
      setRenderQuality('original');
    }).catch((error) => {
      if (requestId !== editLoadRequest.current) return;
      restoreEditState({ sections: editSections, curves: identityCurves, crop: identityCrop });
      setStatusMessage(`편집값 불러오기 실패: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [selectedImageId]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (selectedImageId === null) setControlTab('adjustments');
  }, [selectedImageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderParams(editParams), renderQuality === 'proxy' ? 60 : 0);
    return () => window.clearTimeout(timer);
  }, [editParams, renderQuality]);

  useEffect(() => {
    let connected = false;
    const receivePort = (event: MessageEvent) => {
      if (event.data?.type !== 'shared-preview-port' || !event.ports[0]) return;
      const port = event.ports[0];
      connected = true;
      port.onmessage = ({ data }) => {
        const pending = sharedPreviewRequests.current.get(data?.requestId);
        if (!pending) return;
        sharedPreviewRequests.current.delete(data.requestId);
        if (data.type === 'shared-preview-error') pending.reject(new Error(data.error));
        if (data.type === 'shared-preview-ready') pending.resolve(data as SharedPreviewResult);
      };
      port.start();
      sharedPreviewPort.current = port;
      setSharedPreviewReady(true);
    };
    window.addEventListener('message', receivePort);
    window.rawElectron.requestSharedPreviewChannel();
    const retry = window.setInterval(() => {
      if (!connected) window.rawElectron.requestSharedPreviewChannel();
    }, 1000);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener('message', receivePort);
      portCleanup(sharedPreviewPort.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.code === 'Space') {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) &&
            !(target instanceof HTMLSelectElement) &&
            !(target instanceof HTMLButtonElement)) {
          event.preventDefault();
          setIsSpacePressed(true);
        }
        return;
      }
      if (event.key === 'F2' && selectedLibraryPath !== null) {
        event.preventDefault();
        renameLibraryEntry(selectedLibraryPath);
        return;
      }
      if (event.key !== 'Delete' || isExporting) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;
      if (!selectedFolderId && !selectedLibraryPath) return;
      event.preventDefault();
      if (selectedFolderId) requestRemoveFolder(selectedFolderId);
      else if (selectedLibraryPath) requestRemoveLibraryEntry(selectedLibraryPath);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsPanning(false);
    };
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('click', closeMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('click', closeMenu);
    };
  });

  useEffect(() => {
    let active = true;
    void window.rawElectron.getDebugLogs().then((entries) => {
      if (active) setDebugLogs(entries);
    });
    const unsubscribe = window.rawElectron.onDebugLog((entry) => {
      setDebugLogs((current) => [...current.filter((item) => item.id !== entry.id), entry].slice(-1000));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => () => {
    if (generatedPreviewUrl.current) URL.revokeObjectURL(generatedPreviewUrl.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = window.devicePixelRatio || 1;
      const nextSize = {
        width: Math.max(1, Math.round(entry.contentRect.width * ratio)),
        height: Math.max(1, Math.round(entry.contentRect.height * ratio)),
      };
      setViewportPixels((current) =>
        current.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedImage || !sharedPreviewReady) {
      setPreviewUrl(null);
      setPreviewQuality(null);
      setPreviewSize({ width: 0, height: 0 });
      setHistograms(null);
      setSourceHistograms(null);
      return undefined;
    }

    let cancelled = false;
    const requestId = ++engineRequestId.current;
    setSourceHistograms(sourceHistogramCache.current.get(selectedImage.id) ?? null);
    const previewWidth = Math.max(1, Math.min(selectedImage.width, viewportPixels.width));
    const previewHeight = Math.max(1, Math.min(selectedImage.height, viewportPixels.height));
    const geometry = previewRenderParams.crop;
    const turns = ((geometry.quarterTurns % 4) + 4) % 4;
    const baseWidth = turns % 2 === 0 ? selectedImage.width : selectedImage.height;
    const baseHeight = turns % 2 === 0 ? selectedImage.height : selectedImage.width;
    const radians = Math.abs(geometry.rotation) * Math.PI / 180;
    const rotatedWidth = Math.ceil(baseWidth * Math.cos(radians) + baseHeight * Math.sin(radians));
    const rotatedHeight = Math.ceil(baseWidth * Math.sin(radians) + baseHeight * Math.cos(radians));
    const cropIsApplied = geometry.enabled && geometry.applyCrop !== false;
    const originalWidth = Math.max(1, Math.round(rotatedWidth * (cropIsApplied ? geometry.width : 1)));
    const originalHeight = Math.max(1, Math.round(rotatedHeight * (cropIsApplied ? geometry.height : 1)));

    const renderShared = (
      quality: 'proxy' | 'original',
      params: EditParams = previewRenderParams,
    ) => new Promise<SharedPreviewResult>((resolve, reject) => {
      const port = sharedPreviewPort.current;
      if (!port) {
        reject(new Error('미리보기 채널이 준비되지 않았습니다.'));
        return;
      }
      sharedPreviewRequests.current.set(requestId, { resolve, reject });
      const targetWidth = quality === 'original' ? originalWidth : previewWidth;
      const targetHeight = quality === 'original' ? originalHeight : previewHeight;
      port.postMessage({
        type: 'render-shared-preview',
        request: {
          requestId,
          imageId: selectedImage.id,
          quality,
          params,
          preview: { maxWidth: targetWidth, maxHeight: targetHeight },
        },
      });
    });

    const toUrl = async (result: SharedPreviewResult) => {
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('미리보기를 표시할 수 없습니다.');
      const rowBytes = result.width * 4;
      const packed = result.stride === rowBytes
        ? result.data
        : new Uint8ClampedArray(result.width * result.height * 4);
      if (result.stride !== rowBytes) {
        for (let row = 0; row < result.height; row += 1) {
          packed.set(result.data.subarray(row * result.stride, row * result.stride + rowBytes), row * rowBytes);
        }
      }
      context.putImageData(new ImageData(packed, result.width, result.height), 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('미리보기 변환에 실패했습니다.')), 'image/png');
      });
      return URL.createObjectURL(blob);
    };

    const display = async (result: SharedPreviewResult) => {
      if (cancelled || result.requestId !== engineRequestId.current) return;
      const url = await toUrl(result);
      if (cancelled || result.requestId !== engineRequestId.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (generatedPreviewUrl.current) URL.revokeObjectURL(generatedPreviewUrl.current);
      generatedPreviewUrl.current = url;
      setHistograms(calculateHistograms(result));
      setPreviewUrl(url);
      setPreviewQuality(result.quality);
      setPreviewSize({ width: result.width, height: result.height });
      setStatusMessage(result.quality === 'proxy' ? '미리보기' : '원본 보기');
    };

    void (async () => {
      try {
        let sourceHistogram = sourceHistogramCache.current.get(selectedImage.id);
        if (!sourceHistogram) {
          const neutralParams = buildEditParams(editSections, identityCurves, identityCrop);
          sourceHistogram = calculateHistograms(await renderShared('proxy', neutralParams));
          sourceHistogramCache.current.set(selectedImage.id, sourceHistogram);
        }
        if (!cancelled) setSourceHistograms(sourceHistogram);
        await display(await renderShared('proxy'));
        if (renderQuality === 'original') {
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          if (!cancelled) await display(await renderShared('original'));
        }
      } catch (error) {
        if (!cancelled) {
          const message = `미리보기 실패: ${error instanceof Error ? error.message : String(error)}`;
          setStatusMessage(message);
          window.rawElectron.reportDebugError('미리보기', message);
        }
      }
    })();

    return () => {
      cancelled = true;
      sharedPreviewRequests.current.delete(requestId);
    };
  }, [selectedImage, previewRenderParams, viewportPixels, renderQuality, sharedPreviewReady]);

  const openImages = async () => {
    try {
      const opened = await window.rawElectron.openImages();
      if (!opened.length) return;
      setImages((current) => {
        const paths = new Set(current.map((image) => image.path));
        return [...current, ...opened.filter((image) => !paths.has(image.path))];
      });
      setLibraryEntries((current) => {
        const paths = new Set(current.map((entry) => entry.path));
        return [...current, ...opened.filter((image) => !paths.has(image.path)).map((image) => ({ path: image.path }))];
      });
      setSelectedImageId(opened[0].id);
      setSelectedLibraryPath(opened[0].path);
      setStatusMessage(`${opened.length}개 이미지를 열었습니다.`);
    } catch (error) {
      setStatusMessage(`파일 열기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addOpenedImages = (opened: ImageFile[], destinationFolderId?: string | null) => {
    if (!opened.length) return;
    setImages((current) => {
      const paths = new Set(current.map((image) => image.path));
      return [...current, ...opened.filter((image) => !paths.has(image.path))];
    });
    setLibraryEntries((current) => {
      const paths = new Set(current.map((entry) => entry.path));
      const updated = destinationFolderId === undefined
        ? current
        : current.map((entry) => opened.some((image) => image.path === entry.path)
          ? { ...entry, folderId: destinationFolderId }
          : entry);
      return [
        ...updated,
        ...opened.filter((image) => !paths.has(image.path)).map((image) => ({
          path: image.path,
          folderId: destinationFolderId ?? null,
        })),
      ];
    });
    setSelectedImageId(opened[0].id);
    setSelectedLibraryPath(opened[0].path);
    setStatusMessage(`${opened.length}개 이미지를 열었습니다.`);
  };

  const openDroppedImages = async (files: File[], destinationFolderId: string | null = null) => {
    if (!files.length || isExporting) return;
    try {
      setStatusMessage('드롭한 이미지를 여는 중입니다…');
      addOpenedImages(await window.rawElectron.openDroppedImages(files), destinationFolderId);
    } catch (error) {
      setStatusMessage(`드롭 파일 열기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const removeImage = async (imageId: number) => {
    const index = images.findIndex((image) => image.id === imageId);
    if (index < 0) return;
    try {
      await window.rawElectron.closeImage(imageId);
      const remaining = images.filter((image) => image.id !== imageId);
      setImages(remaining);
      setLibraryEntries((current) => current.filter((entry) => entry.path !== images[index].path));
      if (selectedImageId === imageId) {
        const nextImage = remaining[Math.min(index, remaining.length - 1)] ?? null;
        setSelectedImageId(nextImage?.id ?? null);
        setSelectedLibraryPath(nextImage?.path ?? null);
      }
      setContextMenu(null);
      setStatusMessage('이미지를 목록에서 제거했습니다. 원본 파일은 유지됩니다.');
    } catch (error) {
      setStatusMessage(`목록 제거 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const renameLibraryEntry = (entryPath: string) => {
    const entry = libraryEntries.find((item) => item.path === entryPath);
    if (!entry) return;
    const image = images.find((item) => item.path === entryPath);
    const originalName = image?.name ?? entryPath.split(/[\\/]/).pop() ?? entryPath;
    setNameDialog({
      title: '이미지 별명 변경',
      description: '비워두면 원래 파일명이 표시됩니다.',
      value: entry.alias?.trim() || originalName,
      onSubmit: (value) => setLibraryEntries((current) => current.map((entry) =>
        entry.path === entryPath ? { ...entry, alias: value.trim() || undefined } : entry)),
    });
    setContextMenu(null);
  };

  const removeLibraryEntry = (entryPath: string) => {
    const image = images.find((item) => item.path === entryPath);
    if (image) {
      void removeImage(image.id);
      return;
    }
    setLibraryEntries((current) => current.filter((entry) => entry.path !== entryPath));
    setLoadingPaths((current) => { const next = new Set(current); next.delete(entryPath); return next; });
    setFailedPaths((current) => { const next = new Set(current); next.delete(entryPath); return next; });
    if (selectedLibraryPath === entryPath) setSelectedLibraryPath(null);
    setContextMenu(null);
  };

  const requestRemoveLibraryEntry = (entryPath: string) => {
    const entry = libraryEntries.find((item) => item.path === entryPath);
    const image = images.find((item) => item.path === entryPath);
    const name = entry?.alias?.trim() || image?.name || entryPath.split(/[\\/]/).pop() || entryPath;
    setConfirmDialog({
      title: '사진을 목록에서 삭제할까요?',
      message: `“${name}”을 목록에서 삭제합니다. 원본 파일은 삭제되지 않습니다.`,
      onConfirm: () => removeLibraryEntry(entryPath),
    });
    setContextMenu(null);
  };

  const createFolder = (parentId: string | null = null) => {
    setNameDialog({
      title: '새 폴더 만들기',
      value: '새 폴더',
      onSubmit: (value) => {
        const name = value.trim();
        if (!name) return;
        setLibraryFolders((current) => [...current, {
          id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          parentId,
        }]);
      },
    });
  };

  const renameFolder = (folderId: string) => {
    const folder = libraryFolders.find((item) => item.id === folderId);
    if (!folder) return;
    setNameDialog({
      title: '폴더 이름 변경',
      value: folder.name,
      onSubmit: (value) => {
        const name = value.trim();
        if (name) setLibraryFolders((current) => current.map((item) => item.id === folderId ? { ...item, name } : item));
      },
    });
    setContextMenu(null);
  };

  const removeFolder = (folderId: string) => {
    const removedFolder = libraryFolders.find((folder) => folder.id === folderId);
    const nextParentId = removedFolder?.parentId ?? null;
    setLibraryFolders((current) => current
      .filter((folder) => folder.id !== folderId)
      .map((folder) => folder.parentId === folderId ? { ...folder, parentId: nextParentId } : folder));
    setLibraryEntries((current) => current.map((entry) =>
      entry.folderId === folderId ? { ...entry, folderId: nextParentId } : entry));
    setSelectedFolderId((current) => current === folderId ? null : current);
    setLastSelectedFolderId((current) => current === folderId ? nextParentId : current);
    setContextMenu(null);
  };

  const requestRemoveFolder = (folderId: string) => {
    const folder = libraryFolders.find((item) => item.id === folderId);
    if (!folder) return;
    setConfirmDialog({
      title: '폴더를 삭제할까요?',
      message: `“${folder.name}” 폴더를 삭제합니다. 폴더 안의 사진과 하위 폴더는 한 단계 위로 이동합니다.`,
      onConfirm: () => removeFolder(folderId),
    });
    setContextMenu(null);
  };

  const moveImageToFolder = (entryPath: string, folderId: string | null) => {
    setLibraryEntries((current) => current.map((entry) =>
      entry.path === entryPath ? { ...entry, folderId } : entry));
    setContextMenu(null);
  };

  const moveFolderToFolder = (folderId: string, parentId: string | null) => {
    if (folderId === parentId) return;
    let ancestorId = parentId;
    while (ancestorId) {
      if (ancestorId === folderId) return;
      ancestorId = libraryFolders.find((folder) => folder.id === ancestorId)?.parentId ?? null;
    }
    setLibraryFolders((current) => current.map((folder) =>
      folder.id === folderId ? { ...folder, parentId } : folder));
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (parentId) next.delete(parentId);
      return next;
    });
    setContextMenu(null);
  };

  const exportImage = async () => {
    if (!selectedImage || isExporting) return;
    try {
      setIsExporting(true);
      setStatusMessage('이미지를 저장하고 있습니다…');
      const result = await window.rawElectron.exportImage(selectedImage.id, editParams, exportFormat);
      if (result.canceled) {
        setStatusMessage('저장이 취소되었습니다.');
      } else {
        const savedPath = result.path ?? '';
        setStatusMessage(`저장 완료: ${savedPath}`);
        setExportResult({ path: savedPath });
      }
    } catch (error) {
      setStatusMessage(`저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const resetAll = () => {
    if (selectedImageId === null) return;
    pushUndo(editStateRef.current);
    restoreEditState({ sections: editSections, curves: identityCurves, crop: identityCrop });
    void window.rawElectron.saveEditState(selectedImageId, serializeEditState(editStateRef.current));
    setRenderQuality('original');
    setStatusMessage('모든 조정을 초기화했습니다.');
  };

  const changeZoom = (nextZoom: number) => {
    const clamped = Math.min(8, Math.max(0.1, nextZoom));
    setZoom(clamped);
    if (clamped <= 1) setPan({ x: 0, y: 0 });
  };

  const constrainedPan = (nextPan: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const image = previewImageRef.current;
    if (!canvas || !image) return nextPan;

    const canvasRect = canvas.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const deltaX = nextPan.x - pan.x;
    const deltaY = nextPan.y - pan.y;
    const minimumVisible = Math.min(72, canvasRect.width * 0.18, canvasRect.height * 0.18);
    let x = nextPan.x;
    let y = nextPan.y;

    const nextLeft = imageRect.left + deltaX;
    const nextRight = imageRect.right + deltaX;
    const nextTop = imageRect.top + deltaY;
    const nextBottom = imageRect.bottom + deltaY;

    if (nextRight < canvasRect.left + minimumVisible) {
      x += canvasRect.left + minimumVisible - nextRight;
    }
    if (nextLeft > canvasRect.right - minimumVisible) {
      x -= nextLeft - (canvasRect.right - minimumVisible);
    }
    if (nextBottom < canvasRect.top + minimumVisible) {
      y += canvasRect.top + minimumVisible - nextBottom;
    }
    if (nextTop > canvasRect.bottom - minimumVisible) {
      y -= nextTop - (canvasRect.bottom - minimumVisible);
    }

    return { x, y };
  };

  const handleViewerWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!selectedImage || !event.ctrlKey || controlTab === 'crop') return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const factor = Math.exp(-event.deltaY * 0.002);
    const nextZoom = Math.min(8, Math.max(0.1, zoom * factor));
    if (nextZoom <= 1) {
      setZoom(nextZoom);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - (rect.left + rect.width / 2);
    const cursorY = event.clientY - (rect.top + rect.height / 2);
    const scale = nextZoom / zoom;
    setPan({
      x: cursorX - (cursorX - pan.x) * scale,
      y: cursorY - (cursorY - pan.y) * scale,
    });
    setZoom(nextZoom);
  };

  const startPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!selectedImage || !isSpacePressed || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  const movePanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan(constrainedPan({
      x: panStart.current.panX + event.clientX - panStart.current.pointerX,
      y: panStart.current.panY + event.clientY - panStart.current.pointerY,
    }));
  };

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  };
  const handleViewerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedImage || controlTab === 'crop') return;
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 80 : 20;
    setPan((current) => constrainedPan({
      x: current.x - direction.x * step,
      y: current.y - direction.y * step,
    }));
  };

  const resizePanel = (panel: 'library' | 'controls', pointerX: number) => {
    const workspace = document.querySelector<HTMLElement>('.workspace');
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const centerMinimum = 320;
    if (panel === 'library') {
      const maximum = Math.min(420, rect.width - controlsWidth - centerMinimum);
      setLibraryWidth(Math.max(160, Math.min(maximum, pointerX - rect.left)));
    } else {
      const maximum = Math.min(520, rect.width - libraryWidth - centerMinimum);
      setControlsWidth(Math.max(260, Math.min(maximum, rect.right - pointerX)));
    }
  };

  const handleResizePointerDown = (
    panel: 'library' | 'controls',
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingPanel(panel);
  };

  const handleResizePointerMove = (
    panel: 'library' | 'controls',
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (resizingPanel !== panel) return;
    resizePanel(panel, event.clientX);
  };

  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizingPanel(null);
  };

  const handleResizeKeyDown = (
    panel: 'library' | 'controls',
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 40 : 10);
    if (panel === 'library') {
      setLibraryWidth((width) => Math.max(160, Math.min(420, width + delta)));
    } else {
      setControlsWidth((width) => Math.max(260, Math.min(520, width - delta)));
    }
  };

  const renderLibraryEntry = (entry: LibraryEntry) => {
    const image = images.find((item) => item.path === entry.path);
    const originalName = image?.name ?? entry.path.split(/[\\/]/).pop() ?? entry.path;
    const isLoading = loadingPaths.has(entry.path);
    const failed = failedPaths.has(entry.path);
    return (
      <button
        key={entry.path}
        className={`image-item ${entry.path === selectedLibraryPath ? 'selected' : ''}`}
        draggable={Boolean(image)}
        title={entry.path}
        onClick={() => {
          setSelectedFolderId(null);
          setSelectedLibraryPath(entry.path);
          setSelectedImageId(image?.id ?? null);
        }}
        onDragStart={(event) => {
          if (!image) { event.preventDefault(); return; }
          setSelectedImageId(image.id);
          setSelectedLibraryPath(entry.path);
          setDraggedLibraryPath(entry.path);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/x-rawelectron-library-path', entry.path);
          event.dataTransfer.setData('text/plain', entry.path);
        }}
        onDragEnd={() => {
          setDraggedLibraryPath(null);
          setFolderDropTarget(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setSelectedFolderId(null);
          setSelectedImageId(image?.id ?? null);
          setSelectedLibraryPath(entry.path);
          setContextMenu({ kind: 'image', id: entry.path, x: event.clientX, y: event.clientY });
        }}
      >
        <span
          className={`image-status ${isLoading ? 'loading' : failed ? 'failed' : 'loaded'}`}
          title={isLoading ? '불러오는 중' : failed ? '불러오기 실패' : '로딩 완료'}
          aria-label={isLoading ? '불러오는 중' : failed ? '불러오기 실패' : '로딩 완료'}
        >
          {isLoading ? '…' : failed ? '×' : '✓'}
        </span>
        <span className="image-name">{entry.alias?.trim() || originalName}</span>
      </button>
    );
  };

  const renderLibraryFolder = (folder: LibraryFolder, depth = 0): React.ReactNode => {
    const folderEntries = libraryEntries.filter((entry) => entry.folderId === folder.id);
    const childFolders = libraryFolders.filter((item) => item.parentId === folder.id);
    const collapsed = collapsedFolders.has(folder.id);
    return (
      <section
        className={`library-folder ${folderDropTarget === folder.id ? 'drop-target' : ''}`}
        key={folder.id}
        data-depth={depth}
        onDragEnter={(event) => {
          const hasExternalFiles = event.dataTransfer.types.includes('Files');
          if (!draggedLibraryPath && !draggedFolderId && !hasExternalFiles) return;
          event.preventDefault();
          event.stopPropagation();
          setFolderDropTarget(folder.id);
        }}
        onDragOver={(event) => {
          const hasExternalFiles = event.dataTransfer.types.includes('Files');
          if (!draggedLibraryPath && !draggedFolderId && !hasExternalFiles) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setFolderDropTarget((current) => current === folder.id ? null : current);
        }}
        onDrop={(event) => {
          if (event.dataTransfer.files.length) {
            event.preventDefault();
            event.stopPropagation();
            setIsDragOver(false);
            setFolderDropTarget(null);
            setLastSelectedFolderId(folder.id);
            void openDroppedImages(Array.from(event.dataTransfer.files), folder.id);
            return;
          }
          if (draggedFolderId) {
            event.preventDefault();
            event.stopPropagation();
            moveFolderToFolder(draggedFolderId, folder.id);
            setDraggedFolderId(null);
            setFolderDropTarget(null);
            return;
          }
          const entryPath = draggedLibraryPath ||
            event.dataTransfer.getData('application/x-rawelectron-library-path');
          if (!entryPath) return;
          event.preventDefault();
          event.stopPropagation();
          moveImageToFolder(entryPath, folder.id);
          setLastSelectedFolderId(folder.id);
          setDraggedLibraryPath(null);
          setFolderDropTarget(null);
        }}
      >
        <button
          className={`folder-heading ${selectedFolderId === folder.id ? 'selected' : ''}`}
          draggable
          onClick={() => {
            setSelectedFolderId(folder.id);
            setLastSelectedFolderId(folder.id);
            setSelectedLibraryPath(null);
            setSelectedImageId(null);
            setCollapsedFolders((current) => {
            const next = new Set(current);
            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
            return next;
            });
          }}
          onDragStart={(event) => {
            event.stopPropagation();
            setDraggedFolderId(folder.id);
            setDraggedLibraryPath(null);
            setSelectedFolderId(folder.id);
            setLastSelectedFolderId(folder.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-rawelectron-folder-id', folder.id);
          }}
          onDragEnd={() => {
            setDraggedFolderId(null);
            setFolderDropTarget(null);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setSelectedFolderId(folder.id);
            setLastSelectedFolderId(folder.id);
            setSelectedLibraryPath(null);
            setSelectedImageId(null);
            setContextMenu({ kind: 'folder', id: folder.id, x: event.clientX, y: event.clientY });
          }}
        >
          <span>{collapsed ? '▸' : '▾'} 📁 {folder.name}</span>
          <small>{folderEntries.length + childFolders.length}</small>
        </button>
        {!collapsed && (
          <div className="folder-children">
            {folderEntries.map(renderLibraryEntry)}
            {childFolders.map((child) => renderLibraryFolder(child, depth + 1))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      className="raw-app"
      data-theme={theme}
      data-logs={showLogs}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes('Files')) setIsDragOver(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsDragOver(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setIsDragOver(false);
        void openDroppedImages(Array.from(event.dataTransfer.files));
      }}
    >
      <header className="app-header">
        <div className="brand">
          <strong>RawElectron</strong>
          <span>{selectedImage ? selectedImage.name : '이미지 편집기'}</span>
        </div>
        <div className="header-actions">
          <div className="history-actions" aria-label="편집 기록">
            <button
              className="icon-button"
              title="실행 취소 (Ctrl+Z)"
              aria-label="실행 취소"
              disabled={selectedImageId === null || !undoStack.current.length}
              onClick={undo}
            >
              ↶
            </button>
            <button
              className="icon-button"
              title="다시 실행 (Ctrl+Shift+Z)"
              aria-label="다시 실행"
              disabled={selectedImageId === null || !redoStack.current.length}
              onClick={redo}
            >
              ↷
            </button>
          </div>
          <button className="button" disabled={isExporting} onClick={openImages}>파일 열기</button>
          <label className="format-select">
            <span>저장 형식</span>
            <select
              disabled={isExporting}
              value={exportFormat}
              onChange={(event) => setExportFormat(event.currentTarget.value as ExportFormat)}
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
              <option value="tiff">TIFF</option>
              <option value="bmp">BMP</option>
              <option value="jpeg2000">JPEG 2000</option>
              <option value="ppm">PPM</option>
              <option value="hdr">HDR</option>
              <option value="ras">Sun Raster</option>
            </select>
          </label>
          <button className="button primary" disabled={!selectedImage || isExporting} onClick={exportImage}>
            {isExporting ? '저장 중…' : '다른 이름으로 저장'}
          </button>
          <button className="button quiet" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '밝은 화면' : '어두운 화면'}
          </button>
        </div>
      </header>

      <main
        className={`workspace ${resizingPanel ? 'is-resizing' : ''}`}
        style={{ gridTemplateColumns: `${libraryWidth}px minmax(0, 1fr) ${controlsWidth}px` }}
      >
        <aside className="library">
          <div className="pane-heading">
            <strong>파일 목록</strong>
            <div className="pane-actions">
              <button onClick={() => createFolder()}>+ 폴더</button>
              <button onClick={openImages}>+ 파일</button>
            </div>
          </div>
          <div
            className={`image-list ${folderDropTarget === '__root__' ? 'root-drop-target' : ''}`}
            onDragEnter={(event) => {
              if (!draggedFolderId && !draggedLibraryPath) return;
              event.preventDefault();
              setFolderDropTarget('__root__');
            }}
            onDragOver={(event) => {
              if (!draggedFolderId && !draggedLibraryPath) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setFolderDropTarget((current) => current === '__root__' ? null : current);
            }}
            onDrop={(event) => {
              if (!draggedFolderId && !draggedLibraryPath) return;
              event.preventDefault();
              event.stopPropagation();
              if (draggedFolderId) moveFolderToFolder(draggedFolderId, null);
              if (draggedLibraryPath) moveImageToFolder(draggedLibraryPath, null);
              setDraggedFolderId(null);
              setDraggedLibraryPath(null);
              setFolderDropTarget(null);
            }}
          >
            <div
              className={`root-drop-zone ${draggedFolderId || draggedLibraryPath ? 'active' : ''}`}
              aria-hidden="true"
            >
              ↰ 최상위로 이동
            </div>
            {!libraryEntries.length && !libraryFolders.length && <p className="empty-note">파일과 폴더가 없습니다.</p>}
            {libraryEntries.filter((entry) => !entry.folderId).map(renderLibraryEntry)}
            {libraryFolders.filter((folder) => !folder.parentId).map((folder) => renderLibraryFolder(folder))}
          </div>
        </aside>

        <div
          className="panel-resizer library-resizer"
          role="separator"
          aria-label="파일 목록 패널 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={160}
          aria-valuemax={420}
          aria-valuenow={Math.round(libraryWidth)}
          tabIndex={0}
          style={{ left: libraryWidth }}
          onPointerDown={(event) => handleResizePointerDown('library', event)}
          onPointerMove={(event) => handleResizePointerMove('library', event)}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={(event) => handleResizeKeyDown('library', event)}
          onDoubleClick={() => setLibraryWidth(220)}
        />

        <section
          className={`viewer ${showHistograms && controlTab !== 'crop' ? '' : 'histogram-hidden'}`}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.files.length) return;
            event.preventDefault();
            event.stopPropagation();
            setIsDragOver(false);
            void openDroppedImages(Array.from(event.dataTransfer.files), lastSelectedFolderId);
          }}
        >
          {selectedImage && controlTab !== 'crop' && (
            <div className="preview-quality-bar" role="status" aria-live="polite">
              <span className={`quality-badge ${previewQuality === 'original' ? 'original' : ''}`}>
                {previewQuality === 'original' ? '원본 보기' : '미리보기'}
              </span>
            </div>
          )}
          <div
            className={`canvas ${isSpacePressed ? 'pan-ready' : ''} ${isPanning ? 'panning' : ''}`}
            ref={canvasRef}
            tabIndex={selectedImage && controlTab !== 'crop' ? 0 : -1}
            aria-label="이미지 뷰포트. 방향키로 이동"
            onWheel={handleViewerWheel}
            onPointerDown={startPanning}
            onPointerMove={movePanning}
            onPointerUp={stopPanning}
            onPointerCancel={stopPanning}
            onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
            onKeyDown={handleViewerKeyDown}
          >
            {selectedImage ? (
              previewUrl
                ? controlTab === 'crop' && cropStage
                  ? <div
                      className="crop-web-editor"
                      style={{ width: cropStage.width, height: cropStage.height }}
                    >
                      <img
                        ref={previewImageRef}
                        className="crop-source-image"
                        src={previewUrl}
                        alt={selectedImage.name}
                        draggable={false}
                        style={{
                          width: cropStage.imageWidth,
                          height: cropStage.imageHeight,
                          transform: `translate(-50%, -50%) scale(${crop.flipHorizontal ? -1 : 1}, ${crop.flipVertical ? -1 : 1}) rotate(${cropStage.displayRotation}deg)`,
                        }}
                      />
                      <CropFrame
                        crop={crop}
                        imageAspect={cropImageAspect}
                        onChange={changeCrop}
                        onEditStart={beginEdit}
                        onEditEnd={endEdit}
                      />
                    </div>
                  : <div
                    className="image-transform"
                    style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
                  >
                    <img
                      ref={previewImageRef}
                      src={previewUrl}
                      alt={selectedImage.name}
                      draggable={false}
                      style={fittedPreviewSize}
                      onLoad={() => {
                        if (previewQuality) sharedPreviewPort.current?.postMessage({
                          type: 'shared-preview-displayed',
                          imageId: selectedImage.id,
                          quality: previewQuality,
                        });
                      }}
                    />
                  </div>
                : <div className="loading">미리보기를 만드는 중입니다…</div>
            ) : selectedLibraryPath && loadingPaths.has(selectedLibraryPath) ? (
              <div className="empty-state loading-library-entry">
                <span className="spinner" aria-hidden="true" />
                <h1>이미지를 불러오는 중입니다</h1>
                <p>{selectedLibraryPath.split(/[\\/]/).pop()}</p>
              </div>
            ) : selectedLibraryPath && failedPaths.has(selectedLibraryPath) ? (
              <div className="empty-state">
                <h1>이미지를 불러오지 못했습니다</h1>
                <p>원본 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.</p>
              </div>
            ) : (
              <div className="empty-state">
                <h1>편집할 이미지를 여세요</h1>
                <p>RAW와 일반 이미지 파일을 불러와 조정하고 다른 형식으로 저장할 수 있습니다.</p>
                <button className="button primary" onClick={openImages}>이미지 선택</button>
              </div>
            )}
            {selectedImage && controlTab === 'crop' && (
              <div
                className="crop-viewport-overlay"
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <div className="viewport-angle">
                  <AngleDial
                    value={crop.rotation}
                    onChange={(rotation) => {
                      const oldBoundsAspect = boundingAspectForRotation(cropImageAspect, crop.rotation);
                      const targetAspect = crop.width * oldBoundsAspect / Math.max(0.0001, crop.height);
                      changeCrop({
                        ...crop,
                        ...maximumFixedRatioCrop(cropImageAspect, rotation, targetAspect),
                        enabled: true,
                        rotation,
                      });
                    }}
                    onEditStart={beginEdit}
                    onEditEnd={endEdit}
                    hideHeading
                  />
                </div>
              </div>
            )}
          </div>
          {showHistograms && controlTab !== 'crop' && <HistogramPanel histograms={histograms} />}
          <footer className="statusbar">
            <span>{statusMessage}</span>
            {selectedImage && <span>{selectedImage.width} × {selectedImage.height}px</span>}
            <div className="zoom-controls" aria-label="확대 축소">
              <button disabled={!selectedImage} onClick={() => changeZoom(zoom / 1.25)}>−</button>
              <button disabled={!selectedImage} onClick={() => changeZoom(1)}>화면 맞춤</button>
              <button disabled={!selectedImage} onClick={() => changeZoom(zoom * 1.25)}>+</button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>
            <button
              disabled={controlTab === 'crop'}
              onClick={() => setShowHistograms((current) => !current)}
            >
              {controlTab === 'crop'
                ? '히스토그램 비활성'
                : showHistograms ? '히스토그램 숨기기' : '히스토그램 보기'}
            </button>
            <button onClick={() => setShowLogs((current) => !current)}>
              {showLogs ? '로그 닫기' : `로그 ${debugLogs.length}`}
            </button>
          </footer>
        </section>

        <div
          className="panel-resizer controls-resizer"
          role="separator"
          aria-label="옵션 패널 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={260}
          aria-valuemax={520}
          aria-valuenow={Math.round(controlsWidth)}
          tabIndex={0}
          style={{ right: controlsWidth }}
          onPointerDown={(event) => handleResizePointerDown('controls', event)}
          onPointerMove={(event) => handleResizePointerMove('controls', event)}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={(event) => handleResizeKeyDown('controls', event)}
          onDoubleClick={() => setControlsWidth(330)}
        />

        <aside className="controls">
          <div className="controls-heading control-tabs">
            <button
              className={controlTab === 'adjustments' ? 'active' : ''}
              onClick={() => {
                if (controlTab === 'crop') {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }
                setControlTab('adjustments');
              }}
            >
              보정
            </button>
            <button
              className={controlTab === 'crop' ? 'active' : ''}
              disabled={!selectedImage}
              onClick={() => setControlTab('crop')}
            >
              자르기·회전
            </button>
          </div>
          <div className="control-scroll">
            <fieldset className="adjustment-fieldset" disabled={!selectedImage}>
              {controlTab === 'adjustments' ? (
                <AdjustmentPanel
                  sections={sections}
                  curves={curves}
                  autoAdjustmentAvailable={Boolean(sourceHistograms)}
                  onAutoAdjustment={applyAutomaticAdjustment}
                  onImportPreset={() => void importXmpPreset()}
                  onExportPreset={() => void exportXmpPreset()}
                  onEditStart={beginEdit}
                  onEditEnd={endEdit}
                  onSlider={changeSliderValue}
                  onCurveChange={changeCurve}
                />
              ) : (
                <CropPanel
                  crop={crop}
                  imageAspect={(crop.quarterTurns % 2 === 0
                    ? selectedImage.width / selectedImage.height
                    : selectedImage.height / selectedImage.width)}
                  onChange={changeCrop}
                  onEditStart={beginEdit}
                  onEditEnd={endEdit}
                />
              )}
            </fieldset>
          </div>
          <div className="control-footer">
            <button className="button quiet" disabled={!selectedImage} onClick={resetAll}>전체 초기화</button>
            <button className="button primary" disabled={!selectedImage} onClick={() => setRenderQuality('original')}>
              원본 보기
            </button>
          </div>
        </aside>
      </main>

      {showLogs && <DebugLogPanel logs={debugLogs} onClear={() => setDebugLogs([])} />}
      {isDragOver && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <strong>이미지를 여기에 놓으세요</strong>
            <span>여러 파일을 한 번에 추가할 수 있습니다.</span>
          </div>
        </div>
      )}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.kind === 'image' ? <>
            <button onClick={() => renameLibraryEntry(contextMenu.id as string)}>별명 변경 (F2)</button>
            <div className="context-menu-label">폴더로 이동</div>
            <button onClick={() => moveImageToFolder(contextMenu.id as string, null)}>폴더 없음</button>
            {libraryFolders.map((folder) => (
              <button key={folder.id} onClick={() => moveImageToFolder(contextMenu.id as string, folder.id)}>
                {folder.name}
              </button>
            ))}
            <div className="context-menu-separator" />
            <button onClick={() => requestRemoveLibraryEntry(contextMenu.id as string)}>목록에서 삭제</button>
          </> : <>
            <button onClick={() => createFolder(contextMenu.id as string)}>하위 폴더 만들기</button>
            <button onClick={() => renameFolder(contextMenu.id as string)}>폴더 이름 변경</button>
            <button onClick={() => requestRemoveFolder(contextMenu.id as string)}>폴더 삭제</button>
            <span>내부 항목은 한 단계 위 폴더로 이동합니다.</span>
          </>}
        </div>
      )}
      {nameDialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="name-dialog-title">
          <form
            className="name-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              nameDialog.onSubmit(String(form.get('name') ?? ''));
              setNameDialog(null);
            }}
          >
            <h2 id="name-dialog-title">{nameDialog.title}</h2>
            {nameDialog.description && <p>{nameDialog.description}</p>}
            <input name="name" defaultValue={nameDialog.value} autoFocus onFocus={(event) => event.currentTarget.select()} />
            <div className="dialog-actions">
              <button type="button" className="button quiet" onClick={() => setNameDialog(null)}>취소</button>
              <button type="submit" className="button primary">확인</button>
            </div>
          </form>
        </div>
      )}
      {confirmDialog && (
        <div
          className="modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setConfirmDialog(null);
              return;
            }
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
            if (!buttons.length) return;
            const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              const direction = event.key === 'ArrowRight' ? 1 : -1;
              buttons[(currentIndex + direction + buttons.length) % buttons.length].focus();
            } else if (event.key === 'Tab') {
              const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
              if (nextIndex < 0 || nextIndex >= buttons.length) {
                event.preventDefault();
                buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
              }
            }
          }}
        >
          <div className="confirm-dialog">
            <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
            <p>{confirmDialog.message}</p>
            <div className="dialog-actions">
              <button className="button quiet" autoFocus onClick={() => setConfirmDialog(null)}>취소</button>
              <button
                className="button danger"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {isExporting && (
        <div className="modal-backdrop" role="alert" aria-live="assertive" aria-busy="true">
          <div className="progress-dialog">
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>이미지를 저장하고 있습니다</strong>
              <p>처리가 끝날 때까지 잠시 기다려 주세요.</p>
            </div>
          </div>
        </div>
      )}
      {exportResult && !isExporting && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="export-complete-title">
          <div className="result-dialog">
            <div className="success-mark" aria-hidden="true">✓</div>
            <h2 id="export-complete-title">저장이 완료되었습니다</h2>
            <p>{exportResult.path}</p>
            <button className="button primary" autoFocus onClick={() => setExportResult(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CropFrame({
  crop,
  imageAspect,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  crop: CropState;
  imageAspect: number;
  onChange: (crop: CropState) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: 'move' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left';
    startX: number;
    startY: number;
    crop: CropState;
  } | null>(null);
  const start = (mode: NonNullable<typeof drag.current>['mode'], event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    frameRef.current?.setPointerCapture(event.pointerId);
    drag.current = { mode, startX: event.clientX, startY: event.clientY, crop: { ...crop } };
    onEditStart();
  };
  const move = (event: React.PointerEvent) => {
    const active = drag.current;
    const parent = frameRef.current?.parentElement;
    if (!active || !parent) return;
    const rect = parent.getBoundingClientRect();
    const dx = (event.clientX - active.startX) / rect.width;
    const dy = (event.clientY - active.startY) / rect.height;
    let { x, y, width, height } = active.crop;
    const safe = maximumCropForRotation(imageAspect, crop.rotation);
    const safeRight = safe.x + safe.width;
    const safeBottom = safe.y + safe.height;
    const minimum = 0.08;
    if (active.mode === 'move') {
      const desiredX = Math.min(1 - width, Math.max(0, x + dx));
      const desiredY = Math.min(1 - height, Math.max(0, y + dy));
      const constrained = constrainCropPosition(imageAspect, crop.rotation, {
        x: desiredX, y: desiredY, width, height,
      });
      x = constrained.x;
      y = constrained.y;
    } else {
      if (active.mode.includes('left')) {
        const right = x + width;
        x = Math.min(right - minimum, Math.max(safe.x, x + dx));
        width = right - x;
      }
      if (active.mode.includes('right')) width = Math.min(safeRight - x, Math.max(minimum, width + dx));
      if (active.mode.includes('top')) {
        const bottom = y + height;
        y = Math.min(bottom - minimum, Math.max(safe.y, y + dy));
        height = bottom - y;
      }
      if (active.mode.includes('bottom')) height = Math.min(safeBottom - y, Math.max(minimum, height + dy));
    }
    onChange({
      ...crop,
      enabled: true,
      ratio: active.mode === 'move' ? crop.ratio : '자유',
      x,
      y,
      width,
      height,
    });
  };
  const stop = (event: React.PointerEvent) => {
    if (!drag.current) return;
    if (frameRef.current?.hasPointerCapture(event.pointerId)) frameRef.current.releasePointerCapture(event.pointerId);
    drag.current = null;
    onEditEnd();
  };
  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.01 : 0.0025;
    const constrained = constrainCropPosition(imageAspect, crop.rotation, {
      x: crop.x + direction.x * step,
      y: crop.y + direction.y * step,
      width: crop.width,
      height: crop.height,
    });
    onEditStart();
    onChange({ ...crop, enabled: true, x: constrained.x, y: constrained.y });
    onEditEnd();
  };
  return (
    <div
      ref={frameRef}
      className="crop-frame"
      tabIndex={0}
      role="group"
      aria-label="자르기 영역. 방향키로 이동"
      style={{
        left: `${crop.x * 100}%`,
        top: `${crop.y * 100}%`,
        width: `${crop.width * 100}%`,
        height: `${crop.height * 100}%`,
      }}
      onPointerDown={(event) => {
        frameRef.current?.focus();
        start('move', event);
      }}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={moveWithKeyboard}
    >
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((position) => (
        <i key={position} className={`corner ${position}`} onPointerDown={(event) => start(position, event)} />
      ))}
      {(['top', 'right', 'bottom', 'left'] as const).map((position) => (
        <i key={position} className={`edge ${position}`} onPointerDown={(event) => start(position, event)} />
      ))}
    </div>
  );
}

function CropPanel({
  crop,
  imageAspect,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  crop: CropState;
  imageAspect: number;
  onChange: (crop: CropState) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const [rotationDraft, setRotationDraft] = useState(crop.rotation.toFixed(1));
  useEffect(() => setRotationDraft(crop.rotation.toFixed(1)), [crop.rotation]);
  const update = (changes: Partial<CropState>) => onChange({
    ...crop,
    ...changes,
    enabled: true,
  });
  const commit = (changes: Partial<CropState>) => {
    onEditStart();
    update(changes);
    onEditEnd();
  };
  const changeRatio = (ratio: string) => {
    if (ratio === '자유') {
      commit({ ratio });
      return;
    }
    if (ratio === '원본') {
      const target = imageAspect;
      commit({ ratio, ...maximumFixedRatioCrop(imageAspect, crop.rotation, target) });
      return;
    }
    const [wide, high] = ratio.split(':').map(Number);
    const target = wide / high;
    commit({ ratio, ...maximumFixedRatioCrop(imageAspect, crop.rotation, target) });
  };
  const applyRotation = (rotation: number) => {
    const value = Math.min(45, Math.max(-45, rotation));
    const oldBoundsAspect = boundingAspectForRotation(imageAspect, crop.rotation);
    const targetAspect = crop.width * oldBoundsAspect / Math.max(0.0001, crop.height);
    update({ ...maximumFixedRatioCrop(imageAspect, value, targetAspect), rotation: value });
  };
  return (
    <div className="crop-panel">
      <section className="control-section">
        <div className="crop-heading">
          <strong>자르기 및 변환</strong>
          <button onClick={() => {
            onEditStart();
            onChange(identityCrop);
            onEditEnd();
          }}>전체 초기화</button>
        </div>
        <label className="crop-field">
          <span>비율</span>
          <select value={crop.ratio} onChange={(event) => changeRatio(event.currentTarget.value)}>
            <option value="원본">원본</option>
            <option value="자유">자유</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
            <option value="3:2">3:2</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
        <label className="slider-control">
          <span>
            <span>수평 맞춤</span>
            <input
              className="slider-value-input"
              type="number"
              min="-45"
              max="45"
              step="0.1"
              value={rotationDraft}
              aria-label="수평 맞춤 각도"
              onFocus={onEditStart}
              onChange={(event) => setRotationDraft(event.currentTarget.value)}
              onBlur={() => {
                const parsed = Number(rotationDraft);
                applyRotation(Number.isFinite(parsed) ? parsed : crop.rotation);
                onEditEnd();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setRotationDraft(crop.rotation.toFixed(1));
                  event.currentTarget.blur();
                }
              }}
            />
          </span>
          <input
            type="range"
            tabIndex={-1}
            min="-45"
            max="45"
            step="0.1"
            value={crop.rotation}
            onPointerDown={onEditStart}
            onPointerUp={onEditEnd}
            onPointerCancel={onEditEnd}
            onChange={(event) => {
              const rotation = Number(event.currentTarget.value);
              applyRotation(rotation);
            }}
          />
        </label>
        <div className="crop-actions">
          <button onClick={() => commit({ quarterTurns: (crop.quarterTurns + 3) % 4 })}>↶ 왼쪽 90°</button>
          <button onClick={() => commit({ quarterTurns: (crop.quarterTurns + 1) % 4 })}>↷ 오른쪽 90°</button>
          <button
            className={crop.flipHorizontal ? 'active' : ''}
            onClick={() => commit({ flipHorizontal: !crop.flipHorizontal })}
          >
            ↔ 가로 뒤집기
          </button>
          <button
            className={crop.flipVertical ? 'active' : ''}
            onClick={() => commit({ flipVertical: !crop.flipVertical })}
          >
            ↕ 세로 뒤집기
          </button>
        </div>
      </section>
    </div>
  );
}

function AngleDial({
  value,
  onChange,
  onEditStart,
  onEditEnd,
  hideHeading = false,
}: {
  value: number;
  onChange: (value: number) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  hideHeading?: boolean;
}) {
  const dialRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const angle = Math.min(45, Math.max(-45, value));
  const radians = (angle - 90) * Math.PI / 180;
  const knobX = 100 + Math.cos(radians) * 72;
  const knobY = 86 + Math.sin(radians) * 72;
  const ticks = Array.from({ length: 19 }, (_, index) => {
    const tickAngle = -45 + index * 5;
    const tickRadians = (tickAngle - 90) * Math.PI / 180;
    const outer = 72;
    const inner = index % 3 === 0 ? 62 : 66;
    return {
      x1: 100 + Math.cos(tickRadians) * inner,
      y1: 86 + Math.sin(tickRadians) * inner,
      x2: 100 + Math.cos(tickRadians) * outer,
      y2: 86 + Math.sin(tickRadians) * outer,
    };
  });
  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - rect.left) / rect.width * 200;
    const y = (clientY - rect.top) / rect.height * 105;
    const pointerAngle = Math.atan2(y - 86, x - 100) * 180 / Math.PI + 90;
    onChange(Math.round(Math.min(45, Math.max(-45, pointerAngle)) * 10) / 10);
  };
  return (
    <div className="angle-control">
      {!hideHeading && <div className="angle-heading">
        <span>수평 맞춤</span>
        <button onClick={() => {
          onEditStart();
          onChange(0);
          onEditEnd();
        }}>{angle.toFixed(1)}°</button>
      </div>}
      <svg
        ref={dialRef}
        className={`angle-dial ${dragging ? 'dragging' : ''}`}
        viewBox="0 0 200 105"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          onEditStart();
          updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging) updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDragging(false);
          onEditEnd();
        }}
        onPointerCancel={() => {
          setDragging(false);
          onEditEnd();
        }}
      >
        <path className="angle-arc" d="M 49.1 35.1 A 72 72 0 0 1 150.9 35.1" />
        {ticks.map((tick, index) => (
          <line key={index} className={index === 9 ? 'angle-tick center' : 'angle-tick'} {...tick} />
        ))}
        <line className="angle-indicator" x1="100" y1="86" x2={knobX} y2={knobY} />
        <circle className="angle-knob" cx={knobX} cy={knobY} r="7" />
        <text x="100" y="100">{angle.toFixed(1)}°</text>
      </svg>
    </div>
  );
}

function HistogramPanel({ histograms }: { histograms: Histograms | null }) {
  const graphs: Array<{ key: keyof Histograms; label: string; color: string }> = [
    { key: 'luminance', label: '노출', color: '#dfe4eb' },
    { key: 'red', label: 'R', color: '#ff6868' },
    { key: 'green', label: 'G', color: '#54d17a' },
    { key: 'blue', label: 'B', color: '#6598ff' },
  ];
  return (
    <div className="histogram-panel" aria-label="RGB 색상 분포">
      {graphs.map((graph) => {
        const values = histograms?.[graph.key] ?? Array(64).fill(0);
        const maximum = Math.max(1, ...values);
        const points = values.map((value, index) =>
          `${(index / 63) * 100},${100 - (value / maximum) * 92}`).join(' ');
        const area = `0,100 ${points} 100,100`;
        return (
          <div className="histogram-item" key={graph.key}>
            <span>{graph.label}</span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path className="histogram-grid" d="M 25 0 V 100 M 50 0 V 100 M 75 0 V 100" />
              <polygon points={area} style={{ fill: graph.color }} />
              <polyline points={points} style={{ stroke: graph.color }} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function portCleanup(port: MessagePort | null) {
  port?.close();
}

function AdjustmentPanel({
  sections,
  curves,
  autoAdjustmentAvailable,
  onAutoAdjustment,
  onImportPreset,
  onExportPreset,
  onSlider,
  onCurveChange,
  onEditStart,
  onEditEnd,
}: {
  sections: ToolSection[];
  curves: Curves;
  autoAdjustmentAvailable: boolean;
  onAutoAdjustment: (preset: AutoAdjustmentPreset) => void;
  onImportPreset: () => void;
  onExportPreset: () => void;
  onSlider: (sectionId: ToolSectionId, controlId: string, value: number) => void;
  onCurveChange: (channel: CurveChannel, points: CurvePoint[]) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const [curveExpanded, setCurveExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ToolSectionId | 'auto' | null>(null);
  const autoExpanded = expandedSection === 'auto';
  return (
    <>
      <section className="control-section auto-adjustment-section" aria-label="자동 보정">
        <button
          className="control-section-toggle"
          aria-expanded={autoExpanded}
          onClick={() => setExpandedSection((current) => current === 'auto' ? null : 'auto')}
        >
          <span>자동 보정</span>
          <span aria-hidden="true">{autoExpanded ? '▾' : '▸'}</span>
        </button>
        {autoExpanded && (
          <div className="control-section-content">
            <p className="auto-adjustment-description">현재 사진의 밝기와 RGB 분포를 분석합니다.</p>
            <div className="auto-adjustment-options">
              {([
                ['balanced', '기본'],
                ['warm', '따뜻하게'],
                ['cool', '차갑게'],
                ['vivid', '선명하게'],
                ['soft', '부드럽게'],
              ] as Array<[AutoAdjustmentPreset, string]>).map(([preset, label]) => (
                <button
                  key={preset}
                  disabled={!autoAdjustmentAvailable}
                  onClick={() => onAutoAdjustment(preset)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="preset-file-actions">
              <button type="button" onClick={onImportPreset}>XMP 가져오기</button>
              <button type="button" onClick={onExportPreset}>XMP 내보내기</button>
            </div>
          </div>
        )}
      </section>
      {sections.map((section) => {
        const expanded = expandedSection === section.id;
        return (
          <section className="control-section" key={section.id}>
            <button
              className="control-section-toggle"
              aria-expanded={expanded}
              onClick={() => setExpandedSection((current) =>
                current === section.id ? null : section.id)}
            >
              <span>{section.title}</span>
              <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            </button>
            {expanded && (
              <div className="control-section-content">
                {section.id === 'color' && (
                  <div className="white-balance-presets" aria-label="화이트 밸런스">
                    <span>WB</span>
                    {([
                      ['원본값', 0, 0], ['일광', 10, 0], ['흐림', 20, 2],
                      ['그늘', 30, 4], ['텅스텐', -35, 0], ['형광등', -15, 12],
                    ] as Array<[string, number, number]>).map(([label, temperature, tint]) => (
                      <button key={label} type="button" onClick={() => {
                        onEditStart();
                        onSlider('color', 'temperature', temperature);
                        onSlider('color', 'tint', tint);
                        onEditEnd();
                      }}>{label}</button>
                    ))}
                  </div>
                )}
                {section.id === 'light' && (
                  <div className="curve-section">
                    <button
                      className="curve-section-toggle"
                      aria-expanded={curveExpanded}
                      onClick={() => setCurveExpanded((current) => !current)}
                    >
                      <span>RGB 커브</span>
                      <span aria-hidden="true">{curveExpanded ? '▾' : '▸'}</span>
                    </button>
                    {curveExpanded && (
                      <CurveEditor
                        curves={curves}
                        onChange={onCurveChange}
                        onEditStart={onEditStart}
                        onEditEnd={onEditEnd}
                      />
                    )}
                  </div>
                )}
                {section.controls.map((control) => (
                  control.id === 'removeCa' || control.id === 'lensCorrection'
                    ? <button
                        key={control.id}
                        type="button"
                        role="switch"
                        aria-checked={control.value >= 0.5}
                        className={`option-switch ${control.value >= 0.5 ? 'enabled' : ''}`}
                        onClick={() => {
                          onEditStart();
                          onSlider(section.id, control.id, control.value >= 0.5 ? 0 : 1);
                          onEditEnd();
                        }}
                      >
                        <span aria-hidden="true"><i /></span>
                        {control.label}
                      </button>
                    : <SliderControl
                        key={control.id}
                        control={control}
                        onEditStart={onEditStart}
                        onEditEnd={onEditEnd}
                        onChange={(value) => onSlider(section.id, control.id, value)}
                      />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

function CurveEditor({
  curves,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  curves: Curves;
  onChange: (channel: CurveChannel, points: CurvePoint[]) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const [channel, setChannel] = useState<CurveChannel>('rgb');
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const points = curves[channel];
  const colors: Record<CurveChannel, string> = {
    rgb: '#dfe4eb',
    red: '#ff6868',
    green: '#54d17a',
    blue: '#6598ff',
  };
  const curveValue = (x: number) => {
    const allPoints = [{ x: 0, y: 0 }, ...points, { x: 1, y: 1 }];
    let segment = 0;
    while (segment + 2 < allPoints.length && x > allPoints[segment + 1].x) segment += 1;
    const left = allPoints[segment];
    const right = allPoints[segment + 1];
    const width = Math.max(0.000001, right.x - left.x);
    const t = Math.min(1, Math.max(0, (x - left.x) / width));
    const slope = (index: number) => {
      if (index === 0) return (allPoints[1].y - allPoints[0].y) / Math.max(0.000001, allPoints[1].x - allPoints[0].x);
      if (index + 1 === allPoints.length) {
        return (allPoints[index].y - allPoints[index - 1].y) /
          Math.max(0.000001, allPoints[index].x - allPoints[index - 1].x);
      }
      return (allPoints[index + 1].y - allPoints[index - 1].y) /
        Math.max(0.000001, allPoints[index + 1].x - allPoints[index - 1].x);
    };
    const m0 = slope(segment) * width;
    const m1 = slope(segment + 1) * width;
    const t2 = t * t;
    const t3 = t2 * t;
    return Math.min(1, Math.max(0,
      (2 * t3 - 3 * t2 + 1) * left.y +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * right.y +
      (t3 - t2) * m1));
  };
  const path = Array.from({ length: 65 }, (_, index) => {
    const x = index / 64;
    return `${index === 0 ? 'M' : 'L'} ${x * 100} ${(1 - curveValue(x)) * 100}`;
  }).join(' ');

  const pointerPosition = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.min(0.999, Math.max(0.001, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height)),
    };
  };

  const updatePoint = (index: number, clientX: number, clientY: number) => {
    const position = pointerPosition(clientX, clientY);
    if (!position) return;
    const next = [...points];
    const minimumX = index === 0 ? 0.001 : next[index - 1].x + 0.01;
    const maximumX = index + 1 === next.length ? 0.999 : next[index + 1].x - 0.01;
    next[index] = { x: Math.min(maximumX, Math.max(minimumX, position.x)), y: position.y };
    onChange(channel, next);
  };

  return (
    <div className="curve-editor">
      <div className="curve-tabs">
        {(['rgb', 'red', 'green', 'blue'] as CurveChannel[]).map((item) => (
          <button
            key={item}
            className={channel === item ? 'active' : ''}
            style={{ '--curve-color': colors[item] } as React.CSSProperties}
            onClick={() => setChannel(item)}
          >
            {item === 'rgb' ? 'RGB' : item === 'red' ? 'R' : item === 'green' ? 'G' : 'B'}
          </button>
        ))}
        <button className="curve-reset" onClick={() => {
          onEditStart();
          (['rgb', 'red', 'green', 'blue'] as CurveChannel[]).forEach((item) => onChange(item, []));
          onEditEnd();
        }}>전체 초기화</button>
      </div>
      <svg
        ref={svgRef}
        className="curve-graph"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onDoubleClick={(event) => {
          if (points.length >= 8) return;
          const position = pointerPosition(event.clientX, event.clientY);
          if (!position) return;
          onEditStart();
          onChange(channel, [...points, position].sort((left, right) => left.x - right.x));
          onEditEnd();
        }}
        onPointerMove={(event) => {
          if (dragPoint !== null) updatePoint(dragPoint, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
          setDragPoint(null);
          onEditEnd();
        }}
        onPointerCancel={() => {
          setDragPoint(null);
          onEditEnd();
        }}
      >
        <path className="curve-grid" d="M 25 0 V 100 M 50 0 V 100 M 75 0 V 100 M 0 25 H 100 M 0 50 H 100 M 0 75 H 100" />
        <path className="curve-diagonal" d="M 0 100 L 100 0" />
        <path className="curve-line" d={path} style={{ stroke: colors[channel] }} />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x * 100}
            cy={(1 - point.y) * 100}
            r="3.2"
            style={{ stroke: colors[channel] }}
            onPointerDown={(event) => {
              event.preventDefault();
              onEditStart();
              svgRef.current?.setPointerCapture(event.pointerId);
              setDragPoint(index);
              updatePoint(index, event.clientX, event.clientY);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onEditStart();
              onChange(channel, points.filter((_, pointIndex) => pointIndex !== index));
              onEditEnd();
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        ))}
      </svg>
      <div className="curve-labels">
        <span>더블클릭: 점 추가</span>
        <span>{points.length}/8</span>
        <span>우클릭: 제거</span>
      </div>
    </div>
  );
}

function SliderControl({
  control,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  control: SliderOption;
  onChange: (value: number) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const [draft, setDraft] = useState(String(control.value));
  useEffect(() => setDraft(String(control.value)), [control.value]);
  const displayValue = control.step && control.step < 1
    ? control.value.toFixed(1).replace('.0', '')
    : Math.round(control.value).toString();
  const commitDraft = () => {
    const parsed = Number(draft);
    const value = Number.isFinite(parsed)
      ? Math.min(control.max, Math.max(control.min, parsed))
      : control.value;
    onChange(value);
    setDraft(String(value));
    onEditEnd();
  };
  return (
    <label className="slider-control">
      <span>
        <span>{control.label}</span>
        <input
          className="slider-value-input"
          type="number"
          min={control.min}
          max={control.max}
          step={control.step ?? 1}
          value={draft}
          aria-label={`${control.label} 값`}
          onFocus={onEditStart}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(displayValue);
              event.currentTarget.blur();
            }
          }}
        />
      </span>
      <input
        type="range"
        tabIndex={-1}
        min={control.min}
        max={control.max}
        step={control.step ?? 1}
        value={control.value}
        onPointerDown={onEditStart}
        onPointerUp={onEditEnd}
        onPointerCancel={onEditEnd}
        onKeyDown={onEditStart}
        onKeyUp={onEditEnd}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function DebugLogPanel({ logs, onClear }: { logs: DebugLogEntry[]; onClear: () => void }) {
  return (
    <section className="debug-panel">
      <header>
        <strong>처리 로그</strong>
        <button onClick={onClear} disabled={!logs.length}>지우기</button>
      </header>
      <div className="debug-list">
        {!logs.length && <span>표시할 로그가 없습니다.</span>}
        {logs.map((entry) => (
          <div key={entry.id} className={`log-${entry.level}`}>
            <time>{new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour12: false })}</time>
            <strong>{entry.level.toUpperCase()}</strong>
            <span>[{entry.source}] {entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app root element');
createRoot(root).render(<App />);
