import { contextBridge, ipcRenderer } from 'electron';
import type { DebugLogEntry } from './shared/engineTypes';

contextBridge.exposeInMainWorld('rawElectron', {
  openImages: () => ipcRenderer.invoke('images:open'),
  exportImage: (imageId: number, params: unknown) =>
    ipcRenderer.invoke('images:export', imageId, params),
  renderPreviewFile: (request: unknown) =>
    ipcRenderer.invoke('engine-preview-file:render', request),
  getDebugLogs: (): Promise<DebugLogEntry[]> => ipcRenderer.invoke('debug-logs:list'),
  onDebugLog: (callback: (entry: DebugLogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: DebugLogEntry) => callback(entry);
    ipcRenderer.on('debug-log:entry', listener);
    return () => ipcRenderer.removeListener('debug-log:entry', listener);
  },
  engineWorker: {
    exportRenderedImage: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:export-rendered-image', request),
  },
});
