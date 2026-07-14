import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from '../shared/engineTypes';
import type { OpenedImage } from './nativeAddon';

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
  quality: 'proxy' | 'original';
  width: number;
  height: number;
  stride: number;
  data: Uint8ClampedArray;
  engine: 'cpp' | 'cpp-opencv';
};

export type SharedPreviewResult = Omit<NativePreview, 'data'> & { data?: Uint8ClampedArray };

class WorkerClient {
  private readonly worker = new Worker(path.join(__dirname, 'engineHost.js'));
  private readonly pending = new Map<number, PendingCommand>();
  private nextCommandId = 1;

  constructor() {
    this.worker.on('message', (message: WorkerResponse) => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
    this.worker.on('error', (error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  call<T>(type: string, payload: unknown): Promise<T> {
    const id = this.nextCommandId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  terminate() {
    return this.worker.terminate();
  }
}

export class EngineWorker {
  private readonly interactiveWorker = new WorkerClient();
  private readonly originalWorker = new WorkerClient();
  private readonly imagePaths = new Map<number, string>();

  private call<T>(type: string, payload: unknown): Promise<T> {
    return this.interactiveWorker.call<T>(type, payload);
  }

  async openImage(imagePath: string): Promise<OpenedImage> {
    const image = await this.call<OpenedImage>('openImage', { imagePath });
    this.imagePaths.set(image.id, imagePath);
    return image;
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

  renderPreviewShared(request: EngineWorkerRenderRequest, buffer: SharedArrayBuffer | ArrayBuffer) {
    const worker = request.quality === 'original' ? this.originalWorker : this.interactiveWorker;
    return worker.call<SharedPreviewResult>('renderPreviewShared', { request, buffer });
  }

  renderPreviewFile(request: EngineWorkerRenderRequest, outputPath: string) {
    const worker = request.quality === 'original' ? this.originalWorker : this.interactiveWorker;
    return worker.call<{ requestId: number; quality: 'proxy' | 'original'; width: number; height: number }>(
      'renderPreviewFile',
      { request, outputPath },
    );
  }

  exportRenderedImage(request: EngineWorkerExportRequest) {
    return this.call<{ path: string }>('exportImage', request);
  }

  async dispose(): Promise<void> {
    await Promise.all([this.interactiveWorker.terminate(), this.originalWorker.terminate()]);
  }
}
