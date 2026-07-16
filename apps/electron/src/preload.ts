import { contextBridge, ipcRenderer } from 'electron';
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
  exportImage: (imageId: number, params: unknown, format: unknown) =>
    ipcRenderer.invoke('images:export', imageId, params, format),
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
