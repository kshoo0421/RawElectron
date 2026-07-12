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
        result = preview;
        transferList = [preview.data.buffer];
        break;
      }
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
