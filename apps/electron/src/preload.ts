import { contextBridge, ipcRenderer } from 'electron';

ipcRenderer.on('engine-preview-port', (event) => {
  const [port] = event.ports;
  if (port) window.postMessage({ type: 'engine-preview-port' }, '*', [port]);
});

contextBridge.exposeInMainWorld('rawElectron', {
  openImages: () => ipcRenderer.invoke('images:open'),
  exportImage: (imageId: number, params: unknown) =>
    ipcRenderer.invoke('images:export', imageId, params),
  connectPreviewPort: () => ipcRenderer.send('engine-preview-port:connect'),
  engineWorker: {
    renderPreview: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:render-preview', request),
    exportRenderedImage: (request: unknown) =>
      ipcRenderer.invoke('engine-worker:export-rendered-image', request),
  },
});
