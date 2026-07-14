const path = require('node:path');
const { contextBridge } = require('electron');

const addon = require(path.resolve(__dirname, '..', 'native', 'build', 'Release', 'rawelectron_engine.node'));

contextBridge.exposeInMainWorld('previewTest', {
  render: async (imagePath, buffer) => {
    const opened = addon.openImage(imagePath);
    const result = addon.renderPreviewInto({
      requestId: 1,
      imageId: opened.id,
      quality: 'proxy',
      params: {},
      preview: { maxWidth: 1200, maxHeight: 800 },
    }, {
      width: 1200,
      height: 800,
      stride: 1200 * 4,
      pixelFormat: 'rgba8',
      data: new Uint8ClampedArray(buffer),
    });
    return { ...result, opened, nonZero: new Uint8ClampedArray(buffer).some(Boolean) };
  },
});
