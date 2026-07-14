import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rawElectron', {
  openImages: () => ipcRenderer.invoke('images:open'),
  exportImage: (imageId: number, params: unknown) =>
    ipcRenderer.invoke('images:export', imageId, params),
  renderPreviewFile: (request: unknown) =>
    ipcRenderer.invoke('engine-preview-file:render', request),
  engineWorker: {
    exportRenderedImage: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:export-rendered-image', request),
  },
});
