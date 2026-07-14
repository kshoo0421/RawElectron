const { ipcRenderer } = require('electron');

ipcRenderer.on('test-preview-port', (event) => {
  const [port] = event.ports;
  if (port) window.postMessage({ type: 'test-preview-port' }, '*', [port]);
});
