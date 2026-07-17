import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DebugLogEntry } from './shared/engineTypes';

ipcRenderer.on('shared-preview-port', (event) => {
  const [port] = event.ports;
  if (port) {
    ipcRenderer.send('debug-logs:report-info', {
      source: '공유 메모리',
      message: 'preload가 공유 메모리 채널을 받아 UI로 전달했습니다.',
    });
    window.postMessage({ type: 'shared-preview-port' }, '*', [port]);
  }
});

contextBridge.exposeInMainWorld('rawElectron', {
  openImages: () => ipcRenderer.invoke('images:open'),
  openDroppedImages: (files: File[]) =>
    ipcRenderer.invoke('images:open-paths', files.map((file) => webUtils.getPathForFile(file))),
  closeImage: (imageId: number) => ipcRenderer.invoke('images:close', imageId),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  openLibraryEntry: (filePath: string) => ipcRenderer.invoke('library:open-entry', filePath),
  saveLibrary: (state: unknown) => ipcRenderer.invoke('library:save', state),
  loadEditState: (imageId: number) => ipcRenderer.invoke('edit-state:load', imageId),
  saveEditState: (imageId: number, state: unknown) => ipcRenderer.invoke('edit-state:save', imageId, state),
  importXmpPreset: () => ipcRenderer.invoke('presets:import-xmp'),
  exportXmpPreset: (values: unknown) => ipcRenderer.invoke('presets:export-xmp', values),
  exportImage: (imageId: number, params: unknown, format: unknown) =>
    ipcRenderer.invoke('images:export', imageId, params, format),
  dragExportImage: (imageId: number, params: unknown, format: unknown) =>
    ipcRenderer.invoke('images:drag-export', imageId, params, format),
  renderPreviewFile: (request: unknown) =>
    ipcRenderer.invoke('engine-preview-file:render', request),
  getDebugLogs: (): Promise<DebugLogEntry[]> => ipcRenderer.invoke('debug-logs:list'),
  onDebugLog: (callback: (entry: DebugLogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: DebugLogEntry) => callback(entry);
    ipcRenderer.on('debug-log:entry', listener);
    return () => ipcRenderer.removeListener('debug-log:entry', listener);
  },
  requestSharedPreviewChannel: () => ipcRenderer.send('shared-preview:connect'),
  reportDebugError: (source: string, message: string) =>
    ipcRenderer.send('debug-logs:report-error', { source, message }),
  engineWorker: {
    exportRenderedImage: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:export-rendered-image', request),
  },
});
