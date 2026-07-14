import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeInfo,
  Blend,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Cloud,
  Crop,
  Droplet,
  Eraser,
  Expand,
  FolderOpen,
  History,
  ImagePlus,
  Info,
  Lock,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  PanelTop,
  Ratio,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  SquareArrowOutUpRight,
  Sun,
  Tags,
  Undo2,
  Users,
  WandSparkles,
} from 'lucide-react';
import type {
  EditParams,
  EngineWorkerRenderRequest,
  EngineWorkerRenderResponse,
} from './shared/engineTypes';
import './index.css';

type ThemeMode = 'dark' | 'light';
type ActiveTool = 'edit' | 'crop' | 'remove' | 'mask';
type ToolSectionId = 'light' | 'color' | 'effects' | 'detail' | 'optics';
type SliderTone = 'neutral' | 'temperature' | 'tint' | 'vibrance' | 'sharpness' | 'hue';

type SliderOption = {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  disabled?: boolean;
  tone?: SliderTone;
};

type ToggleOption = {
  id: string;
  label: string;
  enabled: boolean;
};

type ActionOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type ToolSection = {
  id: ToolSectionId;
  title: string;
  controls: Array<SliderOption | ToggleOption | ActionOption>;
};

type ImageFile = {
  id: number;
  name: string;
  width: number;
  height: number;
  pixelFormat: 'rgba8';
};

type PreviewBitmap = EngineWorkerRenderResponse['bitmap'];

declare global {
  interface Window {
    rawElectron: {
      openImages: () => Promise<ImageFile[]>;
      exportImage: (
        imageId: number,
        params: EditParams,
      ) => Promise<{ canceled: boolean; path?: string }>;
      connectPreviewPort: () => void;
      engineWorker: {
        exportRenderedImage: (request: unknown) => Promise<{ path: string }>;
      };
    };
  }
}

type PreviewPortResponse = {
  requestId: number;
  quality: 'proxy' | 'original';
  width?: number;
  height?: number;
  stride?: number;
  engine?: EngineWorkerRenderResponse['engine'];
  data?: Uint8ClampedArray;
  error?: string;
};

type PendingPreview = {
  buffer: SharedArrayBuffer | null;
  timeoutId: number;
  resolve: (response: EngineWorkerRenderResponse) => void;
  reject: (error: Error) => void;
};

let previewPortPromise: Promise<MessagePort> | null = null;
const pendingPreviews = new Map<string, PendingPreview>();

function getPreviewPort(): Promise<MessagePort> {
  if (previewPortPromise) return previewPortPromise;
  previewPortPromise = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', handlePort);
      previewPortPromise = null;
      reject(new Error('Preview MessagePort connection timed out'));
    }, 1500);
    const handlePort = (event: MessageEvent) => {
      if (event.data?.type !== 'engine-preview-port' || !event.ports[0]) return;
      window.removeEventListener('message', handlePort);
      window.clearTimeout(timeoutId);
      const port = event.ports[0];
      port.onmessage = ({ data }: MessageEvent<PreviewPortResponse>) => {
        const key = `${data.requestId}:${data.quality}`;
        const pending = pendingPreviews.get(key);
        if (!pending) return;
        pendingPreviews.delete(key);
        window.clearTimeout(pending.timeoutId);
        if (data.error) {
          pending.reject(new Error(data.error));
          return;
        }
        if (!data.width || !data.height || !data.stride || !data.engine) {
          pending.reject(new Error('Preview response metadata is incomplete'));
          return;
        }
        const pixels = data.data ?? new Uint8ClampedArray(
          pending.buffer as SharedArrayBuffer,
          0,
          data.stride * data.height,
        );
        pending.resolve({
          requestId: data.requestId,
          quality: data.quality,
          engine: data.engine,
          bitmap: {
            width: data.width,
            height: data.height,
            stride: data.stride,
            pixelFormat: 'rgba8',
            data: pixels,
          },
        });
      };
      port.start();
      resolve(port);
    };
    window.addEventListener('message', handlePort);
    window.rawElectron.connectPreviewPort();
  });
  return previewPortPromise;
}

async function renderPreviewThroughPort(
  request: EngineWorkerRenderRequest,
): Promise<EngineWorkerRenderResponse> {
  if (typeof SharedArrayBuffer !== 'function' || !window.crossOriginIsolated) {
    throw new Error('SharedArrayBuffer is unavailable (cross-origin isolation is disabled)');
  }
  const port = await getPreviewPort();
  const key = `${request.requestId}:${request.quality}`;
  const byteLength = request.preview.maxWidth * request.preview.maxHeight * 4;
  const buffer = new SharedArrayBuffer(byteLength);
  const response = new Promise<EngineWorkerRenderResponse>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingPreviews.delete(key);
      reject(new Error('Shared preview request timed out'));
    }, request.quality === 'proxy' ? 5000 : 60000);
    pendingPreviews.set(key, {
      buffer,
      timeoutId,
      resolve,
      reject,
    });
  });
  port.postMessage({ request, buffer });
  return response;
}

const filmItems = [
  { id: 1, label: '대표', scene: 'formal' },
  { id: 2, label: '입장', scene: 'walk' },
  { id: 3, label: '단체', scene: 'group' },
  { id: 4, label: '가족', scene: 'family' },
  { id: 5, label: '스냅', scene: 'couple' },
  { id: 6, label: '실내', scene: 'indoor' },
  { id: 7, label: '행진', scene: 'march' },
  { id: 8, label: '소품', scene: 'detail' },
];

