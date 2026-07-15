const { spawnSync } = require('node:child_process');
const Module = require('node:module');

if (process.platform === 'darwin') {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const parentFile = parent?.filename ?? '';
    if (
      request === './unzip'
      && parentFile.endsWith('/@electron/packager/dist/packager.js')
    ) {
      return {
        async extractElectronZip(zipPath, targetDir) {
          const result = spawnSync('unzip', ['-q', zipPath, '-d', targetDir], {
            stdio: 'inherit',
          });

          if (result.error) {
            throw result.error;
          }
          if (result.status !== 0) {
            throw new Error(`unzip failed with exit code ${result.status}`);
          }
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };
}
