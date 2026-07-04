import { createRequire } from 'node:module';
import path from 'node:path';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from '../shared/engineTypes';

type NativeRenderResponse = {
  requestId: number;
  imageBuffer: Buffer;
  mimeType: string;
  engine: 'cpp';
};

type NativeEngineAddon = {
  renderPreview: (request: EngineWorkerRenderRequest) => NativeRenderResponse;
  exportRenderedImage: (request: EngineWorkerExportRequest) => { path: string };
};

const requireNative = createRequire(import.meta.url);

const nativeAddonPaths = [
  path.join(process.cwd(), 'native', 'build', 'Release', 'rawelectron_engine.node'),
  path.join(process.cwd(), 'native', 'build', 'Debug', 'rawelectron_engine.node'),
  path.join(__dirname, '..', '..', 'native', 'build', 'Release', 'rawelectron_engine.node'),
  path.join(__dirname, '..', '..', 'native', 'build', 'Debug', 'rawelectron_engine.node'),
];

export function loadNativeEngineAddon(): NativeEngineAddon | null {
  for (const addonPath of nativeAddonPaths) {
    try {
      return requireNative(addonPath) as NativeEngineAddon;
    } catch {
      // Try the next known development/package path.
    }
  }

  return null;
}
