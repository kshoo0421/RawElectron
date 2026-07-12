import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
  EngineWorkerRenderResponse,
} from '../shared/engineTypes';

type WorkerResponse = {
  id: number;
  result?: unknown;
  error?: string;
};

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

type NativePreview = {
  requestId: number;
  width: number;
  height: number;
  stride: number;
  data: Uint8ClampedArray;
  engine: 'cpp' | 'cpp-opencv';
};

export class EngineWorker {
  private readonly worker = new Worker(path.join(__dirname, 'engineHost.js'));
  private readonly pending = new Map<number, PendingCommand>();
  private readonly imagePaths = new Map<number, string>();
  private nextCommandId = 1;

  constructor() {
    this.worker.on('message', (message: WorkerResponse) => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.result);
      }
    });
    this.worker.on('error', (error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  private call<T>(type: string, payload: unknown): Promise<T> {
    const id = this.nextCommandId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async openImage(imagePath: string): Promise<number> {
    const imageId = await this.call<number>('openImage', { imagePath });
    this.imagePaths.set(imageId, imagePath);
    return imageId;
  }

  async closeImage(imageId: number): Promise<void> {
    await this.call<boolean>('closeImage', { imageId });
    this.imagePaths.delete(imageId);
  }

  getImagePath(imageId: number): string {
    const imagePath = this.imagePaths.get(imageId);
    if (!imagePath) throw new Error(`ImageId was not found: ${imageId}`);
    return imagePath;
  }

  async renderPreview(request: EngineWorkerRenderRequest): Promise<EngineWorkerRenderResponse> {
    const response = await this.call<NativePreview>('renderPreview', request);
    return {
      requestId: response.requestId,
      bitmap: {
        width: response.width,
        height: response.height,
        stride: response.stride,
        pixelFormat: 'rgba8',
        data: response.data,
      },
      engine: response.engine,
    };
  }

  exportRenderedImage(request: EngineWorkerExportRequest) {
    return this.call<{ path: string }>('exportImage', request);
  }

  async dispose(): Promise<void> {
    await this.worker.terminate();
  }
}
