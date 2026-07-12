import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type {
  EngineWorkerExportRequest,
  EngineWorkerRenderRequest,
} from '../shared/engineTypes';

type NativeRenderResponse = {
  requestId: number;
  width: number;
  height: number;
  stride: number;
  data: Uint8ClampedArray;
  engine: 'cpp' | 'cpp-opencv';
};

export type SharedBitmap = {
  width: number;
  height: number;
  stride: number;
  pixelFormat: 'rgba8';
  data: Uint8ClampedArray;
};

type NativeEngineAddon = {
  getEngineInfo: () => { name: string; apiVersion: string; ready: boolean };
  openImage: (path: string) => number;
  closeImage: (imageId: number) => boolean;
  createSharedBitmap: (width: number, height: number) => SharedBitmap;
  fillSharedBitmap: (bitmap: SharedBitmap, rgba: number) => SharedBitmap;
  checksumSharedBitmap: (bitmap: SharedBitmap) => number;
  renderPreview: (request: EngineWorkerRenderRequest) => NativeRenderResponse;
  exportRenderedImage: (request: EngineWorkerExportRequest) => { path: string };
};

const requireNative = createRequire(import.meta.url);
const packagedResourcesPath = typeof process.resourcesPath === 'string'
  ? process.resourcesPath
  : null;

const nativeRuntimeDllPaths = [
  ...(packagedResourcesPath ? [packagedResourcesPath] : []),
  path.join(process.cwd(), '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin'),
  path.join(process.cwd(), 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin'),
  path.join(__dirname, '..', '..', '..', '..', '..', 'third_party', 'opencv', 'install', 'x64', 'vc17', 'bin'),
];

const nativeAddonPaths = [
  ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'rawelectron_engine.node')] : []),
  path.join(process.cwd(), 'native', 'build', 'Release', 'rawelectron_engine.node'),
  path.join(process.cwd(), 'native', 'build', 'Debug', 'rawelectron_engine.node'),
  path.join(__dirname, '..', '..', 'native', 'build', 'Release', 'rawelectron_engine.node'),
  path.join(__dirname, '..', '..', 'native', 'build', 'Debug', 'rawelectron_engine.node'),
];

function addNativeRuntimeDllPaths() {
  const currentPath = process.env.PATH ?? '';
  const currentEntries = new Set(currentPath.split(path.delimiter).filter(Boolean));
  const existingDllPaths = nativeRuntimeDllPaths.filter((dllPath) => existsSync(dllPath));
  const missingDllPaths = existingDllPaths.filter((dllPath) => !currentEntries.has(dllPath));

  if (missingDllPaths.length) {
    process.env.PATH = [...missingDllPaths, currentPath].filter(Boolean).join(path.delimiter);
  }
}

export function loadNativeEngineAddon(): NativeEngineAddon | null {
  addNativeRuntimeDllPaths();

  for (const addonPath of nativeAddonPaths) {
    try {
      return requireNative(addonPath) as NativeEngineAddon;
    } catch {
      // Try the next known development/package path.
    }
  }

  return null;
}
