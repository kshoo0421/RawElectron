import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const findNativeRuntimeLibraries = (root: string): string[] => {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(entryPath);
      else if (/^opencv_.*\.dll$/i.test(entry.name) || /^libopencv_.*\.(dylib|so(?:\..*)?)$/i.test(entry.name)) {
        results.push(entryPath);
      }
    }
  }
  return results;
};

const opencvInstallRoot = path.resolve(__dirname, '..', '..', 'third_party', 'opencv', 'install');
const packagedLocales = new Set(['ko.pak', 'en-US.pak']);

const prunePackagedLocales = (outputPath: string): void => {
  const queue = [outputPath];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (
        path.basename(current).toLowerCase() === 'locales'
        && entry.name.endsWith('.pak')
        && !packagedLocales.has(entry.name)
      ) {
        fs.rmSync(entryPath);
      }
    }
  }
};

const nativeResourceCandidates = [
  path.resolve(__dirname, 'native', 'build', 'Release', 'rawelectron_engine.node'),
  path.resolve(__dirname, '..', '..', 'third_party', 'libraw', 'buildfiles', 'release-x86_64', 'libraw.dll'),
  ...findNativeRuntimeLibraries(opencvInstallRoot),
].filter((resourcePath) => fs.existsSync(resourcePath));

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    prune: true,
    appBundleId: 'com.rawelectron.app',
    executableName: 'RawElectron',
    osxSign: {
      identity: '-',
    },
    extraResource: nativeResourceCandidates,
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      // Electron Packager ships every Chromium locale by default. The UI only
      // supports Korean and English, so remove the other packs before making.
      for (const outputPath of packageResult.outputPaths) {
        prunePackagedLocales(outputPath);
      }

      if (process.platform !== 'darwin' || packageResult.platform !== 'darwin') return;

      for (const outputPath of packageResult.outputPaths) {
        const appPath = path.join(outputPath, 'rawelectron.app');
        if (!fs.existsSync(appPath)) continue;

        const result = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
          stdio: 'inherit',
        });
        if (result.error) throw result.error;
        if (result.status !== 0) {
          throw new Error(`codesign failed for ${appPath} with exit code ${result.status}`);
        }
      }
    },
  },
  makers: [
    new MakerZIP({}, ['win32', 'darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/engine/engineHost.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