const editSections: ToolSection[] = [
  {
    id: 'light',
    title: '빛',
    controls: [
      { id: 'exposure', label: '노출', min: -5, max: 5, value: 0, step: 0.1 },
      { id: 'contrast', label: '대비', min: -100, max: 100, value: 0 },
      { id: 'highlights', label: '밝은 영역', min: -100, max: 100, value: 0 },
      { id: 'shadows', label: '어두운 영역', min: -100, max: 100, value: 0 },
      { id: 'whites', label: '흰색 계열', min: -100, max: 100, value: 0 },
      { id: 'blacks', label: '검정 계열', min: -100, max: 100, value: 0 },
      { id: 'sdr', label: 'SDR 설정', icon: <PanelTop size={18} /> },
    ],
  },
  {
    id: 'color',
    title: '색상',
    controls: [
      { id: 'temperature', label: '색온도', min: -100, max: 100, value: 0, tone: 'temperature' },
      { id: 'tint', label: '색조', min: -100, max: 100, value: 0, tone: 'tint' },
      { id: 'vibrance', label: '생동감', min: -100, max: 100, value: 0, tone: 'vibrance' },
      { id: 'saturation', label: '채도', min: -100, max: 100, value: 0, tone: 'vibrance' },
      { id: 'colorMixer', label: '색상 혼합', icon: <Palette size={22} /> },
      { id: 'colorGrade', label: '색 보정', icon: <Blend size={22} /> },
    ],
  },
  {
    id: 'effects',
    title: '효과',
    controls: [
      { id: 'texture', label: '텍스처', min: -100, max: 100, value: 0 },
      { id: 'clarity', label: '부분 대비', min: -100, max: 100, value: 0 },
      { id: 'dehaze', label: '디헤이즈', min: -100, max: 100, value: 0 },
      { id: 'vignette', label: '비네팅', min: -100, max: 100, value: 0 },
      { id: 'grain', label: '그레인', min: 0, max: 100, value: 0 },
    ],
  },
  {
    id: 'detail',
    title: '세부 정보',
    controls: [
      { id: 'sharpening', label: '선명 효과', min: 0, max: 150, value: 0, tone: 'sharpness' },
      { id: 'luminanceNoise', label: '노이즈 감소', min: 0, max: 100, value: 0 },
      { id: 'colorNoise', label: '색상 노이즈 감소', min: 0, max: 100, value: 0 },
    ],
  },
  {
    id: 'optics',
    title: '광학',
    controls: [
      { id: 'removeCa', label: 'CA 제거', enabled: false },
      { id: 'lensCorrection', label: '렌즈 교정 사용', enabled: false },
      { id: 'moire', label: 'Moiré', min: 0, max: 100, value: 0 },
      { id: 'defringe', label: '언저리 제거', min: 0, max: 100, value: 0 },
    ],
  },
];

const maskSections: ToolSection[] = [
  {
    id: 'light',
    title: '밝기',
    controls: [
      { id: 'maskExposure', label: '노출', min: -5, max: 5, value: 0, step: 0.1 },
      { id: 'maskContrast', label: '대비', min: -100, max: 100, value: 0 },
      { id: 'maskHighlights', label: '밝은 영역', min: -100, max: 100, value: 0 },
      { id: 'maskShadows', label: '어두운 영역', min: -100, max: 100, value: 0 },
      { id: 'maskWhites', label: '흰색 계열', min: -100, max: 100, value: 0 },
      { id: 'maskBlacks', label: '검정 계열', min: -100, max: 100, value: 0 },
    ],
  },
  {
    id: 'color',
    title: '색상',
    controls: [
      { id: 'maskTemp', label: '색온도', min: -100, max: 100, value: 0, tone: 'temperature' },
      { id: 'maskTint', label: '색조', min: -100, max: 100, value: 0, tone: 'tint' },
      { id: 'maskSat', label: '채도', min: -100, max: 100, value: 0, tone: 'vibrance' },
      { id: 'maskHue', label: '색조', min: 0, max: 360, value: 180, tone: 'hue' },
      { id: 'fineAdjust', label: '미세 조정 사용', enabled: false },
    ],
  },
  {
    id: 'effects',
    title: '효과',
    controls: [
      { id: 'maskTexture', label: '텍스처', min: -100, max: 100, value: 0 },
      { id: 'maskClarity', label: '부분 대비', min: -100, max: 100, value: 0 },
      { id: 'maskDehaze', label: '디헤이즈', min: -100, max: 100, value: 0 },
    ],
  },
  {
    id: 'detail',
    title: '세부 정보',
    controls: [
      { id: 'maskNoise', label: '노이즈', min: 0, max: 100, value: 0 },
      { id: 'maskSharpness', label: '선명도', min: 0, max: 100, value: 0 },
    ],
  },
  {
    id: 'optics',
    title: '광학',
    controls: [
      { id: 'maskMoire', label: 'Moiré', min: 0, max: 100, value: 0 },
      { id: 'maskDefringe', label: '언저리 제거', min: 0, max: 100, value: 0 },
    ],
  },
];

function getDpiScale() {
  const ratio = window.devicePixelRatio || 1;
  return Math.min(1, Math.max(0.78, 1 / Math.sqrt(ratio)));
}

function getMonitorDpiPercent() {
  return Math.round((window.devicePixelRatio || 1) * 100);
}

function getSavedPanelTextScale() {
  const savedValue = Number(window.localStorage.getItem('raw-electron-panel-text-scale'));

  if (!Number.isFinite(savedValue)) {
    return 0.82;
  }

  return Math.min(1.1, Math.max(0.6, savedValue));
}

function isSlider(control: ToolSection['controls'][number]): control is SliderOption {
  return 'min' in control;
}

function isToggle(control: ToolSection['controls'][number]): control is ToggleOption {
  return 'enabled' in control;
}

function formatValue(control: SliderOption) {
  return control.step && control.step < 1
    ? control.value.toFixed(1).replace('.0', '')
    : Math.round(control.value).toString();
}

