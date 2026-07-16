import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DebugLogEntry, EditParams, ExportFormat } from './shared/engineTypes';
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
const identityCurves: Curves = {
  rgb: [],
  red: [],
  green: [],
  blue: [],
};

type ImageFile = {
  id: number;
  name: string;
  width: number;
  height: number;
  pixelFormat: 'rgba8';
};

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

declare global {
  interface Window {
    rawElectron: {
      openImages: () => Promise<ImageFile[]>;
      openDroppedImages: (files: File[]) => Promise<ImageFile[]>;
      closeImage: (imageId: number) => Promise<boolean>;
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
      { id: 'grain', label: '그레인', min: 0, max: 100, value: 0 },
    ],
  },
  {
    id: 'detail',
    title: '디테일',
    controls: [
      { id: 'sharpening', label: '선명도', min: 0, max: 150, value: 0 },
      { id: 'luminanceNoise', label: '휘도 노이즈 감소', min: 0, max: 100, value: 0 },
      { id: 'colorNoise', label: '색상 노이즈 감소', min: 0, max: 100, value: 0 },
    ],
  },
  {
    id: 'optics',
    title: '아티팩트 감소',
    controls: [
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

function buildEditParams(sections: ToolSection[], curves: Curves): EditParams {
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
    removeCa: false,
    lensCorrection: false,
    moire: sliderValue(sections, 'moire'),
    defringe: sliderValue(sections, 'defringe'),
    curves,
    crop: { enabled: false, ratio: '원본', rotation: 0 },
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

function App() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewQuality, setPreviewQuality] = useState<'proxy' | 'original' | null>(null);
  const [statusMessage, setStatusMessage] = useState('이미지를 열어 편집을 시작하세요.');
  const [viewportPixels, setViewportPixels] = useState({ width: 1280, height: 960 });
  const [sections, setSections] = useState<ToolSection[]>(editSections);
  const [curves, setCurves] = useState<Curves>(identityCurves);
  const [renderQuality, setRenderQuality] = useState<'proxy' | 'original'>('original');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ path: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ imageId: number; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const panStart = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const engineRequestId = useRef(0);
  const generatedPreviewUrl = useRef<string | null>(null);
  const sharedPreviewPort = useRef<MessagePort | null>(null);
  const sharedPreviewRequests = useRef(new Map<number, {
    resolve: (value: SharedPreviewResult) => void;
    reject: (reason: Error) => void;
  }>());
  const [sharedPreviewReady, setSharedPreviewReady] = useState(false);

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
  const editParams = useMemo(() => buildEditParams(sections, curves), [sections, curves]);
  const [renderParams, setRenderParams] = useState(editParams);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
      if (event.key !== 'Delete' || selectedImageId === null || isExporting) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      void removeImage(selectedImageId);
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
      return undefined;
    }

    let cancelled = false;
    const requestId = ++engineRequestId.current;
    const targetWidth = Math.max(1, Math.min(selectedImage.width, viewportPixels.width));
    const targetHeight = Math.max(1, Math.min(selectedImage.height, viewportPixels.height));

    const renderShared = (quality: 'proxy' | 'original') => new Promise<SharedPreviewResult>((resolve, reject) => {
      const port = sharedPreviewPort.current;
      if (!port) {
        reject(new Error('미리보기 채널이 준비되지 않았습니다.'));
        return;
      }
      sharedPreviewRequests.current.set(requestId, { resolve, reject });
      port.postMessage({
        type: 'render-shared-preview',
        request: {
          requestId,
          imageId: selectedImage.id,
          quality,
          params: renderParams,
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
      const packed = new Uint8ClampedArray(result.width * result.height * 4);
      const rowBytes = result.width * 4;
      for (let row = 0; row < result.height; row += 1) {
        packed.set(result.data.subarray(row * result.stride, row * result.stride + rowBytes), row * rowBytes);
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
      setPreviewUrl(url);
      setPreviewQuality(result.quality);
      setStatusMessage(result.quality === 'proxy' ? '빠른 미리보기' : '고품질 미리보기');
    };

    void (async () => {
      try {
        await display(await renderShared('proxy'));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        if (!cancelled) await display(await renderShared('original'));
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
  }, [selectedImage, renderParams, viewportPixels, renderQuality, sharedPreviewReady]);

  const openImages = async () => {
    try {
      const opened = await window.rawElectron.openImages();
      if (!opened.length) return;
      setImages((current) => {
        const ids = new Set(current.map((image) => image.id));
        return [...current, ...opened.filter((image) => !ids.has(image.id))];
      });
      setSelectedImageId(opened[0].id);
      setStatusMessage(`${opened.length}개 이미지를 열었습니다.`);
    } catch (error) {
      setStatusMessage(`파일 열기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addOpenedImages = (opened: ImageFile[]) => {
    if (!opened.length) return;
    setImages((current) => {
      const ids = new Set(current.map((image) => image.id));
      return [...current, ...opened.filter((image) => !ids.has(image.id))];
    });
    setSelectedImageId(opened[0].id);
    setStatusMessage(`${opened.length}개 이미지를 열었습니다.`);
  };

  const openDroppedImages = async (files: File[]) => {
    if (!files.length || isExporting) return;
    try {
      setStatusMessage('드롭한 이미지를 여는 중입니다…');
      addOpenedImages(await window.rawElectron.openDroppedImages(files));
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
      if (selectedImageId === imageId) {
        setSelectedImageId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
      }
      setContextMenu(null);
      setStatusMessage('이미지를 목록에서 제거했습니다. 원본 파일은 유지됩니다.');
    } catch (error) {
      setStatusMessage(`목록 제거 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const dragOutput = async (imageId: number, event: React.DragEvent) => {
    if (isExporting) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    setStatusMessage('드래그 출력 파일을 준비하는 중입니다…');
    try {
      await window.rawElectron.dragExportImage(imageId, editParams, exportFormat);
      setStatusMessage(`${exportFormat.toUpperCase()} 파일을 드래그해 내보냈습니다.`);
    } catch (error) {
      setStatusMessage(`드래그 출력 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    setSections(editSections);
    setCurves(identityCurves);
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
    if (!selectedImage) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    changeZoom(zoom * factor);
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

      <main className="workspace">
        <aside className="library">
          <div className="pane-heading">
            <strong>열린 이미지</strong>
            <button onClick={openImages}>추가</button>
          </div>
          <div className="image-list">
            {!images.length && <p className="empty-note">열린 이미지가 없습니다.</p>}
            {images.map((image) => (
              <button
                key={image.id}
                className={`image-item ${image.id === selectedImageId ? 'selected' : ''}`}
                draggable
                onClick={() => setSelectedImageId(image.id)}
                onDragStart={(event) => {
                  setSelectedImageId(image.id);
                  void dragOutput(image.id, event);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setSelectedImageId(image.id);
                  setContextMenu({ imageId: image.id, x: event.clientX, y: event.clientY });
                }}
              >
                <span className="image-name">{image.name}</span>
                <span>{image.width} × {image.height}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="viewer">
          <div
            className={`canvas ${isSpacePressed ? 'pan-ready' : ''} ${isPanning ? 'panning' : ''}`}
            ref={canvasRef}
            onWheel={handleViewerWheel}
            onPointerDown={startPanning}
            onPointerMove={movePanning}
            onPointerUp={stopPanning}
            onPointerCancel={stopPanning}
            onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
          >
            {selectedImage ? (
              previewUrl
                ? <div
                    className="image-transform"
                    style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
                  >
                    <img
                      ref={previewImageRef}
                      src={previewUrl}
                      alt={selectedImage.name}
                      draggable={false}
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
            ) : (
              <div className="empty-state">
                <h1>편집할 이미지를 여세요</h1>
                <p>RAW와 일반 이미지 파일을 불러와 조정하고 다른 형식으로 저장할 수 있습니다.</p>
                <button className="button primary" onClick={openImages}>이미지 선택</button>
              </div>
            )}
          </div>
          <footer className="statusbar">
            <span>{statusMessage}</span>
            {selectedImage && <span>{selectedImage.width} × {selectedImage.height}px</span>}
            <div className="zoom-controls" aria-label="확대 축소">
              <button disabled={!selectedImage} onClick={() => changeZoom(zoom / 1.25)}>−</button>
              <button disabled={!selectedImage} onClick={() => changeZoom(1)}>화면 맞춤</button>
              <button disabled={!selectedImage} onClick={() => changeZoom(zoom * 1.25)}>+</button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>
            <button onClick={() => setShowLogs((current) => !current)}>
              {showLogs ? '로그 닫기' : `로그 ${debugLogs.length}`}
            </button>
          </footer>
        </section>

        <aside className="controls">
          <div className="controls-heading">
            <strong>기본 조정</strong>
            <span>실시간 미리보기</span>
          </div>
          <div className="control-scroll">
            <AdjustmentPanel
              sections={sections}
              curves={curves}
              onSlider={(sectionId, controlId, value) => {
                setRenderQuality('proxy');
                setSections((current) => updateSlider(current, sectionId, controlId, value));
              }}
              onCurveChange={(channel, points) => {
                setRenderQuality('proxy');
                setCurves((current) => ({ ...current, [channel]: points }));
              }}
            />
          </div>
          <div className="control-footer">
            <button className="button quiet" onClick={resetAll}>전체 초기화</button>
            <button className="button primary" disabled={!selectedImage} onClick={() => setRenderQuality('original')}>
              고품질 적용
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
          <button onClick={() => void removeImage(contextMenu.imageId)}>목록에서 제거</button>
          <span>Delete 키로도 제거할 수 있습니다.</span>
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

function portCleanup(port: MessagePort | null) {
  port?.close();
}

function AdjustmentPanel({
  sections,
  curves,
  onSlider,
  onCurveChange,
}: {
  sections: ToolSection[];
  curves: Curves;
  onSlider: (sectionId: ToolSectionId, controlId: string, value: number) => void;
  onCurveChange: (channel: CurveChannel, points: CurvePoint[]) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <section className="control-section" key={section.id}>
          <h2>{section.title}</h2>
          {section.id === 'light' && (
            <CurveEditor curves={curves} onChange={onCurveChange} />
          )}
          {section.controls.map((control) => (
            <SliderControl
              key={control.id}
              control={control}
              onChange={(value) => onSlider(section.id, control.id, value)}
            />
          ))}
        </section>
      ))}
    </>
  );
}

function CurveEditor({
  curves,
  onChange,
}: {
  curves: Curves;
  onChange: (channel: CurveChannel, points: CurvePoint[]) => void;
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
        <button className="curve-reset" onClick={() => onChange(channel, [])}>초기화</button>
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
          onChange(channel, [...points, position].sort((left, right) => left.x - right.x));
        }}
        onPointerMove={(event) => {
          if (dragPoint !== null) updatePoint(dragPoint, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
          setDragPoint(null);
        }}
        onPointerCancel={() => setDragPoint(null)}
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
              svgRef.current?.setPointerCapture(event.pointerId);
              setDragPoint(index);
              updatePoint(index, event.clientX, event.clientY);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onChange(channel, points.filter((_, pointIndex) => pointIndex !== index));
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

function SliderControl({ control, onChange }: { control: SliderOption; onChange: (value: number) => void }) {
  const displayValue = control.step && control.step < 1
    ? control.value.toFixed(1).replace('.0', '')
    : Math.round(control.value).toString();
  return (
    <label className="slider-control">
      <span><span>{control.label}</span><output>{displayValue}</output></span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step ?? 1}
        value={control.value}
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
