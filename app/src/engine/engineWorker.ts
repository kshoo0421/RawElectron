import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
  EngineWorkerRenderResponse,
} from '../shared/engineTypes';
import { loadNativeEngineAddon } from './nativeAddon';

const imageMimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

async function imagePathToDataUrl(filePath: string) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = imageMimeTypes[extension] ?? 'application/octet-stream';

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export class EngineWorker {
  private readonly nativeAddon = loadNativeEngineAddon();

  async renderPreview(request: EngineWorkerRenderRequest): Promise<EngineWorkerRenderResponse> {
    if (this.nativeAddon) {
      const response = this.nativeAddon.renderPreview(request);

      return {
        requestId: response.requestId,
        imageUrl: `data:${response.mimeType};base64,${response.imageBuffer.toString('base64')}`,
        engine: response.engine,
      };
    }

    return {
      requestId: request.requestId,
      imageUrl: await imagePathToDataUrl(request.imagePath),
      engine: 'stub',
    };
  }

  async exportRenderedImage(request: EngineWorkerExportRequest) {
    if (this.nativeAddon) {
      return this.nativeAddon.exportRenderedImage(request);
    }

    await copyFile(request.imagePath, request.outputPath);
    return { path: request.outputPath };
  }
}