function sliderValue(sections: ToolSection[], id: string, fallback = 0) {
  for (const section of sections) {
    const control = section.controls.find((item) => item.id === id);

    if (control && isSlider(control)) {
      return control.value;
    }
  }

  return fallback;
}

function toggleValue(sections: ToolSection[], id: string, fallback = false) {
  for (const section of sections) {
    const control = section.controls.find((item) => item.id === id);

    if (control && isToggle(control)) {
      return control.enabled;
    }
  }

  return fallback;
}

function buildEditParams(
  sections: ToolSection[],
  maskControls: ToolSection[],
  selectedRatio: string,
  removeSize: number,
  detectObjects: boolean,
  generativeAi: boolean,
): EditParams {
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
    texture: sliderValue(sections, 'texture'),
    clarity: sliderValue(sections, 'clarity'),
    dehaze: sliderValue(sections, 'dehaze'),
    vignette: sliderValue(sections, 'vignette'),
    grain: sliderValue(sections, 'grain'),
    sharpening: sliderValue(sections, 'sharpening'),
    luminanceNoise: sliderValue(sections, 'luminanceNoise'),
    colorNoise: sliderValue(sections, 'colorNoise'),
    removeCa: toggleValue(sections, 'removeCa'),
    lensCorrection: toggleValue(sections, 'lensCorrection'),
    moire: sliderValue(sections, 'moire'),
    defringe: sliderValue(sections, 'defringe'),
    crop: {
      enabled: selectedRatio !== '',
      ratio: selectedRatio,
      rotation: 0,
    },
    remove: {
      brushSize: removeSize,
      detectObjects,
      generativeAi,
    },
    mask: {
      exposure: sliderValue(maskControls, 'maskExposure'),
      contrast: sliderValue(maskControls, 'maskContrast'),
      highlights: sliderValue(maskControls, 'maskHighlights'),
      shadows: sliderValue(maskControls, 'maskShadows'),
      whites: sliderValue(maskControls, 'maskWhites'),
      blacks: sliderValue(maskControls, 'maskBlacks'),
      temperature: sliderValue(maskControls, 'maskTemp'),
      tint: sliderValue(maskControls, 'maskTint'),
      saturation: sliderValue(maskControls, 'maskSat'),
      hue: sliderValue(maskControls, 'maskHue'),
      texture: sliderValue(maskControls, 'maskTexture'),
      clarity: sliderValue(maskControls, 'maskClarity'),
      dehaze: sliderValue(maskControls, 'maskDehaze'),
      noise: sliderValue(maskControls, 'maskNoise'),
      sharpness: sliderValue(maskControls, 'maskSharpness'),
      moire: sliderValue(maskControls, 'maskMoire'),
      defringe: sliderValue(maskControls, 'maskDefringe'),
      fineAdjust: toggleValue(maskControls, 'fineAdjust'),
    },
  };
}

function updateSectionSlider(sections: ToolSection[], sectionId: ToolSectionId, controlId: string, value: number) {
  return sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          controls: section.controls.map((control) =>
            control.id === controlId && isSlider(control) ? { ...control, value } : control,
          ),
        }
      : section,
  );
}

