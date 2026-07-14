import { parentPort } from 'node:worker_threads';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from '../shared/engineTypes';
import { loadNativeEngineAddon } from './nativeAddon';

type EngineCommand =
  | { id: number; type: 'openImage'; payload: { imagePath: string } }
  | { id: number; type: 'closeImage'; payload: { imageId: number } }
  | { id: number; type: 'renderPreview'; payload: EngineWorkerRenderRequest }
  | { id: number; type: 'renderPreviewFile'; payload: { request: EngineWorkerRenderRequest; outputPath: string } }
  | {
      id: number;
      type: 'renderPreviewShared';
      payload: { request: EngineWorkerRenderRequest; buffer: SharedArrayBuffer | ArrayBuffer };
    }
  | { id: number; type: 'exportImage'; payload: EngineWorkerExportRequest };

const port = parentPort;
const addon = loadNativeEngineAddon();

if (!port || !addon) {
  throw new Error('Engine worker could not load the native engine addon');
}

port.on('message', (command: EngineCommand) => {
  try {
    let result: unknown;
    let transferList: ArrayBuffer[] = [];

    switch (command.type) {
      case 'openImage':
        result = addon.openImage(command.payload.imagePath);
        break;
      case 'closeImage':
        result = addon.closeImage(command.payload.imageId);
        break;
      case 'renderPreview': {
        const preview = addon.renderPreview(command.payload);
        result = { ...preview, quality: command.payload.quality };
        transferList = [preview.data.buffer];
        break;
      }
      case 'renderPreviewShared': {
        const sharedPixels = new Uint8ClampedArray(command.payload.buffer);
        const preview = addon.renderPreviewInto(command.payload.request, {
          width: command.payload.request.preview.maxWidth,
          height: command.payload.request.preview.maxHeight,
          stride: command.payload.request.preview.maxWidth * 4,
          pixelFormat: 'rgba8',
          data: sharedPixels,
        });
        result = {
          requestId: preview.requestId,
          quality: command.payload.request.quality,
          width: preview.width,
          height: preview.height,
          stride: preview.stride,
          engine: preview.engine,
          data: command.payload.buffer instanceof SharedArrayBuffer ? undefined : sharedPixels,
        };
        break;
      }
      case 'renderPreviewFile':
        result = {
          ...addon.renderPreviewFile(command.payload.request, command.payload.outputPath),
          quality: command.payload.request.quality,
        };
        break;
      case 'exportImage':
        result = addon.exportRenderedImage(command.payload);
        break;
    }

    port.postMessage({ id: command.id, result }, transferList);
  } catch (error) {
    port.postMessage({
      id: command.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
