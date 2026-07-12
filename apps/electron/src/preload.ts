import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rawElectron', {
  openImages: () => ipcRenderer.invoke('images:open'),
  exportImage: (sourcePath: string, params: unknown) =>
    ipcRenderer.invoke('images:export', sourcePath, params),
  engineWorker: {
    renderPreview: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:render-preview', request),
    exportRenderedImage: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:export-rendered-image', request),
  },
});