function updateSectionToggle(sections: ToolSection[], sectionId: ToolSectionId, controlId: string) {
  return sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          controls: section.controls.map((control) =>
            control.id === controlId && isToggle(control)
              ? { ...control, enabled: !control.enabled }
              : control,
          ),
        }
      : section,
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [dpiUiScale, setDpiUiScale] = useState(getDpiScale);
  const [monitorDpiPercent, setMonitorDpiPercent] = useState(getMonitorDpiPercent);
  const [panelTextScale, setPanelTextScale] = useState(getSavedPanelTextScale);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('edit');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [renderedPreviewBitmap, setRenderedPreviewBitmap] = useState<PreviewBitmap | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [viewportPixels, setViewportPixels] = useState({ width: 1280, height: 960 });
  const engineRequestId = useRef(0);
  const [sections, setSections] = useState<ToolSection[]>(editSections);
  const [maskControls, setMaskControls] = useState<ToolSection[]>(maskSections);
  const [removeSize, setRemoveSize] = useState(20);
  const [detectObjects, setDetectObjects] = useState(false);
  const [generativeAi, setGenerativeAi] = useState(true);
  const [cropTab, setCropTab] = useState<'ratio' | 'shape'>('ratio');
  const [selectedRatio, setSelectedRatio] = useState('원본');
  const [openSections, setOpenSections] = useState<Record<ToolSectionId, boolean>>({
    light: true,
    color: false,
    effects: false,
    detail: false,
    optics: false,
  });
  const [openMaskSections, setOpenMaskSections] = useState<Record<ToolSectionId, boolean>>({
    light: false,
    color: false,
    effects: false,
    detail: false,
    optics: false,
  });

  useEffect(() => {
    const updateScale = () => {
      setDpiUiScale(getDpiScale());
      setMonitorDpiPercent(getMonitorDpiPercent());
    };
    window.addEventListener('resize', updateScale);
    const intervalId = window.setInterval(updateScale, 1000);

    return () => {
      window.removeEventListener('resize', updateScale);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('raw-electron-panel-text-scale', String(panelTextScale));
  }, [panelTextScale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F5') {
        return;
      }

      event.preventDefault();
      setShowSettings((current) => !current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const previewFilter = useMemo(() => {
    const values = Object.fromEntries(
      sections.flatMap((section) =>
        section.controls.filter(isSlider).map((control) => [control.id, control.value]),
      ),
    );

    const exposure = 1 + Number(values.exposure ?? 0) * 0.08;
    const contrast = 1 + Number(values.contrast ?? 0) * 0.003;
    const saturation =
      1 + (Number(values.saturation ?? 0) + Number(values.vibrance ?? 0) * 0.6) * 0.004;
    const warmth = Number(values.temperature ?? 0) * 0.4;

    return {
      filter: `brightness(${exposure}) contrast(${contrast}) saturate(${saturation})`,
      boxShadow: warmth
        ? `inset 0 0 0 999px rgba(${warmth > 0 ? 255 : 90}, ${warmth > 0 ? 190 : 120}, ${warmth > 0 ? 80 : 255}, ${Math.abs(warmth) / 1000})`
        : undefined,
    };
  }, [sections]);

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
  const editParams = useMemo(
    () =>
      buildEditParams(
        sections,
        maskControls,
        selectedRatio,
        removeSize,
        detectObjects,
        generativeAi,
      ),
    [sections, maskControls, selectedRatio, removeSize, detectObjects, generativeAi],
  );
  const isModalTool = activeTool === 'crop' || activeTool === 'remove' || activeTool === 'mask';

  useEffect(() => {
    if (!selectedImage) {
      setRenderedPreviewBitmap(null);
      setPreviewError(null);
      return undefined;
    }

    setRenderedPreviewBitmap(null);
    setPreviewError(null);
    let cancelled = false;
    let originalPresented = false;
    let failureCount = 0;
    const requestId = engineRequestId.current + 1;
    engineRequestId.current = requestId;
    const targetWidth = Math.max(1, Math.min(selectedImage.width, viewportPixels.width));
    const targetHeight = Math.max(1, Math.min(selectedImage.height, viewportPixels.height));

    const renderBitmap = (quality: 'proxy' | 'original') => {
      return renderPreviewThroughPort({
        requestId,
        imageId: selectedImage.id,
        quality,
        params: editParams,
        preview: { maxWidth: targetWidth, maxHeight: targetHeight },
      });
    };

    const handleFailure = (quality: 'proxy' | 'original', error: unknown) => {
      failureCount += 1;
      if (!cancelled && failureCount === 2) {
        setPreviewError(
          `${quality} Preview 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    // Both pipelines start together. The proxy normally wins the first frame;
    // the original-derived preview replaces it only when its full pipeline ends.
    void renderBitmap('proxy')
      .then((proxy) => {
        if (cancelled || originalPresented || proxy.requestId !== engineRequestId.current) return;
        setRenderedPreviewBitmap(proxy.bitmap);
      })
      .catch((error) => handleFailure('proxy', error));

    void renderBitmap('original')
      .then((original) => {
        if (cancelled || original.requestId !== engineRequestId.current) return;
        originalPresented = true;
        setRenderedPreviewBitmap(original.bitmap);
      })
      .catch((error) => handleFailure('original', error));

    return () => {
      cancelled = true;
    };
  }, [selectedImage, editParams, viewportPixels]);

  const openImages = async () => {
    setPreviewError(null);
    let openedImages: ImageFile[];
    try {
      openedImages = await window.rawElectron.openImages();
    } catch (error) {
      setPreviewError(`파일을 열지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (!openedImages.length) {
      return;
    }

    setImages((current) => {
      const knownIds = new Set(current.map((image) => image.id));
      return [...current, ...openedImages.filter((image) => !knownIds.has(image.id))];
    });
    setSelectedImageId(openedImages[0].id);
    setActiveTool('edit');
  };

  const exportSelectedImage = async () => {
    if (!selectedImage) {
      return;
    }

    await window.rawElectron.exportImage(selectedImage.id, editParams);
  };

  return (
    <div
      className="raw-app"
      data-theme={theme}
      data-tool={activeTool}
      style={
        {
          '--ui-scale': dpiUiScale,
          '--panel-text-scale': panelTextScale,
        } as React.CSSProperties
      }
    >
      <Topbar
        theme={theme}
        monitorDpiPercent={monitorDpiPercent}
        panelTextScale={panelTextScale}
        showSettings={showSettings}
        activeTool={activeTool}
        canExport={Boolean(selectedImage)}
        onOpenImages={openImages}
        onExportImage={exportSelectedImage}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        onToggleSettings={() => setShowSettings((current) => !current)}
        onPanelTextScaleChange={setPanelTextScale}
        onResetPanelTextScale={() => setPanelTextScale(0.82)}
      />
      <main className="workspace">
        <Viewer
          images={images}
          selectedImage={selectedImage}
          renderedPreviewBitmap={renderedPreviewBitmap}
          previewError={previewError}
          onViewportPixelsChange={setViewportPixels}
          previewFilter={previewFilter}
          activeTool={activeTool}
          selectedRatio={selectedRatio}
          onOpenImages={openImages}
          onSelectImage={(image) => {
            setSelectedImageId(image.id);
            setActiveTool('edit');
          }}
        />
        {activeTool === 'edit' && (
          <EditPanel
            title="편집"
            sections={sections}
            openSections={openSections}
            onToggleSection={(sectionId) =>
              setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
            }
            onSliderChange={(sectionId, controlId, value) =>
              setSections((current) => updateSectionSlider(current, sectionId, controlId, value))
            }
            onToggleOption={(sectionId, controlId) =>
              setSections((current) => updateSectionToggle(current, sectionId, controlId))
            }
            onReset={() => setSections(editSections)}
          />
        )}
        {activeTool === 'crop' && (
          <CropPanel
            cropTab={cropTab}
            selectedRatio={selectedRatio}
            onTabChange={setCropTab}
            onRatioSelect={setSelectedRatio}
          />
        )}
        {activeTool === 'remove' && (
          <RemovePanel
            size={removeSize}
            detectObjects={detectObjects}
            generativeAi={generativeAi}
            onSizeChange={setRemoveSize}
            onDetectObjectsChange={() => setDetectObjects((current) => !current)}
            onGenerativeAiChange={() => setGenerativeAi((current) => !current)}
          />
        )}
        {activeTool === 'mask' && (
          <MaskPanel
            sections={maskControls}
            openSections={openMaskSections}
            onToggleSection={(sectionId) =>
              setOpenMaskSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
            }
            onSliderChange={(sectionId, controlId, value) =>
              setMaskControls((current) => updateSectionSlider(current, sectionId, controlId, value))
            }
            onToggleOption={(sectionId, controlId) =>
              setMaskControls((current) => updateSectionToggle(current, sectionId, controlId))
            }
          />
        )}
        <ToolRail activeTool={activeTool} onToolSelect={setActiveTool} />
      </main>
      {isModalTool && (
        <div className="action-footer">
          <button className="icon-button" aria-label="되돌리기">
            <RotateCcw size={22} />
          </button>
          <div className="action-footer-buttons">
            <button className="ghost-action" onClick={() => setActiveTool('edit')}>
              취소
            </button>
            <button className="primary-action" onClick={() => setActiveTool('edit')}>
              적용
            </button>
          </div>
          <BadgeInfo size={22} />
        </div>
      )}
    </div>
  );
}

function Topbar({
  theme,
  monitorDpiPercent,
  panelTextScale,
  showSettings,
  activeTool,
  canExport,
  onOpenImages,
  onExportImage,
  onToggleTheme,
  onToggleSettings,
  onPanelTextScaleChange,
  onResetPanelTextScale,
}: {
  theme: ThemeMode;
  monitorDpiPercent: number;
  panelTextScale: number;
  showSettings: boolean;
  activeTool: ActiveTool;
  canExport: boolean;
  onOpenImages: () => void;
  onExportImage: () => void;
  onToggleTheme: () => void;
  onToggleSettings: () => void;
  onPanelTextScaleChange: (value: number) => void;
  onResetPanelTextScale: () => void;
}) {
  const ThemeIcon = theme === 'dark' ? Moon : Sun;
  const cropTitle = activeTool === 'crop' ? '원본(4 x 3)' : '';

  return (
    <header className="topbar">
      <button className="icon-button back" aria-label="뒤로">
        <ChevronLeft size={34} />
      </button>
      <div className="topbar-title">{cropTitle}</div>
      <div className="topbar-actions" aria-label="빠른 작업">
        <button className="icon-button muted" aria-label="실행 취소">
          <Undo2 size={22} />
        </button>
        <button className="icon-button muted" aria-label="다시 실행">
          <Redo2 size={22} />
        </button>
        <button className="icon-button" aria-label="도움말">
          ?
        </button>
        <button className="icon-button" aria-label="사진 열기" onClick={onOpenImages}>
          <FolderOpen size={22} />
        </button>
        <button
          className="icon-button"
          aria-label="내보내기"
          disabled={!canExport}
          onClick={onExportImage}
        >
          <SquareArrowOutUpRight size={22} />
        </button>
        <button className="icon-button cloud" aria-label="동기화">
          <Cloud size={25} />
          <span className="sync-dot" />
        </button>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="테마 전환">
          <ThemeIcon size={18} />
          {theme === 'dark' ? '다크' : '라이트'}
        </button>
        <span className="dpi-indicator" title="DPI에 따라 자동 조절됩니다">
          <Monitor size={16} />
          {monitorDpiPercent}%
        </span>
        <button
          className={`icon-button ${showSettings ? 'active-button' : ''}`}
          aria-label="설정"
          aria-expanded={showSettings}
          onClick={onToggleSettings}
        >
          <MoreHorizontal size={24} />
        </button>
      </div>
      {showSettings && (
          <SettingsPopover
          monitorDpiPercent={monitorDpiPercent}
          panelTextScale={panelTextScale}
          onPanelTextScaleChange={onPanelTextScaleChange}
          onResetPanelTextScale={onResetPanelTextScale}
        />
      )}
    </header>
  );
}

function SettingsPopover({
  monitorDpiPercent,
  panelTextScale,
  onPanelTextScaleChange,
  onResetPanelTextScale,
}: {
  monitorDpiPercent: number;
  panelTextScale: number;
  onPanelTextScaleChange: (value: number) => void;
  onResetPanelTextScale: () => void;
}) {
  return (
    <section className="settings-popover" aria-label="설정">
      <div className="settings-header">
        <h2>설정</h2>
        <button onClick={onResetPanelTextScale}>기본값</button>
      </div>
      <label className="scale-setting">
        <span className="slider-meta">
          <span>패널 글자</span>
          <output>{Math.round(panelTextScale * 100)}%</output>
        </span>
        <input
          type="range"
          min={60}
          max={110}
          step={2}
          value={Math.round(panelTextScale * 100)}
          onChange={(event) => onPanelTextScaleChange(Number(event.currentTarget.value) / 100)}
        />
      </label>
      <div className="settings-info">
        <span>모니터 DPI</span>
        <strong>{monitorDpiPercent}%</strong>
      </div>
      <div className="settings-info">
        <span>단축키</span>
        <strong>F5</strong>
      </div>
    </section>
  );
}

function BitmapCanvas({ bitmap, label }: { bitmap: PreviewBitmap; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bitmap.pixelFormat !== 'rgba8' || bitmap.stride !== bitmap.width * 4) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const pixels = bitmap.data instanceof Uint8ClampedArray
      ? bitmap.data
      : new Uint8ClampedArray(bitmap.data);
    context.putImageData(new ImageData(pixels, bitmap.width, bitmap.height), 0, 0);
  }, [bitmap]);

  return <canvas ref={canvasRef} className="photo-img photo-canvas" role="img" aria-label={label} />;
}

function Viewer({
  images,
  selectedImage,
  renderedPreviewBitmap,
  previewError,
  onViewportPixelsChange,
  previewFilter,
  activeTool,
  selectedRatio,
  onOpenImages,
  onSelectImage,
}: {
  images: ImageFile[];
  selectedImage: ImageFile | null;
  renderedPreviewBitmap: PreviewBitmap | null;
  previewError: string | null;
  onViewportPixelsChange: (size: { width: number; height: number }) => void;
  previewFilter: React.CSSProperties;
  activeTool: ActiveTool;
  selectedRatio: string;
  onOpenImages: () => void;
  onSelectImage: (image: ImageFile) => void;
}) {
  const showToolFooter = activeTool !== 'edit';
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(entry.contentRect.width * ratio));
      const height = Math.max(1, Math.round(entry.contentRect.height * ratio));
      onViewportPixelsChange({ width, height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [onViewportPixelsChange]);

  return (
    <section className="viewer" aria-label="사진 미리보기">
      <div className="stage" ref={stageRef}>
        <div className={`photo-frame ${activeTool === 'crop' && selectedImage ? 'crop-active' : ''}`}>
          {selectedImage ? (
            <div className="sample-photo loaded-photo" style={previewFilter} role="img" aria-label={selectedImage.name}>
              {renderedPreviewBitmap ? (
                <BitmapCanvas bitmap={renderedPreviewBitmap} label={selectedImage.name} />
              ) : (
                <div className={`preview-loading ${previewError ? 'preview-error' : ''}`} role="status">
                  {previewError ?? '파일 로드 완료 · Proxy Preview 생성 중…'}
                </div>
              )}
              {activeTool === 'mask' && <div className="mask-overlay" />}
            </div>
          ) : (
            <EmptyViewer onOpenImages={onOpenImages} />
          )}
          {selectedImage && activeTool === 'crop' && <CropOverlay selectedRatio={selectedRatio} />}
          {selectedImage && activeTool === 'mask' && <MaskOverlay />}
        </div>
      </div>
      {showToolFooter ? (
        <div className="tool-canvas-footer">
          {selectedImage && activeTool === 'crop' && (
            <>
              <div className="rotation-dial">0°</div>
              <button className="round-tool" aria-label="맞춤">
                <Expand size={18} />
              </button>
              <button className="round-tool" aria-label="비율 잠금">
                <Lock size={18} />
              </button>
            </>
          )}
        </div>
      ) : (
        <ImageFilmstrip
          images={images}
          selectedImage={selectedImage}
          onSelectImage={onSelectImage}
          onOpenImages={onOpenImages}
        />
      )}
    </section>
  );

  return (
    <section className="viewer" aria-label="사진 미리보기">
      <div className="stage">
        <div className={`photo-frame ${activeTool === 'crop' ? 'crop-active' : ''}`}>
          <div className="sample-photo" style={previewFilter} role="img" aria-label="사진 미리보기">
            <div className="light-curtain" />
            <div className="arch arch-left" />
            <div className="arch arch-right" />
            <div className="flower-bed" />
            <SamplePerson className="person-wide" body="suit" />
            <SamplePerson className="person-bride" body="dress" />
            <SamplePerson className="person-groom" body="suit" />
            <SamplePerson className="person-hanbok" body="hanbok" />
            <SamplePerson className="person-right" body="suit" />
            {activeTool === 'mask' && <div className="mask-overlay" />}
          </div>
          {activeTool === 'crop' && <CropOverlay selectedRatio={selectedRatio} />}
          {activeTool === 'mask' && <MaskOverlay />}
        </div>
      </div>
      {activeTool === 'edit' ? (
        <Filmstrip />
      ) : (
        <div className="tool-canvas-footer">
          {activeTool === 'crop' && (
            <>
              <div className="rotation-dial">0°</div>
              <button className="round-tool"><Expand size={18} /></button>
              <button className="round-tool"><Lock size={18} /></button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyViewer({ onOpenImages }: { onOpenImages: () => void }) {
  return (
    <div className="empty-viewer">
      <div className="empty-viewer-content">
        <ImagePlus size={34} />
        <h2>사진이 없습니다</h2>
        <p>이미지를 불러온 뒤 하단 썸네일을 선택하면 편집 화면에 표시됩니다.</p>
        <button className="open-button" onClick={onOpenImages}>
          <FolderOpen size={18} />
          사진 불러오기
        </button>
      </div>
    </div>
  );
}

function ImageFilmstrip({
  images,
  selectedImage,
  onSelectImage,
  onOpenImages,
}: {
  images: ImageFile[];
  selectedImage: ImageFile | null;
  onSelectImage: (image: ImageFile) => void;
  onOpenImages: () => void;
}) {
  return (
    <aside className="filmstrip" aria-label="사진 목록">
      {images.map((image) => (
        <button
          key={image.id}
          className={`thumb ${selectedImage?.id === image.id ? 'selected' : ''}`}
          aria-label={`${image.name} 선택`}
          title={image.name}
          onClick={() => onSelectImage(image)}
        >
          <div className="thumb-placeholder" aria-hidden="true">
            {image.width}×{image.height}
          </div>
        </button>
      ))}
      <button className="thumb add-thumb" aria-label="사진 추가" onClick={onOpenImages}>
        <FolderOpen size={20} />
      </button>
    </aside>
  );
}

function CropOverlay({ selectedRatio }: { selectedRatio: string }) {
  return (
    <div className="crop-overlay" aria-label={`${selectedRatio} 자르기 프레임`}>
      <span className="corner top-left" />
      <span className="corner top-right" />
      <span className="corner bottom-left" />
      <span className="corner bottom-right" />
      <span className="edge left" />
      <span className="edge right" />
    </div>
  );
}

function MaskOverlay() {
  return (
    <>
      <div className="mask-tip">선택 영역 조정</div>
      <div className="mask-pin"><Users size={16} /></div>
      <div className="mask-stack">
        <button className="mask-add">+</button>
        <button className="mask-chip active"><Users size={22} /></button>
        <button className="mask-chip"><CircleDotDashed size={22} /></button>
        <button className="mask-chip small">−+</button>
      </div>
      <div className="mask-delete-stack">
        <button><CircleDotDashed size={18} /></button>
        <button><Eraser size={18} /></button>
      </div>
    </>
  );
}

function SamplePerson({ className, body }: { className: string; body: string }) {
  return (
    <div className={`person ${className}`}>
      <span className="head" />
      <span className={`body ${body}`} />
    </div>
  );
}

function Filmstrip() {
  return (
    <aside className="filmstrip" aria-label="사진 목록">
      {filmItems.map((item) => (
        <button
          key={item.id}
          className={`thumb ${item.id === 1 ? 'selected' : ''}`}
          aria-label={`${item.label} 사진`}
        >
          <span className={`thumb-image thumb-${item.scene}`} />
        </button>
      ))}
      <button className="filmstrip-menu" aria-label="필름스트립 보기">
        <ChevronDown size={24} />
      </button>
    </aside>
  );
}

function EditPanel({
  title,
  sections,
  openSections,
  onToggleSection,
  onSliderChange,
  onToggleOption,
  onReset,
}: {
  title: string;
  sections: ToolSection[];
  openSections: Record<ToolSectionId, boolean>;
  onToggleSection: (sectionId: ToolSectionId) => void;
  onSliderChange: (sectionId: ToolSectionId, controlId: string, value: number) => void;
  onToggleOption: (sectionId: ToolSectionId, controlId: string) => void;
  onReset: () => void;
}) {
  return (
    <aside className="edit-panel" aria-label={`${title} 패널`}>
      <div className="panel-scroll">
        <div className="panel-header">
          <h1>{title}</h1>
          <button className="auto-button">
            <ImagePlus size={20} />
            자동
          </button>
        </div>
        <div className="profile-row">
          <div>
            <h2>프로필</h2>
            <p>색상</p>
          </div>
          <button>탐색</button>
        </div>
        <AdjustSections
          sections={sections}
          openSections={openSections}
          onToggleSection={onToggleSection}
          onSliderChange={onSliderChange}
          onToggleOption={onToggleOption}
          showLightActions
          showWhiteBalance
        />
      </div>
      <div className="panel-footer">
        <button className="icon-button" aria-label="전체 초기화" onClick={onReset}>
          <RotateCcw size={22} />
        </button>
      </div>
    </aside>
  );
}

function MaskPanel({
  sections,
  openSections,
  onToggleSection,
  onSliderChange,
  onToggleOption,
}: {
  sections: ToolSection[];
  openSections: Record<ToolSectionId, boolean>;
  onToggleSection: (sectionId: ToolSectionId) => void;
  onSliderChange: (sectionId: ToolSectionId, controlId: string, value: number) => void;
  onToggleOption: (sectionId: ToolSectionId, controlId: string) => void;
}) {
  return (
    <aside className="edit-panel" aria-label="마스크 패널">
      <div className="panel-scroll">
        <div className="panel-header mode-header">
          <h1>마스크</h1>
        </div>
        <AdjustSections
          sections={sections}
          openSections={openSections}
          onToggleSection={onToggleSection}
          onSliderChange={onSliderChange}
          onToggleOption={onToggleOption}
        />
      </div>
    </aside>
  );
}

function AdjustSections({
  sections,
  openSections,
  onToggleSection,
  onSliderChange,
  onToggleOption,
  showLightActions,
  showWhiteBalance,
}: {
  sections: ToolSection[];
  openSections: Record<ToolSectionId, boolean>;
  onToggleSection: (sectionId: ToolSectionId) => void;
  onSliderChange: (sectionId: ToolSectionId, controlId: string, value: number) => void;
  onToggleOption: (sectionId: ToolSectionId, controlId: string) => void;
  showLightActions?: boolean;
  showWhiteBalance?: boolean;
}) {
  return (
    <div className="accordion">
      {sections.map((section) => (
        <section className="tool-section" key={section.id}>
          <button
            className="accordion-item"
            aria-expanded={openSections[section.id]}
            onClick={() => onToggleSection(section.id)}
          >
            {openSections[section.id] ? <ChevronDown size={23} /> : <ChevronRight size={23} />}
            <strong>{section.title}</strong>
          </button>
          {openSections[section.id] && (
            <div className="section-body">
              {showLightActions && section.id === 'light' && (
                <div className="section-actions">
                  <button>HDR</button>
                  <button aria-label="톤 커브">⌁</button>
                </div>
              )}
              {showWhiteBalance && section.id === 'color' && (
                <div className="white-balance-row">
                  <span>WB</span>
                  <button>
                    원본값 <ChevronDown size={19} />
                  </button>
                  <button className="eyedropper" aria-label="스포이드">
                    ⌕
                  </button>
                </div>
              )}
              {section.controls.map((control) => {
                if (isSlider(control)) {
                  return (
                    <SliderControl
                      key={control.id}
                      control={control}
                      onChange={(value) => onSliderChange(section.id, control.id, value)}
                    />
                  );
                }
                if (isToggle(control)) {
                  return (
                    <ToggleControl
                      key={control.id}
                      control={control}
                      onToggle={() => onToggleOption(section.id, control.id)}
                    />
                  );
                }
                return (
                  <button className="panel-action-button" key={control.id}>
                    {control.icon}
                    {control.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CropPanel({
  cropTab,
  selectedRatio,
  onTabChange,
  onRatioSelect,
}: {
  cropTab: 'ratio' | 'shape';
  selectedRatio: string;
  onTabChange: (tab: 'ratio' | 'shape') => void;
  onRatioSelect: (ratio: string) => void;
}) {
  const ratios = [
    { label: '원본', icon: <ImagePlus size={22} /> },
    { label: '비율', icon: <Ratio size={22} /> },
    { label: 'Instagram', text: '◎' },
    { label: 'Facebook', text: 'f' },
    { label: 'TikTok', text: '♪' },
    { label: 'YouTube', text: '▶' },
    { label: 'X', text: '𝕏' },
  ];
  const transforms = ['수평맞춤', '뒤집기 V', '뒤집기 H', '회전'];

  return (
    <aside className="edit-panel" aria-label="자르기 및 도형 패널">
      <div className="panel-scroll">
        <div className="panel-header mode-header">
          <h1>자르기 및 도형</h1>
        </div>
        <div className="tab-row">
          <button className={cropTab === 'ratio' ? 'active' : ''} onClick={() => onTabChange('ratio')}>
            종횡비
          </button>
          <button className={cropTab === 'shape' ? 'active' : ''} onClick={() => onTabChange('shape')}>
            도형
          </button>
        </div>
        <div className="preset-grid">
          {ratios.map((ratio) => (
            <button
              key={ratio.label}
              className={selectedRatio === ratio.label ? 'selected' : ''}
              onClick={() => onRatioSelect(ratio.label)}
            >
              {ratio.icon ?? <span className="brand-mark">{ratio.text}</span>}
              <span>{ratio.label}</span>
            </button>
          ))}
        </div>
        <div className="tool-divider" />
        <div className="transform-grid">
          {transforms.map((item) => (
            <button key={item}>
              <RotateCcw size={22} />
              <span>{item}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function RemovePanel({
  size,
  detectObjects,
  generativeAi,
  onSizeChange,
  onDetectObjectsChange,
  onGenerativeAiChange,
}: {
  size: number;
  detectObjects: boolean;
  generativeAi: boolean;
  onSizeChange: (value: number) => void;
  onDetectObjectsChange: () => void;
  onGenerativeAiChange: () => void;
}) {
  return (
    <aside className="edit-panel" aria-label="제거 패널">
      <div className="panel-scroll">
        <div className="panel-header mode-header">
          <h1>제거</h1>
        </div>
        <div className="remove-body">
          <button className="blue-tool-button">
            <Eraser size={20} />
            제거
          </button>
          <SliderControl
            control={{ id: 'removeSize', label: '크기', min: 1, max: 100, value: size }}
            onChange={onSizeChange}
          />
          <ToggleControl control={{ id: 'detectObjects', label: '객체 감지', enabled: detectObjects }} onToggle={onDetectObjectsChange} />
          <ToggleControl control={{ id: 'generativeAi', label: '생성형 AI', enabled: generativeAi }} onToggle={onGenerativeAiChange} />
          <button className="panel-action-button disabled">
            <Eraser size={18} />
            다듬기
          </button>
          <div className="tool-divider" />
          <p className="panel-caption">불필요한 요소 제거</p>
          <button className="outline-chip">
            <Users size={18} />
            인물
          </button>
        </div>
      </div>
    </aside>
  );
}

function SliderControl({ control, onChange }: { control: SliderOption; onChange: (value: number) => void }) {
  const position = ((control.value - control.min) / (control.max - control.min)) * 100;

  return (
    <label className={`slider-control ${control.disabled ? 'disabled' : ''}`}>
      <span className="slider-meta">
        <span>{control.label}</span>
        <output>{formatValue(control)}</output>
      </span>
      <span className={`slider-track tone-${control.tone ?? 'neutral'}`}>
        <span className="slider-fill" style={{ width: `${position}%` }} />
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step ?? 1}
          value={control.value}
          disabled={control.disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </span>
    </label>
  );
}

function ToggleControl({ control, onToggle }: { control: ToggleOption; onToggle: () => void }) {
  return (
    <button className="toggle-row" onClick={onToggle} aria-pressed={control.enabled}>
      <span className={`switch ${control.enabled ? 'on' : ''}`}>
        <span />
      </span>
      <span>{control.label}</span>
      {control.id === 'generativeAi' && <Info size={16} />}
    </button>
  );
}

function ToolRail({
  activeTool,
  onToolSelect,
}: {
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
}) {
  const tools = [
    { id: 'edit' as const, icon: <SlidersHorizontal size={25} />, label: '편집' },
    { id: 'crop' as const, icon: <Crop size={25} />, label: '자르기' },
    { id: 'remove' as const, icon: <Eraser size={25} />, label: '제거' },
    { id: 'mask' as const, icon: <CircleDotDashed size={25} />, label: '마스크' },
  ];
  const decorativeTools = [
    { icon: <WandSparkles size={25} />, label: '자동 보정' },
    { icon: <CircleDotDashed size={25} />, label: '선택' },
    { icon: <Droplet size={25} />, label: '톤' },
    { icon: <SlidersHorizontal size={25} />, label: '사전 설정' },
    { icon: <History size={25} />, label: '기록' },
    { icon: <Sparkles size={25} />, label: '즐겨찾기' },
    { icon: <Tags size={25} />, label: '태그' },
    { icon: <BadgeInfo size={25} />, label: '정보' },
  ];

  return (
    <nav className="tool-rail" aria-label="도구">
      <button className="rail-button" aria-label={decorativeTools[0].label} title={decorativeTools[0].label}>
        {decorativeTools[0].icon}
      </button>
      <button className="rail-button" aria-label={decorativeTools[1].label} title={decorativeTools[1].label}>
        {decorativeTools[1].icon}
      </button>
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`rail-button ${activeTool === tool.id ? 'active' : ''}`}
          aria-label={tool.label}
          title={tool.label}
          onClick={() => onToolSelect(tool.id)}
        >
          {tool.icon}
        </button>
      ))}
      <div className="rail-spacer" />
      {decorativeTools.slice(2).map((tool) => (
        <button key={tool.label} className="rail-button" aria-label={tool.label} title={tool.label}>
          {tool.icon}
        </button>
      ))}
    </nav>
  );
}

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

createRoot(root).render(<App />);
