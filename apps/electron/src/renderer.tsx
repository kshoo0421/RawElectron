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
      exportImage: (
        imageId: number,
        params: EditParams,
        format: ExportFormat,
      ) => Promise<{ canceled: boolean; path?: string }>;
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

function buildEditParams(sections: ToolSection[]): EditParams {
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
  const [renderQuality, setRenderQuality] = useState<'proxy' | 'original'>('original');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg');
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRequestId = useRef(0);
  const generatedPreviewUrl = useRef<string | null>(null);
  const sharedPreviewPort = useRef<MessagePort | null>(null);
  const sharedPreviewRequests = useRef(new Map<number, {
    resolve: (value: SharedPreviewResult) => void;
    reject: (reason: Error) => void;
  }>());
  const [sharedPreviewReady, setSharedPreviewReady] = useState(false);

  const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
  const editParams = useMemo(() => buildEditParams(sections), [sections]);
  const [renderParams, setRenderParams] = useState(editParams);

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

  const exportImage = async () => {
    if (!selectedImage) return;
    try {
      const result = await window.rawElectron.exportImage(selectedImage.id, editParams, exportFormat);
      if (!result.canceled) setStatusMessage(`저장 완료: ${result.path ?? ''}`);
    } catch (error) {
      setStatusMessage(`내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const resetAll = () => {
    setSections(editSections);
    setRenderQuality('original');
    setStatusMessage('모든 조정을 초기화했습니다.');
  };

  return (
    <div className="raw-app" data-theme={theme} data-logs={showLogs}>
      <header className="app-header">
        <div className="brand">
          <strong>RawElectron</strong>
          <span>{selectedImage ? selectedImage.name : '이미지 편집기'}</span>
        </div>
        <div className="header-actions">
          <button className="button" onClick={openImages}>파일 열기</button>
          <label className="format-select">
            <span>저장 형식</span>
            <select
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
          <button className="button primary" disabled={!selectedImage} onClick={exportImage}>다른 이름으로 저장</button>
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
                onClick={() => setSelectedImageId(image.id)}
              >
                <span className="image-name">{image.name}</span>
                <span>{image.width} × {image.height}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="viewer">
          <div className="canvas" ref={canvasRef}>
            {selectedImage ? (
              previewUrl
                ? <img src={previewUrl} alt={selectedImage.name} onLoad={() => {
                    if (previewQuality) sharedPreviewPort.current?.postMessage({
                      type: 'shared-preview-displayed',
                      imageId: selectedImage.id,
                      quality: previewQuality,
                    });
                  }} />
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
              onSlider={(sectionId, controlId, value) => {
                setRenderQuality('proxy');
                setSections((current) => updateSlider(current, sectionId, controlId, value));
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
    </div>
  );
}

function portCleanup(port: MessagePort | null) {
  port?.close();
}

function AdjustmentPanel({
  sections,
  onSlider,
}: {
  sections: ToolSection[];
  onSlider: (sectionId: ToolSectionId, controlId: string, value: number) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <section className="control-section" key={section.id}>
          <h2>{section.title}</h2>
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
